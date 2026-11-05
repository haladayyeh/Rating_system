# Frontend — 42 Amman Peer Rank

React + Vite. Talks to the backend in `../Backend` using the contract in `../API/API.md`.

## Run

Run everything from the project root — see [../README.md](../README.md) (`npm run dev`, or `npm run build && npm start`).

## Structure

```
src/
  lib/          api client, auth context, hooks, formatting, toasts
  components/   layout, stars, countdown, podium, shared UI
  pages/
    Login.jsx
    student/    Home, Rate, Leaderboard
    staff/      Overview, Students, StudentDetail, Ratings, Participation,
                Abuse, Leaderboard, Labels, Windows
  styles.css    all styles; 42 palette lives in :root
```

Colors (`src/styles.css`): navy `#0b1d3a`, turquoise `#00babc`, yellow `#ffc72c`, black, white.
