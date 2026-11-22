'use server';

import { z } from 'zod';
import type { Sql } from 'postgres';
import { revalidatePath } from 'next/cache';
import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import { sql } from './db';
import { isUuid } from './utils';
import { fetchParts, fetchScheme } from './data';
import { SLOTS, activeSlots, defaultLabels, maxOf } from './grading';
import { audit } from './audit';
import { requireRole, requireSchool } from './session';
import {
  back, dbMessage, diffFields, fail, optInt, optText, snapshot, text, values, type Change, type SnapTable,
} from './action-utils';
import type { State } from './types';

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

/* ───────── name lookups for the operations history (all scoped to the school) ───────── */
const one = async (q: Promise<{ v: string }[]>) => (await q)[0]?.v ?? null;
const groupLabel = (groupId: string, schoolId: string) =>
  one(sql`SELECT c.name || ' - ' || g.name AS v FROM class_groups g JOIN classes c ON c.id = g.class_id
          WHERE g.id = ${groupId} AND g.school_id = ${schoolId}`);
const studentName = (id: string, schoolId: string) => one(sql`SELECT full_name AS v FROM students WHERE id = ${id} AND school_id = ${schoolId}`);
const teacherName = (id: string, schoolId: string) => one(sql`SELECT full_name AS v FROM teachers WHERE id = ${id} AND school_id = ${schoolId}`);
const subjectName = (id: string) => one(sql`SELECT name AS v FROM subjects WHERE id = ${id}`);
const currentGroupLabel = (studentId: string, schoolId: string) =>
  one(sql`SELECT c.name || ' - ' || g.name AS v FROM enrollments e
          JOIN class_groups g ON g.id = e.class_group_id JOIN classes c ON c.id = g.class_id
          WHERE e.student_id = ${studentId} AND e.school_id = ${schoolId}
            AND e.academic_year_id = (SELECT id FROM academic_years WHERE is_current)`);

/* ───────── generic delete of school records ───────── */
const ENTITY: Record<SnapTable, { entity: string; noun: string; nameCol: string }> = {
  students: { entity: 'student', noun: 'الطالب', nameCol: 'full_name' },
  teachers: { entity: 'teacher', noun: 'المعلم', nameCol: 'full_name' },
  class_groups: { entity: 'group', noun: 'الشعبة', nameCol: 'name' },
  transport_routes: { entity: 'route', noun: 'خط النقل', nameCol: 'name' },
  class_requests: { entity: 'request', noun: 'طلب فتح الصف', nameCol: 'full_name' },
  inventory_items: { entity: 'inventory', noun: 'المادة', nameCol: 'name' },
};

async function removeScoped(table: SnapTable, id: string, path: string) {
  const scope = await requireSchool();
  const before = await snapshot(table, id, scope.schoolId);
  if (!before) return back(path, 'السجل غير موجود.');
  const { entity, noun, nameCol } = ENTITY[table];
  try {
    await sql.begin(async (tx) => {
      await tx`DELETE FROM ${tx(table)} WHERE id = ${id} AND school_id = ${scope.schoolId}`;
      await audit(scope, 'delete', entity, id, `حذف ${noun} «${String(before[nameCol])}»`, null, tx);
    });
  } catch (e) {
    return back(path, dbMessage(e, 'تعذّر الحذف.', 'لا يمكن الحذف لوجود بيانات مرتبطة بهذا السجل.'));
  }
  revalidatePath(path);
  return back(path);
}
export async function deleteStudent(id: string) { return removeScoped('students', id, '/dashboard/students'); }
export async function deleteTeacher(id: string) { return removeScoped('teachers', id, '/dashboard/teachers'); }
export async function deleteGroup(id: string) { return removeScoped('class_groups', id, '/dashboard/groups'); }
export async function deleteRoute(id: string) { return removeScoped('transport_routes', id, '/dashboard/transport'); }
export async function deleteRequest(id: string) { return removeScoped('class_requests', id, '/dashboard/requests'); }
export async function deleteInventoryItem(id: string) { return removeScoped('inventory_items', id, '/dashboard/inventory'); }

/* The plan (classes, subjects, curriculum, grading schemes) is national: only the education director edits it */
async function removePlan(table: 'subjects' | 'classes', id: string, path: string) {
  await requireRole('education_director');
  try {
    await sql`DELETE FROM ${sql(table)} WHERE id = ${id}`;
  } catch (e) {
    return back(path, dbMessage(e, 'تعذّر الحذف.', 'لا يمكن الحذف لوجود بيانات مرتبطة بهذا السجل.'));
  }
  revalidatePath(path);
  return back(path);
}
export async function deleteSubject(id: string) { return removePlan('subjects', id, '/dashboard/subjects'); }
export async function deleteClass(id: string) { return removePlan('classes', id, '/dashboard/classes'); }

/* ───────── students ───────── */
const StudentSchema = z.object({
  student_number: optText,
  full_name: text('الاسم مطلوب'),
  gender: z.enum(['male', 'female'], { errorMap: () => ({ message: 'اختر الجنس' }) }),
  date_of_birth: optText,
  guardian_name: optText,
  guardian_phone: optText,
  guardian_phone2: optText,
  address: optText,
  registration_status: z.enum(['complete', 'pending'], { errorMap: () => ({ message: 'اختر حالة التسجيل' }) }),
  missing_documents: optText,
  status: z.enum(['active', 'inactive', 'graduated', 'transferred'], { errorMap: () => ({ message: 'اختر الحالة' }) }),
  group_id: z.string().optional(),
  transport_route_id: z.string().optional(),
});
const studentFields = {
  student_number: 'رقم الطالب', full_name: 'الاسم', gender: 'الجنس', date_of_birth: 'تاريخ الميلاد', guardian_name: 'ولي الأمر',
  guardian_phone: 'رقم التواصل', guardian_phone2: 'رقم تواصل إضافي', address: 'العنوان',
  registration_status: 'حالة التسجيل', missing_documents: 'الأوراق الناقصة', status: 'الحالة',
};

