import { sql } from './db';
import { requireSchool, requireScope } from './session';
import type { Scheme } from './grading';

const PAGE_SIZE = 10;
const currentYear = () => sql`(SELECT id FROM academic_years WHERE is_current)`;
// All school data is filtered by the signed-in user's school (education directors are redirected away)
const sid = async () => (await requireSchool()).schoolId;

export async function getCurrentYear() {
  const [y] = await sql<
    { id: string; name: string; periods_per_day: number; school_days_per_week: number; period_minutes: number }[]
  >`SELECT id, name, periods_per_day, period_minutes, school_days_per_week FROM academic_years WHERE is_current`;
  if (!y) throw new Error('لا توجد سنة دراسية حالية.');
  return y;
}

/* ───────── Overview ───────── */
export async function fetchOverview(today: string) {
  const sch = await sid();
  const [r] = await sql<
    { students: string; teachers: string; groups: string; present: string; recorded: string; missing: string; provisional: string }[]
  >`SELECT
      (SELECT COUNT(*) FROM students WHERE school_id = ${sch} AND status = 'active') AS students,
      (SELECT COUNT(*) FROM teachers WHERE school_id = ${sch} AND status = 'active') AS teachers,
      (SELECT COUNT(*) FROM class_groups WHERE school_id = ${sch} AND academic_year_id = ${currentYear()}) AS groups,
      (SELECT COUNT(*) FROM attendance a JOIN enrollments e ON e.id = a.enrollment_id
        WHERE e.school_id = ${sch} AND a.date = ${today}::date AND a.status IN ('present','late')) AS present,
      (SELECT COUNT(*) FROM attendance a JOIN enrollments e ON e.id = a.enrollment_id
        WHERE e.school_id = ${sch} AND a.date = ${today}::date) AS recorded,
      (SELECT COUNT(*) FROM curriculum_without_scheme WHERE academic_year_id = ${currentYear()}) AS missing,
      (SELECT COUNT(*) FROM grading_schemes WHERE is_provisional) AS provisional`;
  return {
    students: Number(r.students), teachers: Number(r.teachers), groups: Number(r.groups),
    present: Number(r.present), recorded: Number(r.recorded), missingSchemes: Number(r.missing), provisionalSchemes: Number(r.provisional),
  };
}

/* ───────── Students ───────── */
export async function fetchStudents(query: string, page: number) {
  const sch = await sid();
  const q = `%${query}%`;
  const offset = (page - 1) * PAGE_SIZE;
  const rows = await sql<
    { id: string; student_number: string | null; full_name: string; gender: string; status: string;
      registration_status: string; address: string | null; guardian_phone: string | null; route_name: string | null;
      class_name: string | null; group_name: string | null }[]
  >`SELECT s.id, s.student_number, s.full_name, s.gender, s.status, s.registration_status, s.address, s.guardian_phone,
           tr.name AS route_name, c.name AS class_name, g.name AS group_name
    FROM students s
    LEFT JOIN transport_routes tr ON tr.id = s.transport_route_id
    LEFT JOIN enrollments e ON e.student_id = s.id AND e.academic_year_id = ${currentYear()}
    LEFT JOIN class_groups g ON g.id = e.class_group_id
    LEFT JOIN classes c ON c.id = g.class_id
    WHERE s.school_id = ${sch} AND (s.full_name ILIKE ${q} OR s.student_number ILIKE ${q} OR s.guardian_name ILIKE ${q} OR s.address ILIKE ${q} OR s.guardian_phone ILIKE ${q})
    ORDER BY s.full_name
    LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*) FROM students s
    WHERE s.school_id = ${sch} AND (s.full_name ILIKE ${q} OR s.student_number ILIKE ${q} OR s.guardian_name ILIKE ${q} OR s.address ILIKE ${q} OR s.guardian_phone ILIKE ${q})`;
  return { rows, totalPages: Math.max(1, Math.ceil(Number(count) / PAGE_SIZE)) };
}

