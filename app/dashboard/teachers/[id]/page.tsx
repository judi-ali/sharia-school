import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchTeacher } from '@/app/lib/data';
import { createTeacher, updateTeacher } from '@/app/lib/actions';
import { personStatusLabel, toOptions } from '@/app/lib/labels';
import { isUuid } from '@/app/lib/utils';
import { PageHeader } from '@/app/ui/kit';
import { FormShell, Input, Select } from '@/app/ui/form';

export const metadata: Metadata = { title: 'بيانات المعلم' };
const { graduated: _g, ...teacherStatus } = personStatusLabel;

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const isNew = id === 'new';
  if (!isNew && !isUuid(id)) notFound();
  const t = isNew ? null : await fetchTeacher(id);
  if (!isNew && !t) notFound();

  return (
    <>
      <PageHeader title={isNew ? 'إضافة معلم' : 'تعديل بيانات المعلم'} />
      <FormShell action={isNew ? createTeacher : updateTeacher.bind(null, id)} cancelHref="/dashboard/teachers">
        <Input name="full_name" label="الاسم الكامل" defaultValue={t?.full_name} required />
        <Input name="email" label="البريد الإلكتروني" type="email" defaultValue={t?.email} ltr required />
        <Input name="phone" label="الهاتف" defaultValue={t?.phone} ltr />
        <Input name="hire_date" label="تاريخ التعيين" type="date" defaultValue={t?.hire_date} />
        <Select name="status" label="الحالة" options={toOptions(teacherStatus)} defaultValue={t?.status ?? 'active'} />
      </FormShell>
    </>
  );
}
