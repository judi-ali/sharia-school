import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchRequests } from '@/app/lib/data';
import { deleteRequest } from '@/app/lib/actions';
import { requestStatusLabel } from '@/app/lib/labels';
import { Badge, EmptyRow, LinkButton, Notice, PageHeader, RowActions } from '@/app/ui/kit';
import { tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'طلبات فتح الصفوف' };

export default async function Page(props: { searchParams?: Promise<{ error?: string }> }) {
  const sp = await props.searchParams;
  const rows = await fetchRequests();
  const perClass = new Map<string, number>();
  for (const r of rows) if (r.status !== 'dropped') perClass.set(r.class_name, (perClass.get(r.class_name) ?? 0) + 1);

  return (
    <>
      <PageHeader title="طلبات فتح الصفوف" hint="رغبات أولياء الأمور بفتح صفوف جديدة. تساعد في قرار فتح الصف وإنشاء شعبه."
        action={<LinkButton href="/dashboard/requests/new">إضافة طلب</LinkButton>} />
      {sp?.error && <Notice>{sp.error}</Notice>}
      {perClass.size > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {[...perClass].map(([cls, n]) => <Badge key={cls} tone="neutral">{cls}: {n} طلب</Badge>)}
        </div>
      )}
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr><th className={th}>الصف المطلوب</th><th className={th}>الاسم</th><th className={th}>الهاتف</th><th className={th}>الحالة</th><th className={th}><span className="sr-only">إجراءات</span></th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 && <EmptyRow cols={5}>لا توجد طلبات.</EmptyRow>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={td}>{r.class_name}</td>
                <td className={td}><Link href={`/dashboard/requests/${r.id}`} className="font-medium hover:underline">{r.full_name}</Link></td>
                <td className={td} dir="ltr">{r.phone ?? '—'}</td>
                <td className={td}><Badge tone={r.status === 'pending' ? 'warn' : r.status === 'enrolled' ? 'good' : 'neutral'}>{requestStatusLabel[r.status]}</Badge></td>
                <td className={td}>
                  <RowActions editHref={`/dashboard/requests/${r.id}`} onDelete={deleteRequest.bind(null, r.id)} confirm={`حذف طلب «${r.full_name}»؟`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
