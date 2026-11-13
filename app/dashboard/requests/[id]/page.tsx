import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchClassOptions, fetchRequest } from '@/app/lib/data';
import { createRequest, updateRequest } from '@/app/lib/actions';
import { requestStatusLabel, toOptions } from '@/app/lib/labels';
import { isUuid } from '@/app/lib/utils';
import { PageHeader } from '@/app/ui/kit';
import { FormShell, Input, Select } from '@/app/ui/form';

export const metadata: Metadata = { title: 'طلب فتح صف' };

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const isNew = id === 'new';
  if (!isNew && !isUuid(id)) notFound();
  const [req, classes] = await Promise.all([isNew ? null : fetchRequest(id), fetchClassOptions()]);
  if (!isNew && !req) notFound();
  return (
    <>
      <PageHeader title={isNew ? 'إضافة طلب' : 'تعديل الطلب'} />
      <FormShell action={isNew ? createRequest : updateRequest.bind(null, id)} cancelHref="/dashboard/requests">
        <Input name="full_name" label="اسم الطالب" defaultValue={req?.full_name} required />
        <Input name="phone" label="الهاتف" defaultValue={req?.phone} ltr />
        <Select name="class_id" label="الصف المطلوب" options={classes.map((c) => ({ value: c.id, label: c.name }))} defaultValue={req?.class_id} empty="اختر الصف" />
        <Select name="status" label="الحالة" options={toOptions(requestStatusLabel)} defaultValue={req?.status ?? 'pending'} />
        <Input name="note" label="ملاحظة" defaultValue={req?.note} />
      </FormShell>
    </>
  );
}
