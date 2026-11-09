import { sql } from './db';

const PAGE_SIZE = 10;
const currentYear = () => sql`(SELECT id FROM academic_years WHERE is_current)`;

export async function getCurrentYear() {
  const [y] = await sql<
    { id: string; name: string; periods_per_day: number; school_days_per_week: number; period_minutes: number }[]
  >`SELECT id, name, periods_per_day, period_minutes, school_days_per_week FROM academic_years WHERE is_current`;
  if (!y) throw new Error('لا توجد سنة دراسية حالية.');
  return y;
}

/* ───────── Overview ───────── */
export async function fetchOverview(today: string) {
  const [r] = await sql<
    { students: string; teachers: string; groups: string; present: string; recorded: string }[]
  >`SELECT
      (SELECT COUNT(*) FROM students WHERE status = 'active') AS students,
      (SELECT COUNT(*) FROM teachers WHERE status = 'active') AS teachers,
      (SELECT COUNT(*) FROM class_groups WHERE academic_year_id = ${currentYear()}) AS groups,
      (SELECT COUNT(*) FROM attendance WHERE date = ${today}::date AND status IN ('present','late')) AS present,
      (SELECT COUNT(*) FROM attendance WHERE date = ${today}::date) AS recorded`;
  return {
    students: Number(r.students), teachers: Number(r.teachers), groups: Number(r.groups),
    present: Number(r.present), recorded: Number(r.recorded),
  };
}

/* ───────── Students ───────── */
export async function fetchStudents(query: string, page: number) {
  const q = `%${query}%`;
  const offset = (page - 1) * PAGE_SIZE;
  const rows = await sql<
    { id: string; student_number: string; full_name: string; gender: string; status: string;
      class_name: string | null; group_name: string | null }[]
  >`SELECT s.id, s.student_number, s.full_name, s.gender, s.status, c.name AS class_name, g.name AS group_name
    FROM students s
    LEFT JOIN enrollments e ON e.student_id = s.id AND e.academic_year_id = ${currentYear()}
    LEFT JOIN class_groups g ON g.id = e.class_group_id
    LEFT JOIN classes c ON c.id = g.class_id
    WHERE s.full_name ILIKE ${q} OR s.student_number ILIKE ${q} OR s.guardian_name ILIKE ${q}
    ORDER BY s.full_name
    LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*) FROM students s
    WHERE s.full_name ILIKE ${q} OR s.student_number ILIKE ${q} OR s.guardian_name ILIKE ${q}`;
  return { rows, totalPages: Math.max(1, Math.ceil(Number(count) / PAGE_SIZE)) };
}

export async function fetchStudent(id: string) {
  const [s] = await sql<
    { id: string; student_number: string; full_name: string; gender: string; date_of_birth: string | null;
      guardian_name: string | null; guardian_phone: string | null; status: string; group_id: string | null }[]
  >`SELECT s.id, s.student_number, s.full_name, s.gender, s.date_of_birth::text AS date_of_birth,
           s.guardian_name, s.guardian_phone, s.status, e.class_group_id AS group_id
    FROM students s
    LEFT JOIN enrollments e ON e.student_id = s.id AND e.academic_year_id = ${currentYear()}
    WHERE s.id = ${id}`;
  return s;
}

/* ───────── Teachers ───────── */
export async function fetchTeachers(query: string, page: number) {
  const q = `%${query}%`;
  const offset = (page - 1) * PAGE_SIZE;
  const rows = await sql<
    { id: string; full_name: string; email: string; phone: string | null; status: string; subjects: string }[]
  >`SELECT t.id, t.full_name, t.email, t.phone, t.status,
           (SELECT COUNT(*) FROM teaching_assignments a WHERE a.teacher_id = t.id) AS subjects
    FROM teachers t
    WHERE t.full_name ILIKE ${q} OR t.email ILIKE ${q} OR t.phone ILIKE ${q}
    ORDER BY t.full_name LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*) FROM teachers t WHERE t.full_name ILIKE ${q} OR t.email ILIKE ${q} OR t.phone ILIKE ${q}`;
  return { rows, totalPages: Math.max(1, Math.ceil(Number(count) / PAGE_SIZE)) };
}