export async function fetchStudent(id: string) {
  const sch = await sid();
  const [s] = await sql<
    { id: string; student_number: string | null; full_name: string; gender: string; date_of_birth: string | null;
      guardian_name: string | null; guardian_phone: string | null; guardian_phone2: string | null; address: string | null;
      registration_status: string; missing_documents: string | null; transport_route_id: string | null;
      status: string; group_id: string | null }[]
  >`SELECT s.id, s.student_number, s.full_name, s.gender, s.date_of_birth::text AS date_of_birth,
           s.guardian_name, s.guardian_phone, s.guardian_phone2, s.address, s.registration_status, s.missing_documents,
           s.transport_route_id, s.status, e.class_group_id AS group_id
    FROM students s
    LEFT JOIN enrollments e ON e.student_id = s.id AND e.academic_year_id = ${currentYear()}
    WHERE s.id = ${id} AND s.school_id = ${sch}`;
  return s;
}

/* ───────── Teachers ───────── */
export async function fetchTeachers(query: string, page: number) {
  const sch = await sid();
  const q = `%${query}%`;
  const offset = (page - 1) * PAGE_SIZE;
  const rows = await sql<
    { id: string; full_name: string; email: string | null; phone: string | null; status: string; periods: string }[]
  >`SELECT t.id, t.full_name, t.email, t.phone, t.status,
           COALESCE((SELECT SUM(cu.weekly_periods) FROM teaching_assignments a
                       JOIN curriculum cu ON cu.academic_year_id = a.academic_year_id AND cu.class_id = a.class_id
                                         AND cu.subject_id = a.subject_id
                      WHERE a.teacher_id = t.id AND a.academic_year_id = ${currentYear()}), 0) AS periods
    FROM teachers t
    WHERE t.school_id = ${sch} AND (t.full_name ILIKE ${q} OR t.email ILIKE ${q} OR t.phone ILIKE ${q})
    ORDER BY t.full_name LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*) FROM teachers t WHERE t.school_id = ${sch} AND (t.full_name ILIKE ${q} OR t.email ILIKE ${q} OR t.phone ILIKE ${q})`;
  return { rows, totalPages: Math.max(1, Math.ceil(Number(count) / PAGE_SIZE)) };
}

export async function fetchTeacher(id: string) {
  const sch = await sid();
  const [t] = await sql<
    { id: string; full_name: string; email: string | null; phone: string | null; hire_date: string | null; status: string }[]
  >`SELECT id, full_name, email, phone, hire_date::text AS hire_date, status FROM teachers WHERE id = ${id} AND school_id = ${sch}`;
  return t;
}

export async function fetchTeacherOptions() {
  const sch = await sid();
  return sql<{ id: string; full_name: string }[]>`
    SELECT id, full_name FROM teachers WHERE school_id = ${sch} AND status = 'active' ORDER BY full_name`;
}

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
export async function fetchClasses() {
  const sch = (await requireScope()).schoolId; // null for the education director: counts over all schools
  return sql<
    { id: string; name: string; grade_level: number; track: string; stage: string;
      groups: string; students: string; periods: string; missing_schemes: string }[]
  >`SELECT c.id, c.name, c.grade_level, c.track, c.stage,
      (SELECT COUNT(*) FROM class_groups g WHERE g.class_id = c.id AND g.academic_year_id = y.id
                AND (${sch}::uuid IS NULL OR g.school_id = ${sch}::uuid)) AS groups,
      (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id AND e.academic_year_id = y.id
                AND (${sch}::uuid IS NULL OR e.school_id = ${sch}::uuid)) AS students,
      COALESCE(l.total_periods, 0) AS periods,
      (SELECT COUNT(*) FROM curriculum_without_scheme m WHERE m.class_id = c.id AND m.academic_year_id = y.id) AS missing_schemes
    FROM classes c
    CROSS JOIN academic_years y
    LEFT JOIN class_weekly_load l ON l.class_id = c.id AND l.academic_year_id = y.id
    WHERE y.is_current
    ORDER BY c.grade_level, c.track`;
}

