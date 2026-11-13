import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchOverview, fetchGroups } from '@/app/lib/data';
import { todayStr, formatDate } from '@/app/lib/utils';
import { Notice, PageHeader } from '@/app/ui/kit';
import { tableWrap, th, td } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'الرئيسية' };

export default async function Page() {
  const today = todayStr();
  const [o, groups] = await Promise.all([fetchOverview(today), fetchGroups()]);
  const rate = o.recorded ? `${Math.round((o.present / o.recorded) * 100)}%` : 'لم يُسجَّل بعد';

  const cards = [
    { label: 'الطلاب النشطون', value: o.students, href: '/dashboard/students' },
    { label: 'المعلمون', value: o.teachers, href: '/dashboard/teachers' },
    { label: 'الشعب هذا العام', value: o.groups, href: '/dashboard/groups' },
    { label: `الحضور اليوم · ${formatDate(today)}`, value: rate, href: '/dashboard/attendance' },
  ];

  return (
    <>
      <PageHeader title="الرئيسية" hint="نظرة سريعة على العام الدراسي الحالي." />
      {o.missingSchemes > 0 && (
        <Notice tone="info">
          {o.missingSchemes} مادة في الخطة الدرسية بلا سلّم علامات (لا يمكن إدخال علاماتها بعد).{' '}
          <Link href="/dashboard/classes" className="font-medium underline">راجع الصفوف</Link>
        </Notice>
      )}
      {o.provisionalSchemes > 0 && (
        <Notice tone="info">
          {o.provisionalSchemes} سلّم علامات مؤقت (التربية الرياضية والأنشطة والعلوم الشرعية). عدّلها من صفحة الصف عند صدور الدفاتر.
        </Notice>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-xl border border-ink-100 bg-white p-4 transition-colors hover:border-gold-500">
            <p className="text-sm text-ink-700">{c.label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-ink-800">{c.value}</p>
          </Link>
        ))}
      </div>

      <h2 className="mb-1 mt-8 font-display text-lg font-bold">الشعب</h2>
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr><th className={th}>الصف</th><th className={th}>الشعبة</th><th className={th}>الطلاب</th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {groups.map((g) => (
              <tr key={g.id}>
                <td className={td}>{g.class_name}</td>
                <td className={td}><Link href={`/dashboard/groups/${g.id}`} className="font-medium hover:underline">{g.name}</Link></td>
                <td className={td}>{g.students}{g.capacity ? ` / ${g.capacity}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
