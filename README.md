# AI-Based Chronic Disease Tracker

A web platform where patients with long-term conditions keep their diseases, timestamped health measurements, symptoms, medications, appointments and threshold-based alerts in one record, and where authorised doctors review the same trends. Analytics and alerts are rule-based and informational. The application does not diagnose.

Live Demo : https://chronicdisease-tracker.netlify.app/

## Screenshots

### Landing page

![Landing page introducing the chronic disease tracker](./docs/screenshots/landing-page.png)

### Dashboard

Patient dashboard with demo data.

![Patient dashboard showing health metrics, trends, alerts and recent records](./docs/screenshots/dashboard.png)

## What works today

The landing page, sign-in and registration, and an app shell with role-aware navigation (Patient, Doctor, Admin) are in place. Five screens are fully interactive:

- **Dashboard:** KPI tiles, blood-pressure trend, recent alerts, metric snapshot, recent records and upcoming appointments.
- **Health records:** filter, sort, paginate, add, edit and delete readings. Each reading can carry symptoms and notes and is validated before saving. Readings outside a configured threshold raise an alert.
- **Analytics:** Recharts trends for heart rate, blood pressure, glucose, sleep, steps and weight, with date ranges, daily/weekly/monthly grouping, average/min/max, trend direction, comparison with the previous period, and a table view.
- **Patient profile:** conditions, prescriptions, appointments and the health-history timeline.
- **Notifications:** read/unread/resolved alerts and the active threshold rules.

Patient data (profile, health records, alerts, alert rules, dashboard) is stored in **MongoDB Atlas** and served by an Express REST API. The UI reaches it only through `src/data/api.ts`. New readings, edits, deletes and alert status changes are saved to the database. Static reference lists (metrics, symptoms, diseases) are still bundled from `src/data/fixtures.ts`, which is also the source for the seed script.

There is no real login yet: sign-in is a demo role picker, and the API does not check who is calling. Keep only demo data in the database until authentication lands (Milestone 3).

## Database (MongoDB)

- `db/connection.ts`: one cached Mongoose connection that reads `MONGODB_URI` from the environment.
- `db/models/`: one Mongoose schema per collection (`patients`, `doctors`, `diseases`, `patient_diseases`, `health_metrics`, `health_records`, `symptoms`, `medications`, `prescriptions`, `appointments`, `alert_rules`, `alerts`, `users`, `counters`), with validation, enums and indexes.
- `db/seed.ts`: loads the demo data. It only inserts missing documents, so it is safe to re-run.
- `server/app.ts`: the Express API. Creating a reading runs as one MongoDB transaction (insert the reading, check the alert rules, insert any alert). Deleting a reading sets `record_id` to null on its alerts.
- `netlify/functions/api.ts`: runs the same Express app on Netlify. `netlify.toml` routes `/api/*` to it.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Database connectivity check |
| GET | `/api/metrics`, `/api/symptoms`, `/api/diseases` | Reference data |
| GET | `/api/patients/:id` | Profile with conditions, prescriptions, appointments |
| GET | `/api/patients/:id/dashboard` | KPI totals, recent records and alerts |
| GET | `/api/patients/:id/records?metric=&from=&to=&order=` | Filtered readings |
| GET | `/api/patients/:id/alerts` | Alerts for a patient |
| GET | `/api/patients/:id/alert-rules` | Patient and global threshold rules |
| POST | `/api/records` | Add a reading (transaction + alert check) |
| PUT / DELETE | `/api/records/:id` | Edit or delete a reading |
| PATCH | `/api/alerts/:id` | Set alert status (`unread`, `read`, `resolved`) |

## Tech stack

- React 19, TypeScript, Vite
- Tailwind CSS v4
- React Router 7
- Recharts
- lucide-react icons
- Express 5 REST API (Netlify Functions in production, Vite middleware in development)
- MongoDB Atlas with Mongoose
- Planned: bcrypt and JWT auth. See [PLAN.md](./PLAN.md).

## Run locally

1. Copy `.env.example` to `.env` and put your MongoDB Atlas connection string in `MONGODB_URI`. `.env` is gitignored; never commit it.
2. In Atlas → Network Access, allow your IP address.
3. Install, seed and start:

```bash
npm install
npm run db:seed        # insert demo data (safe to re-run)
npm run dev            # frontend + /api on the same Vite dev server
```

`npm run db:reset` deletes all data in the database and reseeds it.

Sign in with any of the pre-filled demo roles on `/login`.

### Deploying on Netlify

Add `MONGODB_URI` (and optionally `MONGODB_DB`, default `chronic_disease_tracker`) under **Site configuration → Environment variables**. Netlify functions run from changing IP addresses, so Atlas Network Access must allow `0.0.0.0/0`. Visit `/api/health` after deploying to confirm the connection.

## Roadmap

Full details are in [PLAN.md](./PLAN.md).

1. Product surface (done)
2. MongoDB schema, validation, indexes, seed data, Express API (done for patient data)
3. Authentication (bcrypt + JWT) and role-based access
4. Patient, disease, health record and symptom APIs and screens
5. Medications, prescriptions, side effects, doctors, appointments
6. Aggregation-pipeline analytics, saved analysis reports, alert-rule editor
7. Tests, database concept documentation with `explain()`, API reference
