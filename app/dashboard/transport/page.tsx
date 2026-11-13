import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchRoutes } from '@/app/lib/data';
import { deleteRoute } from '@/app/lib/actions';
import { EmptyRow, LinkButton, Notice, PageHeader, RowActions } from '@/app/ui/kit';
import { tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'النقل' };

export default async function Page(props: { searchParams?: Promise<{ error?: string }> }) {
  const sp = await props.searchParams;
  const routes = await fetchRoutes();
  return (
    <>
      <PageHeader title="النقل" hint="خطوط السرافيس وسائقوها والطلاب المسجّلون على كل خط."
        action={<LinkButton href="/dashboard/transport/new">إضافة خط</LinkButton>} />
      {sp?.error && <Notice>{sp.error}</Notice>}
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr><th className={th}>الخط</th><th className={th}>السائق</th><th className={th}>هاتف السائق</th><th className={th}>الركاب</th><th className={th}><span className="sr-only">إجراءات</span></th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {routes.length === 0 && <EmptyRow cols={5}>لا توجد خطوط نقل بعد.</EmptyRow>}
            {routes.map((r) => (
              <tr key={r.id}>
                <td className={td}><Link href={`/dashboard/transport/${r.id}`} className="font-medium hover:underline">{r.name}</Link></td>
                <td className={td}>{r.driver_name}</td>
                <td className={td} dir="ltr">{r.driver_phone ?? '—'}</td>
                <td className={td}>{r.passengers}</td>
                <td className={td}>
                  <RowActions editHref={`/dashboard/transport/${r.id}`} onDelete={deleteRoute.bind(null, r.id)}
                    confirm={`حذف خط «${r.name}»؟ يبقى الطلاب بلا خط نقل.`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
