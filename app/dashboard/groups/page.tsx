import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchGroups, getCurrentYear } from '@/app/lib/data';
import { deleteGroup } from '@/app/lib/actions';
import { Badge, EmptyRow, LinkButton, Notice, PageHeader, RowActions } from '@/app/ui/kit';
import { tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'الشعب' };

export default async function Page(props: { searchParams?: Promise<{ error?: string }> }) {
  const sp = await props.searchParams;
  const [groups, year] = await Promise.all([fetchGroups(), getCurrentYear()]);

  return (
    <>
      <PageHeader title="الشعب" hint={`شعب العام الدراسي ${year.name}، مثل: السابع - الشعبة 1.`}
        action={<LinkButton href="/dashboard/groups/new">إضافة شعبة</LinkButton>} />
      {sp?.error && <Notice>{sp.error}</Notice>}
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr><th className={th}>الصف</th><th className={th}>الشعبة</th><th className={th}>الطلاب</th><th className={th}><span className="sr-only">إجراءات</span></th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {groups.length === 0 && <EmptyRow cols={4}>لا توجد شعب بعد. أضِف شعبة لأحد الصفوف.</EmptyRow>}
            {groups.map((g) => {
              const full = g.capacity !== null && Number(g.students) >= g.capacity;
              return (
                <tr key={g.id}>
                  <td className={td}>{g.class_name}</td>
                  <td className={td}><Link href={`/dashboard/groups/${g.id}`} className="font-medium hover:underline">{g.name}</Link></td>
                  <td className={td}>{g.students}{g.capacity ? ` / ${g.capacity}` : ''} {full && <Badge tone="warn">مكتملة</Badge>}</td>
                  <td className={td}>
                    <RowActions editHref={`/dashboard/groups/${g.id}`} onDelete={deleteGroup.bind(null, g.id)}
                      confirm={`حذف «${g.class_name} - ${g.name}»؟`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
