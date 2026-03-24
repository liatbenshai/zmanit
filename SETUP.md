# 📅 הגדרת Google Calendar - Vercel

## 📁 שלב 1: העתקת קבצים

### 1.1 קבצי API
העתיקי את התיקייה `api/` לשורש הפרויקט שלך:
```
zmanit/
├── api/                          ← תיקייה חדשה
│   ├── google-auth.js
│   └── sync-google-calendar.js
├── src/
│   └── ...
```

### 1.2 קבצי קוד
החליפי/הוסיפי:
- `src/hooks/useGoogleCalendar.js` ← החליפי את הקיים
- `src/pages/GoogleCallback.jsx` ← הוסיפי

### 1.3 עדכון Router
ב-`App.jsx` הוסיפי את ה-route:

```jsx
import GoogleCallback from './pages/GoogleCallback';

// בתוך ה-Routes:
<Route path="/auth/google/callback" element={<GoogleCallback />} />
```

---

## ⚙️ שלב 2: הגדרת Environment Variables ב-Vercel

1. לכי ל: https://vercel.com/dashboard
2. בחרי את הפרויקט **zmanit**
3. לכי ל: **Settings → Environment Variables**
4. הוסיפי את המשתנים הבאים:

| Name | Value |
|------|-------|
| `GOOGLE_CLIENT_ID` | `817535440248-c3bfvtta658ogdjdk473brbecumhs182.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `[ה-SECRET שלך מ-Google Cloud Console]` |
| `SUPABASE_SERVICE_ROLE_KEY` | `[מ-Supabase Dashboard → Settings → API → service_role]` |

⚠️ **חשוב**: ודאי שכל המשתנים מסומנים לכל ה-Environments (Production, Preview, Development)

---

## 🔑 שלב 3: קבלת SUPABASE_SERVICE_ROLE_KEY

1. לכי ל: **Supabase Dashboard**
2. בחרי את הפרויקט
3. לכי ל: **Settings → API**
4. העתיקי את **service_role (secret)**

⚠️ זה מפתח סודי! אל תשימי אותו בקוד, רק ב-Vercel Environment Variables

---

## 🚀 שלב 4: Deploy

1. עשי commit ו-push ל-GitHub:
```bash
git add .
git commit -m "Add Google Calendar integration"
git push
```

2. Vercel יעשה deploy אוטומטי

---

## ✅ שלב 5: בדיקה

1. לכי ל: https://zmanit.vercel.app
2. בתצוגה יומית, לחצי על "התחבר ליומן גוגל"
3. אשרי את ההרשאות ב-popup
4. ✅ אמור להופיע "מחובר ליומן גוגל"

---

## 🔄 מה השתנה?

| לפני | אחרי |
|------|------|
| טוקן נשמר ב-localStorage | טוקן נשמר בדאטהבייס |
| פג אחרי שעה | מתחדש אוטומטית |
| לא עובד בין מכשירים | עובד בכל מקום |
| אירועים לא נשמרים | אירועים מסונכרנים לדאטהבייס |

---

## 🐛 פתרון בעיות

### "Not authenticated"
- ודאי שאת מחוברת לאפליקציה

### "Not connected to Google"
- לחצי על "התחבר ליומן גוגל"

### "Token expired - please reconnect"
- התנתקי והתחברי מחדש

### שגיאה 500 ב-API
- ודאי שכל ה-Environment Variables מוגדרים ב-Vercel
- בדקי את הלוגים ב-Vercel: Functions → Logs

---

## 📋 רשימת קבצים

```
api/
├── google-auth.js           # אימות מול גוגל
└── sync-google-calendar.js  # סנכרון אירועים

src/
├── hooks/
│   └── useGoogleCalendar.js # Hook מעודכן
└── pages/
    └── GoogleCallback.jsx   # דף callback
```
