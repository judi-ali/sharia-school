import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchTeachers } from '@/app/lib/data';
import { deleteTeacher } from '@/app/lib/actions';
import { personStatusLabel } from '@/app/lib/labels';
import { Badge, EmptyRow, LinkButton, Notice, PageHeader, RowActions } from '@/app/ui/kit';
import Search from '@/app/ui/search';
import Pagination from '@/app/ui/pagination';
import { tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'المعلمون' };

export default async function Page(props: { searchParams?: Promise<{ query?: string; page?: string; error?: string }> }) {
  const sp = await props.searchParams;
  const { rows, totalPages } = await fetchTeachers(sp?.query ?? '', Number(sp?.page) || 1);

  return (
    <>
      <PageHeader title="المعلمون" hint="الكادر التدريسي. تُسند المواد للمعلمين من صفحة كل شعبة."
        action={<LinkButton href="/dashboard/teachers/new">إضافة معلم</LinkButton>} />
      {sp?.error && <Notice>{sp.error}</Notice>}
      <Search placeholder="ابحث بالاسم أو البريد أو الهاتف" />
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr>
              <th className={th}>الاسم</th><th className={th}>البريد الإلكتروني</th><th className={th}>الهاتف</th>
              <th className={th}>المواد المسندة</th><th className={th}>الحالة</th><th className={th}><span className="sr-only">إجراءات</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 && <EmptyRow cols={6}>لا يوجد معلمون مطابقون.</EmptyRow>}
            {rows.map((t) => (
              <tr key={t.id}>
                <td className={td}><Link href={`/dashboard/teachers/${t.id}`} className="font-medium hover:underline">{t.full_name}</Link></td>
                <td className={td} dir="ltr">{t.email}</td>
                <td className={td} dir="ltr">{t.phone}</td>
                <td className={td}>{t.subjects}</td>
                <td className={td}><Badge tone={t.status === 'active' ? 'good' : 'neutral'}>{personStatusLabel[t.status]}</Badge></td>
                <td className={td}>
                  <RowActions editHref={`/dashboard/teachers/${t.id}`} onDelete={deleteTeacher.bind(null, t.id)}
                    confirm={`حذف المعلم «${t.full_name}»؟`} />
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
