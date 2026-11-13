import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchSubjects } from '@/app/lib/data';
import { deleteSubject } from '@/app/lib/actions';
import { categoryLabel } from '@/app/lib/labels';
import { EmptyRow, LinkButton, Notice, PageHeader, RowActions } from '@/app/ui/kit';
import Search from '@/app/ui/search';
import { tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'المواد الدراسية' };

export default async function Page(props: { searchParams?: Promise<{ query?: string; error?: string }> }) {
  const sp = await props.searchParams;
  const subjects = await fetchSubjects(sp?.query ?? '');

  return (
    <>
      <PageHeader title="المواد الدراسية" hint="مواد الخطة الدرسية. تُربط المادة بالصف (مع عدد الحصص) من صفحة الصف."
        action={<LinkButton href="/dashboard/subjects/new">إضافة مادة</LinkButton>} />
      {sp?.error && <Notice>{sp.error}</Notice>}
      <Search placeholder="ابحث عن مادة" />
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr><th className={th}>المادة</th><th className={th}><span className="sr-only">إجراءات</span></th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {subjects.length === 0 && <EmptyRow cols={2}>لا توجد مواد مطابقة.</EmptyRow>}
            {(['sharia', 'educational'] as const).map((cat) => {
              const list = subjects.filter((s) => s.category === cat);
              if (!list.length) return null;
              return [
                <tr key={cat} className="bg-gold-50">
                  <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-gold-600">{categoryLabel[cat]} ({list.length})</td>
                </tr>,
                ...list.map((s) => (
                  <tr key={s.id}>
                    <td className={td}><Link href={`/dashboard/subjects/${s.id}`} className="font-medium hover:underline">{s.name}</Link></td>
                    <td className={td}>
                      <RowActions editHref={`/dashboard/subjects/${s.id}`} onDelete={deleteSubject.bind(null, s.id)}
                        confirm={`حذف المادة «${s.name}»؟`} />
                    </td>
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
