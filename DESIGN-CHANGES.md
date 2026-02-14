# שינויי עיצוב — Zmanit

## סיכום
שיפור מקיף של העיצוב וחוויית המשתמש באפליקציית "זמנית", עם דגש על:
- טיפוגרפיה עברית מקצועית (פונט Rubik)
- היררכיה ויזואלית ברורה
- עקביות עיצובית בכל הרכיבים
- רספונסיביות (מחשב + מובייל)
- תמיכה מלאה ב-RTL ו-Dark Mode

---

## 1. פונט עברי מקצועי — Rubik

**הבעיה:** הפונט הקודם (Arial/Tahoma) נראה גנרי ולא מקצועי בעברית.

**השיפור:** הוספת פונט **Rubik** מ-Google Fonts — פונט שתוכנן במיוחד לעברית עם:
- קריאות מצוינת בכל הגדלים
- תמיכה מלאה בעברית ואנגלית
- משקלים מ-300 (דק) עד 800 (כבד)
- מראה מודרני ונקי

**קבצים:** `index.html`, `tailwind.config.js`, `globals.css`

---

## 2. מערכת צבעים ראשית (Primary Color)

**הבעיה:** לא היה צבע ראשי מוגדר — כל מקום השתמש ב-`blue-600` ישירות.

**השיפור:** הגדרת `primary` color scale (50-900) ב-Tailwind config, מאפשר שינוי קל של ערכת הצבעים בעתיד ממקום אחד.

**קובץ:** `tailwind.config.js`

---

## 3. סגנונות בסיס משופרים

**הבעיות:**
- `user-select: none` על body חסם בחירת טקסט בכל מקום
- כותרות בלי גודל ברירת מחדל רספונסיבי
- חוסר anti-aliasing לטקסט
- Scrollbar עבה מדי

**השיפורים:**
- בחירת טקסט מופעלת על כל התוכן (חוץ מכפתורים)
- גדלים רספונסיביים ל-h1/h2/h3
- Anti-aliased text rendering
- Scrollbar דק יותר (5px) עם hover effect
- Smooth scrolling מובנה
- `.text-gradient` — כלי לטקסט עם גרדיאנט
- `.badge` — רכיב תגית אחיד
- `.stat-card` — כרטיס סטטיסטיקה אחיד
- `.card-elevated` — כרטיס מודגש
- `.glass-bottom` — אפקט זכוכית לניווט תחתון

**קובץ:** `globals.css`

---

## 4. צלליות ואלוציה (Shadows)

**הבעיה:** שימוש לא עקבי ב-shadows — חלק מהכרטיסים עם `shadow-lg`, חלק `shadow-sm`.

**השיפור:** מערכת צלליות מדורגת:
- `shadow-card` — כרטיס רגיל (קלה מאוד)
- `shadow-card-hover` — כרטיס ב-hover
- `shadow-elevated` — רכיב מורם (מודלים, dropdowns)
- `shadow-nav` — ניווט תחתון

**קובץ:** `tailwind.config.js`

---

## 5. Header — ניווט משופר

**הבעיות:**
- שם גנרי "ניהול זמן" — לא ממותג
- ניווט דסקטופ ללא רקע — קשה לזהות מצב אקטיבי
- תפריט משתמש ללא אפקטים

**השיפורים:**
- לוגו ממותג **"זמנית"** עם אפקט גרדיאנט
- ניווט דסקטופ עם רקע שקוף ואנימציית "pill" (כמו iOS segmented control)
- אפקט זכוכית (glass) לכותרת שלמה
- אווטר משתמש עם גרדיאנט כחול-סגול
- תפריט dropdown עם מעבר צבע על הפריט הפעיל
- פינות מעוגלות יותר (rounded-xl)

**קובץ:** `Header.jsx`

---

## 6. MobileNav — ניווט תחתון

**הבעיות:**
- רקע אטום ללא עומק
- אינדיקטור פעיל גדול מדי (רקע מלא)
- font-size קטן מדי

**השיפורים:**
- אפקט זכוכית (glass-bottom) עם blur
- אינדיקטור פעיל כקו עליון דק (כמו iOS tab bar)
- טקסט 11px עם font-weight medium
- צל עליון עדין (shadow-nav)

**קובץ:** `MobileNav.jsx`

---

## 7. Dashboard — היררכיה ויזואלית

**הבעיות:**
- שעון ענק (text-5xl) שולט על המסך
- אזור ברכה גדול מדי — דוחף את התוכן למטה
- כפתורי דוחות כטקסט קטן — קשה ללחוץ במובייל
- חוסר padding-bottom לניווט תחתון

**השיפורים:**
- שעון קטן יותר (text-4xl) עם tracking רחב
- אזור ברכה קומפקטי
- כרטיס "דוחות וכלים" כגריד 3x2 עם אייקונים — הרבה יותר נגיש במובייל
- כפתורים עם active:scale feedback
- רקע גרדיאנט עדין יותר (via-white)
- pb-24 לפינוי מקום לניווט תחתון
- כרטיסים עם rounded-2xl עקבי

**קובץ:** `Dashboard.jsx`

---

