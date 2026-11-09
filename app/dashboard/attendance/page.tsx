import type { Metadata } from 'next';
import { fetchAttendance, fetchGroupOptions } from '@/app/lib/data';
import { saveAttendance } from '@/app/lib/actions';
import { attendanceLabel } from '@/app/lib/labels';
import { formatDate, isUuid, todayStr } from '@/app/lib/utils';
import { Badge, Notice, PageHeader } from '@/app/ui/kit';
import { AutoDate, AutoSelect } from '@/app/ui/filters';
import AttendanceSheet from '@/app/ui/attendance-sheet';

export const metadata: Metadata = { title: 'الحضور والغياب' };

export default async function Page(props: { searchParams?: Promise<{ group?: string; date?: string }> }) {
  const sp = await props.searchParams;
  const groups = await fetchGroupOptions();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp?.date ?? '') ? sp!.date! : todayStr();
  const groupId = sp?.group && isUuid(sp.group) && groups.some((g) => g.value === sp.group) ? sp.group : '';
  const rows = groupId ? await fetchAttendance(groupId, date) : [];
  const count = (st: string) => rows.filter((r) => r.status === st).length;

  return (
    <>
      <PageHeader title="الحضور والغياب" hint="سجّل حضور الشعبة ليوم محدّد. اترك الحالة «غير مسجّل» لحذف السجل." />
      <form method="get" className="flex flex-wrap items-end gap-4 rounded-xl border border-ink-100 bg-white p-4">
        <AutoSelect name="group" label="الشعبة" options={groups} defaultValue={groupId} empty="اختر الشعبة" />
        <AutoDate name="date" label="التاريخ" defaultValue={date} />
      </form>

      {!groupId && <p className="mt-6 text-sm text-ink-700">اختر شعبة لعرض سجل الحضور.</p>}
      {groupId && rows.length === 0 && <div className="mt-5"><Notice tone="info">لا يوجد طلاب مسجّلون في هذه الشعبة.</Notice></div>}
      {groupId && rows.length > 0 && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{formatDate(date)}</span>
            <Badge tone="good">{attendanceLabel.present} {count('present')}</Badge>
            <Badge tone="bad">{attendanceLabel.absent} {count('absent')}</Badge>
            <Badge tone="warn">{attendanceLabel.late} {count('late')}</Badge>
            <Badge>{attendanceLabel.excused} {count('excused')}</Badge>
            <Badge>غير مسجّل {rows.filter((r) => !r.status).length}</Badge>
          </div>
          <AttendanceSheet
            key={`${groupId}${date}${rows.map((r) => r.status ?? '-').join('')}`}
            rows={rows}
            action={saveAttendance.bind(null, groupId, date)}
          />
        </>
      )}
    </>
  );
}
