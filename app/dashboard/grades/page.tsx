import type { Metadata } from 'next';
import Link from 'next/link';
import {
  fetchComputedSheet, fetchGradeSheet, fetchGroup, fetchGroupAssignments, fetchGroupOptions, fetchScheme,
} from '@/app/lib/data';
import { saveGrades } from '@/app/lib/actions';
import { semesterLabel, toOptions } from '@/app/lib/labels';
import { fmtNum, isUuid } from '@/app/lib/utils';
import { Notice, PageHeader } from '@/app/ui/kit';
import { AutoSelect } from '@/app/ui/filters';
import GradeSheet from '@/app/ui/grade-sheet';
import { tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'العلامات' };

export default async function Page(props: { searchParams?: Promise<{ group?: string; subject?: string; semester?: string }> }) {
  const sp = await props.searchParams;
  const groups = await fetchGroupOptions();
  const groupId = sp?.group && isUuid(sp.group) && groups.some((g) => g.value === sp.group) ? sp.group : '';
  const semester = sp?.semester === '2' ? 2 : 1;

  const subjects = groupId ? await fetchGroupAssignments(groupId) : [];
  const subject = subjects.find((s) => s.subject_id === sp?.subject);
  const subjectId = subject?.subject_id ?? '';
  const computed = !!subject?.is_parent;

  const [rows, scheme] = groupId && subjectId && !computed
    ? await Promise.all([fetchGradeSheet(groupId, subjectId, semester), fetchScheme(groupId, subjectId)])
    : [[], undefined];
  const sheet = groupId && subjectId && computed ? await fetchComputedSheet(groupId, subjectId, semester) : null;
  const group = groupId && subjectId && !computed && !scheme ? await fetchGroup(groupId) : null;

  return (
    <>
      <PageHeader title="العلامات"
        hint="محصلة الفصل = (مجموع الأعمال + الامتحان) ÷ 2، والمحصلة النهائية = متوسط الفصلين. اترك الصف فارغاً لحذف علاماته." />
      <form method="get" className="flex flex-wrap items-end gap-4 rounded-xl border border-ink-100 bg-white p-4">
        <AutoSelect name="group" label="الشعبة" options={groups} defaultValue={groupId} empty="اختر الشعبة" />
        <AutoSelect name="semester" label="الفصل الدراسي" options={toOptions(semesterLabel)} defaultValue={String(semester)} />
        {groupId && (
          <AutoSelect name="subject" label="المادة" empty="اختر المادة" defaultValue={subjectId}
            options={subjects.map((s) => ({ value: s.subject_id, label: s.is_parent ? `${s.name} (محسوبة)` : s.name }))} />
        )}
      </form>

      {!groupId && <p className="mt-6 text-sm text-ink-700">اختر الشعبة ثم المادة لإدخال العلامات.</p>}
      {groupId && !subjectId && (
        <p className="mt-6 text-sm text-ink-700">
          {subjects.length ? 'اختر المادة لعرض جدول العلامات.' : 'لا توجد مواد في خطة صف هذه الشعبة. أضِفها من صفحة الصف.'}
        </p>
      )}

      {sheet && (
        <>
          <div className="mt-5"><Notice tone="info">
            «{subject?.name}» مادة محسوبة تلقائياً: هي متوسط محصلة {sheet.parts.map((p) => p.name).join(' و')}. لا يمكن تعديلها،
            وتُدخل علامات كل جزء على حدة.
          </Notice></div>
          <div className={tableWrap}>
            <table className="min-w-full text-sm">
              <thead className="border-b border-ink-100 bg-ink-50">
                <tr>
                  <th className={th}>الطالب</th>
                  {sheet.parts.map((p) => <th key={p.subject_id} className={th}>{p.name}</th>)}
                  <th className={`${th} bg-gold-50`}>{subject?.name} (المتوسط)</th>
                  <th className={th}>المحصلة النهائية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {sheet.rows.map((r) => (
                  <tr key={r.enrollment_id}>
                    <td className={td}>{r.full_name}</td>
                    {r.partTotals.map((t, i) => <td key={i} className={td}>{fmtNum(t) || '—'}</td>)}
                    <td className={`${td} bg-gold-50/60 font-semibold`}>{fmtNum(r.computed_total) || '—'}</td>
                    <td className={td}>{fmtNum(r.final_total) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {groupId && subjectId && !computed && !scheme && (
        <div className="mt-5">
          <Notice tone="info">
            لا يوجد سلّم علامات لهذه المادة في هذا الصف، لذلك لا يمكن إدخال العلامات.{' '}
            {group && <Link href={`/dashboard/classes/${group.class_id}/scheme/${subjectId}`} className="font-medium underline">حدّد سلّم العلامات</Link>}
          </Notice>
        </div>
      )}
      {groupId && subjectId && !computed && scheme && rows.length === 0 && (
        <div className="mt-5"><Notice tone="info">لا يوجد طلاب مسجّلون في هذه الشعبة.</Notice></div>
      )}
      {groupId && subjectId && !computed && scheme && rows.length > 0 && (
        <GradeSheet
          key={`${groupId}${subjectId}${semester}${rows.map((r) => r.semester_total ?? '-').join('')}`}
          rows={rows} scheme={scheme}
          action={saveGrades.bind(null, groupId, subjectId, semester)}
        />
      )}
    </>
  );
}
