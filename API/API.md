# Rating System — API Contract

> هاد الملف هو "الاتفاق" بين الباك اند والفرونت اند.
> الفرونت بيشتغل على هاي الأشكال ببيانات وهمية لحد ما يجهز الباك اند.
> أي تغيير على endpoint لازم يتعدل هون أول، ويتبلغ فيه الفريق.

Base URL (local): `http://localhost:3000/api`

Auth: بعد تسجيل الدخول السيرفر برجع token، والفرونت بيبعته بكل طلب بالـ header:
`Authorization: Bearer <token>`

Rate limits — إذا انتجاوزوا، السيرفر بيرجّع `429` مع `{ "error": "...", "retryAfterSeconds": 60 }`:
- `POST /api/auth/login`: 10 محاولات كل 15 دقيقة لنفس الاسم من نفس الجهاز
- `POST /api/ratings`: 20 طلب بالدقيقة
- كل الـ API: 300 طلب بالدقيقة

---

## 1. Auth

### POST /api/auth/login
Request:
```json
{ "login": "ahmad", "password": "123456" }
```
Response 200:
```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": "u_1", "login": "ahmad", "name": "Ahmad Ali", "role": "STUDENT" }
}
```
Response 401:
```json
{ "error": "Wrong login or password" }
```

### GET /api/auth/me
Response 200:
```json
{ "id": "u_1", "login": "ahmad", "name": "Ahmad Ali", "role": "STUDENT" }
```

---

## 2. Student (role = STUDENT)

### GET /api/me/rating
متوسط تقييمه فقط. بدون labels وبدون مين قيّمه.
```json
{ "average": 2.6, "visible": true }
```
إذا لسا ما وصله 3 تقييمات:
```json
{ "average": null, "visible": false, "message": "Your rating appears after 3 ratings" }
```

### GET /api/me/votes
```json
{ "used": 3, "min": 2, "max": 5, "remaining": 2 }
```

### GET /api/windows/current
```json
{
  "id": "w_1",
  "startsAt": "2026-11-05T09:00:00Z",
  "endsAt": "2026-11-07T21:00:00Z",
  "isOpen": true
}
```
إذا ما في تصويت مفتوح:
```json
{ "isOpen": false }
```

### GET /api/students?q=sara
بحث عن طالب بالاسم أو الـ intra login (بدون نفسه). بيرجّع أول 10 نتائج،
والـ login المطابق بالضبط بيطلع أول. ما بيرجّع أي تقييمات أو متوسطات.
- `q` لازم يكون حرفين على الأقل، وإلا بيرجّع 400: `{ "error": "Type at least 2 characters to search" }`
- بدون `q` بيرجّع كل الطلاب.
```json
[
  { "id": "u_2", "login": "sara", "name": "Sara Omar", "alreadyRated": false },
  { "id": "u_3", "login": "omar", "name": "Omar Khaled", "alreadyRated": true }
]
```

### GET /api/labels?stars=2
الـ labels المسموحة لهاد العدد من النجوم.
```json
[
  { "id": "l_1", "name": "Helpful", "severity": "POSITIVE" },
  { "id": "l_9", "name": "Late", "severity": "MINOR" }
]
```
severity = `POSITIVE` | `MINOR` | `SERIOUS`

### POST /api/ratings
Request:
```json
{
  "rateeId": "u_2",
  "stars": 1,
  "labelIds": ["l_15"],
  "explanation": "Was aggressive during the evaluation"
}
```
- `explanation` إجباري إذا stars = 1 وفي label من نوع SERIOUS.

Response 201:
```json
{ "id": "r_10", "remaining": 1 }
```
Errors 400:
```json
{ "error": "You already rated this student" }
{ "error": "No votes left" }
{ "error": "Voting window is closed" }
{ "error": "Label not allowed for this star level" }
{ "error": "Explanation is required for serious flags" }
```

---

## 3. Staff (role = STAFF) — أي طالب بيحاول يفتحهم بيرجعله 403

### GET /api/staff/overview
```json
{
  "window": { "id": "w_1", "endsAt": "2026-11-07T21:00:00Z" },
  "totalRatings": 120,
  "totalStudents": 40,
  "studentsWhoRated": 31,
  "studentsWhoDidNotRate": 9,
  "studentsBelowMinimum": 12,
  "openAbuseCases": 5
}
```

### GET /api/staff/students?q=khatib
كل الطلاب، أو بحث بالاسم أو الـ intra login إذا بعتت `q`.
```json
[
  { "id": "u_1", "login": "ahmad", "name": "Ahmad Ali", "average": 2.6,
    "ratingsReceived": 7, "votesGiven": 4 }
]
```