// Put the student in a group of THIS school for the current year ('' = remove). Capacity enforced.
async function setEnrollment(tx: Sql, schoolId: string, studentId: string, groupId?: string) {
  if (!groupId) {
    await tx`DELETE FROM enrollments WHERE student_id = ${studentId}::uuid AND school_id = ${schoolId}::uuid
             AND academic_year_id = (SELECT id FROM academic_years WHERE is_current)`;
    return;
  }
  const rows = await tx`
    INSERT INTO enrollments (school_id, student_id, class_group_id, academic_year_id, class_id)
    SELECT g.school_id, ${studentId}::uuid, g.id, g.academic_year_id, g.class_id
    FROM class_groups g JOIN academic_years y ON y.id = g.academic_year_id AND y.is_current
    WHERE g.id = ${groupId}::uuid AND g.school_id = ${schoolId}::uuid
      AND (g.capacity IS NULL OR
           (SELECT COUNT(*) FROM enrollments x WHERE x.class_group_id = g.id AND x.student_id <> ${studentId}::uuid) < g.capacity)
    ON CONFLICT (student_id, academic_year_id)
    DO UPDATE SET class_group_id = EXCLUDED.class_group_id, class_id = EXCLUDED.class_id
    RETURNING id`;
  if (rows.length === 0) throw new Error('GROUP_FULL');
}

