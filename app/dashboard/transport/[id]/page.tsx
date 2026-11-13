import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchRoute, fetchRoutePassengers, fetchStudentsWithoutRoute } from '@/app/lib/data';
import { addPassenger, createRoute, removePassenger, updateRoute } from '@/app/lib/actions';
import { isUuid } from '@/app/lib/utils';
import { EmptyRow, Notice, PageHeader, Section } from '@/app/ui/kit';
import { DeleteButton, FormShell, Input } from '@/app/ui/form';
import { btnPrimary, fieldClass, tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'خط النقل' };

export default async function Page(props: { params: Promise<{ id: string }>; searchParams?: Promise<{ error?: string }> }) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const isNew = id === 'new';
  if (!isNew && !isUuid(id)) notFound();
  const route = isNew ? null : await fetchRoute(id);
  if (!isNew && !route) notFound();

  const form = (
    <FormShell action={isNew ? createRoute : updateRoute.bind(null, id)} cancelHref="/dashboard/transport">
      <Input name="name" label="اسم الخط" placeholder="مثال: دورة الأشرفية" defaultValue={route?.name} required />
      <Input name="driver_name" label="اسم السائق" defaultValue={route?.driver_name} required />
      <Input name="driver_phone" label="هاتف السائق" defaultValue={route?.driver_phone} ltr />
    </FormShell>
  );
  if (isNew || !route) return <><PageHeader title="إضافة خط نقل" />{form}</>;

  const [passengers, free] = await Promise.all([fetchRoutePassengers(id), fetchStudentsWithoutRoute()]);
  return (
    <>
      <PageHeader title={`خط ${route.name}`} />
      {sp?.error && <Notice>{sp.error}</Notice>}
      {form}
      <Section title={`الركاب (${passengers.length})`}>
        <div className={tableWrap}>
          <table className="min-w-full text-sm">
            <thead className="border-b border-ink-100 bg-ink-50">
              <tr><th className={th}>الطالب</th><th className={th}>العنوان</th><th className={th}>الهاتف</th><th className={th}><span className="sr-only">إجراءات</span></th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {passengers.length === 0 && <EmptyRow cols={4}>لا يوجد ركاب على هذا الخط.</EmptyRow>}
              {passengers.map((s) => (
                <tr key={s.id}>
                  <td className={td}>{s.full_name}</td>
                  <td className={td}>{s.address ?? '—'}</td>
                  <td className={td} dir="ltr">{s.guardian_phone ?? '—'}</td>
                  <td className={td}>
                    <div className="flex justify-end">
                      <DeleteButton action={removePassenger.bind(null, id, s.id)} label="إزالة" confirm={`إزالة «${s.full_name}» من الخط؟`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={addPassenger.bind(null, id)} className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-ink-100 bg-white p-4">
          <div className="min-w-56 flex-1">
            <label htmlFor="student_id" className="mb-1.5 block text-sm font-medium">إضافة طالب بلا خط نقل</label>
            <select id="student_id" name="student_id" required defaultValue="" className={fieldClass} disabled={free.length === 0}>
              <option value="" disabled>{free.length ? 'اختر الطالب' : 'كل الطلاب لديهم خطوط نقل'}</option>
              {free.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>
          <button className={btnPrimary} disabled={free.length === 0}>إضافة إلى الخط</button>
        </form>
      </Section>
    </>
  );
}
