# لوحة إدارة الثانوية الشرعية

Next.js (App Router) + Postgres (Neon via Vercel) + NextAuth. Arabic / RTL UI, Arabic data.

## Run
```bash
pnpm install
cp .env.example .env     # fill POSTGRES_URL, AUTH_SECRET, SEED_SECRET
pnpm dev
```
Open `http://localhost:3000/seed?secret=<SEED_SECRET>` once to create tables and Arabic sample data
(the route safely upgrades the previous schema and preserves existing records). Then log in with `admin@school.test`
and `SEED_ADMIN_PASSWORD` (default `ChangeMe123!`). **Delete `app/seed` before going live.**

`/seed?secret=...&reset=1` drops and rebuilds all tables and data. Use it only for a disposable database;
back up the database before any reset.

## Deploy (Vercel)
1. Create a Neon database from Vercel Storage and copy the **pooled** URL into `POSTGRES_URL`.
2. Add `AUTH_SECRET` (and `SEED_SECRET` for the first seed) to the project environment.
3. Deploy, call `/seed?secret=...` once, then remove the route.

## Structure
- `app/lib/schema.ts` – database schema (the plan, classes, groups, enrollments, curriculum, grades…)
- `app/lib/placeholder-data.ts` – official plan 2026/2027 (weekly periods, grading schemes, pass marks)
- `app/lib/school-data.ts` – the school's real data, generated from its Excel sheet and the grade-7 timetables
- `app/lib/data.ts` / `actions.ts` – queries and server actions (every action checks the admin session)
- `app/dashboard/*` – students, teachers, subjects, classes (+ curriculum), groups (+ students, teachers), attendance, grades

## Grading
Each class + subject has a grading scheme from the ministry grade books (`app/lib/placeholder-data.ts`):
coursework = oral + homework + activity + quiz (+ quiz 2), exam = exam (+ exam 2), semester result = (coursework + exam) / 2,
final = average of the two semesters. Missing schemes are listed by `/seed` and flagged on the dashboard; fill them from
**Classes → class → «تحديد» next to the subject**.

## Computed subjects
In grades 7–9 **Social Studies** is computed: the average of its parts' results (Geography and History, graded on their
own). It cannot be edited (enforced by a database trigger), is shown next to its parts, and is the only one of the three
counted in totals/averages (`/dashboard/results`). Configured in `compositeSubjects` (`app/lib/placeholder-data.ts`).

## School data and extra features (from the school's Excel sheet and timetables)
Students (address, second phone, documents status, bus), attendance, buses (`/dashboard/transport`), textbook handouts
(`/dashboard/books`), class-opening requests (`/dashboard/requests`), inventory (`/dashboard/inventory`), the school
bell schedule and the weekly timetable (`/dashboard/timetable`, per group or per teacher; a teacher can't be in two groups
at once). Grading schemes marked **مؤقت** (PE/Arts, Activities, Sharia Sciences) are placeholders until their books are issued.
`/seed` rolls back if a class doesn't total 35 periods or a timetable differs from the plan.
