/**
 * Google OAuth Callback Page
 * ==========================
 * דף זה נפתח ב-popup ומקבל את ה-authorization code מגוגל
 */

import { useEffect } from 'react';

function GoogleCallback() {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      if (window.opener) {
        window.opener.postMessage(
          { type: 'GOOGLE_AUTH_ERROR', error },
          window.location.origin
        );
      }
      window.close();
      return;
    }

    if (code) {
      if (window.opener) {
        window.opener.postMessage(
          { type: 'GOOGLE_AUTH_CODE', code },
          window.location.origin
        );
      }
      window.close();
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center p-8 bg-white rounded-xl shadow-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">
          מתחבר ליומן גוגל...
        </h1>
        <p className="text-gray-500">
          החלון יסגר אוטומטית
        </p>
      </div>
    </div>
  );
}

export default GoogleCallback;
