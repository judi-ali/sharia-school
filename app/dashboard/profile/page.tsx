import type { Metadata } from 'next';
import { updateProfile } from '@/app/lib/admin-actions';
import { requireScope } from '@/app/lib/session';
import { roleLabel } from '@/app/lib/labels';
import { PageHeader } from '@/app/ui/kit';
import { FormShell, Input } from '@/app/ui/form';

export const metadata: Metadata = { title: 'الملف الشخصي' };

export default async function Page() {
  const me = await requireScope();
  return (
    <>
      <PageHeader title="الملف الشخصي" hint="عدّل اسمك وبريدك وكلمة مرورك. تغيير البريد أو كلمة المرور يتطلب إدخال كلمة المرور الحالية." />
      <div className="mb-4 flex flex-wrap gap-6 rounded-xl border border-ink-100 bg-white p-4 text-sm">
        <p><span className="text-ink-600">الدور: </span><b>{roleLabel[me.role]}</b></p>
        {me.schoolName && <p><span className="text-ink-600">المدرسة: </span><b>{me.schoolName}</b></p>}
      </div>
      <FormShell action={updateProfile}>
        <Input name="name" label="الاسم" defaultValue={me.name} required />
        <Input name="email" label="البريد الإلكتروني (اسم الدخول)" type="email" defaultValue={me.email} ltr required />
        <Input name="new_password" label="كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)" type="password" ltr autoComplete="new-password" />
        <Input name="confirm_password" label="تأكيد كلمة المرور الجديدة" type="password" ltr autoComplete="new-password" />
        <div className="md:col-span-2">
          <Input name="current_password" label="كلمة المرور الحالية (مطلوبة لتغيير البريد أو كلمة المرور)" type="password" ltr autoComplete="current-password" />
        </div>
      </FormShell>
    </>
  );
}
