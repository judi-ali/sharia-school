# لوحة إدارة الثانوية الشرعية

Next.js (App Router) + Postgres (Neon via Vercel) + NextAuth. Arabic / RTL UI, Arabic data.

## Run
```bash
pnpm install
cp .env.example .env     # fill POSTGRES_URL, AUTH_SECRET, SEED_SECRET
pnpm dev
```
Open `http://localhost:3000/seed?secret=<SEED_SECRET>` once to create tables and Arabic sample data
(add `&reset=1` to drop and rebuild everything). Then log in with `admin@school.test`
and `SEED_ADMIN_PASSWORD` (default `ChangeMe123!`). **Delete `app/seed` before going live.**

## Deploy (Vercel)
1. Create a Neon database from Vercel Storage and copy the **pooled** URL into `POSTGRES_URL`.
2. Add `AUTH_SECRET` (and `SEED_SECRET` for the first seed) to the project environment.
3. Deploy, call `/seed?secret=...` once, then remove the route.

## Structure
- `app/lib/schema.ts` – database schema (the plan, classes, groups, enrollments, curriculum, grades…)
- `app/lib/placeholder-data.ts` – official plan 2026/2027 (weekly periods per class) and sample records
- `app/lib/data.ts` / `actions.ts` – queries and server actions (every action checks the admin session)
- `app/dashboard/*` – students, teachers, subjects, classes (+ curriculum), groups (+ students, teachers), attendance, grades
