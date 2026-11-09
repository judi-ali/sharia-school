// Full database schema. Run by /seed. All statements are idempotent.
// Use `dropAll` (via /seed?reset=1) when the structure changes during development.
export const dropAll = /* sql */ `
DROP VIEW IF EXISTS final_grades, class_weekly_load;
DROP TABLE IF EXISTS grades, attendance, teaching_assignments, enrollments,
  grading_schemes, curriculum, class_groups, students, teachers, subjects,
  classes, academic_years, users CASCADE;
`;

export const schema = /* sql */ `
-- ───────── Auth ─────────
CREATE TABLE IF NOT EXISTS users (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name     VARCHAR(255) NOT NULL,
  email    TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role     VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin'))
);

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
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  name             VARCHAR(50) NOT NULL,                    -- 'Group 1'
  capacity         SMALLINT CHECK (capacity > 0),
  UNIQUE (class_id, academic_year_id, name),
  UNIQUE (id, academic_year_id, class_id)                   -- target of composite FKs below
);

-- ───────── People ─────────
CREATE TABLE IF NOT EXISTS teachers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name  VARCHAR(255) NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  phone      VARCHAR(30),
  hire_date  DATE,
  status     VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_number VARCHAR(30) NOT NULL UNIQUE,               -- school-issued ID
  full_name      VARCHAR(255) NOT NULL,
  gender         VARCHAR(10) NOT NULL CHECK (gender IN ('male','female')),
  date_of_birth  DATE,
  guardian_name  VARCHAR(255),
  guardian_phone VARCHAR(30),
  status         VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','graduated')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
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
CREATE TABLE IF NOT EXISTS curriculum (
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id       UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  weekly_periods   SMALLINT NOT NULL CHECK (weekly_periods BETWEEN 1 AND 35),
  PRIMARY KEY (academic_year_id, class_id, subject_id)
);

-- ───────── Relations ─────────
-- Student <-> class group, once per academic year.
-- class_id / academic_year_id are repeated on purpose so the composite FK
-- guarantees they match the group (the app fills them from the group).
CREATE TABLE IF NOT EXISTS enrollments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_group_id   UUID NOT NULL,
  academic_year_id UUID NOT NULL,
  class_id         UUID NOT NULL,
  FOREIGN KEY (class_group_id, academic_year_id, class_id)
    REFERENCES class_groups (id, academic_year_id, class_id) ON DELETE RESTRICT,
  UNIQUE (student_id, academic_year_id),
  UNIQUE (id, academic_year_id, class_id)                   -- target of grades FK
);
CREATE INDEX IF NOT EXISTS enrollments_group_idx ON enrollments (class_group_id);

-- Teacher teaches a subject in a class group.
-- The subject MUST be in the curriculum of the group's class for that year.
CREATE TABLE IF NOT EXISTS teaching_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  class_group_id   UUID NOT NULL,
  academic_year_id UUID NOT NULL,
  class_id         UUID NOT NULL,
  subject_id       UUID NOT NULL,
  FOREIGN KEY (class_group_id, academic_year_id, class_id)
    REFERENCES class_groups (id, academic_year_id, class_id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id, class_id, subject_id)
    REFERENCES curriculum (academic_year_id, class_id, subject_id) ON DELETE RESTRICT,
  UNIQUE (class_group_id, subject_id)                       -- one teacher per subject per group
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

-- ───────── Grading ─────────
-- Max marks (from the grade book): oral + homework + quiz = coursework; exam; total.
-- subject_id NULL = default for the whole class. Max marks do NOT follow weekly
-- periods (e.g. Geography G10 and G11 both have 2 periods but 200 vs 300).
CREATE TABLE IF NOT EXISTS grading_schemes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id   UUID REFERENCES subjects(id) ON DELETE CASCADE,
  oral_max     SMALLINT NOT NULL,   -- 25% of coursework
  homework_max SMALLINT NOT NULL,   -- 25% of coursework
  quiz_max     SMALLINT NOT NULL,   -- 50% of coursework (مذاكرة)
  exam_max     SMALLINT NOT NULL,
  total_max    SMALLINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS scheme_class_subject_uq
  ON grading_schemes (class_id, subject_id) WHERE subject_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS scheme_class_default_uq
  ON grading_schemes (class_id) WHERE subject_id IS NULL;

-- One row per student, subject, semester.
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
  quiz             NUMERIC(5,2) CHECK (quiz >= 0),
  exam             NUMERIC(5,2) CHECK (exam >= 0),
  -- computed by the database (NULL until all parts are entered)
  coursework_total NUMERIC(6,2) GENERATED ALWAYS AS (oral + homework + quiz) STORED,
  semester_total   NUMERIC(6,2) GENERATED ALWAYS AS
                   (ROUND((oral + homework + quiz + exam) / 2, 2)) STORED,
  FOREIGN KEY (enrollment_id, academic_year_id, class_id)
    REFERENCES enrollments (id, academic_year_id, class_id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id, class_id, subject_id)
    REFERENCES curriculum (academic_year_id, class_id, subject_id) ON DELETE RESTRICT,
  UNIQUE (enrollment_id, subject_id, semester)
);
CREATE INDEX IF NOT EXISTS grades_subject_idx ON grades (subject_id);

-- ───────── Views ─────────
-- Final result = average of both semesters (only when both exist)
CREATE OR REPLACE VIEW final_grades AS
SELECT
  enrollment_id,
  subject_id,
  MAX(semester_total) FILTER (WHERE semester = 1) AS semester1_total,
  MAX(semester_total) FILTER (WHERE semester = 2) AS semester2_total,
  CASE WHEN COUNT(semester_total) = 2 THEN ROUND(AVG(semester_total), 2) END AS final_total
FROM grades
GROUP BY enrollment_id, subject_id;

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
`;
