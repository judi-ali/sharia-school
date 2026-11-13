import type { Metadata } from 'next';
import clsx from 'clsx';
import { fetchGroupOptions, fetchResults, type ResultColumn } from '@/app/lib/data';
import { fmtNum, isUuid } from '@/app/lib/utils';
import { Notice, PageHeader } from '@/app/ui/kit';
import { AutoSelect } from '@/app/ui/filters';
import { tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'النتائج' };

const PERIODS = [
  { value: '1', label: 'الفصل الأول' },
  { value: '2', label: 'الفصل الثاني' },
  { value: 'final', label: 'المحصلة النهائية' },
];

export default async function Page(props: { searchParams?: Promise<{ group?: string; period?: string }> }) {
  const sp = await props.searchParams;
  const groups = await fetchGroupOptions();
  const groupId = sp?.group && isUuid(sp.group) && groups.some((g) => g.value === sp.group) ? sp.group : '';
  const period = sp?.period === '2' || sp?.period === 'final' ? sp.period : '1';
  const key = period === '2' ? 'semester2_total' : period === 'final' ? 'final_total' : 'semester1_total';

  const data = groupId ? await fetchResults(groupId) : null;

  // Column order: plan order, each computed subject followed by its parts
  const ordered: ResultColumn[] = [];
  if (data) {
    for (const c of data.columns.filter((x) => !x.part_of_subject_id)) {
      ordered.push(c);
      if (c.is_parent) ordered.push(...data.columns.filter((x) => x.part_of_subject_id === c.subject_id));
    }
  }
  // Only top-level subjects count in totals (parts of a computed subject do not); a subject needs a scheme to count
  const counted = ordered.filter((c) => !c.part_of_subject_id && c.max_total);
  const skipped = ordered.filter((c) => !c.part_of_subject_id && !c.max_total).map((c) => c.name);
  const maxSum = counted.reduce((a, c) => a + (c.max_total ?? 0), 0);
  const parentName = (c: ResultColumn) => ordered.find((x) => x.subject_id === c.part_of_subject_id)?.name;

  return (
    <>
      <PageHeader title="النتائج"
        hint="نتائج كل مواد الشعبة. المجموع والمعدل يحسبان المواد الأساسية فقط؛ أجزاء المادة المحسوبة (مثل الجغرافيا والتاريخ ضمن الدراسات الاجتماعية) تظهر منفصلة ولا تدخل فيهما." />
      <form method="get" className="flex flex-wrap items-end gap-4 rounded-xl border border-ink-100 bg-white p-4">
        <AutoSelect name="group" label="الشعبة" options={groups} defaultValue={groupId} empty="اختر الشعبة" />
        <AutoSelect name="period" label="الفترة" options={PERIODS} defaultValue={period} />
      </form>

      {!data && <p className="mt-6 text-sm text-ink-700">اختر شعبة لعرض نتائجها.</p>}
      {data && data.students.length === 0 && <div className="mt-5"><Notice tone="info">لا يوجد طلاب مسجّلون في هذه الشعبة.</Notice></div>}
      {data && data.students.length > 0 && (
        <>
          {skipped.length > 0 && (
            <div className="mt-5"><Notice tone="info">لم تدخل في المجموع (بلا سلّم علامات بعد): {skipped.join('، ')}.</Notice></div>
          )}
          <div className={tableWrap}>
            <table className="min-w-full text-sm">
              <thead className="border-b border-ink-100 bg-ink-50">
                <tr>
                  <th className={`${th} sticky start-0 bg-ink-50`}>الطالب</th>
                  {ordered.map((c) => (
                    <th key={c.subject_id} className={clsx(th, c.is_parent && 'bg-gold-50', c.part_of_subject_id && 'font-normal text-ink-600')}>
                      <span className="block whitespace-nowrap">{c.name}</span>
                      <span className="block text-[11px] font-normal text-ink-600">
                        {c.part_of_subject_id ? `جزء من ${parentName(c)} — لا يُحسب` : c.max_total ? `من ${c.max_total}${c.pass_mark ? ` · نجاح ${c.pass_mark}` : ''}` : 'بلا سلّم'}
                      </span>
                    </th>
                  ))}
                  <th className={`${th} bg-ink-100`}>المجموع <span className="font-normal text-ink-600">(من {maxSum})</span></th>
                  <th className={`${th} bg-ink-100`}>المعدل %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {data.students.map((st) => {
                  const vals = counted.map((c) => st.results[c.subject_id]?.[key] ?? null);
                  const complete = counted.length > 0 && vals.every((v) => v !== null);
                  const total = complete ? vals.reduce((a, v) => a + Number(v), 0) : null;
                  return (
                    <tr key={st.enrollment_id}>
                      <td className={`${td} sticky start-0 whitespace-nowrap bg-white font-medium`}>{st.full_name}</td>
                      {ordered.map((c) => (
                        <td key={c.subject_id} className={clsx(td, c.is_parent && 'bg-gold-50/60 font-semibold', c.part_of_subject_id && 'text-ink-600',
                          c.pass_mark && st.results[c.subject_id]?.[key] != null && Number(st.results[c.subject_id]?.[key]) < c.pass_mark && 'font-semibold text-red-700')}>
                          {fmtNum(st.results[c.subject_id]?.[key]) || '—'}
                        </td>
                      ))}
                      <td className={`${td} bg-ink-50 font-semibold`}>{total === null ? '—' : Math.round(total * 100) / 100}</td>
                      <td className={`${td} bg-ink-50 font-semibold`}>{total === null ? '—' : ((total / maxSum) * 100).toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-700">
            المجموع والمعدل يظهران عند اكتمال نتائج كل المواد المحسوبة. المعدل = المجموع ÷ المجموع الأعظمي × 100. اللون الأحمر = أقل من الدرجة الصغرى للمادة.
          </p>
        </>
      )}
    </>
  );
}
