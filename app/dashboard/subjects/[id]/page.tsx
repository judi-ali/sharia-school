import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchSubject } from '@/app/lib/data';
import { createSubject, updateSubject } from '@/app/lib/actions';
import { categoryLabel, toOptions } from '@/app/lib/labels';
import { isUuid } from '@/app/lib/utils';
import { PageHeader } from '@/app/ui/kit';
import { FormShell, Input, Select } from '@/app/ui/form';

export const metadata: Metadata = { title: 'بيانات المادة' };

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const isNew = id === 'new';
  if (!isNew && !isUuid(id)) notFound();
  const s = isNew ? null : await fetchSubject(id);
  if (!isNew && !s) notFound();

  return (
    <>
      <PageHeader title={isNew ? 'إضافة مادة' : 'تعديل المادة'} />
      <FormShell action={isNew ? createSubject : updateSubject.bind(null, id)} cancelHref="/dashboard/subjects">
        <Input name="name" label="اسم المادة" defaultValue={s?.name} required />
        <Select name="category" label="التصنيف" options={toOptions(categoryLabel)} defaultValue={s?.category ?? 'educational'} />
      </FormShell>
    </>
  );
}
