<div align="center">

# ★ 42 Amman · Peer Rank

**Rate fairly & grow together.**

A peer rating system for 42 Amman: students rate the people they worked with,
staff see how the cohort is doing, and suspicious votes get caught before they count.

**Live → https://rank.reactiveweb.dev**

</div>

---

## Contents

1. [Why Peer Rank](#why-peer-rank)
2. [How it works](#how-it-works)
3. [Features](#features)
4. [Abuse detection](#abuse-detection)
5. [Design](#design)
6. [Tech stack and architecture](#tech-stack-and-architecture)
7. [Project structure](#project-structure)
8. [Run it locally](#run-it-locally)
9. [Configuration](#configuration)
10. [Deploy on the VPS](#deploy-on-the-vps)
11. [Demo walkthrough](#demo-walkthrough)
12. [Team](#team)

---

## Why Peer Rank

At 42 there are no teachers: you learn from your peers. So your peers are the best people to say how you work in a team.

But peer ratings are easy to game. Friends boost each other, people take revenge for a bad rating, and groups gang up on one person. Peer Rank collects honest feedback, **detects the suspicious patterns**, and leaves the final decision to a human.

---

## How it works

```
 Staff open a voting window
           │
           ▼
 Students rate the peers they worked with
 (1–3 stars + labels + optional note)
           │
           ▼
 The API blocks obvious abuse
 (self-rating, double votes, closed window, spam)
           │
           ▼
 8 detectors flag suspicious patterns
           │
           ▼
 Staff review each case → confirm (and invalidate the ratings) or dismiss
           │
           ▼
 Staff publish the leaderboard when they choose
```

**Stars**

| ★ | ★★ | ★★★ |
|---|---|---|
| Needs work | Good | Excellent |

Each rating can carry **labels** that staff manage, positive (*Helpful*, *Clear explainer*, *Good teammate*…) or negative (*Rushed*, *Late*, *Disruptive*…). Every label has a severity (positive / minor / serious) and a set of star values it's allowed with.

---

## Features

### Students
- **Rate your peers**: search by name or intra login, pick stars with big animated stars (red, orange, green), add labels and a note.
- **Fair rules**: one vote per person per window, no self-rating, no votes when the window is closed.
- **Your rating**: see your own average and how many ratings you received, **never who rated you**.
- **Leaderboard**: appears only when staff share it, with a podium for the top 3 and an announcement card on the home page.
- **Nickname badge**: pick a short nickname and a pixel icon, shown next to your name across the app.
- **Light and dark mode**, and it works on mobile.

### Staff
| Page | What it's for |
|---|---|
| **Overview** | live countdown, participation %, total ratings, students below the minimum, open abuse cases |
| **Students** | search the cohort, sort by average, open a student to see every rating received and given |
| **Ratings** | browse all ratings by label, by stars, by student, or all of them |
| **Participation** | who voted, who didn't, who is below the minimum |
| **Abuse cases** | review flagged activity, then confirm or dismiss |
| **Leaderboard** | set the title, top 3 / 10 / 20, show or hide averages, share or unshare |
| **Labels** | create, edit and disable labels, set severity and allowed stars |
| **Voting windows** | open, close and extend rating periods |

Staff can also **invalidate** any single rating with a reason, and **export CSV** (protected against spreadsheet formula injection).

---

## Abuse detection

Three layers: **prevent → detect → a human decides.**

### 1. Prevent: the API refuses it
- No self-rating, one vote per pair per window, no votes outside an open window.
- Rate limits: **10** login attempts / 15 min, **20** ratings / min, **300** API calls / min.
- Every refused attempt is logged with its reason (`ALREADY_RATED`, `WINDOW_CLOSED`…), so even failed attempts become evidence.

### 2. Detect: 8 detectors

| # | Pattern | Rule | Severity |
|---|---|---|---|
| 1 | **Bulk votes** | 4+ ratings on the same student within 10 min | Medium · High at 8+ |
| 2 | **Repeated attempts** | 2+ extra tries to rate someone already rated | Medium · High at 6+ |
| 3 | **Group voting** | 3+ students give one person the exact same stars **and** labels within 30 min | High if 1 star |
| 4 | **Revenge / exchange** | A gives B a low rating, B answers with 1 star · or two students swap 3 stars within 10 min | High if revenge within 1 h · Low for exchange |
| 5 | **Friends boosting** | 3+ students who **all** gave each other 3 stars | Medium · High at 4+ |
| 6 | **Too fast** | 3+ ratings within 60 s, or 8+ attempts within 5 min | Medium / High |
| 7 | **Extreme voter** | 4+ ratings, all 1 star (or all 3 stars) | High / Low |
| 8 | **Malicious serious flag** | 1 star + a serious label, when others rate that person well, the reason is too short or copied, or nobody else reported anything | Medium · High if 2+ reasons |

How it works:
- **Friends boosting** builds a graph of mutual 3-star ratings and finds the groups where everyone is connected to everyone, using the **Bron–Kerbosch** algorithm.
- **Bulk, group and too-fast** use a **sliding time window** to find the densest burst of activity, not just a total count.
- Each case is written as a **plain-English sentence** with names. For example: *"Ali gave Sara 1 star, and Sara answered with 1 star 3 minutes later. This looks like revenge."*
- All thresholds live in one `RULES` object in `Backend/src/abuse/detectors.js`.
- Detection re-runs on each visit and **never overwrites a staff decision** (upsert on `case_key`). Invalidated ratings are ignored.

### 3. A human decides
The system never punishes anyone on its own. Three friends rating each other 3 stars can be cheating, or they might just be a great team. Staff **confirm** a case (optionally invalidating its ratings, which removes them from every average and from the leaderboard) or **dismiss** it. Every decision is stored with who made it and when.

---

## Design

- **The star is the identity.** It's in the login background, the rating picker, the podium and the announcement card.
- **42 colors only**:

| Navy | Turquoise | Yellow | Black | White |
|---|---|---|---|---|
| `#0b1d3a` | `#00babc` | `#ffc72c` | `#000000` | `#ffffff` |

- Fonts: Space Grotesk, JetBrains Mono and Silkscreen for the pixel accents.
- Pixel-art icons for navigation, labels and abuse cases.
- Light and dark themes. The saved choice is applied before the page loads, so there's no white flash.
- Motion is small and meaningful (star fill, headline reveal), and turned off for users who prefer reduced motion.
- Keyboard friendly: the star picker works with the arrow keys and is a proper `radiogroup`.

---

## Tech stack and architecture

| Layer | Tools |
|---|---|
| Frontend | React, Vite, React Router, plain CSS |
| Backend | Node.js, Express 5, plain SQL with `pg` |
| Database | PostgreSQL |
| Auth | bcrypt password hashes, JWT in `Authorization: Bearer`, role guards on every route (student / staff) |
| Deploy | Docker Compose, Traefik, HTTPS from Let's Encrypt |

```
 Browser ──HTTPS──▶ Traefik ──▶ app container (Express)
                                   ├── /api/*  → routes → PostgreSQL (db container, VPS-only)
                                   └── /*      → built React app
```

**Security**: rate limiting, security headers, `x-powered-by` off, 10 kb JSON body limit, `JWT_SECRET` must be 16+ characters, students never see who rated them, CSV formula-injection guard, and Postgres reachable only from the server itself.

**API**: the full contract between frontend and backend is in [`API/API.md`](API/API.md). It has route groups for auth, student, staff, abuse and leaderboard.

---

## Project structure

```
Rating_system/
├── API/API.md                 # API contract
├── Backend/
│   ├── db/
│   │   ├── schema.sql         # tables
│   │   ├── seed.js            # demo students + staff
│   │   └── seed-demo.js       # sample ratings + abuse cases
│   └── src/
│       ├── index.js           # Express app
│       ├── config.js          # reads Backend/.env, then the root .env
│       ├── db.js              # Postgres pool
│       ├── migrate.js         # creates tables / adds missing columns on start
│       ├── middleware/        # auth guards, security, rate limits
│       ├── routes/            # auth, student, staff, abuse, leaderboard
│       └── abuse/detectors.js # the 8 detectors
├── Frontend/
│   ├── public/                # 42 logo, favicons, pixel sprites
│   └── src/
│       ├── lib/               # api client, auth, theme, hooks, formatting, toasts
│       ├── components/        # Layout, Stars, Countdown, Podium, modals, shared UI
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── student/       # Home, Rate, Leaderboard
│       │   └── staff/         # Overview, Students, StudentDetail, Ratings,
│       │                      # Participation, Abuse, Leaderboard, Labels, Windows
│       └── styles.css         # all styles, with the 42 palette in :root
├── docker-compose.yml
├── Dockerfile
└── package.json               # root scripts (dev, build, start, seed)
```

---

## Run it locally

**You need:** Node.js 20+, and either Docker or any PostgreSQL URL (for example Neon).

```bash
git clone <repo-url>
cd Rating_system
npm install                     # installs the root + Backend + Frontend
```

**Database: pick one**

<details>
<summary><b>A) Local Postgres in Docker</b></summary>

```bash
cp .env.example .env            # set JWT_SECRET
docker compose up -d db         # only the database
```
The backend connects to it automatically (user `rank`, password `rank` unless you set `POSTGRES_PASSWORD`).
</details>

<details>
<summary><b>B) Your own Postgres URL</b></summary>

Create `Backend/.env`:
```
DATABASE_URL=postgresql://user:password@host/dbname
JWT_SECRET=a-long-random-secret-16-chars-or-more
```
`Backend/.env` takes priority over the root `.env`.
</details>

**Start**
```bash
npm run seed        # optional: demo students + staff (wipes the database!)
npm run seed:demo   # optional: sample ratings + abuse cases
npm run dev         # API on :3000 + app on http://localhost:5173
```

**Demo logins** (after seeding): `staff`, or any student such as `hdaya`. Password: `123456`.

| Script | What it does |
|---|---|
| `npm run dev` | backend (watch mode) + Vite dev server with hot reload |
| `npm run build` then `npm start` | one server on :3000 for the API + built app, without Docker |
| `npm run seed` / `npm run seed:demo` | fill the database with demo data |

> **Windows tip:** if PowerShell blocks `npm`, use Command Prompt or `npm.cmd`.

---

## Configuration

Copy `.env.example` to `.env`. `Backend/.env`, if it exists, wins over the root `.env`.

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `JWT_SECRET` | **yes** | – | signing secret, 16+ characters. Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATABASE_URL` | no | local Docker DB | any Postgres connection string |
| `POSTGRES_PASSWORD` | no | `rank` | password for the Docker database (fixed when the DB is first created) |
| `APP_PORT` / `APP_BIND` | no | `3000` / `127.0.0.1` | where the app container listens |
| `PORT` | no | `3000` | backend port in local dev |
| `CORS_ORIGIN` | no | – | only if the frontend is hosted on another domain (comma-separated) |

Never commit `.env`: it's in `.gitignore`.

---

## Deploy on the VPS

```bash
cp .env.example .env            # set JWT_SECRET
docker compose up -d --build    # Postgres + app at https://rank.reactiveweb.dev
docker compose exec app npm run seed        # optional demo data (wipes the DB!)
docker compose exec app npm run seed:demo   # optional sample ratings + abuse cases
```

- On first start the app sees an empty database and creates the tables from `Backend/db/schema.sql`.
- The site is served by the VPS's **Traefik**: the app joins the `edge-traefik` network, and the labels in `docker-compose.yml` route the domain and get the HTTPS certificate from Let's Encrypt. The app has no public port of its own.
- DNS: `rank.reactiveweb.dev` needs an `A` record to the VPS IP (or a `CNAME` to `reactiveweb.dev`).
- Postgres is reachable only from the VPS itself (`127.0.0.1:5432`).
- Update after pulling new code: `docker compose up -d --build` (data is kept).

**Backups**
```bash
docker compose exec -T db pg_dump -U rank rank > backup-$(date +%F).sql   # backup
docker compose exec -T db psql -U rank rank < backup-2026-11-05.sql       # restore into an empty DB
```
> ⚠️ `docker compose down -v` deletes the volume and **all data**. Plain `down` is safe.

---

## Demo walkthrough

1. **Log in as a student** (`hdaya`): see the voting countdown and your own rating.
2. **Rate a peer**: search a name, tap the stars, add labels, submit.
3. **Try to cheat**: rate the same person again. The API refuses it, and the attempt is logged.
4. **Log in as staff**: the Overview shows participation and who is below the minimum.
5. **Abuse cases**: read the plain-English cases (friends boosting, revenge…), then confirm one and invalidate its ratings.
6. **Leaderboard**: choose top 3 / 10 / 20 and share it. Students now see the podium and an announcement on their home page.

---

## Team

Built at **42 Amman** by **Hala Dayyeh**,
in collaboration with **Rawd Abdallah**, **Ammar Radwan** and **Amro Alsakaji**.

<div align="center">

★ ★ ★

</div>