### GET /api/staff/students/:id
```json
{
  "student": { "id": "u_1", "login": "ahmad", "name": "Ahmad Ali", "average": 2.6 },
  "given": [
    { "ratingId": "r_1", "to": { "id": "u_2", "login": "sara" }, "stars": 3,
      "labels": ["Helpful"], "createdAt": "...", "invalidated": false }
  ],
  "received": [
    { "ratingId": "r_5", "from": { "id": "u_3", "login": "omar" }, "stars": 2,
      "labels": ["Late"], "createdAt": "...", "invalidated": false }
  ],
  "labelsReceived": [ { "name": "Helpful", "count": 4 }, { "name": "Late", "count": 1 } ]
}
```

### GET /api/staff/ratings?groupBy=label | stars | student
```json
[
  { "group": "Helpful", "count": 22, "ratings": [ /* ratings */ ] }
]
```

### GET /api/staff/windows/:id/participation
```json
{
  "minVotes": 2,
  "maxVotes": 5,
  "voted":        [ { "id": "u_1", "login": "ahmad", "name": "Ahmad Ali", "votesGiven": 4, "reachedMinimum": true } ],
  "notVoted":     [ { "id": "u_7", "login": "lina", "name": "Lina Haddad" } ],
  "belowMinimum": [ { "id": "u_7", "login": "lina", "name": "Lina Haddad", "votesGiven": 0, "reachedMinimum": false } ]
}
```

### Labels
- `GET    /api/staff/labels`
- `POST   /api/staff/labels`        body: `{ "name": "Late", "allowedStars": [1,2], "severity": "MINOR" }`
- `PATCH  /api/staff/labels/:id`    body: `{ "isActive": false }`
- `DELETE /api/staff/labels/:id`

### Voting windows
- `GET   /api/staff/windows`
- `POST  /api/staff/windows`        body: `{ "startsAt": "...", "endsAt": "...", "minVotes": 2, "maxVotes": 5 }`
- `PATCH /api/staff/windows/:id`    (تغيير الوقت أو min/max بأي وقت)

### GET /api/staff/export.csv
بيرجع ملف CSV للتحميل.

---

## 3.5 Leaderboard — "Top students"

الستاف بيشوف الترتيب الكامل دايماً، وهو اللي بيقرر إذا ووقتيش يشاركه مع الطلاب.
الترتيب حسب المتوسط (التقييمات المش ملغية)، وبيدخل فيه بس اللي عنده 3 تقييمات أو أكثر.

### GET /api/staff/leaderboard?windowId=...   (Staff)
```json
{
  "windows": [ { "id": "w_1", "title": "Week 1 voting", "shared": false } ],
  "window": {
    "id": "w_1", "title": "Week 1 voting",
    "shared": false, "topN": 10, "showAverages": true,
    "leaderboardTitle": "Top students of the week", "sharedAt": null
  },
  "minRatingsToRank": 3,
  "ranking": [
    { "rank": 1, "id": "u_5", "login": "faris", "name": "Faris Daher", "average": 2.75, "ratingsCount": 4 }
  ]
}
```

### PATCH /api/staff/leaderboard/:windowId   (Staff)
كل الحقول اختيارية:
```json
{ "shared": true, "topN": 10, "showAverages": true, "title": "Top students of the week" }
```
- `topN` من 1 لـ 100. و `title` من 1 لـ 80 حرف.
- `{ "shared": false }` بيخبّيها عن الطلاب.

### GET /api/leaderboard   (Student)
آخر لوحة شاركها الستاف، أول `topN` بس. ما فيها ids.
```json
{
  "shared": true,
  "title": "Top students of the week",
  "windowTitle": "Week 1 voting",
  "showAverages": true,
  "entries": [ { "rank": 1, "name": "Faris Daher", "average": 2.75, "isMe": false } ]
}
```
إذا الستاف ما شاركها: `{ "shared": false }`. وإذا `showAverages` = false، ما في `average`.

---

## 4. Abuse (Staff only)

### GET /api/staff/abuse
```json
[
  {
    "id": "c_1",
    "type": "REVENGE",
    "title": "Pair voting / revenge",
    "summary": "Ahmad and Sara rated each other 1 star within 4 minutes.",
    "severity": "HIGH",
    "status": "OPEN",
    "students": [ { "id": "u_1", "login": "ahmad" }, { "id": "u_2", "login": "sara" } ],
    "ratingIds": ["r_20", "r_21"],
    "detectedAt": "..."
  }
]
```
type = `BULK` | `REPEATED` | `GROUP` | `REVENGE` | `FRIENDS_BOOST` | `TOO_FAST` | `EXTREME_VOTER` | `MALICIOUS_SERIOUS`
severity = `LOW` | `MEDIUM` | `HIGH`
status = `OPEN` | `CONFIRMED` | `DISMISSED`

### POST /api/staff/abuse/:id/confirm
### POST /api/staff/abuse/:id/dismiss
### POST /api/staff/ratings/:id/invalidate
body: `{ "reason": "Confirmed revenge vote" }`
