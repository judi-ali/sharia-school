import type { Metadata } from 'next';
import { fetchAudit, fetchAuditUsers } from '@/app/lib/directory';
import { auditActionLabel, entityLabel, roleLabel, toOptions } from '@/app/lib/labels';
import { formatDateTime, isUuid } from '@/app/lib/utils';
import { requireRole } from '@/app/lib/session';
import { Badge, EmptyRow, PageHeader } from '@/app/ui/kit';
import { AutoSelect } from '@/app/ui/filters';
import Pagination from '@/app/ui/pagination';
import { tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'سجل العمليات' };

export default async function Page(props: { searchParams?: Promise<{ entity?: string; user?: string; page?: string }> }) {
  await requireRole('school_director');
  const sp = await props.searchParams;
  const entity = sp?.entity && sp.entity in entityLabel ? sp.entity : null;
  const user = sp?.user && isUuid(sp.user) ? sp.user : null;
  const [{ rows, totalPages, total }, users] = await Promise.all([fetchAudit(entity, user, Number(sp?.page) || 1), fetchAuditUsers()]);

  return (
    <>
      <PageHeader title="سجل العمليات" hint="كل تعديل على بيانات المدرسة ومن قام به. السجل للقراءة فقط ولا يمكن تعديله أو حذفه." />
      <form method="get" className="flex flex-wrap items-end gap-4 rounded-xl border border-ink-100 bg-white p-4">
        <AutoSelect name="entity" label="نوع البيانات" options={toOptions(entityLabel)} defaultValue={entity ?? ''} empty="الكل" />
        <AutoSelect name="user" label="المستخدم" options={users} defaultValue={user ?? ''} empty="الكل" />
        <p className="pb-2 text-sm text-ink-700">{total} عملية</p>
      </form>
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr><th className={th}>الوقت</th><th className={th}>المستخدم</th><th className={th}>العملية</th><th className={th}>التفاصيل</th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 && <EmptyRow cols={4}>لا توجد عمليات مسجّلة.</EmptyRow>}
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className={`${td} whitespace-nowrap text-xs text-ink-700`}>{formatDateTime(r.created_at)}</td>
                <td className={td}>{r.user_name}<span className="block text-[11px] text-ink-600">{roleLabel[r.user_role]}</span></td>
                <td className={td}>
                  <Badge tone={r.action === 'delete' ? 'bad' : r.action === 'create' ? 'good' : 'neutral'}>{auditActionLabel[r.action]}</Badge>
                  <span className="mt-1 block text-[11px] text-ink-600">{entityLabel[r.entity] ?? r.entity}</span>
                </td>
                <td className={td}>
                  {r.description}
                  {r.changes && r.changes.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs text-ink-700">
                      {r.changes.map((c, i) => (
                        <li key={i}><span className="font-medium">{c.field}:</span> {c.from} ← {c.to}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination totalPages={totalPages} />
    </>
  );
}