export async function fetchClass(id: string) {
  const [c] = await sql<{ id: string; name: string; grade_level: number; track: string }[]>`
    SELECT id, name, grade_level, track FROM classes WHERE id = ${id}`;
  return c;
}

export const fetchCurriculum = (classId: string) =>
  sql<
    { subject_id: string; name: string; category: string; weekly_periods: number; scheme_total: number | null;
      part_of_subject_id: string | null; part_of_name: string | null; is_parent: boolean; scheme_provisional: boolean | null }[]
  >`
    SELECT s.id AS subject_id, s.name, s.category, cu.weekly_periods, gs.total_max AS scheme_total, gs.is_provisional AS scheme_provisional,
           cu.part_of_subject_id, par.name AS part_of_name,
           EXISTS (SELECT 1 FROM curriculum k WHERE k.academic_year_id = cu.academic_year_id
                     AND k.class_id = cu.class_id AND k.part_of_subject_id = cu.subject_id) AS is_parent
    FROM curriculum cu JOIN subjects s ON s.id = cu.subject_id
    LEFT JOIN subjects par ON par.id = cu.part_of_subject_id
    LEFT JOIN grading_schemes gs ON gs.class_id = cu.class_id AND gs.subject_id = cu.subject_id
    WHERE cu.class_id = ${classId} AND cu.academic_year_id = ${currentYear()}
    ORDER BY COALESCE(par.sort_order, s.sort_order), cu.part_of_subject_id IS NOT NULL, s.sort_order`;

export const fetchSubjectOptions = () =>
  sql<{ id: string; name: string; category: string }[]>`SELECT id, name, category FROM subjects ORDER BY sort_order`;

export const fetchClassOptions = () =>
  sql<{ id: string; name: string }[]>`SELECT id, name FROM classes ORDER BY grade_level, track`;

/* ───────── Class groups ───────── */
export async function fetchGroups() {
  const sch = await sid();
  return sql<
    { id: string; name: string; capacity: number | null; class_name: string; students: string }[]
  >`SELECT g.id, g.name, g.capacity, c.name AS class_name,
      (SELECT COUNT(*) FROM enrollments e WHERE e.class_group_id = g.id) AS students
    FROM class_groups g JOIN classes c ON c.id = g.class_id
    WHERE g.school_id = ${sch} AND g.academic_year_id = ${currentYear()}
    ORDER BY c.grade_level, c.track, g.name`;
}

export async function fetchGroupOptions() {
  const sch = await sid();
  return sql<{ value: string; label: string }[]>`
    SELECT g.id AS value, c.name || ' - ' || g.name AS label
    FROM class_groups g JOIN classes c ON c.id = g.class_id
    WHERE g.school_id = ${sch} AND g.academic_year_id = ${currentYear()}
    ORDER BY c.grade_level, c.track, g.name`;
}

export async function fetchGroup(id: string) {
  const sch = await sid();
  const [g] = await sql<{ id: string; name: string; capacity: number | null; class_id: string; class_name: string }[]>`
    SELECT g.id, g.name, g.capacity, g.class_id, c.name AS class_name
    FROM class_groups g JOIN classes c ON c.id = g.class_id WHERE g.id = ${id} AND g.school_id = ${sch}`;
  return g;
}

export async function fetchGroupStudents(groupId: string) {
  const sch = await sid();
  return sql<{ enrollment_id: string; full_name: string; student_number: string | null }[]>`
    SELECT e.id AS enrollment_id, s.full_name, s.student_number
    FROM enrollments e JOIN students s ON s.id = e.student_id
    WHERE e.class_group_id = ${groupId} AND e.school_id = ${sch} ORDER BY s.full_name`;
}

