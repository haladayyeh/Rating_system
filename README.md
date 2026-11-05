# Rating_system

42 Amman peer rating system — Express + PostgreSQL backend, React + Vite frontend.
Postgres runs in Docker with its data on a named volume (`pgdata`); no external database service.

## Deploy on the VPS

```bash
cp .env.example .env          # set JWT_SECRET (DB password is optional)
docker compose up -d --build  # starts Postgres + the app on 127.0.0.1:3000
docker compose exec app npm run seed        # optional demo data (wipes the DB!)
docker compose exec app npm run seed:demo   # optional sample ratings + abuse cases
```

On first start the app sees an empty database and creates the tables from `Backend/db/schema.sql`.
Point nginx/Caddy at `127.0.0.1:3000` (or set `APP_BIND=0.0.0.0` in `.env` to expose it directly).
Postgres is only reachable from the VPS itself (`127.0.0.1:5432`).

Update after pulling new code: `docker compose up -d --build` (data is kept).

### Backups

```bash
docker compose exec -T db pg_dump -U rank rank > backup-$(date +%F).sql   # backup
docker compose exec -T db psql -U rank rank < backup-2026-11-05.sql       # restore (into an empty DB)
```

⚠️ `docker compose down -v` deletes the volume and all data. Plain `down` is safe.

## Local development

```bash
cp .env.example .env && docker compose up -d db   # only the database
npm install                                       # root + Backend + Frontend
```

Same `.env` as production — no database URL to copy anywhere. The backend reads the root `.env` and
connects to the local container (password `rank` unless you set `POSTGRES_PASSWORD`). (To use a different Postgres, set
`DATABASE_URL` in `.env` or `Backend/.env`; it takes priority.)

```bash
npm run seed         # optional demo data
npm run dev          # backend + frontend with hot reload → http://localhost:5173
```

Demo logins (after seeding): `staff` or any student (e.g. `hdaya`), password `123456`.

| Script | What it does |
| --- | --- |
| `npm run dev` | backend (watch mode) + Vite dev server |
| `npm run build` / `npm start` | build frontend, then one server for API + app on :3000 (without Docker) |
| `npm run seed` / `seed:demo` | seed the database |

API contract: [API/API.md](API/API.md).
