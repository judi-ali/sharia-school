import { sql } from './db';
import { requireRole, type SchoolScope } from './session';

const PAGE_SIZE = 20;

/* ───────── schools (education director) ───────── */
export async function fetchSchools() {
  await requireRole('education_director');
  return sql<
    { id: string; name: string; gender: string; directorate: string | null; is_active: boolean;
      director_name: string | null; director_email: string | null; students: string; teachers: string }[]
  >`SELECT s.id, s.name, s.gender, s.directorate, s.is_active, d.name AS director_name, d.email AS director_email,
           (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id AND st.status = 'active') AS students,
           (SELECT COUNT(*) FROM teachers t WHERE t.school_id = s.id AND t.status = 'active') AS teachers
    FROM schools s LEFT JOIN users d ON d.school_id = s.id AND d.role = 'school_director'
    ORDER BY s.name`;
}

export async function fetchSchoolForEdit(id: string) {
  await requireRole('education_director');
  const [s] = await sql<
    { id: string; name: string; gender: string; directorate: string | null; address: string | null; phone: string | null;
      is_active: boolean; director_name: string | null; director_email: string | null }[]
  >`SELECT s.id, s.name, s.gender, s.directorate, s.address, s.phone, s.is_active,
           d.name AS director_name, d.email AS director_email
    FROM schools s LEFT JOIN users d ON d.school_id = s.id AND d.role = 'school_director'
    WHERE s.id = ${id}`;
  return s;
}

/* ───────── school users (school director) ───────── */
export async function fetchSchoolUsers() {
  const sc = (await requireRole('school_director')) as SchoolScope;
  return sql<{ id: string; name: string; email: string; role: string; is_active: boolean }[]>`
    SELECT id, name, email, role, is_active FROM users
    WHERE school_id = ${sc.schoolId} ORDER BY (role = 'school_director') DESC, name`;
}

export async function fetchSchoolAdmin(id: string) {
  const sc = (await requireRole('school_director')) as SchoolScope;
  const [u] = await sql<{ id: string; name: string; email: string; is_active: boolean }[]>`
    SELECT id, name, email, is_active FROM users WHERE id = ${id} AND school_id = ${sc.schoolId} AND role = 'school_admin'`;
  return u;
}

/* ───────── operations history (school director) ───────── */
export type AuditRow = {
  id: string; created_at: Date; user_name: string; user_role: string; action: string; entity: string;
  description: string; changes: { field: string; from: string; to: string }[] | null;
};

export async function fetchAudit(entity: string | null, userId: string | null, page: number) {
  const sc = (await requireRole('school_director')) as SchoolScope;
  const offset = (page - 1) * PAGE_SIZE;
  const rows = await sql<AuditRow[]>`
    SELECT id, created_at, user_name, user_role, action, entity, description, changes
    FROM audit_log
    WHERE school_id = ${sc.schoolId}
      AND (${entity}::text IS NULL OR entity = ${entity}::text)
      AND (${userId}::uuid IS NULL OR user_id = ${userId}::uuid)
    ORDER BY created_at DESC, id LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*) FROM audit_log
    WHERE school_id = ${sc.schoolId}
      AND (${entity}::text IS NULL OR entity = ${entity}::text)
      AND (${userId}::uuid IS NULL OR user_id = ${userId}::uuid)`;
  return { rows, totalPages: Math.max(1, Math.ceil(Number(count) / PAGE_SIZE)), total: Number(count) };
}

export async function fetchAuditUsers() {
  const sc = (await requireRole('school_director')) as SchoolScope;
  return sql<{ value: string; label: string }[]>`
    SELECT id AS value, name AS label FROM users WHERE school_id = ${sc.schoolId} ORDER BY name`;
}
