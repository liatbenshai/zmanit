/**
 * Google Auth API - Vercel Serverless Function
 * =============================================
 * /api/google-auth.js
 * 
 * מטפל באימות מול Google OAuth2
 */

import { createClient } from '@supabase/supabase-js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // בדיקת אימות המשתמש
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Supabase client עם service role
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Supabase client עם הטוקן של המשתמש
    const supabaseClient = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // קבלת פרטי המשתמש
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { action, code, redirect_uri } = req.body;

    // =============================================
    // פעולה: exchange - המרת קוד לטוקנים
    // =============================================
    if (action === 'exchange') {
      if (!code || !redirect_uri) {
        return res.status(400).json({ error: 'Missing code or redirect_uri' });
      }

      // בקשה לגוגל להמרת הקוד
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirect_uri,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        console.error('Google token error:', tokenData);
        return res.status(400).json({ error: `Google auth error: ${tokenData.error_description || tokenData.error}` });
      }

      // קבלת פרטי המשתמש מגוגל
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const googleUser = await userInfoResponse.json();

      // חישוב זמן תפוגה
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      // שמירה בדאטהבייס (upsert)
      const { error: upsertError } = await supabaseAdmin
        .from('user_google_tokens')
        .upsert({
          user_id: user.id,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          token_type: tokenData.token_type || 'Bearer',
          expires_at: expiresAt.toISOString(),
          google_email: googleUser.email,
          scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (upsertError) {
        console.error('Upsert error:', upsertError);
        return res.status(500).json({ error: 'Failed to save token' });
      }

      // לוג
      await supabaseAdmin.from('google_sync_log').insert({
        user_id: user.id,
        action: 'connect',
        success: true,
      });

      return res.status(200).json({
        success: true,
        email: googleUser.email,
        expires_at: expiresAt.toISOString(),
      });
    }

    // =============================================
    // פעולה: refresh - חידוש טוקן
    // =============================================
    if (action === 'refresh') {
      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from('user_google_tokens')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (tokenError || !tokenData) {
        return res.status(400).json({ error: 'No token found - please reconnect' });
      }

      if (!tokenData.refresh_token) {
        return res.status(400).json({ error: 'No refresh token - please reconnect with full permissions' });
      }

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: tokenData.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      const refreshData = await refreshResponse.json();

      if (refreshData.error) {
        if (refreshData.error === 'invalid_grant') {
          await supabaseAdmin
            .from('user_google_tokens')
            .delete()
            .eq('user_id', user.id);
          
          return res.status(400).json({ error: 'Token expired - please reconnect' });
        }
        return res.status(400).json({ error: `Refresh error: ${refreshData.error_description || refreshData.error}` });
      }

      const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000);

      await supabaseAdmin
        .from('user_google_tokens')
        .update({
          access_token: refreshData.access_token,
          expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      await supabaseAdmin.from('google_sync_log').insert({
        user_id: user.id,
        action: 'refresh_token',
        success: true,
      });

      return res.status(200).json({
        success: true,
        expires_at: newExpiresAt.toISOString(),
      });
    }

    // =============================================
    // פעולה: status - בדיקת מצב החיבור
    // =============================================
    if (action === 'status') {
      const { data: tokenData } = await supabaseAdmin
        .from('user_google_tokens')
        .select('expires_at, google_email, last_sync_at')
        .eq('user_id', user.id)
        .single();

      if (!tokenData) {
        return res.status(200).json({ connected: false });
      }

      const isExpired = new Date(tokenData.expires_at) < new Date();
      
      return res.status(200).json({
        connected: !isExpired,
        email: tokenData.google_email,
        expires_at: tokenData.expires_at,
        last_sync_at: tokenData.last_sync_at,
        needs_refresh: isExpired,
      });
    }

    // =============================================
    // פעולה: disconnect - ניתוק
    // =============================================
    if (action === 'disconnect') {
      await supabaseAdmin
        .from('user_google_tokens')
        .delete()
        .eq('user_id', user.id);

      await supabaseAdmin
        .from('google_calendar_events')
        .delete()
        .eq('user_id', user.id);

      await supabaseAdmin.from('google_sync_log').insert({
        user_id: user.id,
        action: 'disconnect',
        success: true,
      });

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