export async function fetchTeacher(id: string) {
  const [t] = await sql<
    { id: string; full_name: string; email: string; phone: string | null; hire_date: string | null; status: string }[]
  >`SELECT id, full_name, email, phone, hire_date::text AS hire_date, status FROM teachers WHERE id = ${id}`;
  return t;
}

export const fetchTeacherOptions = () =>
  sql<{ id: string; full_name: string }[]>`
    SELECT id, full_name FROM teachers WHERE status = 'active' ORDER BY full_name`;

/* ───────── Subjects ───────── */
export const fetchSubjects = (query: string) =>
  sql<{ id: string; name: string; category: string }[]>`
    SELECT id, name, category FROM subjects WHERE name ILIKE ${`%${query}%`} ORDER BY sort_order`;

export async function fetchSubject(id: string) {
  const [s] = await sql<{ id: string; name: string; category: string }[]>`
    SELECT id, name, category FROM subjects WHERE id = ${id}`;
  return s;
}

/* ───────── Classes + curriculum ───────── */
export const fetchClasses = () =>
  sql<
    { id: string; name: string; grade_level: number; track: string; stage: string;
      groups: string; students: string; periods: string }[]
  >`SELECT c.id, c.name, c.grade_level, c.track, c.stage,
      (SELECT COUNT(*) FROM class_groups g WHERE g.class_id = c.id AND g.academic_year_id = y.id) AS groups,
      (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id AND e.academic_year_id = y.id) AS students,
      COALESCE(l.total_periods, 0) AS periods
    FROM classes c
    CROSS JOIN academic_years y
    LEFT JOIN class_weekly_load l ON l.class_id = c.id AND l.academic_year_id = y.id
    WHERE y.is_current
    ORDER BY c.grade_level, c.track`;

export async function fetchClass(id: string) {
  const [c] = await sql<{ id: string; name: string; grade_level: number; track: string }[]>`
    SELECT id, name, grade_level, track FROM classes WHERE id = ${id}`;
  return c;
}

export const fetchCurriculum = (classId: string) =>
  sql<{ subject_id: string; name: string; category: string; weekly_periods: number }[]>`
    SELECT s.id AS subject_id, s.name, s.category, cu.weekly_periods
    FROM curriculum cu JOIN subjects s ON s.id = cu.subject_id
    WHERE cu.class_id = ${classId} AND cu.academic_year_id = ${currentYear()}
    ORDER BY s.sort_order`;

export const fetchSubjectOptions = () =>
  sql<{ id: string; name: string; category: string }[]>`SELECT id, name, category FROM subjects ORDER BY sort_order`;

export const fetchClassOptions = () =>
  sql<{ id: string; name: string }[]>`SELECT id, name FROM classes ORDER BY grade_level, track`;

/* ───────── Class groups ───────── */
export const fetchGroups = () =>
  sql<
    { id: string; name: string; capacity: number | null; class_name: string; students: string }[]
  >`SELECT g.id, g.name, g.capacity, c.name AS class_name,
      (SELECT COUNT(*) FROM enrollments e WHERE e.class_group_id = g.id) AS students
    FROM class_groups g JOIN classes c ON c.id = g.class_id
    WHERE g.academic_year_id = ${currentYear()}
    ORDER BY c.grade_level, c.track, g.name`;

export const fetchGroupOptions = () =>
  sql<{ value: string; label: string }[]>`
    SELECT g.id AS value, c.name || ' - ' || g.name AS label
    FROM class_groups g JOIN classes c ON c.id = g.class_id
    WHERE g.academic_year_id = ${currentYear()}
    ORDER BY c.grade_level, c.track, g.name`;

