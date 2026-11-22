import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchSchoolAdmin } from '@/app/lib/directory';
import { createSchoolAdmin, updateSchoolAdmin } from '@/app/lib/admin-actions';
import { requireRole } from '@/app/lib/session';
import { isUuid } from '@/app/lib/utils';
import { PageHeader } from '@/app/ui/kit';
import { FormShell, Input, Select } from '@/app/ui/form';

export const metadata: Metadata = { title: 'مستخدم' };

export default async function Page(props: { params: Promise<{ id: string }> }) {
  await requireRole('school_director');
  const { id } = await props.params;
  const isNew = id === 'new';
  if (!isNew && !isUuid(id)) notFound();
  const user = isNew ? null : await fetchSchoolAdmin(id);
  if (!isNew && !user) notFound();

  return (
    <>
      <PageHeader title={isNew ? 'إضافة مستخدم إداري' : 'تعديل المستخدم'}
        hint="الإداري يدير بيانات المدرسة لكنه لا يرى المستخدمين ولا سجل العمليات. عطّل الحساب بدل حذفه ليبقى سجله محفوظاً." />
      <FormShell action={isNew ? createSchoolAdmin : updateSchoolAdmin.bind(null, id)} cancelHref="/dashboard/users">
        <Input name="name" label="الاسم" defaultValue={user?.name} required />
        <Input name="email" label="البريد الإلكتروني (اسم الدخول)" type="email" defaultValue={user?.email} ltr required />
        <Input name={isNew ? 'password' : 'new_password'} type="password" ltr required={isNew} autoComplete="new-password"
          label={isNew ? 'كلمة المرور (8 أحرف على الأقل)' : 'كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)'} />
        {!isNew && (
          <Select name="is_active" label="الحالة" options={[{ value: '1', label: 'نشط' }, { value: '0', label: 'معطّل' }]} defaultValue={user?.is_active ? '1' : '0'} />
        )}
      </FormShell>
    </>
  );
}
