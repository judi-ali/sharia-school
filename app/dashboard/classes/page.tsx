import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchClasses, getCurrentYear } from '@/app/lib/data';
import { deleteClass } from '@/app/lib/actions';
import { stageLabel, trackLabel } from '@/app/lib/labels';
import { Badge, LinkButton, Notice, PageHeader, RowActions } from '@/app/ui/kit';
import { tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'الصفوف' };

export default async function Page(props: { searchParams?: Promise<{ error?: string }> }) {
  const sp = await props.searchParams;
  const [classes, year] = await Promise.all([fetchClasses(), getCurrentYear()]);
  const target = year.periods_per_day * year.school_days_per_week;

  return (
    <>
      <PageHeader title="الصفوف" hint={`العام الدراسي ${year.name}. افتح الصف لإدارة موادّه وحصصه الأسبوعية (المطلوب ${target} حصة).`}
        action={<LinkButton href="/dashboard/classes/new">إضافة صف</LinkButton>} />
      {sp?.error && <Notice>{sp.error}</Notice>}
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr>
              <th className={th}>الصف</th><th className={th}>المرحلة</th><th className={th}>الاختصاص</th>
              <th className={th}>الشعب</th><th className={th}>الطلاب</th><th className={th}>الحصص الأسبوعية</th>
              <th className={th}><span className="sr-only">إجراءات</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {classes.map((c) => (
              <tr key={c.id}>
                <td className={td}><Link href={`/dashboard/classes/${c.id}`} className="font-medium hover:underline">{c.name}</Link></td>
                <td className={td}>{stageLabel[c.stage]}</td>
                <td className={td}>{trackLabel[c.track]}</td>
                <td className={td}>{c.groups}</td>
                <td className={td}>{c.students}</td>
                <td className={td}><Badge tone={Number(c.periods) === target ? 'good' : 'warn'}>{c.periods} / {target}</Badge></td>
                <td className={td}>
                  <RowActions editHref={`/dashboard/classes/${c.id}`} onDelete={deleteClass.bind(null, c.id)}
                    confirm={`حذف الصف «${c.name}»؟ سيُحذف سلّم علاماته وخطته.`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
