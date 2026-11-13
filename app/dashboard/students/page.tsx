import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchStudents } from '@/app/lib/data';
import { deleteStudent } from '@/app/lib/actions';
import { personStatusLabel, registrationLabel } from '@/app/lib/labels';
import { Badge, EmptyRow, LinkButton, Notice, PageHeader, RowActions } from '@/app/ui/kit';
import Search from '@/app/ui/search';
import Pagination from '@/app/ui/pagination';
import { tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'الطلاب' };

export default async function Page(props: { searchParams?: Promise<{ query?: string; page?: string; error?: string }> }) {
  const sp = await props.searchParams;
  const { rows, totalPages } = await fetchStudents(sp?.query ?? '', Number(sp?.page) || 1);

  return (
    <>
      <PageHeader title="الطلاب" hint="تسجيل الطلاب وتوزيعهم على الصفوف والشعب."
        action={<LinkButton href="/dashboard/students/new">إضافة طالب</LinkButton>} />
      {sp?.error && <Notice>{sp.error}</Notice>}
      <Search placeholder="ابحث بالاسم أو العنوان أو الهاتف" />
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr>
              <th className={th}>الاسم</th><th className={th}>الهاتف</th><th className={th}>الصف والشعبة</th>
              <th className={th}>خط النقل</th><th className={th}>التسجيل</th><th className={th}>الحالة</th>
              <th className={th}><span className="sr-only">إجراءات</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 && <EmptyRow cols={7}>لا يوجد طلاب مطابقون. أضِف طالباً جديداً للبدء.</EmptyRow>}
            {rows.map((s) => (
              <tr key={s.id}>
                <td className={td}>
                  <Link href={`/dashboard/students/${s.id}`} className="font-medium hover:underline">{s.full_name}</Link>
                  {s.address && <span className="block max-w-64 truncate text-xs text-ink-600">{s.address}</span>}
                </td>
                <td className={td} dir="ltr">{s.guardian_phone ?? '—'}</td>
                <td className={td}>{s.class_name ? `${s.class_name} - ${s.group_name}` : s.status === 'active' ? <Badge tone="warn">بلا شعبة</Badge> : '—'}</td>
                <td className={td}>{s.route_name ?? '—'}</td>
                <td className={td}><Badge tone={s.registration_status === 'complete' ? 'good' : 'warn'}>{registrationLabel[s.registration_status]}</Badge></td>
                <td className={td}><Badge tone={s.status === 'active' ? 'good' : 'neutral'}>{personStatusLabel[s.status]}</Badge></td>
                <td className={td}>
                  <RowActions editHref={`/dashboard/students/${s.id}`} onDelete={deleteStudent.bind(null, s.id)}
                    confirm={`حذف الطالب «${s.full_name}»؟ سيُحذف معه سجل حضوره وعلاماته.`} />
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