export async function fetchUnassignedStudents() {
  const sch = await sid();
  return sql<{ id: string; full_name: string; student_number: string | null }[]>`
    SELECT s.id, s.full_name, s.student_number FROM students s
    WHERE s.school_id = ${sch} AND s.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = s.id AND e.academic_year_id = ${currentYear()})
    ORDER BY s.full_name`;
}

// Plan subjects of the group's class, with the teacher assigned in this group (if any)
export async function fetchGroupAssignments(groupId: string) {
  const sch = await sid();
  return sql<
    { subject_id: string; name: string; weekly_periods: number; teacher_id: string | null;
      part_of_subject_id: string | null; is_parent: boolean }[]
  >`
    SELECT s.id AS subject_id, s.name, cu.weekly_periods, ta.teacher_id, cu.part_of_subject_id,
           EXISTS (SELECT 1 FROM curriculum k WHERE k.academic_year_id = g.academic_year_id
                     AND k.class_id = g.class_id AND k.part_of_subject_id = cu.subject_id) AS is_parent
    FROM class_groups g
    JOIN curriculum cu ON cu.class_id = g.class_id AND cu.academic_year_id = g.academic_year_id
    JOIN subjects s ON s.id = cu.subject_id
    LEFT JOIN subjects par ON par.id = cu.part_of_subject_id
    LEFT JOIN teaching_assignments ta ON ta.class_group_id = g.id AND ta.subject_id = s.id
    WHERE g.id = ${groupId} AND g.school_id = ${sch} ORDER BY COALESCE(par.sort_order, s.sort_order), cu.part_of_subject_id IS NOT NULL, s.sort_order`;
}

/* ───────── Attendance ───────── */
export async function fetchAttendance(groupId: string, date: string) {
  const sch = await sid();
  return sql<{ enrollment_id: string; full_name: string; student_number: string | null; status: string | null; note: string | null }[]>`
    SELECT e.id AS enrollment_id, s.full_name, s.student_number, a.status, a.note
    FROM enrollments e JOIN students s ON s.id = e.student_id
    LEFT JOIN attendance a ON a.enrollment_id = e.id AND a.date = ${date}::date
    WHERE e.class_group_id = ${groupId} AND e.school_id = ${sch} ORDER BY s.full_name`;
}

/* ───────── Grades ───────── */
export async function fetchScheme(groupId: string, subjectId: string) {
  const sch = await sid();
  const [s] = await sql<Scheme[]>`
    SELECT oral_max, homework_max, activity_max, quiz_max, quiz2_max, exam_max, exam2_max, total_max, pass_mark, is_provisional, labels FROM grading_schemes
    WHERE class_id = (SELECT class_id FROM class_groups WHERE id = ${groupId} AND school_id = ${sch}) AND subject_id = ${subjectId}`;
  return s;
}

export async function fetchSchemeByClass(classId: string, subjectId: string) {
  const [s] = await sql<Scheme[]>`
    SELECT oral_max, homework_max, activity_max, quiz_max, quiz2_max, exam_max, exam2_max, total_max, pass_mark, is_provisional, labels FROM grading_schemes WHERE class_id = ${classId} AND subject_id = ${subjectId}`;
  return s;
}

export async function fetchGradeSheet(groupId: string, subjectId: string, semester: number) {
  const sch = await sid();
  return sql<
    { enrollment_id: string; full_name: string; student_number: string | null;
      oral: string | null; homework: string | null; activity: string | null; quiz: string | null;
      quiz2: string | null; exam: string | null; exam2: string | null;
      coursework_total: string | null; semester_total: string | null; final_total: string | null }[]
  >`SELECT e.id AS enrollment_id, s.full_name, s.student_number,
           g.oral, g.homework, g.activity, g.quiz, g.quiz2, g.exam, g.exam2,
           g.coursework_total, g.semester_total, f.final_total
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    LEFT JOIN grade_results g ON g.enrollment_id = e.id AND g.subject_id = ${subjectId} AND g.semester = ${semester}
    LEFT JOIN final_grades f ON f.enrollment_id = e.id AND f.subject_id = ${subjectId}
    WHERE e.class_group_id = ${groupId} AND e.school_id = ${sch} ORDER BY s.full_name`;
}

