import type { Metadata } from 'next';
import { fetchGradeSheet, fetchGroupAssignments, fetchGroupOptions, fetchScheme } from '@/app/lib/data';
import { saveGrades } from '@/app/lib/actions';
import { semesterLabel, toOptions } from '@/app/lib/labels';
import { isUuid } from '@/app/lib/utils';
import { Notice, PageHeader } from '@/app/ui/kit';
import { AutoSelect } from '@/app/ui/filters';
import GradeSheet from '@/app/ui/grade-sheet';

export const metadata: Metadata = { title: 'العلامات' };

export default async function Page(props: { searchParams?: Promise<{ group?: string; subject?: string; semester?: string }> }) {
  const sp = await props.searchParams;
  const groups = await fetchGroupOptions();
  const groupId = sp?.group && isUuid(sp.group) && groups.some((g) => g.value === sp.group) ? sp.group : '';
  const semester = sp?.semester === '2' ? 2 : 1;

  const subjects = groupId ? await fetchGroupAssignments(groupId) : [];
  const subjectId = subjects.find((s) => s.subject_id === sp?.subject)?.subject_id ?? '';
  const [rows, scheme] = groupId && subjectId
    ? await Promise.all([fetchGradeSheet(groupId, subjectId, semester), fetchScheme(groupId, subjectId)])
    : [[], undefined];

  const max = scheme
    ? { oral: scheme.oral_max, homework: scheme.homework_max, quiz: scheme.quiz_max, exam: scheme.exam_max, total: scheme.total_max }
    : null;

  return (
    <>
      <PageHeader title="العلامات"
        hint="محصلة الفصل = (مجموع الأعمال + الامتحان) ÷ 2، والمحصلة النهائية = متوسط الفصلين. اترك الصف فارغاً لحذف علاماته." />
      <form method="get" className="flex flex-wrap items-end gap-4 rounded-xl border border-ink-100 bg-white p-4">
        <AutoSelect name="group" label="الشعبة" options={groups} defaultValue={groupId} empty="اختر الشعبة" />
        <AutoSelect name="semester" label="الفصل الدراسي" options={toOptions(semesterLabel)} defaultValue={String(semester)} />
        {groupId && (
          <AutoSelect name="subject" label="المادة" empty="اختر المادة" defaultValue={subjectId}
            options={subjects.map((s) => ({ value: s.subject_id, label: s.name }))} />
        )}
      </form>

      {!groupId && <p className="mt-6 text-sm text-ink-700">اختر الشعبة ثم المادة لإدخال العلامات.</p>}
      {groupId && !subjectId && (
        <p className="mt-6 text-sm text-ink-700">
          {subjects.length ? 'اختر المادة لعرض جدول العلامات.' : 'لا توجد مواد في خطة صف هذه الشعبة. أضِفها من صفحة الصف.'}
        </p>
      )}
      {groupId && subjectId && !max && (
        <div className="mt-5"><Notice tone="info">لا يوجد سلّم علامات لهذا الصف، لذلك لا يوجد حدّ أعظمي للإدخال.</Notice></div>
      )}
      {groupId && subjectId && rows.length === 0 && <div className="mt-5"><Notice tone="info">لا يوجد طلاب مسجّلون في هذه الشعبة.</Notice></div>}
      {groupId && subjectId && rows.length > 0 && (
        <GradeSheet
          key={`${groupId}${subjectId}${semester}${rows.map((r) => r.semester_total ?? '-').join('')}`}
          rows={rows} max={max}
          action={saveGrades.bind(null, groupId, subjectId, semester)}
        />
      )}
    </>
  );
}
