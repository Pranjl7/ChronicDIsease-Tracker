# AI-Based Chronic Disease Tracker: Product Roadmap

The tracker is a database-driven health-tracking and analytics platform for patients with long-term conditions, their doctors and administrators. Alerts and reports are rule-based and informational. The product never diagnoses.

## Platform decisions

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4 + React Router + Recharts (Vite SPA). Live now.
- **Backend:** Express.js REST API (TypeScript) in `server/app.ts`, deployed as a Netlify Function (`netlify/functions/api.ts`) and mounted in the Vite dev server locally. Every API call goes to `/api/*` on the same origin.
- **Database:** **MongoDB Atlas** via Mongoose (decision changed on 2026-11-18 at the project owner's request; it replaces the earlier Netlify Database/Postgres plan). The connection string lives only in `MONGODB_URI` (`.env` locally, Netlify environment variables in production).
  - One schema per collection in `db/models/`. Documents keep the numeric ids the UI uses (`patient_id`, `record_id`, ...) with unique indexes; new ids come from an atomic `counters` collection.
  - Relational rules are enforced in code: required fields, enums and range validators replace CHECK constraints, unique indexes replace UNIQUE, and the API checks that referenced ids exist. Deleting a reading nulls `record_id` on its alerts (the SET NULL rule). Multi-step writes use MongoDB transactions.
  - Trade-off: MongoDB has no foreign keys or joins in the SQL sense. Joins are done with `$lookup` or in the API layer, and analytics will use the aggregation pipeline (`$match`, `$group`, `$dateTrunc`) instead of SQL `GROUP BY`.
- **Auth:** bcrypt password hashing + JWT (short-lived access token, httpOnly refresh cookie), with role-based middleware (`patient`, `doctor`, `admin`) on every route.

## Milestones

### 1. Product surface ✅ (done)
Branded landing page, sign-in/registration, responsive app shell with a role-aware sidebar, and five working screens that run on stub data from `src/data/fixtures.ts`:
- **Dashboard:** six KPI tiles, BP trend, recent alerts, metric snapshot, recent records, upcoming appointments, quick navigation.
- **Health records:** filter by metric and date range, sort, paginate, add, edit and delete, with symptom tagging and validation.
- **Analytics:** six metrics, 7/30/90/120-day ranges, daily/weekly/monthly grouping, average/min/max, trend direction, comparison with the previous period, threshold lines, and a table view.
- **Patient profile:** conditions, prescriptions, appointments, glucose trend and a timeline of the health history.
- **Notifications:** unread/read/resolved workflow and a list of active alert rules.

The remaining modules appear in the navigation as roadmap pages.

### 2. Data model, seed data and server foundation (MongoDB: done for patient data)
- `db/models/` (MongoDB collections): USERS, PATIENT (1:1 with USERS), DOCTOR (1:1 with USERS), DISEASE, PATIENT_DISEASES, HEALTH_METRICS, HEALTH_RECORD, SYMPTOM, RECORD_SYMPTOMS, MEDICATION, DISEASE_MEDICATIONS, PRESCRIPTION, SIDE_EFFECT, SYMPTOM_SIDE_EFFECTS, APPOINTMENT, AI_ANALYSIS_REPORT, ALERTS. Two supporting tables: **ALERT_RULES** for configurable thresholds and **DOCTOR_PATIENT_ACCESS** for authorisation. An **AUDIT_LOG** table records important changes.
- Constraints: CHECK (value ranges, `end_date >= start_date`, enum statuses), UNIQUE (email, junction pairs), DEFAULTs (`created_at`, `status`), FK rules (CASCADE from patient to their records, RESTRICT on master data in use, SET NULL on `alerts.record_id`).
- Indexes: `(patient_id, recorded_at)`, `(patient_id, metric_id, recorded_at)`, `alerts(patient_id, status)`, `appointment(doctor_id, date)`.
- Seed script that mirrors the current fixtures: 6 patients, 4 doctors, about 120 days of readings, prescriptions, appointments, side effects and alerts.
- Express Netlify Server skeleton with centralised error handling, request validation and CORS.

### 3. Authentication and role-based access
- `/api/auth/register` (USERS + PATIENT inserted in one transaction), `/login`, `/refresh`, `/logout`.
- `requireAuth`, `requireRole`, and `canAccessPatient` middleware. A patient sees only their own record. A doctor sees only patients in DOCTOR_PATIENT_ACCESS.
- Replace `src/context/session.tsx` with real auth, and build the **Settings** page (profile, password change; admins also manage users and roles).

### 4. Core clinical data APIs
- Patients (CRUD, search, safe delete), Diseases (CRUD, filters, assign to patient), Health metrics, Health records (CRUD, date/metric filters), Symptoms.
- Point `src/data/api.ts` at the real endpoints. The Dashboard, Health records and Profile screens then work unchanged.
- Build the **Patients**, **Diseases** and **Symptoms** screens.
- Record creation runs in one transaction: INSERT the record, INSERT its symptoms, evaluate the rules, INSERT any alerts, then COMMIT, or ROLLBACK if any step fails.

### 5. Treatment and scheduling
- Medications + DISEASE_MEDICATIONS, Prescriptions (active vs completed, history), Side effects + SYMPTOM_SIDE_EFFECTS (patient-reported effects kept apart from confirmed reactions), Doctors, Appointments (book, reschedule, cancel, with calendar and table views).
- Nothing is recommended or prescribed automatically.

### 6. Analytics, reports and alerts on SQL
- Analytics endpoints that use the aggregation pipeline (`$group` with `$avg/$min/$max/$count` over `$dateTrunc` by week or month, `$match` after grouping in place of HAVING), plus previous-period comparison.
- **Analysis reports:** generate a report for a chosen period (rule-based summary, trends, observations and "discuss with your doctor" points), then save it to AI_ANALYSIS_REPORT and view it later.
- Optional AI-written summary through Netlify AI Gateway, clearly labelled and built only from stored values. It never fills in missing data.
- Alert-rule editor for doctors and admins.

### 7. Hardening and evaluation pack
- Test the API for data isolation, validation, FK behaviour and transaction rollback.
- Write `docs/dbms-concepts.md`, mapping each DBMS concept to a file or query with `EXPLAIN ANALYZE` output, and `docs/api.md` with the endpoint reference.
- Add an audit-log viewer for admins, and a demo script for the project viva.
