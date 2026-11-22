// Full database schema. Run by /seed. All statements are idempotent.
// Use `dropAll` (via /seed?reset=1) when the structure changes during development.
export const dropAll = /* sql */ `
DROP VIEW IF EXISTS subject_results, computed_results, final_grades, grade_results, curriculum_without_scheme, class_weekly_load CASCADE;
DROP TABLE IF EXISTS audit_log, grades, attendance, timetable_entries, textbook_handouts, textbooks, class_requests,
  inventory_items, bell_schedule, school_profile, teaching_assignments, enrollments,
  grading_schemes, curriculum, class_groups, students, transport_routes, teachers, subjects,
  classes, academic_years, users, schools CASCADE;
DROP FUNCTION IF EXISTS audit_log_immutable();
DROP FUNCTION IF EXISTS block_computed_grades();
`;

export const schema = /* sql */ `
-- ───────── Schools and users ─────────
-- Every Sharia school is a row here; all school-level data below carries its school_id.
CREATE TABLE IF NOT EXISTS schools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL UNIQUE,
  gender      VARCHAR(10) NOT NULL DEFAULT 'boys' CHECK (gender IN ('boys','girls','mixed')),
  directorate VARCHAR(255),                                   -- مديرية الأوقاف
  address     TEXT,
  phone       VARCHAR(30),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles: education_director (global, no school) · school_director · school_admin (both belong to one school)
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  role       VARCHAR(20) NOT NULL CHECK (role IN ('education_director','school_director','school_admin')),
  school_id  UUID REFERENCES schools(id) ON DELETE RESTRICT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((role = 'education_director' AND school_id IS NULL) OR (role <> 'education_director' AND school_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS one_director_per_school ON users (school_id) WHERE role = 'school_director';

-- ───────── School calendar ─────────
-- Period settings come from the ministry decision (7 periods/day, 45 min).
CREATE TABLE IF NOT EXISTS academic_years (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 VARCHAR(20) NOT NULL UNIQUE,         -- '2026/2027'
  start_date           DATE NOT NULL,
  end_date             DATE NOT NULL,
  is_current           BOOLEAN NOT NULL DEFAULT FALSE,
  periods_per_day      SMALLINT NOT NULL DEFAULT 7  CHECK (periods_per_day > 0),
  period_minutes       SMALLINT NOT NULL DEFAULT 45 CHECK (period_minutes > 0),
  school_days_per_week SMALLINT NOT NULL DEFAULT 5  CHECK (school_days_per_week BETWEEN 1 AND 7),
  CHECK (end_date > start_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_current_year
  ON academic_years (is_current) WHERE is_current;

-- The school day: assembly, lessons (numbered) and breaks, with real times.
CREATE TABLE IF NOT EXISTS bell_schedule (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  position         SMALLINT NOT NULL,
  kind             VARCHAR(10) NOT NULL CHECK (kind IN ('assembly','lesson','break')),
  period_no        SMALLINT CHECK (period_no BETWEEN 1 AND 12),   -- lessons only
  label            VARCHAR(60) NOT NULL,
  starts_at        TIME NOT NULL,
  ends_at          TIME NOT NULL,
  note             VARCHAR(120),
  CHECK (ends_at > starts_at),
  CHECK ((kind = 'lesson') = (period_no IS NOT NULL)),
  UNIQUE (school_id, academic_year_id, position),
  UNIQUE (school_id, academic_year_id, period_no)
);

-- ───────── Structure ─────────
-- "Class" = a level of the official plan:
-- السابع والثامن والتاسع (إعدادي، بلا اختصاص)؛ العاشر والحادي عشر والبكالوريا (ثانوي، أدبي أو علمي).
CREATE TABLE IF NOT EXISTS classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,                 -- 'عاشر أدبي'
  grade_level SMALLINT NOT NULL CHECK (grade_level BETWEEN 7 AND 12),  -- 12 = Baccalaureate
  track       VARCHAR(10) NOT NULL DEFAULT 'general'
              CHECK (track IN ('general','literary','scientific')),
  stage       VARCHAR(12) GENERATED ALWAYS AS
              (CASE WHEN grade_level <= 9 THEN 'preparatory' ELSE 'secondary' END) STORED,
  CHECK ((grade_level <= 9 AND track = 'general') OR (grade_level >= 10 AND track <> 'general')),
  UNIQUE (grade_level, track)
);

-- "Class group" = a section of a class in a given year (السابع / الشعبة 1)
CREATE TABLE IF NOT EXISTS class_groups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  name             VARCHAR(50) NOT NULL,                    -- 'الشعبة الأولى'
  capacity         SMALLINT CHECK (capacity > 0),
  UNIQUE (school_id, class_id, academic_year_id, name),
  UNIQUE (id, academic_year_id, class_id, school_id),       -- targets of the composite FKs below
  UNIQUE (id, academic_year_id, school_id)
);

-- ───────── People ─────────
CREATE TABLE IF NOT EXISTS teachers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  full_name  VARCHAR(255) NOT NULL,
  email      TEXT,
  phone      VARCHAR(30),
  hire_date  DATE,
  status     VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, email),
  UNIQUE (id, school_id)
);

-- School buses ("سرافيس"): one row per route
CREATE TABLE IF NOT EXISTS transport_routes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  name         VARCHAR(120) NOT NULL,                        -- 'دورة الأشرفية'
  driver_name  VARCHAR(255) NOT NULL,
  driver_phone VARCHAR(30),
  UNIQUE (school_id, name),
  UNIQUE (id, school_id)
);

CREATE TABLE IF NOT EXISTS students (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_number      VARCHAR(30),                           -- school-issued ID (optional until issued)
  full_name           VARCHAR(255) NOT NULL,
  gender              VARCHAR(10) NOT NULL DEFAULT 'male' CHECK (gender IN ('male','female')),
  date_of_birth       DATE,
  guardian_name       VARCHAR(255),
  guardian_phone      VARCHAR(30),
  guardian_phone2     VARCHAR(30),
  address             TEXT,
  registration_status VARCHAR(10) NOT NULL DEFAULT 'complete' CHECK (registration_status IN ('complete','pending')),
  missing_documents   TEXT,                                  -- papers still required
  transport_route_id  UUID,
  status              VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','inactive','graduated','transferred')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_number),
  UNIQUE (id, school_id),
  FOREIGN KEY (transport_route_id, school_id) REFERENCES transport_routes (id, school_id)
    ON DELETE SET NULL (transport_route_id)                  -- a bus of the same school only
);

-- Subjects of the official plan: Sharia subjects + educational subjects
CREATE TABLE IF NOT EXISTS subjects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(150) NOT NULL UNIQUE,                  -- 'اللغة العربية'
  category   VARCHAR(12)  NOT NULL CHECK (category IN ('sharia','educational')),
  sort_order SMALLINT NOT NULL                              -- order used in the official plan
);

-- ───────── Official plan: subjects of each class, with weekly periods ─────────
-- "Assign a subject to a class" = a row here. Plans are per academic year.
-- Composite subjects: a row with part_of_subject_id is a PART of another subject of the same class
-- (e.g. Geography and History are parts of Social Studies in grades 7-9). The parent is computed
-- from its parts (average) and is the only one counted in totals; the parts are taught and graded
-- on their own and carry 0 periods (the parent holds the plan's periods).
CREATE TABLE IF NOT EXISTS curriculum (
  academic_year_id   UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  class_id           UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id         UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  weekly_periods     SMALLINT NOT NULL CHECK (weekly_periods BETWEEN 0 AND 35),
  part_of_subject_id UUID,
  PRIMARY KEY (academic_year_id, class_id, subject_id),
  CHECK (part_of_subject_id IS DISTINCT FROM subject_id),
  CHECK ((part_of_subject_id IS NULL AND weekly_periods >= 1) OR (part_of_subject_id IS NOT NULL AND weekly_periods = 0)),
  FOREIGN KEY (academic_year_id, class_id, part_of_subject_id)
    REFERENCES curriculum (academic_year_id, class_id, subject_id) ON DELETE RESTRICT
);

-- ───────── Relations ─────────
-- Student <-> class group, once per academic year.
-- class_id / academic_year_id are repeated on purpose so the composite FK
-- guarantees they match the group (the app fills them from the group).
CREATE TABLE IF NOT EXISTS enrollments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL,
  student_id       UUID NOT NULL,
  class_group_id   UUID NOT NULL,
  academic_year_id UUID NOT NULL,
  class_id         UUID NOT NULL,
  FOREIGN KEY (student_id, school_id) REFERENCES students (id, school_id) ON DELETE CASCADE,
  FOREIGN KEY (class_group_id, academic_year_id, class_id, school_id)
    REFERENCES class_groups (id, academic_year_id, class_id, school_id) ON DELETE RESTRICT,
  UNIQUE (student_id, academic_year_id),
  UNIQUE (id, academic_year_id, class_id)                   -- target of grades FK
);
CREATE INDEX IF NOT EXISTS enrollments_group_idx ON enrollments (class_group_id);

-- Teacher teaches a subject in a class group.
-- The subject MUST be in the curriculum of the group's class for that year.
CREATE TABLE IF NOT EXISTS teaching_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL,
  teacher_id       UUID NOT NULL,
  class_group_id   UUID NOT NULL,
  academic_year_id UUID NOT NULL,
  class_id         UUID NOT NULL,
  subject_id       UUID NOT NULL,
  FOREIGN KEY (teacher_id, school_id) REFERENCES teachers (id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (class_group_id, academic_year_id, class_id, school_id)
    REFERENCES class_groups (id, academic_year_id, class_id, school_id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id, class_id, subject_id)
    REFERENCES curriculum (academic_year_id, class_id, subject_id) ON DELETE RESTRICT,
  UNIQUE (class_group_id, subject_id),                      -- one teacher per subject per group
  UNIQUE (class_group_id, subject_id, teacher_id)           -- target of the timetable FK
);
CREATE INDEX IF NOT EXISTS teaching_teacher_idx ON teaching_assignments (teacher_id);

-- ───────── Attendance (daily) ─────────
CREATE TABLE IF NOT EXISTS attendance (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  status        VARCHAR(10) NOT NULL CHECK (status IN ('present','absent','late','excused')),
  note          TEXT,
  recorded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (enrollment_id, date)
);
CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance (date);

-- ───────── Weekly timetable ─────────
-- One subject per group per day/period. The teacher is the one assigned to that subject in the group
-- (composite FK, follows reassignments) and cannot be in two groups at the same time.
-- day_of_week: 0 = Sunday ... 4 = Thursday.
CREATE TABLE IF NOT EXISTS timetable_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL,
  class_group_id   UUID NOT NULL,
  academic_year_id UUID NOT NULL,
  day_of_week      SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  period_no        SMALLINT NOT NULL,
  subject_id       UUID NOT NULL,
  teacher_id       UUID NOT NULL,
  FOREIGN KEY (class_group_id, academic_year_id, school_id)
    REFERENCES class_groups (id, academic_year_id, school_id) ON DELETE CASCADE,
  FOREIGN KEY (school_id, academic_year_id, period_no)
    REFERENCES bell_schedule (school_id, academic_year_id, period_no) ON DELETE RESTRICT,
  FOREIGN KEY (class_group_id, subject_id, teacher_id)
    REFERENCES teaching_assignments (class_group_id, subject_id, teacher_id) ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE (class_group_id, day_of_week, period_no),
  UNIQUE (academic_year_id, teacher_id, day_of_week, period_no)
);

-- Scheduled periods per week vs the plan, per group and subject
CREATE OR REPLACE VIEW timetable_load AS
SELECT g.id AS class_group_id, cu.subject_id, cu.weekly_periods AS planned,
       COUNT(t.id)::int AS scheduled
FROM class_groups g
JOIN curriculum cu ON cu.class_id = g.class_id AND cu.academic_year_id = g.academic_year_id AND cu.weekly_periods > 0
LEFT JOIN timetable_entries t ON t.class_group_id = g.id AND t.subject_id = cu.subject_id
GROUP BY g.id, cu.subject_id, cu.weekly_periods;

-- ───────── Textbooks handed to students ─────────
CREATE TABLE IF NOT EXISTS textbooks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  title      VARCHAR(150) NOT NULL,
  UNIQUE (class_id, title)
);
CREATE TABLE IF NOT EXISTS textbook_handouts (
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  textbook_id      UUID NOT NULL REFERENCES textbooks(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  delivered_on     DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (student_id, textbook_id, academic_year_id)
);

-- ───────── Interest in opening a class ("رغبات لفتح صفوف") ─────────
CREATE TABLE IF NOT EXISTS class_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  full_name  VARCHAR(255) NOT NULL,
  phone      VARCHAR(30),
  status     VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','enrolled','dropped')),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────── School supplies and equipment ─────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name      VARCHAR(150) NOT NULL,
  unit      VARCHAR(60),
  quantity  INTEGER CHECK (quantity >= 0),
  condition VARCHAR(10) CHECK (condition IN ('new','old')),
  note      TEXT
);

-- ───────── Operations history (who changed what) ─────────
-- Written by the application for every change to school data; rows can never be edited or deleted.
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID REFERENCES schools(id) ON DELETE RESTRICT,
  user_id     UUID REFERENCES users(id) ON DELETE RESTRICT,
  user_name   VARCHAR(255) NOT NULL,                         -- kept even if the user is renamed
  user_role   VARCHAR(20) NOT NULL,
  action      VARCHAR(10) NOT NULL CHECK (action IN ('create','update','delete','save')),
  entity      VARCHAR(30) NOT NULL,
  entity_id   UUID,
  description TEXT NOT NULL,
  changes     JSONB,                                          -- [{field, from, to}] for updates
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_school_time_idx ON audit_log (school_id, created_at DESC);

CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log rows cannot be changed or deleted';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_log_no_change ON audit_log;
CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- ───────── Grading ─────────
-- Max marks per class AND subject, from the ministry grade books.
--   coursework = oral + homework + activity + quiz + quiz2
--   exam       = exam + exam2
-- Both sums must equal total_max; the semester result is (coursework + exam) / 2.
-- A component with max 0 is not used by that subject. labels renames columns,
-- e.g. {"homework":"العملي","exam":"الامتحان (تحريري)"}.
CREATE TABLE IF NOT EXISTS grading_schemes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id   UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  oral_max     SMALLINT NOT NULL DEFAULT 0 CHECK (oral_max >= 0),
  homework_max SMALLINT NOT NULL DEFAULT 0 CHECK (homework_max >= 0),
  activity_max SMALLINT NOT NULL DEFAULT 0 CHECK (activity_max >= 0),
  quiz_max     SMALLINT NOT NULL DEFAULT 0 CHECK (quiz_max >= 0),
  quiz2_max    SMALLINT NOT NULL DEFAULT 0 CHECK (quiz2_max >= 0),
  exam_max     SMALLINT NOT NULL DEFAULT 0 CHECK (exam_max >= 0),
  exam2_max    SMALLINT NOT NULL DEFAULT 0 CHECK (exam2_max >= 0),
  total_max    SMALLINT NOT NULL CHECK (total_max > 0),
  pass_mark    SMALLINT CHECK (pass_mark >= 0),               -- minimum mark for the subject (الدرجة الصغرى)
  is_provisional BOOLEAN NOT NULL DEFAULT FALSE,              -- temporary structure, to be replaced
  labels       JSONB NOT NULL DEFAULT '{}',
  UNIQUE (class_id, subject_id),
  CHECK (oral_max + homework_max + activity_max + quiz_max + quiz2_max = total_max),
  CHECK (exam_max + exam2_max = total_max),
  CHECK (pass_mark IS NULL OR pass_mark <= total_max)
);

-- One row per student, subject, semester. NULL = not entered yet.
-- The subject must be in the curriculum of the student's class (composite FK).
CREATE TABLE IF NOT EXISTS grades (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id    UUID NOT NULL,
  academic_year_id UUID NOT NULL,
  class_id         UUID NOT NULL,
  subject_id       UUID NOT NULL,
  semester         SMALLINT NOT NULL CHECK (semester IN (1, 2)),
  oral             NUMERIC(5,2) CHECK (oral >= 0),
  homework         NUMERIC(5,2) CHECK (homework >= 0),
  activity         NUMERIC(5,2) CHECK (activity >= 0),
  quiz             NUMERIC(5,2) CHECK (quiz >= 0),
  quiz2            NUMERIC(5,2) CHECK (quiz2 >= 0),
  exam             NUMERIC(5,2) CHECK (exam >= 0),
  exam2            NUMERIC(5,2) CHECK (exam2 >= 0),
  FOREIGN KEY (enrollment_id, academic_year_id, class_id)
    REFERENCES enrollments (id, academic_year_id, class_id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id, class_id, subject_id)
    REFERENCES curriculum (academic_year_id, class_id, subject_id) ON DELETE RESTRICT,
  UNIQUE (enrollment_id, subject_id, semester)
);
CREATE INDEX IF NOT EXISTS grades_subject_idx ON grades (subject_id);

-- Grades of a computed (parent) subject can never be entered directly.
CREATE OR REPLACE FUNCTION block_computed_grades() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM curriculum c
             WHERE c.academic_year_id = NEW.academic_year_id AND c.class_id = NEW.class_id
               AND c.part_of_subject_id = NEW.subject_id) THEN
    RAISE EXCEPTION 'Grades of a computed subject cannot be entered directly' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS grades_not_computed ON grades;
CREATE TRIGGER grades_not_computed BEFORE INSERT OR UPDATE ON grades
  FOR EACH ROW EXECUTE FUNCTION block_computed_grades();

-- ───────── Views ─────────
-- Totals follow the subject's scheme: a total exists only when every component the
-- scheme uses has been entered (coursework and exam are tracked separately).
CREATE OR REPLACE VIEW grade_results AS
SELECT t.id, t.enrollment_id, t.academic_year_id, t.class_id, t.subject_id, t.semester,
       t.oral, t.homework, t.activity, t.quiz, t.quiz2, t.exam, t.exam2,
       CASE WHEN t.works_ok THEN t.cw END AS coursework_total,
       CASE WHEN t.exam_ok  THEN t.ex END AS exam_total,
       CASE WHEN t.works_ok AND t.exam_ok THEN ROUND((t.cw + t.ex) / 2, 2) END AS semester_total
FROM (
  SELECT g.*,
    (s.id IS NOT NULL
       AND (s.oral_max = 0     OR g.oral     IS NOT NULL)
       AND (s.homework_max = 0 OR g.homework IS NOT NULL)
       AND (s.activity_max = 0 OR g.activity IS NOT NULL)
       AND (s.quiz_max = 0     OR g.quiz     IS NOT NULL)
       AND (s.quiz2_max = 0    OR g.quiz2    IS NOT NULL)) AS works_ok,
    (s.id IS NOT NULL
       AND (s.exam_max = 0  OR g.exam  IS NOT NULL)
       AND (s.exam2_max = 0 OR g.exam2 IS NOT NULL)) AS exam_ok,
    COALESCE(g.oral,0) + COALESCE(g.homework,0) + COALESCE(g.activity,0)
      + COALESCE(g.quiz,0) + COALESCE(g.quiz2,0) AS cw,
    COALESCE(g.exam,0) + COALESCE(g.exam2,0) AS ex
  FROM grades g
  LEFT JOIN grading_schemes s ON s.class_id = g.class_id AND s.subject_id = g.subject_id
) t;

-- Final result = average of both semesters (only when both exist)
CREATE OR REPLACE VIEW final_grades AS
SELECT
  enrollment_id,
  subject_id,
  MAX(semester_total) FILTER (WHERE semester = 1) AS semester1_total,
  MAX(semester_total) FILTER (WHERE semester = 2) AS semester2_total,
  CASE WHEN COUNT(semester_total) = 2 THEN ROUND(AVG(semester_total), 2) END AS final_total
FROM grade_results
GROUP BY enrollment_id, subject_id;

-- Computed subjects (parents): average of their parts' semester totals, per student and semester
CREATE OR REPLACE VIEW computed_results AS
SELECT e.id AS enrollment_id, part.part_of_subject_id AS subject_id, sem.semester,
       CASE WHEN COUNT(gr.semester_total) = COUNT(*) THEN ROUND(AVG(gr.semester_total), 2) END AS semester_total
FROM enrollments e
JOIN curriculum part ON part.academic_year_id = e.academic_year_id
                    AND part.class_id = e.class_id AND part.part_of_subject_id IS NOT NULL
CROSS JOIN (VALUES (1), (2)) AS sem(semester)
LEFT JOIN grade_results gr ON gr.enrollment_id = e.id AND gr.subject_id = part.subject_id AND gr.semester = sem.semester
GROUP BY e.id, part.part_of_subject_id, sem.semester;

-- One row per student and subject: both semesters and the final, for entered AND computed subjects
CREATE OR REPLACE VIEW subject_results AS
SELECT enrollment_id, subject_id, semester1_total, semester2_total, final_total, FALSE AS computed
FROM final_grades
UNION ALL
SELECT enrollment_id, subject_id,
       MAX(semester_total) FILTER (WHERE semester = 1),
       MAX(semester_total) FILTER (WHERE semester = 2),
       CASE WHEN COUNT(semester_total) = 2 THEN ROUND(AVG(semester_total), 2) END,
       TRUE
FROM computed_results
GROUP BY enrollment_id, subject_id;

-- Plan subjects that still have no grading scheme (computed parents need none)
CREATE OR REPLACE VIEW curriculum_without_scheme AS
SELECT cu.academic_year_id, cu.class_id, cu.subject_id
FROM curriculum cu
LEFT JOIN grading_schemes s ON s.class_id = cu.class_id AND s.subject_id = cu.subject_id
WHERE s.id IS NULL
  AND NOT EXISTS (SELECT 1 FROM curriculum p
                  WHERE p.academic_year_id = cu.academic_year_id AND p.class_id = cu.class_id
                    AND p.part_of_subject_id = cu.subject_id);

-- Weekly periods per class; total must equal periods_per_day * school_days_per_week (35)
CREATE OR REPLACE VIEW class_weekly_load AS
SELECT
  cu.academic_year_id,
  cu.class_id,
  COALESCE(SUM(cu.weekly_periods) FILTER (WHERE s.category = 'sharia'), 0)      AS sharia_periods,
  COALESCE(SUM(cu.weekly_periods) FILTER (WHERE s.category = 'educational'), 0) AS educational_periods,
  SUM(cu.weekly_periods)                                                        AS total_periods
FROM curriculum cu
JOIN subjects s ON s.id = cu.subject_id
GROUP BY cu.academic_year_id, cu.class_id;

CREATE INDEX IF NOT EXISTS students_school_idx ON students (school_id);
CREATE INDEX IF NOT EXISTS teachers_school_idx ON teachers (school_id);
CREATE INDEX IF NOT EXISTS class_groups_school_idx ON class_groups (school_id);
CREATE INDEX IF NOT EXISTS enrollments_school_idx ON enrollments (school_id);
`;