/* ───────── Computed subjects (e.g. Social Studies = average of Geography and History) ───────── */
// Parts of a computed subject in the group's class (empty when the subject is an ordinary one)
export async function fetchParts(groupId: string, parentId: string) {
  const sch = await sid();
  return sql<{ subject_id: string; name: string }[]>`
    SELECT s.id AS subject_id, s.name
    FROM class_groups g
    JOIN curriculum part ON part.class_id = g.class_id AND part.academic_year_id = g.academic_year_id
                        AND part.part_of_subject_id = ${parentId}
    JOIN subjects s ON s.id = part.subject_id
    WHERE g.id = ${groupId} AND g.school_id = ${sch} ORDER BY s.sort_order`;
}

export async function fetchComputedSheet(groupId: string, parentId: string, semester: number) {
  const sch = await sid();
  const parts = await fetchParts(groupId, parentId);
  const [rows, sheets] = await Promise.all([
    sql<{ enrollment_id: string; full_name: string; computed_total: string | null; final_total: string | null }[]>`
      SELECT e.id AS enrollment_id, s.full_name, cr.semester_total AS computed_total, sr.final_total
      FROM enrollments e JOIN students s ON s.id = e.student_id
      LEFT JOIN computed_results cr ON cr.enrollment_id = e.id AND cr.subject_id = ${parentId} AND cr.semester = ${semester}
      LEFT JOIN subject_results sr ON sr.enrollment_id = e.id AND sr.subject_id = ${parentId}
      WHERE e.class_group_id = ${groupId} AND e.school_id = ${sch} ORDER BY s.full_name`,
    Promise.all(parts.map((p) => fetchGradeSheet(groupId, p.subject_id, semester))),
  ]);
  return {
    parts,
    rows: rows.map((r) => ({
      ...r,
      partTotals: sheets.map((sh) => sh.find((x) => x.enrollment_id === r.enrollment_id)?.semester_total ?? null),
    })),
  };
}

/* ───────── Results (all subjects of a group, with totals) ───────── */
export type ResultColumn = {
  subject_id: string; name: string; part_of_subject_id: string | null; is_parent: boolean; max_total: number | null;
  pass_mark: number | null;
};
type Totals = { semester1_total: string | null; semester2_total: string | null; final_total: string | null };

export async function fetchResults(groupId: string) {
  const sch = await sid();
  const [columns, values] = await Promise.all([
    sql<ResultColumn[]>`
      SELECT s.id AS subject_id, s.name, cu.part_of_subject_id,
        EXISTS (SELECT 1 FROM curriculum k WHERE k.academic_year_id = cu.academic_year_id
                  AND k.class_id = cu.class_id AND k.part_of_subject_id = cu.subject_id) AS is_parent,
        COALESCE(gs.total_max,
          (SELECT MAX(g2.total_max) FROM curriculum k
             JOIN grading_schemes g2 ON g2.class_id = k.class_id AND g2.subject_id = k.subject_id
            WHERE k.academic_year_id = cu.academic_year_id AND k.class_id = cu.class_id
              AND k.part_of_subject_id = cu.subject_id)) AS max_total,
        COALESCE(gs.pass_mark,
          (SELECT MAX(g3.pass_mark) FROM curriculum k
             JOIN grading_schemes g3 ON g3.class_id = k.class_id AND g3.subject_id = k.subject_id
            WHERE k.academic_year_id = cu.academic_year_id AND k.class_id = cu.class_id
              AND k.part_of_subject_id = cu.subject_id)) AS pass_mark
      FROM class_groups g
      JOIN curriculum cu ON cu.class_id = g.class_id AND cu.academic_year_id = g.academic_year_id
      JOIN subjects s ON s.id = cu.subject_id
      LEFT JOIN grading_schemes gs ON gs.class_id = cu.class_id AND gs.subject_id = cu.subject_id
      WHERE g.id = ${groupId} AND g.school_id = ${sch} ORDER BY s.sort_order`,
    sql<({ enrollment_id: string; full_name: string; student_number: string | null; subject_id: string | null } & Totals)[]>`
      SELECT e.id AS enrollment_id, st.full_name, st.student_number, sr.subject_id,
             sr.semester1_total, sr.semester2_total, sr.final_total
      FROM enrollments e JOIN students st ON st.id = e.student_id
      LEFT JOIN subject_results sr ON sr.enrollment_id = e.id
      WHERE e.class_group_id = ${groupId} AND e.school_id = ${sch} ORDER BY st.full_name`,
  ]);
  const students = new Map<string, { enrollment_id: string; full_name: string; results: Record<string, Totals> }>();
  for (const v of values) {
    const st = students.get(v.enrollment_id) ?? { enrollment_id: v.enrollment_id, full_name: v.full_name, results: {} };
    if (v.subject_id) st.results[v.subject_id] = { semester1_total: v.semester1_total, semester2_total: v.semester2_total, final_total: v.final_total };
    students.set(v.enrollment_id, st);
  }
  return { columns, students: [...students.values()] };
}