export async function createStudent(_: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  const p = StudentSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  try {
    await sql.begin(async (tx) => {
      const [s] = await tx`
        INSERT INTO students (school_id, student_number, full_name, gender, date_of_birth, guardian_name, guardian_phone,
                              guardian_phone2, address, registration_status, missing_documents, transport_route_id, status)
        VALUES (${scope.schoolId}, ${d.student_number}, ${d.full_name}, ${d.gender}, ${d.date_of_birth}, ${d.guardian_name},
                ${d.guardian_phone}, ${d.guardian_phone2}, ${d.address}, ${d.registration_status}, ${d.missing_documents},
                ${d.transport_route_id || null}::uuid, ${d.status})
        RETURNING id`;
      await setEnrollment(tx, scope.schoolId, s.id, d.group_id);
      await audit(scope, 'create', 'student', s.id, `إضافة الطالب «${d.full_name}»`, null, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر إضافة الطالب.', 'خط النقل أو الشعبة غير تابعين لمدرستك.'), values: values(fd) };
  }
  revalidatePath('/dashboard/students');
  return back('/dashboard/students') as never;
}

export async function updateStudent(id: string, _: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  const p = StudentSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  const before = await snapshot('students', id, scope.schoolId);
  if (!before) return { message: 'الطالب غير موجود.' };
  const groupBefore = await currentGroupLabel(id, scope.schoolId);
  try {
    await sql.begin(async (tx) => {
      await tx`
        UPDATE students SET student_number = ${d.student_number}, full_name = ${d.full_name}, gender = ${d.gender},
          date_of_birth = ${d.date_of_birth}, guardian_name = ${d.guardian_name},
          guardian_phone = ${d.guardian_phone}, guardian_phone2 = ${d.guardian_phone2}, address = ${d.address},
          registration_status = ${d.registration_status}, missing_documents = ${d.missing_documents},
          transport_route_id = ${d.transport_route_id || null}::uuid, status = ${d.status}
        WHERE id = ${id} AND school_id = ${scope.schoolId}`;
      await setEnrollment(tx, scope.schoolId, id, d.group_id);
      const groupAfter = d.group_id ? await groupLabel(d.group_id, scope.schoolId) : null;
      const changes: Change[] = diffFields(before, d, studentFields);
      if ((groupBefore ?? '') !== (groupAfter ?? '')) changes.push({ field: 'الصف والشعبة', from: groupBefore ?? '—', to: groupAfter ?? '—' });
      if (changes.length) await audit(scope, 'update', 'student', id, `تعديل بيانات الطالب «${d.full_name}»`, changes, tx);
    });
  } catch (e) {
    return {
      message: dbMessage(e, 'تعذّر تعديل بيانات الطالب.', 'لا يمكن نقل الطالب إلى صف آخر لوجود علامات مسجّلة له، أو الخط/الشعبة غير تابعين لمدرستك.'),
      values: values(fd),
    };
  }
  revalidatePath('/dashboard/students');
  return back('/dashboard/students') as never;
}

/* ───────── teachers ───────── */
const TeacherSchema = z.object({
  full_name: text('الاسم مطلوب'),
  email: z.string().trim().email('بريد إلكتروني غير صالح').optional().or(z.literal('')).transform((v) => v || null),
  phone: optText,
  hire_date: optText,
  status: z.enum(['active', 'inactive'], { errorMap: () => ({ message: 'اختر الحالة' }) }),
});
const teacherFields = { full_name: 'الاسم', email: 'البريد الإلكتروني', phone: 'الهاتف', hire_date: 'تاريخ التعيين', status: 'الحالة' };

export async function createTeacher(_: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  const p = TeacherSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  try {
    await sql.begin(async (tx) => {
      const [t] = await tx`INSERT INTO teachers (school_id, full_name, email, phone, hire_date, status)
              VALUES (${scope.schoolId}, ${d.full_name}, ${d.email}, ${d.phone}, ${d.hire_date}, ${d.status}) RETURNING id`;
      await audit(scope, 'create', 'teacher', t.id, `إضافة المعلم «${d.full_name}»`, null, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّرت إضافة المعلم.'), values: values(fd) };
  }
  revalidatePath('/dashboard/teachers');
  return back('/dashboard/teachers') as never;
}

export async function updateTeacher(id: string, _: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  const p = TeacherSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  const before = await snapshot('teachers', id, scope.schoolId);
  if (!before) return { message: 'المعلم غير موجود.' };
  try {
    await sql.begin(async (tx) => {
      await tx`UPDATE teachers SET full_name = ${d.full_name}, email = ${d.email}, phone = ${d.phone},
              hire_date = ${d.hire_date}, status = ${d.status} WHERE id = ${id} AND school_id = ${scope.schoolId}`;
      const changes = diffFields(before, d, teacherFields);
      if (changes.length) await audit(scope, 'update', 'teacher', id, `تعديل بيانات المعلم «${d.full_name}»`, changes, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر تعديل بيانات المعلم.'), values: values(fd) };
  }
  revalidatePath('/dashboard/teachers');
  return back('/dashboard/teachers') as never;
}

/* ───────── subjects, classes, curriculum, grading schemes (education director only) ───────── */
const SubjectSchema = z.object({
  name: text('اسم المادة مطلوب'),
  category: z.enum(['sharia', 'educational'], { errorMap: () => ({ message: 'اختر التصنيف' }) }),
});

export async function createSubject(_: State, fd: FormData): Promise<State> {
  await requireRole('education_director');
  const p = SubjectSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  try {
    await sql`INSERT INTO subjects (name, category, sort_order)
              VALUES (${p.data.name}, ${p.data.category}, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM subjects))`;
  } catch (e) {
    return { message: dbMessage(e, 'تعذّرت إضافة المادة.'), values: values(fd) };
  }
  revalidatePath('/dashboard/subjects');
  return back('/dashboard/subjects') as never;
}

export async function updateSubject(id: string, _: State, fd: FormData): Promise<State> {
  await requireRole('education_director');
  const p = SubjectSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  try {
    await sql`UPDATE subjects SET name = ${p.data.name}, category = ${p.data.category} WHERE id = ${id}`;
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر تعديل المادة.'), values: values(fd) };
  }
  revalidatePath('/dashboard/subjects');
  return back('/dashboard/subjects') as never;
}

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
  await requireRole('education_director');
  const p = ClassSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  try {
    await sql`INSERT INTO classes (name, grade_level, track) VALUES (${p.data.name}, ${p.data.grade_level}, ${p.data.track})`;
  } catch (e) {
    return { message: dbMessage(e, 'تعذّرت إضافة الصف.'), values: values(fd) };
  }
  revalidatePath('/dashboard/classes');
  return back('/dashboard/classes') as never;
}

export async function updateClass(id: string, _: State, fd: FormData): Promise<State> {
  await requireRole('education_director');
  const p = ClassSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  try {
    await sql`UPDATE classes SET name = ${p.data.name}, grade_level = ${p.data.grade_level}, track = ${p.data.track} WHERE id = ${id}`;
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر تعديل الصف.'), values: values(fd) };
  }
  revalidatePath('/dashboard/classes');
  return back('/dashboard/classes') as never;
}

// Add a subject to the class plan, or change its weekly periods
export async function saveCurriculum(classId: string, fd: FormData) {
  await requireRole('education_director');
  const path = `/dashboard/classes/${classId}`;
  const p = z
    .object({ subject_id: z.string().uuid(), weekly_periods: z.coerce.number().int().min(1).max(35) })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return back(path, 'تحقّق من المادة وعدد الحصص (من 1 إلى 35).');
  try {
    await sql`
      INSERT INTO curriculum (academic_year_id, class_id, subject_id, weekly_periods)
      SELECT id, ${classId}::uuid, ${p.data.subject_id}::uuid, ${p.data.weekly_periods}::int
      FROM academic_years WHERE is_current
      ON CONFLICT (academic_year_id, class_id, subject_id) DO UPDATE SET weekly_periods = EXCLUDED.weekly_periods`;
  } catch (e) {
    return back(path, dbMessage(e, 'تعذّر حفظ المادة في الخطة.'));
  }
  revalidatePath(path);
  return back(path);
}

export async function removeCurriculum(classId: string, subjectId: string) {
  await requireRole('education_director');
  const path = `/dashboard/classes/${classId}`;
  try {
    await sql`DELETE FROM curriculum WHERE class_id = ${classId} AND subject_id = ${subjectId}
              AND academic_year_id = (SELECT id FROM academic_years WHERE is_current)`;
  } catch (e) {
    return back(path, dbMessage(e, 'تعذّر الحذف.', 'لا يمكن حذف المادة من الخطة لوجود معلم مسند إليها أو علامات مسجّلة أو لأنها جزء من مادة محسوبة.'));
  }
  revalidatePath(path);
  return back(path);
}

const maxField = z.coerce.number({ invalid_type_error: 'رقم غير صالح' }).int('رقم صحيح').min(0, 'لا يقل عن 0').max(1000);
const SchemeSchema = z
  .object({
    oral_max: maxField, homework_max: maxField, activity_max: maxField, quiz_max: maxField,
    quiz2_max: maxField, exam_max: maxField, exam2_max: maxField,
    pass_mark: z.string().optional().transform((v) => (v ? Number(v) : null)),
    label_oral: optText, label_homework: optText, label_activity: optText, label_quiz: optText,
    label_quiz2: optText, label_exam: optText, label_exam2: optText,
  })
  .superRefine((d, ctx) => {
    const works = d.oral_max + d.homework_max + d.activity_max + d.quiz_max + d.quiz2_max;
    const exam = d.exam_max + d.exam2_max;
    if (works <= 0) ctx.addIssue({ code: 'custom', path: ['oral_max'], message: 'أدخل درجات مكوّنات الأعمال.' });
    else if (works !== exam)
      ctx.addIssue({ code: 'custom', path: ['exam_max'], message: `مجموع درجات الأعمال (${works}) يجب أن يساوي مجموع درجات الامتحان (${exam}).` });
    if (d.pass_mark !== null && (!Number.isFinite(d.pass_mark) || d.pass_mark < 0 || d.pass_mark > works))
      ctx.addIssue({ code: 'custom', path: ['pass_mark'], message: 'الدرجة الصغرى بين 0 والدرجة العظمى.' });
  });

export async function saveScheme(classId: string, subjectId: string, _: State, fd: FormData): Promise<State> {
  await requireRole('education_director');
  const p = SchemeSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  const labels: Record<string, string> = {};
  for (const k of SLOTS) {
    const v = d[`label_${k}` as const];
    if (v && v !== defaultLabels[k]) labels[k] = v;
  }
  const total = d.oral_max + d.homework_max + d.activity_max + d.quiz_max + d.quiz2_max;
  try {
    await sql`
      INSERT INTO grading_schemes (class_id, subject_id, oral_max, homework_max, activity_max, quiz_max, quiz2_max,
                                   exam_max, exam2_max, total_max, pass_mark, is_provisional, labels)
      VALUES (${classId}, ${subjectId}, ${d.oral_max}, ${d.homework_max}, ${d.activity_max}, ${d.quiz_max}, ${d.quiz2_max},
              ${d.exam_max}, ${d.exam2_max}, ${total}, ${d.pass_mark}, FALSE, ${sql.json(labels)})
      ON CONFLICT (class_id, subject_id) DO UPDATE SET
        oral_max = EXCLUDED.oral_max, homework_max = EXCLUDED.homework_max, activity_max = EXCLUDED.activity_max,
        quiz_max = EXCLUDED.quiz_max, quiz2_max = EXCLUDED.quiz2_max, exam_max = EXCLUDED.exam_max,
        exam2_max = EXCLUDED.exam2_max, total_max = EXCLUDED.total_max, pass_mark = EXCLUDED.pass_mark,
        is_provisional = FALSE, labels = EXCLUDED.labels`;
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر حفظ سلّم العلامات.'), values: values(fd) };
  }
  revalidatePath(`/dashboard/classes/${classId}`);
  revalidatePath('/dashboard/grades');
  return back(`/dashboard/classes/${classId}`) as never;
}

/* ───────── class groups ───────── */
const GroupSchema = z.object({
  class_id: z.string().uuid('اختر الصف').optional(),
  name: text('اسم الشعبة مطلوب'),
  capacity: optInt.refine((v) => v === null || (Number.isInteger(v) && v > 0), 'السعة رقم موجب'),
});

export async function createGroup(_: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  const p = GroupSchema.extend({ class_id: z.string({ required_error: 'اختر الصف' }).uuid('اختر الصف') }).safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  try {
    await sql.begin(async (tx) => {
      const [g] = await tx`
        INSERT INTO class_groups (school_id, class_id, academic_year_id, name, capacity)
        SELECT ${scope.schoolId}::uuid, ${d.class_id}::uuid, id, ${d.name}::text, ${d.capacity}::smallint
        FROM academic_years WHERE is_current RETURNING id`;
      const [c] = await tx`SELECT name FROM classes WHERE id = ${d.class_id}`;
      await audit(scope, 'create', 'group', g.id, `فتح الشعبة «${c?.name} - ${d.name}»`, null, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّرت إضافة الشعبة.'), values: values(fd) };
  }
  revalidatePath('/dashboard/groups');
  return back('/dashboard/groups') as never;
}

export async function updateGroup(id: string, _: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  const p = GroupSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const before = await snapshot('class_groups', id, scope.schoolId);
  if (!before) return { message: 'الشعبة غير موجودة.' };
  try {
    await sql.begin(async (tx) => {
      await tx`UPDATE class_groups SET name = ${p.data.name}, capacity = ${p.data.capacity} WHERE id = ${id} AND school_id = ${scope.schoolId}`;
      const changes = diffFields(before, { name: p.data.name, capacity: p.data.capacity }, { name: 'اسم الشعبة', capacity: 'السعة' });
      if (changes.length) await audit(scope, 'update', 'group', id, `تعديل الشعبة «${p.data.name}»`, changes, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر تعديل الشعبة.'), values: values(fd) };
  }
  revalidatePath('/dashboard/groups');
  return back('/dashboard/groups') as never;
}

export async function enrollStudent(groupId: string, fd: FormData) {
  const scope = await requireSchool();
  const path = `/dashboard/groups/${groupId}`;
  const studentId = String(fd.get('student_id') ?? '');
  if (!isUuid(studentId)) return back(path, 'اختر طالباً.');
  try {
    await sql.begin(async (tx) => {
      await setEnrollment(tx, scope.schoolId, studentId, groupId);
      const [s, g] = await Promise.all([studentName(studentId, scope.schoolId), groupLabel(groupId, scope.schoolId)]);
      await audit(scope, 'create', 'enrollment', studentId, `تسجيل الطالب «${s}» في الشعبة «${g}»`, null, tx);
    });
  } catch (e) {
    return back(path, dbMessage(e, 'تعذّر تسجيل الطالب في الشعبة.'));
  }
  revalidatePath(path);
  return back(path);
}

export async function unenrollStudent(groupId: string, enrollmentId: string) {
  const scope = await requireSchool();
  const path = `/dashboard/groups/${groupId}`;
  const info = await one(sql`SELECT s.full_name AS v FROM enrollments e JOIN students s ON s.id = e.student_id
                             WHERE e.id = ${enrollmentId} AND e.class_group_id = ${groupId} AND e.school_id = ${scope.schoolId}`);
  if (!info) return back(path, 'السجل غير موجود.');
  const g = await groupLabel(groupId, scope.schoolId);
  await sql.begin(async (tx) => {
    await tx`DELETE FROM enrollments WHERE id = ${enrollmentId} AND class_group_id = ${groupId} AND school_id = ${scope.schoolId}`;
    await audit(scope, 'delete', 'enrollment', enrollmentId, `إزالة الطالب «${info}» من الشعبة «${g}»`, null, tx);
  });
  revalidatePath(path);
  return back(path);
}

// Assign (or change / clear) the teacher of a subject in a group
export async function assignTeacher(groupId: string, subjectId: string, fd: FormData) {
  const scope = await requireSchool();
  const path = `/dashboard/groups/${groupId}`;
  const teacherId = String(fd.get('teacher_id') ?? '');
  const g = await groupLabel(groupId, scope.schoolId);
  if (!g) return back(path, 'الشعبة غير موجودة.');
  const subject = await subjectName(subjectId);
  try {
    await sql.begin(async (tx) => {
      if (!teacherId) {
        await tx`DELETE FROM teaching_assignments WHERE class_group_id = ${groupId} AND subject_id = ${subjectId} AND school_id = ${scope.schoolId}`;
        await audit(scope, 'delete', 'assignment', groupId, `إلغاء إسناد معلم «${subject}» في الشعبة «${g}»`, null, tx);
      } else if (isUuid(teacherId)) {
        await tx`
          INSERT INTO teaching_assignments (school_id, teacher_id, class_group_id, academic_year_id, class_id, subject_id)
          SELECT g.school_id, ${teacherId}::uuid, g.id, g.academic_year_id, g.class_id, ${subjectId}::uuid
          FROM class_groups g WHERE g.id = ${groupId}::uuid AND g.school_id = ${scope.schoolId}::uuid
          ON CONFLICT (class_group_id, subject_id) DO UPDATE SET teacher_id = EXCLUDED.teacher_id`;
        const t = await teacherName(teacherId, scope.schoolId);
        await audit(scope, 'save', 'assignment', groupId, `إسناد «${subject}» في الشعبة «${g}» إلى المعلم «${t}»`, null, tx);
      }
    });
  } catch (e) {
    return back(path, dbMessage(e, 'تعذّر إسناد المعلم.', 'المادة ليست ضمن خطة الصف أو المعلم من مدرسة أخرى.'));
  }
  revalidatePath(path);
  return back(path);
}

/* ───────── attendance ───────── */
const ATT = ['present', 'absent', 'late', 'excused'];

// status '' = no record (deletes it); otherwise create/update
export async function saveAttendance(groupId: string, date: string, _: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { message: 'تاريخ غير صالح.' };
  const g = await groupLabel(groupId, scope.schoolId);
  if (!g) return { message: 'الشعبة غير موجودة.' };
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
            WHERE e.class_group_id = ${groupId}::uuid AND e.school_id = ${scope.schoolId}::uuid
              AND e.id IN (SELECT jsonb_array_elements_text(${tx.json(remove)}::jsonb)::uuid))`;
      }
      if (upsert.length) {
        await tx`
          INSERT INTO attendance (enrollment_id, date, status, note, recorded_by)
          SELECT e.id, ${date}::date, r.status, r.note, ${scope.userId}::uuid
          FROM jsonb_to_recordset(${tx.json(upsert)}) AS r(enrollment_id text, status text, note text)
          JOIN enrollments e ON e.id = r.enrollment_id::uuid AND e.class_group_id = ${groupId}::uuid AND e.school_id = ${scope.schoolId}::uuid
          ON CONFLICT (enrollment_id, date)
          DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, recorded_by = EXCLUDED.recorded_by`;
      }
      await audit(scope, 'save', 'attendance', groupId, `حفظ الحضور والغياب للشعبة «${g}» بتاريخ ${date} (${upsert.length} طالب)`, null, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر حفظ الحضور.') };
  }
  revalidatePath('/dashboard/attendance');
  return { ok: true, message: 'تم حفظ سجل الحضور.' };
}

/* ───────── grades ───────── */
// Components come from the subject's grading scheme. A row with every used field empty is deleted;
// otherwise it is created/updated (partial rows are allowed; totals appear once complete).
export async function saveGrades(groupId: string, subjectId: string, semester: number, _: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  if (![1, 2].includes(semester)) return { message: 'فصل دراسي غير صالح.' };
  const g = await groupLabel(groupId, scope.schoolId);
  if (!g) return { message: 'الشعبة غير موجودة.' };
  if ((await fetchParts(groupId, subjectId)).length > 0)
    return { message: 'هذه المادة محسوبة تلقائياً من موادّها ولا تُدخل علاماتها مباشرة.' };
  const scheme = await fetchScheme(groupId, subjectId);
  if (!scheme) return { message: 'لا يوجد سلّم علامات لهذه المادة في هذا الصف.' };
  const active = activeSlots(scheme);

  const first = `${active[0]}_`;
  const ids = [...fd.keys()].filter((k) => k.startsWith(first)).map((k) => k.slice(first.length)).filter(isUuid);
  const errors: Record<string, string[]> = {};
  const rows: Record<string, string | number | null>[] = [];
  const remove: string[] = [];

  for (const id of ids) {
    const raw = active.map((f) => String(fd.get(`${f}_${id}`) ?? '').trim().replace(',', '.'));
    if (raw.every((x) => x === '')) { remove.push(id); continue; }
    const row: Record<string, string | number | null> = { enrollment_id: id };
    SLOTS.forEach((f) => { row[f] = null; });
    active.forEach((f, i) => {
      if (raw[i] === '') return;
      const n = Number(raw[i]);
      if (!Number.isFinite(n) || n < 0) errors[`${f}_${id}`] = ['قيمة غير صالحة'];
      else if (n > maxOf(scheme, f)) errors[`${f}_${id}`] = [`الحد الأعظمي ${maxOf(scheme, f)}`];
      else row[f] = n;
    });
    rows.push(row);
  }
  if (Object.keys(errors).length) return { errors, message: 'بعض العلامات غير صالحة، راجع الحقول المحدّدة.', values: values(fd) };

  const subject = await subjectName(subjectId);
  try {
    await sql.begin(async (tx) => {
      if (remove.length) {
        await tx`DELETE FROM grades WHERE subject_id = ${subjectId}::uuid AND semester = ${semester}::smallint
          AND enrollment_id IN (SELECT e.id FROM enrollments e
            WHERE e.class_group_id = ${groupId}::uuid AND e.school_id = ${scope.schoolId}::uuid
              AND e.id IN (SELECT jsonb_array_elements_text(${tx.json(remove)}::jsonb)::uuid))`;
      }
      if (rows.length) {
        await tx`
          INSERT INTO grades (enrollment_id, academic_year_id, class_id, subject_id, semester,
                              oral, homework, activity, quiz, quiz2, exam, exam2)
          SELECT e.id, e.academic_year_id, e.class_id, ${subjectId}::uuid, ${semester}::smallint,
                 r.oral, r.homework, r.activity, r.quiz, r.quiz2, r.exam, r.exam2
          FROM jsonb_to_recordset(${tx.json(rows)})
            AS r(enrollment_id text, oral numeric, homework numeric, activity numeric, quiz numeric,
                 quiz2 numeric, exam numeric, exam2 numeric)
          JOIN enrollments e ON e.id = r.enrollment_id::uuid AND e.class_group_id = ${groupId}::uuid AND e.school_id = ${scope.schoolId}::uuid
          ON CONFLICT (enrollment_id, subject_id, semester)
          DO UPDATE SET oral = EXCLUDED.oral, homework = EXCLUDED.homework, activity = EXCLUDED.activity,
                        quiz = EXCLUDED.quiz, quiz2 = EXCLUDED.quiz2, exam = EXCLUDED.exam, exam2 = EXCLUDED.exam2`;
      }
      await audit(scope, 'save', 'grades', groupId, `حفظ علامات «${subject}» (الفصل ${semester}) للشعبة «${g}»: ${rows.length} طالب`, null, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر حفظ العلامات.', 'هذه المادة ليست ضمن خطة صف الطالب.'), values: values(fd) };
  }
  revalidatePath('/dashboard/grades');
  return { ok: true, message: 'تم حفظ العلامات.' };
}

/* ───────── transport ───────── */
const RouteSchema = z.object({ name: text('اسم الخط مطلوب'), driver_name: text('اسم السائق مطلوب'), driver_phone: optText });
const routeFields = { name: 'اسم الخط', driver_name: 'السائق', driver_phone: 'هاتف السائق' };

export async function createRoute(_: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  const p = RouteSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  try {
    await sql.begin(async (tx) => {
      const [r] = await tx`INSERT INTO transport_routes (school_id, name, driver_name, driver_phone)
              VALUES (${scope.schoolId}, ${p.data.name}, ${p.data.driver_name}, ${p.data.driver_phone}) RETURNING id`;
      await audit(scope, 'create', 'route', r.id, `إضافة خط النقل «${p.data.name}»`, null, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّرت إضافة الخط.'), values: values(fd) };
  }
  revalidatePath('/dashboard/transport');
  return back('/dashboard/transport') as never;
}

export async function updateRoute(id: string, _: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  const p = RouteSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const before = await snapshot('transport_routes', id, scope.schoolId);
  if (!before) return { message: 'الخط غير موجود.' };
  try {
    await sql.begin(async (tx) => {
      await tx`UPDATE transport_routes SET name = ${p.data.name}, driver_name = ${p.data.driver_name}, driver_phone = ${p.data.driver_phone}
               WHERE id = ${id} AND school_id = ${scope.schoolId}`;
      const changes = diffFields(before, p.data, routeFields);
      if (changes.length) await audit(scope, 'update', 'route', id, `تعديل خط النقل «${p.data.name}»`, changes, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر تعديل الخط.'), values: values(fd) };
  }
  revalidatePath('/dashboard/transport');
  return back('/dashboard/transport') as never;
}

export async function addPassenger(routeId: string, fd: FormData) {
  const scope = await requireSchool();
  const path = `/dashboard/transport/${routeId}`;
  const studentId = String(fd.get('student_id') ?? '');
  if (!isUuid(studentId)) return back(path, 'اختر طالباً.');
  try {
    await sql.begin(async (tx) => {
      await tx`UPDATE students SET transport_route_id = ${routeId} WHERE id = ${studentId} AND school_id = ${scope.schoolId}`;
      const [s, r] = await Promise.all([studentName(studentId, scope.schoolId), one(sql`SELECT name AS v FROM transport_routes WHERE id = ${routeId} AND school_id = ${scope.schoolId}`)]);
      await audit(scope, 'save', 'passenger', studentId, `إضافة الطالب «${s}» إلى خط النقل «${r}»`, null, tx);
    });
  } catch (e) {
    return back(path, dbMessage(e, 'تعذّرت إضافة الراكب.', 'الخط غير تابع لمدرستك.'));
  }
  revalidatePath(path);
  return back(path);
}

export async function removePassenger(routeId: string, studentId: string) {
  const scope = await requireSchool();
  const path = `/dashboard/transport/${routeId}`;
  const [s, r] = await Promise.all([studentName(studentId, scope.schoolId), one(sql`SELECT name AS v FROM transport_routes WHERE id = ${routeId} AND school_id = ${scope.schoolId}`)]);
  if (!s || !r) return back(path, 'السجل غير موجود.');
  await sql.begin(async (tx) => {
    await tx`UPDATE students SET transport_route_id = NULL WHERE id = ${studentId} AND transport_route_id = ${routeId} AND school_id = ${scope.schoolId}`;
    await audit(scope, 'delete', 'passenger', studentId, `إزالة الطالب «${s}» من خط النقل «${r}»`, null, tx);
  });
  revalidatePath(path);
  return back(path);
}

/* ───────── class-opening requests ───────── */
const RequestSchema = z.object({
  class_id: z.string({ required_error: 'اختر الصف' }).uuid('اختر الصف'),
  full_name: text('الاسم مطلوب'),
  phone: optText,
  status: z.enum(['pending', 'enrolled', 'dropped'], { errorMap: () => ({ message: 'اختر الحالة' }) }),
  note: optText,
});
const requestFields = { full_name: 'الاسم', phone: 'الهاتف', status: 'الحالة', note: 'ملاحظة' };

export async function createRequest(_: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  const p = RequestSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  try {
    await sql.begin(async (tx) => {
      const [q] = await tx`INSERT INTO class_requests (school_id, class_id, full_name, phone, status, note)
              VALUES (${scope.schoolId}, ${d.class_id}, ${d.full_name}, ${d.phone}, ${d.status}, ${d.note}) RETURNING id`;
      await audit(scope, 'create', 'request', q.id, `إضافة طلب فتح صف باسم «${d.full_name}»`, null, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّرت إضافة الطلب.'), values: values(fd) };
  }
  revalidatePath('/dashboard/requests');
  return back('/dashboard/requests') as never;
}

export async function updateRequest(id: string, _: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  const p = RequestSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  const before = await snapshot('class_requests', id, scope.schoolId);
  if (!before) return { message: 'الطلب غير موجود.' };
  try {
    await sql.begin(async (tx) => {
      await tx`UPDATE class_requests SET class_id = ${d.class_id}, full_name = ${d.full_name}, phone = ${d.phone}, status = ${d.status}, note = ${d.note}
               WHERE id = ${id} AND school_id = ${scope.schoolId}`;
      const changes = diffFields(before, d, requestFields);
      if (changes.length) await audit(scope, 'update', 'request', id, `تعديل طلب «${d.full_name}»`, changes, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر تعديل الطلب.'), values: values(fd) };
  }
  revalidatePath('/dashboard/requests');
  return back('/dashboard/requests') as never;
}

/* ───────── inventory ───────── */
const InventorySchema = z.object({
  name: text('اسم المادة مطلوب'),
  unit: optText,
  quantity: optInt.refine((v) => v === null || (Number.isInteger(v) && v >= 0), 'الكمية رقم غير سالب'),
  condition: z.enum(['', 'new', 'old']).optional().transform((v) => v || null),
  note: optText,
});
const inventoryFields = { name: 'المادة', unit: 'الوحدة', quantity: 'العدد', condition: 'الحالة', note: 'ملاحظة' };

export async function createInventoryItem(_: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  const p = InventorySchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  try {
    await sql.begin(async (tx) => {
      const [i] = await tx`INSERT INTO inventory_items (school_id, name, unit, quantity, condition, note)
              VALUES (${scope.schoolId}, ${d.name}, ${d.unit}, ${d.quantity}, ${d.condition}, ${d.note}) RETURNING id`;
      await audit(scope, 'create', 'inventory', i.id, `إضافة «${d.name}» إلى المستلزمات`, null, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّرت الإضافة.'), values: values(fd) };
  }
  revalidatePath('/dashboard/inventory');
  return back('/dashboard/inventory') as never;
}

export async function updateInventoryItem(id: string, _: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  const p = InventorySchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  const before = await snapshot('inventory_items', id, scope.schoolId);
  if (!before) return { message: 'المادة غير موجودة.' };
  try {
    await sql.begin(async (tx) => {
      await tx`UPDATE inventory_items SET name = ${d.name}, unit = ${d.unit}, quantity = ${d.quantity}, condition = ${d.condition}, note = ${d.note}
               WHERE id = ${id} AND school_id = ${scope.schoolId}`;
      const changes = diffFields(before, d, inventoryFields);
      if (changes.length) await audit(scope, 'update', 'inventory', id, `تعديل «${d.name}» في المستلزمات`, changes, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر التعديل.'), values: values(fd) };
  }
  revalidatePath('/dashboard/inventory');
  return back('/dashboard/inventory') as never;
}

/* ───────── weekly timetable ───────── */
// Fields slot_<day>_<period> = subject id ('' = free). The teacher comes from the group's assignment.
export async function saveTimetable(groupId: string, _: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  const g = await groupLabel(groupId, scope.schoolId);
  if (!g) return { message: 'الشعبة غير موجودة.' };
  const slots: { day: number; period: number; subject_id: string }[] = [];
  for (const [k, v] of fd.entries()) {
    const m = /^slot_(\d)_(\d+)$/.exec(k);
    const sid = String(v);
    if (m && sid && isUuid(sid)) slots.push({ day: Number(m[1]), period: Number(m[2]), subject_id: sid });
  }
  const assigned = await sql<{ subject_id: string }[]>`
    SELECT subject_id FROM teaching_assignments WHERE class_group_id = ${groupId} AND school_id = ${scope.schoolId}`;
  const ok = new Set(assigned.map((a) => a.subject_id));
  if (slots.some((s) => !ok.has(s.subject_id))) return { message: 'عيّن معلماً لكل مادة في صفحة الشعبة قبل وضعها في الجدول.' };
  try {
    await sql.begin(async (tx) => {
      await tx`DELETE FROM timetable_entries WHERE class_group_id = ${groupId} AND school_id = ${scope.schoolId}`;
      if (slots.length) {
        await tx`
          INSERT INTO timetable_entries (school_id, class_group_id, academic_year_id, day_of_week, period_no, subject_id, teacher_id)
          SELECT g.school_id, g.id, g.academic_year_id, r.day, r.period, ta.subject_id, ta.teacher_id
          FROM jsonb_to_recordset(${tx.json(slots)}) AS r(day int, period int, subject_id text)
          JOIN class_groups g ON g.id = ${groupId}::uuid AND g.school_id = ${scope.schoolId}::uuid
          JOIN teaching_assignments ta ON ta.class_group_id = g.id AND ta.subject_id = r.subject_id::uuid`;
      }
      await audit(scope, 'save', 'timetable', groupId, `حفظ الجدول الأسبوعي للشعبة «${g}» (${slots.length} حصة)`, null, tx);
    });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    return { message: code === '23505' ? 'المعلم مشغول في هذه الحصة مع شعبة أخرى.' : dbMessage(e, 'تعذّر حفظ الجدول.'), values: values(fd) };
  }
  revalidatePath('/dashboard/timetable');
  return { ok: true, message: 'تم حفظ الجدول.' };
}

/* ───────── textbook handouts ───────── */
// Fields book_<studentId>_<textbookId> = 'on' when delivered
export async function saveHandouts(groupId: string, _: State, fd: FormData): Promise<State> {
  const scope = await requireSchool();
  const g = await groupLabel(groupId, scope.schoolId);
  if (!g) return { message: 'الشعبة غير موجودة.' };
  const pairs: { student_id: string; textbook_id: string }[] = [];
  for (const k of fd.keys()) {
    const m = /^book_([0-9a-f-]{36})_([0-9a-f-]{36})$/i.exec(k);
    if (m) pairs.push({ student_id: m[1], textbook_id: m[2] });
  }
  try {
    await sql.begin(async (tx) => {
      await tx`
        DELETE FROM textbook_handouts h
        USING enrollments e, textbooks b
        WHERE e.class_group_id = ${groupId}::uuid AND e.school_id = ${scope.schoolId}::uuid
          AND h.student_id = e.student_id AND h.academic_year_id = e.academic_year_id
          AND b.id = h.textbook_id AND b.class_id = e.class_id
          AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(${tx.json(pairs)}) AS r(student_id text, textbook_id text)
                          WHERE r.student_id::uuid = h.student_id AND r.textbook_id::uuid = h.textbook_id)`;
      if (pairs.length) {
        await tx`
          INSERT INTO textbook_handouts (student_id, textbook_id, academic_year_id)
          SELECT e.student_id, b.id, e.academic_year_id
          FROM jsonb_to_recordset(${tx.json(pairs)}) AS r(student_id text, textbook_id text)
          JOIN enrollments e ON e.student_id = r.student_id::uuid AND e.class_group_id = ${groupId}::uuid AND e.school_id = ${scope.schoolId}::uuid
          JOIN textbooks b ON b.id = r.textbook_id::uuid AND b.class_id = e.class_id
          ON CONFLICT DO NOTHING`;
      }
      await audit(scope, 'save', 'handout', groupId, `حفظ تسليم الكتب للشعبة «${g}» (${pairs.length} كتاب مسلَّم)`, null, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر حفظ تسليم الكتب.') };
  }
  revalidatePath('/dashboard/books');
  return { ok: true, message: 'تم حفظ تسليم الكتب.' };
}
