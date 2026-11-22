'use server';

import bcrypt from 'bcrypt';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { sql } from './db';
import { audit } from './audit';
import { requireRole, requireScope, type SchoolScope } from './session';
import { back, dbMessage, fail, optText, text, values, type Change } from './action-utils';
import { defaultBellSchedule } from './placeholder-data';
import type { State } from './types';

const email = (msg = 'البريد الإلكتروني مطلوب') => z.string({ required_error: msg }).trim().email('بريد إلكتروني غير صالح');
const password = z.string().min(8, 'كلمة المرور 8 أحرف على الأقل');
const optPassword = z.string().optional().transform((v) => v || null)
  .refine((v) => v === null || v.length >= 8, 'كلمة المرور 8 أحرف على الأقل');
const taken = 'البريد الإلكتروني أو الاسم مسجّل مسبقاً.';

/* ───────── schools (education director) ───────── */
const SchoolBase = z.object({
  name: text('اسم المدرسة مطلوب'),
  gender: z.enum(['boys', 'girls', 'mixed'], { errorMap: () => ({ message: 'اختر نوع المدرسة' }) }),
  directorate: optText, address: optText, phone: optText,
  is_active: z.enum(['1', '0']).optional().transform((v) => v !== '0'),
  director_name: text('اسم مدير المدرسة مطلوب'),
  director_email: email('بريد مدير المدرسة مطلوب'),
});
const CreateSchool = SchoolBase.extend({ director_password: password });
const UpdateSchool = SchoolBase.extend({ director_password: optPassword });