/* ───────── Transport ───────── */
export async function fetchRoutes() {
  const sch = await sid();
  return sql<{ id: string; name: string; driver_name: string; driver_phone: string | null; passengers: string }[]>`
    SELECT r.id, r.name, r.driver_name, r.driver_phone,
           (SELECT COUNT(*) FROM students s WHERE s.transport_route_id = r.id AND s.status = 'active') AS passengers
    FROM transport_routes r WHERE r.school_id = ${sch} ORDER BY r.name`;
}

export async function fetchRouteOptions() {
  const sch = await sid();
  return sql<{ value: string; label: string }[]>`
  SELECT id AS value, name AS label FROM transport_routes WHERE school_id = ${sch} ORDER BY name`;
}

export async function fetchRoute(id: string) {
  const sch = await sid();
  const [r] = await sql<{ id: string; name: string; driver_name: string; driver_phone: string | null }[]>`
    SELECT id, name, driver_name, driver_phone FROM transport_routes WHERE id = ${id} AND school_id = ${sch}`;
  return r;
}

export async function fetchRoutePassengers(routeId: string) {
  const sch = await sid();
  return sql<{ id: string; full_name: string; address: string | null; guardian_phone: string | null }[]>`
    SELECT id, full_name, address, guardian_phone FROM students
    WHERE school_id = ${sch} AND transport_route_id = ${routeId} ORDER BY full_name`;
}

export async function fetchStudentsWithoutRoute() {
  const sch = await sid();
  return sql<{ id: string; full_name: string }[]>`
    SELECT id, full_name FROM students WHERE school_id = ${sch} AND status = 'active' AND transport_route_id IS NULL ORDER BY full_name`;
}

/* ───────── Timetable ───────── */
export async function fetchBell() {
  const sch = await sid();
  return sql<{ position: number; kind: string; period_no: number | null; label: string; starts_at: string; ends_at: string; note: string | null }[]>`
    SELECT position, kind, period_no, label, to_char(starts_at, 'HH24:MI') AS starts_at,
           to_char(ends_at, 'HH24:MI') AS ends_at, note
    FROM bell_schedule WHERE school_id = ${sch} AND academic_year_id = ${currentYear()} ORDER BY position`;
}

export async function fetchGroupTimetable(groupId: string) {
  const sch = await sid();
  return sql<{ day_of_week: number; period_no: number; subject_id: string; subject: string; teacher: string }[]>`
    SELECT t.day_of_week, t.period_no, t.subject_id, s.name AS subject, te.full_name AS teacher
    FROM timetable_entries t JOIN subjects s ON s.id = t.subject_id JOIN teachers te ON te.id = t.teacher_id
    WHERE t.class_group_id = ${groupId} AND t.school_id = ${sch}`;
}

