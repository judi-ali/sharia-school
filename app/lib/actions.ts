'use server';

import { z } from 'zod';
import type { Sql } from 'postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { auth, signIn } from '@/auth';
import { sql } from './db';
import { isUuid } from './utils';
import { fetchScheme } from './data';
import type { State } from './types';

/* ───────── helpers ───────── */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('غير مصرّح.');
  const id = (session.user as { id?: string }).id;
  return { userId: id && isUuid(id) ? id : null };
}

const values = (fd: FormData) => {
  const o: Record<string, string> = {};
  fd.forEach((v, k) => { if (typeof v === 'string') o[k] = v; });
  return o;
};
const fail = (e: z.ZodError, fd: FormData): State => ({
  errors: e.flatten().fieldErrors as Record<string, string[]>,
  message: 'تعذّر الحفظ، يرجى مراجعة الحقول.',
  values: values(fd),
});
const dbMessage = (e: unknown, fallback: string, fk?: string) => {
  if (e instanceof Error && e.message === 'GROUP_FULL') return 'الشعبة ممتلئة أو غير متاحة.';
  const code = (e as { code?: string })?.code;
  if (code === '23505') return 'هذه القيمة مسجّلة مسبقاً.';
  if (code === '23503') return fk ?? 'لا يمكن إتمام العملية بسبب بيانات مرتبطة بهذا السجل.';
  if (code === '23514') return 'القيم المدخلة غير صالحة.';
  return fallback;
};
const back = (path: string, error?: string): never =>
  redirect(error ? `${path}?error=${encodeURIComponent(error)}` : path);

const text = (msg: string) => z.string({ required_error: msg }).trim().min(1, msg);
const optText = z.string().trim().optional().transform((v) => v || null);
const optInt = z.string().trim().optional().transform((v) => (v ? Number(v) : null));
const status = z.enum(['active', 'inactive', 'graduated'], { errorMap: () => ({ message: 'اختر الحالة' }) });

/* ───────── auth ───────── */
export async function authenticate(_: string | undefined, formData: FormData) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      return error.type === 'CredentialsSignin' ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'حدث خطأ ما، حاول مجدداً.';
    }
    throw error;
  }
}

/* ───────── generic delete ───────── */
async function removeRow(table: 'students' | 'teachers' | 'subjects' | 'classes' | 'class_groups', id: string, path: string) {
  await requireAdmin();
  try {
    await sql`DELETE FROM ${sql(table)} WHERE id = ${id}`;
  } catch (e) {
    back(path, dbMessage(e, 'تعذّر الحذف.', 'لا يمكن الحذف لوجود بيانات مرتبطة بهذا السجل.'));
  }
  revalidatePath(path);
  back(path);
}
export async function deleteStudent(id: string) { return removeRow('students', id, '/dashboard/students'); }
export async function deleteTeacher(id: string) { return removeRow('teachers', id, '/dashboard/teachers'); }
export async function deleteSubject(id: string) { return removeRow('subjects', id, '/dashboard/subjects'); }
export async function deleteClass(id: string) { return removeRow('classes', id, '/dashboard/classes'); }
export async function deleteGroup(id: string) { return removeRow('class_groups', id, '/dashboard/groups'); }

/* ───────── students ───────── */
const StudentSchema = z.object({
  student_number: text('رقم الطالب مطلوب'),
  full_name: text('الاسم مطلوب'),
  gender: z.enum(['male', 'female'], { errorMap: () => ({ message: 'اختر الجنس' }) }),
  date_of_birth: optText,
  guardian_name: optText,
  guardian_phone: optText,
  status,
  group_id: z.string().optional(),
});