export async function createSchool(_: State, fd: FormData): Promise<State> {
  await requireRole('education_director');
  const p = CreateSchool.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  const hash = await bcrypt.hash(d.director_password, 10);
  try {
    await sql.begin(async (tx) => {
      const [s] = await tx`
        INSERT INTO schools (name, gender, directorate, address, phone, is_active)
        VALUES (${d.name}, ${d.gender}, ${d.directorate}, ${d.address}, ${d.phone}, ${d.is_active}) RETURNING id`;
      await tx`INSERT INTO users (name, email, password, role, school_id)
               VALUES (${d.director_name}, ${d.director_email}, ${hash}, 'school_director', ${s.id})`;
      await tx`
        INSERT INTO bell_schedule (school_id, academic_year_id, position, kind, period_no, label, starts_at, ends_at, note)
        SELECT ${s.id}::uuid, y.id, r.position, r.kind, r.period_no, r.label, r.starts_at::time, r.ends_at::time, r.note
        FROM jsonb_to_recordset(${tx.json(defaultBellSchedule)})
          AS r(position int, kind text, period_no int, label text, starts_at text, ends_at text, note text)
        JOIN academic_years y ON y.is_current`;
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّرت إضافة المدرسة.').replace('هذه القيمة مسجّلة مسبقاً.', taken), values: values(fd) };
  }
  revalidatePath('/dashboard/schools');
  return back('/dashboard/schools') as never;
}

export async function updateSchool(id: string, _: State, fd: FormData): Promise<State> {
  await requireRole('education_director');
  const p = UpdateSchool.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  try {
    await sql.begin(async (tx) => {
      await tx`UPDATE schools SET name = ${d.name}, gender = ${d.gender}, directorate = ${d.directorate},
               address = ${d.address}, phone = ${d.phone}, is_active = ${d.is_active} WHERE id = ${id}`;
      await tx`UPDATE users SET name = ${d.director_name}, email = ${d.director_email}
               WHERE school_id = ${id} AND role = 'school_director'`;
      if (d.director_password) {
        await tx`UPDATE users SET password = ${await bcrypt.hash(d.director_password, 10)}
                 WHERE school_id = ${id} AND role = 'school_director'`;
      }
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر تعديل المدرسة.').replace('هذه القيمة مسجّلة مسبقاً.', taken), values: values(fd) };
  }
  revalidatePath('/dashboard/schools');
  return back('/dashboard/schools') as never;
}

/* ───────── school users (school director manages the admins of the school) ───────── */
const AdminSchema = z.object({
  name: text('الاسم مطلوب'),
  email: email(),
  is_active: z.enum(['1', '0']).optional().transform((v) => v !== '0'),
});

export async function createSchoolAdmin(_: State, fd: FormData): Promise<State> {
  const scope = (await requireRole('school_director')) as SchoolScope;
  const p = AdminSchema.extend({ password }).safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  const hash = await bcrypt.hash(d.password, 10);
  try {
    await sql.begin(async (tx) => {
      const [u] = await tx`INSERT INTO users (name, email, password, role, school_id)
               VALUES (${d.name}, ${d.email}, ${hash}, 'school_admin', ${scope.schoolId}) RETURNING id`;
      await audit(scope, 'create', 'user', u.id, `إضافة مستخدم إداري «${d.name}»`, null, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّرت إضافة المستخدم.').replace('هذه القيمة مسجّلة مسبقاً.', 'هذا البريد الإلكتروني مسجّل مسبقاً.'), values: values(fd) };
  }
  revalidatePath('/dashboard/users');
  return back('/dashboard/users') as never;
}

export async function updateSchoolAdmin(id: string, _: State, fd: FormData): Promise<State> {
  const scope = (await requireRole('school_director')) as SchoolScope;
  const p = AdminSchema.extend({ new_password: optPassword }).safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  const [before] = await sql<{ name: string; email: string; is_active: boolean }[]>`
    SELECT name, email, is_active FROM users WHERE id = ${id} AND school_id = ${scope.schoolId} AND role = 'school_admin'`;
  if (!before) return { message: 'المستخدم غير موجود.' };
  const changes: Change[] = [];
  if (before.name !== d.name) changes.push({ field: 'الاسم', from: before.name, to: d.name });
  if (before.email !== d.email) changes.push({ field: 'البريد الإلكتروني', from: before.email, to: d.email });
  if (before.is_active !== d.is_active) changes.push({ field: 'الحالة', from: before.is_active ? 'نشط' : 'معطّل', to: d.is_active ? 'نشط' : 'معطّل' });
  if (d.new_password) changes.push({ field: 'كلمة المرور', from: '—', to: 'تم التغيير' });
  try {
    await sql.begin(async (tx) => {
      await tx`UPDATE users SET name = ${d.name}, email = ${d.email}, is_active = ${d.is_active}
               WHERE id = ${id} AND school_id = ${scope.schoolId} AND role = 'school_admin'`;
      if (d.new_password) {
        await tx`UPDATE users SET password = ${await bcrypt.hash(d.new_password, 10)} WHERE id = ${id} AND school_id = ${scope.schoolId}`;
      }
      if (changes.length) await audit(scope, 'update', 'user', id, `تعديل المستخدم «${d.name}»`, changes, tx);
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر تعديل المستخدم.').replace('هذه القيمة مسجّلة مسبقاً.', 'هذا البريد الإلكتروني مسجّل مسبقاً.'), values: values(fd) };
  }
  revalidatePath('/dashboard/users');
  return back('/dashboard/users') as never;
}

/* ───────── own profile (every role) ───────── */
const ProfileSchema = z.object({
  name: text('الاسم مطلوب'),
  email: email(),
  current_password: z.string().optional(),
  new_password: optPassword,
  confirm_password: z.string().optional(),
});

export async function updateProfile(_: State, fd: FormData): Promise<State> {
  const scope = await requireScope();
  const p = ProfileSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error, fd);
  const d = p.data;
  const [me] = await sql<{ name: string; email: string; password: string }[]>`SELECT name, email, password FROM users WHERE id = ${scope.userId}`;
  if (!me) return { message: 'المستخدم غير موجود.' };

  const credentialsChange = d.email !== me.email || !!d.new_password;
  if (d.new_password && d.new_password !== (d.confirm_password ?? '')) {
    return { errors: { confirm_password: ['تأكيد كلمة المرور غير مطابق'] }, message: 'تعذّر الحفظ، يرجى مراجعة الحقول.', values: values(fd) };
  }
  if (credentialsChange && !(await bcrypt.compare(d.current_password ?? '', me.password))) {
    return { errors: { current_password: ['كلمة المرور الحالية غير صحيحة'] }, message: 'أدخل كلمة المرور الحالية لتغيير البريد أو كلمة المرور.', values: values(fd) };
  }
  const changes: Change[] = [];
  if (me.name !== d.name) changes.push({ field: 'الاسم', from: me.name, to: d.name });
  if (me.email !== d.email) changes.push({ field: 'البريد الإلكتروني', from: me.email, to: d.email });
  if (d.new_password) changes.push({ field: 'كلمة المرور', from: '—', to: 'تم التغيير' });
  try {
    await sql.begin(async (tx) => {
      await tx`UPDATE users SET name = ${d.name}, email = ${d.email} WHERE id = ${scope.userId}`;
      if (d.new_password) await tx`UPDATE users SET password = ${await bcrypt.hash(d.new_password, 10)} WHERE id = ${scope.userId}`;
      if (scope.schoolId && changes.length) {
        await audit(scope as SchoolScope, 'update', 'user', scope.userId, `تعديل «${me.name}» لملفه الشخصي`, changes, tx);
      }
    });
  } catch (e) {
    return { message: dbMessage(e, 'تعذّر حفظ الملف الشخصي.').replace('هذه القيمة مسجّلة مسبقاً.', 'هذا البريد الإلكتروني مسجّل مسبقاً.'), values: values(fd) };
  }
  revalidatePath('/dashboard/profile');
  return { ok: true, message: 'تم حفظ الملف الشخصي.' };
}
