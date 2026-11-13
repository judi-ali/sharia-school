import type { Metadata } from 'next';
import {
  fetchBell, fetchGroupAssignments, fetchGroupOptions, fetchGroupTimetable, fetchTeacherOptions,
  fetchTeacherTimetable, fetchTimetableLoad,
} from '@/app/lib/data';
import { saveTimetable } from '@/app/lib/actions';
import { dayLabel } from '@/app/lib/labels';
import { isUuid } from '@/app/lib/utils';
import { Badge, Notice, PageHeader } from '@/app/ui/kit';
import { AutoSelect } from '@/app/ui/filters';
import TimetableGrid from '@/app/ui/timetable-grid';
import { tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'الجدول الأسبوعي' };

export default async function Page(props: { searchParams?: Promise<{ group?: string; teacher?: string }> }) {
  const sp = await props.searchParams;
  const [groups, teachers, bell] = await Promise.all([fetchGroupOptions(), fetchTeacherOptions(), fetchBell()]);
  const groupId = sp?.group && isUuid(sp.group) && groups.some((g) => g.value === sp.group) ? sp.group : '';
  const teacherId = !groupId && sp?.teacher && isUuid(sp.teacher) && teachers.some((t) => t.id === sp.teacher) ? sp.teacher : '';

  const [assignments, entries, load] = groupId
    ? await Promise.all([fetchGroupAssignments(groupId), fetchGroupTimetable(groupId), fetchTimetableLoad(groupId)])
    : [[], [], []];
  const teacherSlots = teacherId ? await fetchTeacherTimetable(teacherId) : [];

  const options = assignments
    .filter((a) => a.teacher_id && a.weekly_periods > 0)
    .map((a) => ({ subject_id: a.subject_id, name: a.name, teacher: teachers.find((t) => t.id === a.teacher_id)?.full_name ?? '' }));
  const entryMap = Object.fromEntries(entries.map((e) => [`${e.day_of_week}_${e.period_no}`, e.subject_id]));
  const noTeacher = assignments.filter((a) => !a.teacher_id && a.weekly_periods > 0 && !a.is_parent).length + assignments.filter((a) => a.is_parent && !a.teacher_id).length;
  const lessons = bell.filter((b) => b.kind === 'lesson');

  return (
    <>
      <PageHeader title="الجدول الأسبوعي"
        hint="جدول الحصص لكل شعبة. المعلم هو المُسنَد للمادة في الشعبة، ولا يمكن وضعه في شعبتين في الحصة نفسها." />
      <form method="get" className="flex flex-wrap items-end gap-4 rounded-xl border border-ink-100 bg-white p-4">
        <AutoSelect name="group" label="جدول شعبة" options={groups} defaultValue={groupId} empty="اختر الشعبة" />
        <AutoSelect name="teacher" label="أو جدول معلّم" options={teachers.map((t) => ({ value: t.id, label: t.full_name }))} defaultValue={teacherId} empty="اختر المعلم" />
      </form>

      {!groupId && !teacherId && <p className="mt-6 text-sm text-ink-700">اختر شعبة لعرض جدولها وتعديله، أو معلّماً لعرض حصصه.</p>}

      {groupId && (
        <>
          {noTeacher > 0 && <div className="mt-5"><Notice tone="info">{noTeacher} مادة بلا معلم مُسنَد، ولا تظهر في القائمة حتى تُسنَد من صفحة الشعبة.</Notice></div>}
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            {load.map((l) => (
              <Badge key={l.subject} tone={l.scheduled === l.planned ? 'good' : 'warn'}>{l.subject}: {l.scheduled}/{l.planned}</Badge>
            ))}
          </div>
          <TimetableGrid key={`${groupId}${entries.map((e) => e.subject_id.slice(0, 4)).join('')}`} bell={bell} options={options}
            entries={entryMap} action={saveTimetable.bind(null, groupId)} />
        </>
      )}

      {teacherId && (
        <div className={tableWrap}>
          <table className="min-w-full text-sm">
            <thead className="border-b border-ink-100 bg-ink-50">
              <tr><th className={th}>الحصة</th>{dayLabel.map((d) => <th key={d} className={th}>{d}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {lessons.map((b) => (
                <tr key={b.position}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs"><b>{b.label}</b><span className="block text-ink-600" dir="ltr">{b.starts_at} – {b.ends_at}</span></td>
                  {dayLabel.map((_, d) => {
                    const s = teacherSlots.find((x) => x.day_of_week === d && x.period_no === b.period_no);
                    return (
                      <td key={d} className={td}>
                        {s ? <><span className="block font-medium">{s.subject}</span><span className="text-xs text-ink-600">{s.group_label}</span></> : <span className="text-ink-200">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