export async function fetchTeacherTimetable(teacherId: string) {
  const sch = await sid();
  return sql<{ day_of_week: number; period_no: number; subject: string; group_label: string }[]>`
    SELECT t.day_of_week, t.period_no, s.name AS subject, c.name || ' - ' || g.name AS group_label
    FROM timetable_entries t JOIN subjects s ON s.id = t.subject_id
    JOIN class_groups g ON g.id = t.class_group_id JOIN classes c ON c.id = g.class_id
    WHERE t.school_id = ${sch} AND t.teacher_id = ${teacherId} AND t.academic_year_id = ${currentYear()}`;
}

export async function fetchTimetableLoad(groupId: string) {
  const sch = await sid();
  return sql<{ subject: string; planned: number; scheduled: number }[]>`
    SELECT s.name AS subject, l.planned, l.scheduled
    FROM timetable_load l JOIN subjects s ON s.id = l.subject_id
    WHERE l.class_group_id = ${groupId}
      AND EXISTS (SELECT 1 FROM class_groups cg WHERE cg.id = l.class_group_id AND cg.school_id = ${sch}) ORDER BY s.sort_order`;
}

/* ───────── Textbooks ───────── */
export async function fetchTextbooks(groupId: string) {
  const sch = await sid();
  return sql<{ id: string; title: string }[]>`
    SELECT b.id, b.title FROM textbooks b
    WHERE b.class_id = (SELECT class_id FROM class_groups WHERE id = ${groupId} AND school_id = ${sch})
    ORDER BY COALESCE((SELECT sort_order FROM subjects WHERE id = b.subject_id), 99), b.title`;
}

export async function fetchHandoutSheet(groupId: string) {
  const sch = await sid();
  return sql<{ student_id: string; full_name: string; delivered: string[] }[]>`
    SELECT s.id AS student_id, s.full_name,
           COALESCE((SELECT array_agg(h.textbook_id::text) FROM textbook_handouts h
                     WHERE h.student_id = s.id AND h.academic_year_id = e.academic_year_id), '{}') AS delivered
    FROM enrollments e JOIN students s ON s.id = e.student_id
    WHERE e.class_group_id = ${groupId} AND e.school_id = ${sch} ORDER BY s.full_name`;
}

/* ───────── Class-opening requests ───────── */
export async function fetchRequests() {
  const sch = await sid();
  return sql<{ id: string; full_name: string; phone: string | null; status: string; class_name: string; class_id: string }[]>`
    SELECT q.id, q.full_name, q.phone, q.status, c.name AS class_name, c.id AS class_id
    FROM class_requests q JOIN classes c ON c.id = q.class_id
    WHERE q.school_id = ${sch}
    ORDER BY c.grade_level, c.track, q.full_name`;
}

export async function fetchRequest(id: string) {
  const sch = await sid();
  const [q] = await sql<{ id: string; class_id: string; full_name: string; phone: string | null; status: string; note: string | null }[]>`
    SELECT id, class_id, full_name, phone, status, note FROM class_requests WHERE id = ${id} AND school_id = ${sch}`;
  return q;
}

/* ───────── Inventory ───────── */
export async function fetchInventory(query: string) {
  const sch = await sid();
  const q = `%${query}%`;
  return sql<{ id: string; name: string; unit: string | null; quantity: number | null; condition: string | null }[]>`
    SELECT id, name, unit, quantity, condition FROM inventory_items
    WHERE school_id = ${sch} AND name ILIKE ${q} ORDER BY name`;
}

export async function fetchInventoryItem(id: string) {
  const sch = await sid();
  const [i] = await sql<{ id: string; name: string; unit: string | null; quantity: number | null; condition: string | null; note: string | null }[]>`
    SELECT id, name, unit, quantity, condition, note FROM inventory_items WHERE id = ${id} AND school_id = ${sch}`;
  return i;
}
