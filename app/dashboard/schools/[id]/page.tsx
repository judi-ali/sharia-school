import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchSchoolForEdit } from '@/app/lib/directory';
import { createSchool, updateSchool } from '@/app/lib/admin-actions';
import { schoolTypeLabel, toOptions } from '@/app/lib/labels';
import { requireRole } from '@/app/lib/session';
import { isUuid } from '@/app/lib/utils';
import { PageHeader } from '@/app/ui/kit';
import { FormShell, Input, Select } from '@/app/ui/form';

export const metadata: Metadata = { title: 'بيانات المدرسة' };

export default async function Page(props: { params: Promise<{ id: string }> }) {
  await requireRole('education_director');
  const { id } = await props.params;
  const isNew = id === 'new';
  if (!isNew && !isUuid(id)) notFound();
  const school = isNew ? null : await fetchSchoolForEdit(id);
  if (!isNew && !school) notFound();

  return (
    <>
      <PageHeader title={isNew ? 'إضافة مدرسة شرعية' : 'تعديل المدرسة'}
        hint="بيانات مدير المدرسة هي حساب الدخول الذي يستلمه المدير، ويستطيع تغييرها لاحقاً من ملفه الشخصي." />
      <FormShell action={isNew ? createSchool : updateSchool.bind(null, id)} cancelHref="/dashboard/schools">
        <Input name="name" label="اسم المدرسة" defaultValue={school?.name} required />
        <Select name="gender" label="نوع المدرسة" options={toOptions(schoolTypeLabel)} defaultValue={school?.gender ?? 'boys'} />
        <Input name="directorate" label="مديرية الأوقاف" placeholder="مثال: مديرية أوقاف حلب" defaultValue={school?.directorate} />
        <Input name="phone" label="هاتف المدرسة" defaultValue={school?.phone} ltr />
        <div className="md:col-span-2"><Input name="address" label="العنوان" defaultValue={school?.address} /></div>
        {!isNew && (
          <Select name="is_active" label="الحالة" options={[{ value: '1', label: 'نشطة' }, { value: '0', label: 'معطّلة (يُمنع مستخدموها من الدخول)' }]}
            defaultValue={school?.is_active ? '1' : '0'} />
        )}
        <h2 className="font-display text-base font-bold md:col-span-2">حساب مدير المدرسة</h2>
        <Input name="director_name" label="اسم المدير" defaultValue={school?.director_name} required />
        <Input name="director_email" label="البريد الإلكتروني (اسم الدخول)" type="email" defaultValue={school?.director_email} ltr required />
        <Input name="director_password" type="password" ltr required={isNew} autoComplete="new-password"
          label={isNew ? 'كلمة المرور (8 أحرف على الأقل)' : 'كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)'} />
      </FormShell>
    </>
  );
}