// Put the student in a group for the current year ('' = remove from any group). Capacity enforced.
async function setEnrollment(tx: Sql, studentId: string, groupId?: string) {
  if (!groupId) {
    await tx`DELETE FROM enrollments WHERE student_id = ${studentId}::uuid
             AND academic_year_id = (SELECT id FROM academic_years WHERE is_current)`;
    return;
  }
  const rows = await tx`
    INSERT INTO enrollments (student_id, class_group_id, academic_year_id, class_id)
    SELECT ${studentId}::uuid, g.id, g.academic_year_id, g.class_id
    FROM class_groups g JOIN academic_years y ON y.id = g.academic_year_id AND y.is_current
    WHERE g.id = ${groupId}::uuid
      AND (g.capacity IS NULL OR
           (SELECT COUNT(*) FROM enrollments x WHERE x.class_group_id = g.id AND x.student_id <> ${studentId}::uuid) < g.capacity)
    ON CONFLICT (student_id, academic_year_id)
    DO UPDATE SET class_group_id = EXCLUDED.class_group_id, class_id = EXCLUDED.class_id
    RETURNING id`;
  if (rows.length === 0) throw new Error('GROUP_FULL');
}

export async function createStudent(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const p = StudentSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  try {
    await sql.begin(async (tx) => {
      const [s] = await tx`
        INSERT INTO students (student_number, full_name, gender, date_of_birth, guardian_name, guardian_phone, status)
        VALUES (${d.student_number}, ${d.full_name}, ${d.gender}, ${d.date_of_birth}, ${d.guardian_name}, ${d.guardian_phone}, ${d.status})
        RETURNING id`;
      await setEnrollment(tx, s.id, d.group_id);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر إضافة الطالب.'), values: values(fd) };
  }
  revalidatePath('/dashboard/students');
  back('/dashboard/students');
  return {};
}

export async function updateStudent(id: string, _: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const p = StudentSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  try {
    await sql.begin(async (tx) => {
      await tx`
        UPDATE students SET student_number = ${d.student_number}, full_name = ${d.full_name}, gender = ${d.gender},
          date_of_birth = ${d.date_of_birth}, guardian_name = ${d.guardian_name},
          guardian_phone = ${d.guardian_phone}, status = ${d.status}
        WHERE id = ${id}`;
      await setEnrollment(tx, id, d.group_id);
    });
  } catch (e) {
    return {
      message: dbMessage(e, 'تعذّر تعديل بيانات الطالب.', 'لا يمكن نقل الطالب إلى صف آخر لوجود علامات مسجّلة له.'),
      values: values(fd),
    };
  }
  revalidatePath('/dashboard/students');
  back('/dashboard/students');
  return {};
}

/* ───────── teachers ───────── */
const TeacherSchema = z.object({
  full_name: text('الاسم مطلوب'),
  email: z.string({ required_error: 'البريد الإلكتروني مطلوب' }).trim().email('بريد إلكتروني غير صالح'),
  phone: optText,
  hire_date: optText,
  status: z.enum(['active', 'inactive'], { errorMap: () => ({ message: 'اختر الحالة' }) }),
});

export async function createTeacher(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const p = TeacherSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  try {
    await sql`INSERT INTO teachers (full_name, email, phone, hire_date, status)
              VALUES (${d.full_name}, ${d.email}, ${d.phone}, ${d.hire_date}, ${d.status})`;
  } catch (e) {
    return { message: dbMessage(e, 'تعذّرت إضافة المعلم.'), values: values(fd) };
  }
  revalidatePath('/dashboard/teachers');
  back('/dashboard/teachers');
  return {};
}

export async function updateTeacher(id: string, _: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const p = TeacherSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  try {
    await sql`UPDATE teachers SET full_name = ${d.full_name}, email = ${d.email}, phone = ${d.phone},
              hire_date = ${d.hire_date}, status = ${d.status} WHERE id = ${id}`;
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر تعديل بيانات المعلم.'), values: values(fd) };
  }
  revalidatePath('/dashboard/teachers');
  back('/dashboard/teachers');
  return {};
}

/* ───────── subjects ───────── */
const SubjectSchema = z.object({
  name: text('اسم المادة مطلوب'),
  category: z.enum(['sharia', 'educational'], { errorMap: () => ({ message: 'اختر التصنيف' }) }),
});

export async function createSubject(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const p = SubjectSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  try {
    await sql`INSERT INTO subjects (name, category, sort_order)
              VALUES (${p.data.name}, ${p.data.category}, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM subjects))`;
  } catch (e) {
    return { message: dbMessage(e, 'تعذّرت إضافة المادة.'), values: values(fd) };
  }
  revalidatePath('/dashboard/subjects');
  back('/dashboard/subjects');
  return {};
}

export async function updateSubject(id: string, _: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const p = SubjectSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  try {
    await sql`UPDATE subjects SET name = ${p.data.name}, category = ${p.data.category} WHERE id = ${id}`;
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر تعديل المادة.'), values: values(fd) };
  }
  revalidatePath('/dashboard/subjects');
  back('/dashboard/subjects');
  return {};
}

/* ───────── classes + curriculum ───────── */
const ClassSchema = z
  .object({
    name: text('اسم الصف مطلوب'),
    grade_level: z.coerce.number({ invalid_type_error: 'اختر المستوى' }).int().min(7).max(12),
    track: z.enum(['general', 'literary', 'scientific'], { errorMap: () => ({ message: 'اختر الاختصاص' }) }),
  })
  .refine((d) => (d.grade_level <= 9 ? d.track === 'general' : d.track !== 'general'), {
    path: ['track'],
    message: 'السابع إلى التاسع: عام. العاشر فما فوق: أدبي أو علمي.',
  });

export async function createClass(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const p = ClassSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  try {
    await sql`INSERT INTO classes (name, grade_level, track) VALUES (${p.data.name}, ${p.data.grade_level}, ${p.data.track})`;
  } catch (e) {
    return { message: dbMessage(e, 'تعذّرت إضافة الصف.'), values: values(fd) };
  }
  revalidatePath('/dashboard/classes');
  back('/dashboard/classes');
  return {};
}

export async function updateClass(id: string, _: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const p = ClassSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  try {
    await sql`UPDATE classes SET name = ${p.data.name}, grade_level = ${p.data.grade_level}, track = ${p.data.track} WHERE id = ${id}`;
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر تعديل الصف.'), values: values(fd) };
  }
  revalidatePath('/dashboard/classes');
  back('/dashboard/classes');
  return {};
}

// Add a subject to the class plan, or change its weekly periods
export async function saveCurriculum(classId: string, fd: FormData) {
  await requireAdmin();
  const path = `/dashboard/classes/${classId}`;
  const p = z
    .object({ subject_id: z.string().uuid(), weekly_periods: z.coerce.number().int().min(1).max(35) })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) back(path, 'تحقّق من المادة وعدد الحصص (من 1 إلى 35).');
  else {
    try {
      await sql`
        INSERT INTO curriculum (academic_year_id, class_id, subject_id, weekly_periods)
        SELECT id, ${classId}::uuid, ${p.data.subject_id}::uuid, ${p.data.weekly_periods}::int
        FROM academic_years WHERE is_current
        ON CONFLICT (academic_year_id, class_id, subject_id) DO UPDATE SET weekly_periods = EXCLUDED.weekly_periods`;
    } catch (e) {
      back(path, dbMessage(e, 'تعذّر حفظ المادة في الخطة.'));
    }
  }
  revalidatePath(path);
  back(path);
}

export async function removeCurriculum(classId: string, subjectId: string) {
  await requireAdmin();
  const path = `/dashboard/classes/${classId}`;
  try {
    await sql`DELETE FROM curriculum WHERE class_id = ${classId} AND subject_id = ${subjectId}
              AND academic_year_id = (SELECT id FROM academic_years WHERE is_current)`;
  } catch (e) {
    back(path, dbMessage(e, 'تعذّر الحذف.', 'لا يمكن حذف المادة من الخطة لوجود معلم مسند إليها أو علامات مسجّلة.'));
  }
  revalidatePath(path);
  back(path);
}

/* ───────── class groups ───────── */
const GroupSchema = z.object({
  class_id: z.string().uuid('اختر الصف').optional(),
  name: text('اسم الشعبة مطلوب'),
  capacity: optInt.refine((v) => v === null || (Number.isInteger(v) && v > 0), 'السعة رقم موجب'),
});

export async function createGroup(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const p = GroupSchema.extend({ class_id: z.string({ required_error: 'اختر الصف' }).uuid('اختر الصف') }).safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  try {
    await sql`INSERT INTO class_groups (class_id, academic_year_id, name, capacity)
              SELECT ${d.class_id}::uuid, id, ${d.name}::text, ${d.capacity}::smallint FROM academic_years WHERE is_current`;
  } catch (e) {
    return { message: dbMessage(e, 'تعذّرت إضافة الشعبة.'), values: values(fd) };
  }
  revalidatePath('/dashboard/groups');
  back('/dashboard/groups');
  return {};
}

export async function updateGroup(id: string, _: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const p = GroupSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  try {
    await sql`UPDATE class_groups SET name = ${p.data.name}, capacity = ${p.data.capacity} WHERE id = ${id}`;
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر تعديل الشعبة.'), values: values(fd) };
  }
  revalidatePath('/dashboard/groups');
  back('/dashboard/groups');
  return {};
}

export async function enrollStudent(groupId: string, fd: FormData) {
  await requireAdmin();
  const path = `/dashboard/groups/${groupId}`;
  const studentId = String(fd.get('student_id') ?? '');
  if (!isUuid(studentId)) back(path, 'اختر طالباً.');
  try {
    await sql.begin((tx) => setEnrollment(tx, studentId, groupId));
  } catch (e) {
    back(path, dbMessage(e, 'تعذّر تسجيل الطالب في الشعبة.'));
  }
  revalidatePath(path);
  back(path);
}

export async function unenrollStudent(groupId: string, enrollmentId: string) {
  await requireAdmin();
  const path = `/dashboard/groups/${groupId}`;
  await sql`DELETE FROM enrollments WHERE id = ${enrollmentId} AND class_group_id = ${groupId}`;
  revalidatePath(path);
  back(path);
}

// Assign (or change / clear) the teacher of a subject in a group
export async function assignTeacher(groupId: string, subjectId: string, fd: FormData) {
  await requireAdmin();
  const path = `/dashboard/groups/${groupId}`;
  const teacherId = String(fd.get('teacher_id') ?? '');
  try {
    if (!teacherId) {
      await sql`DELETE FROM teaching_assignments WHERE class_group_id = ${groupId} AND subject_id = ${subjectId}`;
    } else if (isUuid(teacherId)) {
      await sql`
        INSERT INTO teaching_assignments (teacher_id, class_group_id, academic_year_id, class_id, subject_id)
        SELECT ${teacherId}::uuid, g.id, g.academic_year_id, g.class_id, ${subjectId}::uuid
        FROM class_groups g WHERE g.id = ${groupId}::uuid
        ON CONFLICT (class_group_id, subject_id) DO UPDATE SET teacher_id = EXCLUDED.teacher_id`;
    }
  } catch (e) {
    back(path, dbMessage(e, 'تعذّر إسناد المعلم.'));
  }
  revalidatePath(path);
  back(path);
}

/* ───────── attendance ───────── */
const ATT = ['present', 'absent', 'late', 'excused'];

// status '' = no record (deletes it); otherwise create/update
export async function saveAttendance(groupId: string, date: string, _: State, fd: FormData): Promise<State> {
  const { userId } = await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { message: 'تاريخ غير صالح.' };
  const upsert: { enrollment_id: string; status: string; note: string | null }[] = [];
  const remove: string[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith('status_')) continue;
    const id = k.slice(7);
    const st = String(v);
    if (!isUuid(id)) continue;
    if (st === '') remove.push(id);
    else if (ATT.includes(st)) upsert.push({ enrollment_id: id, status: st, note: String(fd.get(`note_${id}`) ?? '').trim() || null });
  }
  try {
    await sql.begin(async (tx) => {
      if (remove.length) {
        await tx`DELETE FROM attendance WHERE date = ${date}::date
          AND enrollment_id IN (SELECT e.id FROM enrollments e
            WHERE e.class_group_id = ${groupId}::uuid
              AND e.id IN (SELECT jsonb_array_elements_text(${tx.json(remove)}::jsonb)::uuid))`;
      }
      if (upsert.length) {
        await tx`
          INSERT INTO attendance (enrollment_id, date, status, note, recorded_by)
          SELECT e.id, ${date}::date, r.status, r.note, ${userId}::uuid
          FROM jsonb_to_recordset(${tx.json(upsert)}::jsonb) AS r(enrollment_id text, status text, note text)
          JOIN enrollments e ON e.id = r.enrollment_id::uuid AND e.class_group_id = ${groupId}::uuid
          ON CONFLICT (enrollment_id, date)
          DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, recorded_by = EXCLUDED.recorded_by`;
      }
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر حفظ الحضور.') };
  }
  revalidatePath('/dashboard/attendance');
  return { ok: true, message: 'تم حفظ سجل الحضور.' };
}

/* ───────── grades ───────── */
const FIELDS = ['oral', 'homework', 'quiz', 'exam'] as const;

// A row with all four fields empty is deleted; otherwise created/updated. Values are checked against the scheme.
export async function saveGrades(groupId: string, subjectId: string, semester: number, _: State, fd: FormData): Promise<State> {
  await requireAdmin();
  if (![1, 2].includes(semester)) return { message: 'فصل دراسي غير صالح.' };
  const scheme = await fetchScheme(groupId, subjectId);
  const max: Record<string, number> = scheme
    ? { oral: scheme.oral_max, homework: scheme.homework_max, quiz: scheme.quiz_max, exam: scheme.exam_max }
    : { oral: 1000, homework: 1000, quiz: 1000, exam: 1000 };

  const ids = [...fd.keys()].filter((k) => k.startsWith('oral_')).map((k) => k.slice(5)).filter(isUuid);
  const errors: Record<string, string[]> = {};
  const rows: Record<string, string | number | null>[] = [];
  const remove: string[] = [];

  for (const id of ids) {
    const raw = FIELDS.map((f) => String(fd.get(`${f}_${id}`) ?? '').trim().replace(',', '.'));
    if (raw.every((x) => x === '')) { remove.push(id); continue; }
    const row: Record<string, string | number | null> = { enrollment_id: id };
    FIELDS.forEach((f, i) => {
      if (raw[i] === '') { row[f] = null; return; }
      const n = Number(raw[i]);
      if (!Number.isFinite(n) || n < 0) errors[`${f}_${id}`] = ['قيمة غير صالحة'];
      else if (n > max[f]) errors[`${f}_${id}`] = [`الحد الأعظمي ${max[f]}`];
      else row[f] = n;
    });
    rows.push(row);
  }
  if (Object.keys(errors).length) return { errors, message: 'بعض العلامات غير صالحة، راجع الحقول المحدّدة.', values: values(fd) };

  try {
    await sql.begin(async (tx) => {
      if (remove.length) {
        await tx`DELETE FROM grades WHERE subject_id = ${subjectId}::uuid AND semester = ${semester}::smallint
          AND enrollment_id IN (SELECT e.id FROM enrollments e
            WHERE e.class_group_id = ${groupId}::uuid
              AND e.id IN (SELECT jsonb_array_elements_text(${tx.json(remove)}::jsonb)::uuid))`;
      }
      if (rows.length) {
        await tx`
          INSERT INTO grades (enrollment_id, academic_year_id, class_id, subject_id, semester, oral, homework, quiz, exam)
          SELECT e.id, e.academic_year_id, e.class_id, ${subjectId}::uuid, ${semester}::smallint, r.oral, r.homework, r.quiz, r.exam
          FROM jsonb_to_recordset(${tx.json(rows)}::jsonb)
            AS r(enrollment_id text, oral numeric, homework numeric, quiz numeric, exam numeric)
          JOIN enrollments e ON e.id = r.enrollment_id::uuid AND e.class_group_id = ${groupId}::uuid
          ON CONFLICT (enrollment_id, subject_id, semester)
          DO UPDATE SET oral = EXCLUDED.oral, homework = EXCLUDED.homework, quiz = EXCLUDED.quiz, exam = EXCLUDED.exam`;
      }
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر حفظ العلامات.', 'هذه المادة ليست ضمن خطة صف الطالب.'), values: values(fd) };
  }
  revalidatePath('/dashboard/grades');
  return { ok: true, message: 'تم حفظ العلامات.' };
}
