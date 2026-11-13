import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchGroupOptions, fetchRouteOptions, fetchStudent } from '@/app/lib/data';
import { createStudent, updateStudent } from '@/app/lib/actions';
import { genderLabel, personStatusLabel, registrationLabel, toOptions } from '@/app/lib/labels';
import { isUuid } from '@/app/lib/utils';
import { PageHeader } from '@/app/ui/kit';
import { FormShell, Input, Select } from '@/app/ui/form';

export const metadata: Metadata = { title: 'بيانات الطالب' };

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const isNew = id === 'new';
  if (!isNew && !isUuid(id)) notFound();
  const [student, groups, routes] = await Promise.all([isNew ? null : fetchStudent(id), fetchGroupOptions(), fetchRouteOptions()]);
  if (!isNew && !student) notFound();

  return (
    <>
      <PageHeader title={isNew ? 'إضافة طالب' : 'تعديل بيانات الطالب'} />
      <FormShell action={isNew ? createStudent : updateStudent.bind(null, id)} cancelHref="/dashboard/students">
        <Input name="full_name" label="الاسم الثلاثي" defaultValue={student?.full_name} required />
        <Input name="student_number" label="رقم الطالب (اختياري)" defaultValue={student?.student_number} ltr />
        <Select name="gender" label="الجنس" options={toOptions(genderLabel)} defaultValue={student?.gender ?? 'male'} />
        <Input name="date_of_birth" label="تاريخ الميلاد" type="date" defaultValue={student?.date_of_birth} />
        <Input name="guardian_name" label="ولي الأمر" defaultValue={student?.guardian_name} />
        <Input name="guardian_phone" label="رقم التواصل" defaultValue={student?.guardian_phone} ltr />
        <Input name="guardian_phone2" label="رقم تواصل إضافي" defaultValue={student?.guardian_phone2} ltr />
        <Input name="address" label="العنوان" defaultValue={student?.address} />
        <Select name="registration_status" label="حالة التسجيل" options={toOptions(registrationLabel)} defaultValue={student?.registration_status ?? 'complete'} />
        <Input name="missing_documents" label="الأوراق الناقصة" defaultValue={student?.missing_documents} />
        <Select name="status" label="الحالة" options={toOptions(personStatusLabel)} defaultValue={student?.status ?? 'active'} />
        <Select name="group_id" label="الصف والشعبة (العام الحالي)" options={groups} defaultValue={student?.group_id} empty="بدون شعبة" />
        <Select name="transport_route_id" label="خط النقل" options={routes} defaultValue={student?.transport_route_id} empty="بدون نقل" />
      </FormShell>
    </>
  );
}