## 8. DailyProgressCard — כרטיס התקדמות

**הבעיות:**
- רקע גרדיאנט בכותרת — לא מתאים ל-dark mode
- סטטיסטיקות עם רווחים גדולים — לא מנצלות את הרוחב
- badge קצב ללא רקע — קשה לקרוא

**השיפורים:**
- רקע נקי ללא גרדיאנט — מתאים לשני המצבים
- badge קצב עם רקע צבעוני (ירוק/אדום/כחול)
- סטטיסטיקות כ-grid ללא רווחים (gap-px) — נקי יותר
- שימוש ב-stat-card class לעקביות
- פס התקדמות עדין יותר (h-3 במקום h-4)
- טקסט עזרה קטן יותר (10px) — לא מסיח

**קובץ:** `DailyProgressCard.jsx`

---

## 9. TaskCard — כרטיס משימה

**הבעיות:**
- Checkbox קטן (20x20px) — קשה ללחוץ במובייל
- תגיות (badges) בשורה אחת עם הכותרת — עמוס
- פס התקדמות צבעוני מדי (ירוק/צהוב/כתום/אדום)
- כפתורי פעולה צפופים

**השיפורים:**
- Checkbox גדול יותר (24x24px) עם hover effect
- כותרת ותגיות בשורות נפרדות — נקי יותר
- תגיות עם badge class — אחידות
- פס התקדמות פשוט: כחול עד 75%, כתום מעל, אדום ב-100%
- פס דק יותר (h-1.5 במקום h-2)
- כפתורי פעולה עם rounded-lg ורווחים
- מעברים עדינים יותר (border-100 במקום border-200)
- hover effect עם shadow-card-hover

**קובץ:** `TaskCard.jsx`

---

## 10. Matrix & Quadrant — מטריצת אייזנהאואר

**הבעיות:**
- טאבים במובייל ללא גבולות — קשה להבחין
- מצב ריק בלנד
- פינות מעוגלות לא עקביות

**השיפורים:**
- טאבים במובייל עם border ו-shadow כשפעילים
- מצב ריק עם אייקון 📝 גדול
- rounded-2xl על הרבעים
- QuadrantHeader עם count badge עגול
- כפתור הוספה עגול
- scrollbar-hide על טאבים (נקי יותר)

**קבצים:** `Matrix.jsx`, `Quadrant.jsx`, `QuadrantHeader.jsx`

---

## 11. Modal — חלון קופץ

**הבעיות:**
- כותרת לא sticky — נעלמת בגלילה
- overflow-y-auto על כל המודל — כותרת נגללת

**השיפורים:**
- כותרת sticky (flex-shrink-0) — תמיד נראית
- תוכן scrollable בנפרד (flex-1 overflow-y-auto)
- צל elevated במקום xl
- padding מוגדל (px-5)
- כפתור סגירה עם rounded-xl

**קובץ:** `Modal.jsx`

---

## 12. Button — כפתור

**הבעיות:**
- חסר variant "outline"
- rounded-lg לא עקבי עם שאר האפליקציה

**השיפורים:**
- variant חדש: `outline` — כפתור עם מסגרת כחולה ללא רקע
- rounded-xl עקבי
- shadows על primary/danger/success
- border על secondary

**קובץ:** `Button.jsx`

---

## 13. Input — שדה קלט

**הבעיות:**
- שגיאה מוצגת כטקסט פשוט — לא בולטת
- מצב disabled לא ברור

**השיפורים:**
- שגיאה עם אייקון ⚠ ורקע אדמדם
- מצב disabled עם רקע אפור
- label עם margin-bottom גדול יותר

**קובץ:** `Input.jsx`

---

## אנימציות חדשות

- `shimmer` — אפקט נצנוץ לסקלטונים
- `progress` — אנימציית פס התקדמות

**קובץ:** `tailwind.config.js`

---

## רשימת קבצים שהשתנו

| קובץ | סוג שינוי |
|-------|-----------|
| `index.html` | הוספת Google Fonts (Rubik) |
| `tailwind.config.js` | צבע primary, shadows, אנימציות, פונט |
| `src/styles/globals.css` | סגנונות בסיס, רכיבים, utilities |
| `src/components/Layout/Header.jsx` | מיתוג, ניווט, אפקט זכוכית |
| `src/components/Layout/MobileNav.jsx` | אפקט זכוכית, אינדיקטור |
| `src/components/Dashboard/Dashboard.jsx` | היררכיה, גריד דוחות, spacing |
| `src/components/Dashboard/DailyProgressCard.jsx` | סטטיסטיקות, badges, spacing |
| `src/components/Tasks/TaskCard.jsx` | checkbox, tags, progress |
| `src/components/Matrix/Matrix.jsx` | טאבים במובייל |
| `src/components/Matrix/Quadrant.jsx` | מצב ריק, rounding |
| `src/components/Matrix/QuadrantHeader.jsx` | count badge, כפתור הוספה |
| `src/components/UI/Modal.jsx` | sticky header, scrollable content |
| `src/components/UI/Button.jsx` | outline variant, shadows |
| `src/components/UI/Input.jsx` | שגיאות, disabled state |