export async function fetchGroup(id: string) {
  const [g] = await sql<{ id: string; name: string; capacity: number | null; class_id: string; class_name: string }[]>`
    SELECT g.id, g.name, g.capacity, g.class_id, c.name AS class_name
    FROM class_groups g JOIN classes c ON c.id = g.class_id WHERE g.id = ${id}`;
  return g;
}

export const fetchGroupStudents = (groupId: string) =>
  sql<{ enrollment_id: string; full_name: string; student_number: string }[]>`
    SELECT e.id AS enrollment_id, s.full_name, s.student_number
    FROM enrollments e JOIN students s ON s.id = e.student_id
    WHERE e.class_group_id = ${groupId} ORDER BY s.full_name`;

export const fetchUnassignedStudents = () =>
  sql<{ id: string; full_name: string; student_number: string }[]>`
    SELECT s.id, s.full_name, s.student_number FROM students s
    WHERE s.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = s.id AND e.academic_year_id = ${currentYear()})
    ORDER BY s.full_name`;

// Plan subjects of the group's class, with the teacher assigned in this group (if any)
export const fetchGroupAssignments = (groupId: string) =>
  sql<{ subject_id: string; name: string; weekly_periods: number; teacher_id: string | null }[]>`
    SELECT s.id AS subject_id, s.name, cu.weekly_periods, ta.teacher_id
    FROM class_groups g
    JOIN curriculum cu ON cu.class_id = g.class_id AND cu.academic_year_id = g.academic_year_id
    JOIN subjects s ON s.id = cu.subject_id
    LEFT JOIN teaching_assignments ta ON ta.class_group_id = g.id AND ta.subject_id = s.id
    WHERE g.id = ${groupId} ORDER BY s.sort_order`;

/* ───────── Attendance ───────── */
export const fetchAttendance = (groupId: string, date: string) =>
  sql<{ enrollment_id: string; full_name: string; student_number: string; status: string | null; note: string | null }[]>`
    SELECT e.id AS enrollment_id, s.full_name, s.student_number, a.status, a.note
    FROM enrollments e JOIN students s ON s.id = e.student_id
    LEFT JOIN attendance a ON a.enrollment_id = e.id AND a.date = ${date}::date
    WHERE e.class_group_id = ${groupId} ORDER BY s.full_name`;

/* ───────── Grades ───────── */
export async function fetchScheme(groupId: string, subjectId: string) {
  const [s] = await sql<
    { oral_max: number; homework_max: number; quiz_max: number; exam_max: number; total_max: number }[]
  >`SELECT gs.oral_max, gs.homework_max, gs.quiz_max, gs.exam_max, gs.total_max
    FROM grading_schemes gs
    WHERE gs.class_id = (SELECT class_id FROM class_groups WHERE id = ${groupId})
      AND (gs.subject_id = ${subjectId} OR gs.subject_id IS NULL)
    ORDER BY gs.subject_id NULLS LAST LIMIT 1`;
  return s;
}

export const fetchGradeSheet = (groupId: string, subjectId: string, semester: number) =>
  sql<
    { enrollment_id: string; full_name: string; student_number: string;
      oral: string | null; homework: string | null; quiz: string | null; exam: string | null;
      coursework_total: string | null; semester_total: string | null; final_total: string | null }[]
  >`SELECT e.id AS enrollment_id, s.full_name, s.student_number,
           g.oral, g.homework, g.quiz, g.exam, g.coursework_total, g.semester_total, f.final_total
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    LEFT JOIN grades g ON g.enrollment_id = e.id AND g.subject_id = ${subjectId} AND g.semester = ${semester}
    LEFT JOIN final_grades f ON f.enrollment_id = e.id AND f.subject_id = ${subjectId}
    WHERE e.class_group_id = ${groupId} ORDER BY s.full_name`;
