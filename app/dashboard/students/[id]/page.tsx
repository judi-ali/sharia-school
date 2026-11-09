import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchGroupOptions, fetchStudent } from '@/app/lib/data';
import { createStudent, updateStudent } from '@/app/lib/actions';
import { genderLabel, personStatusLabel, toOptions } from '@/app/lib/labels';
import { isUuid } from '@/app/lib/utils';
import { PageHeader } from '@/app/ui/kit';
import { FormShell, Input, Select } from '@/app/ui/form';

export const metadata: Metadata = { title: 'بيانات الطالب' };

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const isNew = id === 'new';
  if (!isNew && !isUuid(id)) notFound();
  const [student, groups] = await Promise.all([isNew ? null : fetchStudent(id), fetchGroupOptions()]);
  if (!isNew && !student) notFound();

  return (
    <>
      <PageHeader title={isNew ? 'إضافة طالب' : 'تعديل بيانات الطالب'} />
      <FormShell action={isNew ? createStudent : updateStudent.bind(null, id)} cancelHref="/dashboard/students">
        <Input name="full_name" label="الاسم الثلاثي" defaultValue={student?.full_name} required />
        <Input name="student_number" label="رقم الطالب" defaultValue={student?.student_number} ltr required />
        <Select name="gender" label="الجنس" options={toOptions(genderLabel)} defaultValue={student?.gender ?? 'male'} />
        <Input name="date_of_birth" label="تاريخ الميلاد" type="date" defaultValue={student?.date_of_birth} />
        <Input name="guardian_name" label="ولي الأمر" defaultValue={student?.guardian_name} />
        <Input name="guardian_phone" label="هاتف ولي الأمر" defaultValue={student?.guardian_phone} ltr />
        <Select name="status" label="الحالة" options={toOptions(personStatusLabel)} defaultValue={student?.status ?? 'active'} />
        <Select name="group_id" label="الصف والشعبة (العام الحالي)" options={groups} defaultValue={student?.group_id} empty="بدون شعبة" />
      </FormShell>
    </>
  );
}
