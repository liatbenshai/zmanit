/**
 * Sync Google Calendar API - Vercel Serverless Function
 * ======================================================
 * /api/sync-google-calendar.js
 * 
 * מסנכרן אירועים מיומן גוגל לדאטהבייס
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
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const supabaseClient = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { action, start_date, end_date, calendar_id, task, scheduled_block } = req.body;

    // קבלת הטוקן מהדאטהבייס
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('user_google_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      return res.status(400).json({ error: 'Not connected to Google - please connect first' });
    }

    // בדיקה אם הטוקן פג ונסיון חידוש
    let accessToken = tokenData.access_token;
    if (new Date(tokenData.expires_at) < new Date()) {
      if (tokenData.refresh_token) {
        const refreshed = await refreshToken(tokenData.refresh_token, supabaseAdmin, user.id);
        if (refreshed) {
          accessToken = refreshed;
        } else {
          return res.status(400).json({ error: 'Token expired - please reconnect' });
        }
      } else {
        return res.status(400).json({ error: 'Token expired - please reconnect' });
      }
    }

    const calendarId = calendar_id || tokenData.default_calendar_id || 'primary';

    // =============================================
    // פעולה: import - ייבוא אירועים מגוגל
    // =============================================
    if (action === 'import') {
      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'Missing start_date or end_date' });
      }

      const timeMin = new Date(start_date).toISOString();
      const timeMax = new Date(end_date).toISOString();

      const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
        `timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100`;

      const eventsResponse = await fetch(eventsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!eventsResponse.ok) {
        const error = await eventsResponse.json();
        return res.status(400).json({ error: `Google API error: ${error.error?.message || 'Unknown error'}` });
      }

      const eventsData = await eventsResponse.json();
      const events = eventsData.items || [];

      const upsertData = events
        .filter(e => e.start?.dateTime)
        .map(event => ({
          user_id: user.id,
          google_event_id: event.id,
          calendar_id: calendarId,
          title: event.summary || 'אירוע ללא שם',
          description: event.description || null,
          location: event.location || null,
          start_time: event.start.dateTime,
          end_time: event.end.dateTime,
          is_all_day: false,
          status: event.status || 'confirmed',
          color_id: event.colorId || null,
          is_zmanit_export: event.extendedProperties?.private?.zmanitTaskId ? true : false,
          zmanit_task_id: event.extendedProperties?.private?.zmanitTaskId || null,
          synced_at: new Date().toISOString(),
        }));

      if (upsertData.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from('google_calendar_events')
          .upsert(upsertData, {
            onConflict: 'user_id,google_event_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error('Upsert error:', upsertError);
          return res.status(500).json({ error: 'Failed to save events' });
        }
      }

      await supabaseAdmin
        .from('user_google_tokens')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('user_id', user.id);

      await supabaseAdmin.from('google_sync_log').insert({
        user_id: user.id,
        action: 'import',
        success: true,
        events_count: upsertData.length,
      });

      return res.status(200).json({
        success: true,
        imported: upsertData.length,
        events: upsertData.map(e => ({
          id: e.google_event_id,
          title: e.title,
          start_time: e.start_time,
          end_time: e.end_time,
        }))
      });
    }

    // =============================================
    // פעולה: export - ייצוא משימה לגוגל
    // =============================================
    if (action === 'export') {
      if (!task || !scheduled_block) {
        return res.status(400).json({ error: 'Missing task or scheduled_block' });
      }

      const startDate = new Date(`${scheduled_block.date}T${scheduled_block.startTime}:00`);
      const endDate = new Date(startDate.getTime() + (scheduled_block.duration || task.estimated_duration || 30) * 60000);

      const event = {
        summary: `${getTaskIcon(task.task_type)} ${task.title}`,
        description: task.notes || `משימה מזמנית\nסוג: ${task.task_type || 'אחר'}`,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: 'Asia/Jerusalem',
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: 'Asia/Jerusalem',
        },
        colorId: getColorIdForType(task.task_type),
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 5 }],
        },
        extendedProperties: {
          private: {
            zmanitTaskId: task.id,
            zmanitType: task.task_type || 'other',
          },
        },
      };

      const createResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!createResponse.ok) {
        const error = await createResponse.json();
        return res.status(400).json({ error: `Failed to create event: ${error.error?.message || 'Unknown error'}` });
      }

      const createdEvent = await createResponse.json();

      await supabaseAdmin.from('google_calendar_events').upsert({
        user_id: user.id,
        google_event_id: createdEvent.id,
        calendar_id: calendarId,
        title: event.summary,
        description: event.description,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        is_all_day: false,
        status: 'confirmed',
        color_id: event.colorId,
        is_zmanit_export: true,
        zmanit_task_id: task.id,
        synced_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,google_event_id',
      });

      await supabaseAdmin.from('google_sync_log').insert({
        user_id: user.id,
        action: 'export',
        success: true,
        events_count: 1,
      });

      return res.status(200).json({
        success: true,
        event_id: createdEvent.id,
        event_link: createdEvent.htmlLink,
      });
    }

    // =============================================
    // פעולה: get_events - קבלת אירועים מהדאטהבייס
    // =============================================
    if (action === 'get_events') {
      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'Missing start_date or end_date' });
      }

      const { data: events, error: eventsError } = await supabaseAdmin
        .from('google_calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', start_date)
        .lt('start_time', end_date)
        .neq('status', 'cancelled')
        .order('start_time');

      if (eventsError) {
        return res.status(500).json({ error: 'Failed to fetch events' });
      }

      return res.status(200).json({
        success: true,
        events: events || [],
      });
    }

    // =============================================
    // פעולה: list_calendars - רשימת יומנים
    // =============================================
    if (action === 'list_calendars') {
      const calendarsResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!calendarsResponse.ok) {
        return res.status(400).json({ error: 'Failed to fetch calendars' });
      }

      const calendarsData = await calendarsResponse.json();

      return res.status(200).json({
        success: true,
        calendars: (calendarsData.items || []).map(c => ({
          id: c.id,
          summary: c.summary,
          primary: c.primary || false,
          backgroundColor: c.backgroundColor,
        })),
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// =============================================
// פונקציות עזר
// =============================================

async function refreshToken(refreshToken, supabaseAdmin, userId) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();

    if (data.error) {
      return null;
    }

    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    await supabaseAdmin
      .from('user_google_tokens')
      .update({
        access_token: data.access_token,
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return data.access_token;
  } catch (error) {
    console.error('Refresh token error:', error);
    return null;
  }
}

function getColorIdForType(type) {
  const colors = {
    transcription: '3',
    proofreading: '9',
    email: '7',
    course: '3',
    client_communication: '4',
    management: '6',
    family: '4',
    personal: '2',
    unexpected: '11',
    other: '8',
  };
  return colors[type] || '8';
}

function getTaskIcon(type) {
  const icons = {
    transcription: '🎙️',
    proofreading: '📝',
    email: '📧',
    course: '📚',
    client_communication: '💬',
    management: '👔',
    family: '👨‍👩‍👧‍👦',
    personal: '🧘',
    unexpected: '⚡',
    other: '📋',
  };
  return icons[type] || '📋';
}
