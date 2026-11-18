# AGENTS.md

Read this first, then continue from **[PLAN.md](./PLAN.md)**. Milestone 1 is done and Milestone 2 is done for patient data on MongoDB. Next: Milestone 3 (auth).

## Architecture

- Vite + React 19 + TypeScript SPA, styled with Tailwind v4 (`@tailwindcss/vite`). Routing uses React Router (`src/App.tsx`), and `netlify.toml` rewrites `/*` to `index.html`.
- Backend: an **Express 5 app** in `server/app.ts` on **MongoDB Atlas** (Mongoose). In production it runs as the Netlify Function `netlify/functions/api.ts` (`/api/*` is rewritten to it in `netlify.toml`). In `npm run dev` the `apiDevServer` plugin in `vite.config.ts` mounts it at `/api`. Do not add a full-stack framework: its catch-all function would intercept `/api`.
- Database code lives in `db/`: `connection.ts` (cached connection, reads `MONGODB_URI`), `models/` (one schema per collection, explicit snake_case collection names, numeric ids plus a `counters` collection), and `seed.ts` (`npm run db:seed`, insert-only; `npm run db:reset` wipes the data first).
- Secrets: `MONGODB_URI` lives only in `.env` (gitignored) and in Netlify environment variables. Never commit it or put it in a `VITE_` variable.

## Key directories

- `src/data/fixtures.ts`: TypeScript types, static reference lists the UI looks up synchronously (metrics, symptoms, diseases), and the seed source for MongoDB. Health readings come from a seeded PRNG so they stay stable.
- `src/data/api.ts`: the data-access layer. Patient data is fetched from `/api/...` with the same return shapes the stub had. It also holds the analytics helpers (`seriesFor`, `summarize`, `bucket`), which the aggregation pipeline replaces in Milestone 6.
- `src/context/session.tsx`: the demo session (role picker), replaced by JWT auth in Milestone 3.
- `src/lib/nav.ts`: sidebar config. `milestone > 1` items render `pages/Roadmap.tsx` until they are built. Set `milestone: 1` and add a route when a module ships.
- `src/components/`: `ui.tsx` (Badge, StatCard, Modal, Toast, Skeleton, EmptyState, Disclaimer, PageHeader), `charts.tsx` (TrendChart, Legend, validated series colours), `RecordForm.tsx`, `AppLayout.tsx`.
- `src/pages/`: Landing, Auth (Login/Register), Dashboard, HealthRecords, Analytics, PatientProfile, Notifications, Roadmap.

## Conventions

- Theme tokens live in `src/index.css` under `@theme` (`ink`, `canvas`, `line`, `teal-brand`, `blue-brand`, `violet-brand`, `amber-brand`, `rose-brand` and their `-soft` variants). Fonts are Bricolage Grotesque (display), Figtree (body) and JetBrains Mono (`.num` for figures).
- Reuse the `.card`, `.field`, `.btn`, `.btn-primary` and `.btn-ghost` classes.
- Chart series colours come from `SERIES` in `charts.tsx`, a CVD-validated teal/violet pair. Keep one y-axis per chart, use 2px lines, and start bar charts at zero.
- Every alert or analysis surface shows `<Disclaimer />`. Never describe output as a diagnosis or recommend medication.
- Alert thresholds are configurable data (`alertRules`), never hardcoded medical limits.
- The database is MongoDB (changed from the Postgres plan on 2026-11-18 at the project owner's request). PLAN.md describes how relational rules are enforced on MongoDB.
