'use client';

import type { State } from '@/app/lib/types';
import { attendanceLabel, toOptions } from '@/app/lib/labels';
import { FormShell } from '@/app/ui/form';
import { btnSecondary, fieldClass, tableWrap, td, th } from '@/app/ui/styles';

type Row = { enrollment_id: string; full_name: string; student_number: string; status: string | null; note: string | null };

export default function AttendanceSheet({
  rows, action,
}: { rows: Row[]; action: (s: State, fd: FormData) => Promise<State> }) {
  const options = toOptions(attendanceLabel);
  return (
    <FormShell action={action} submitLabel="حفظ الحضور" bare className="mt-5">
      <button type="button" className={btnSecondary}
        onClick={(e) => e.currentTarget.closest('form')
          ?.querySelectorAll<HTMLSelectElement>('select[name^="status_"]').forEach((s) => { s.value = 'present'; })}>
        تحديد الجميع حاضرين
      </button>
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr><th className={th}>الطالب</th><th className={th}>الحالة</th><th className={th}>ملاحظة</th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => (
              <tr key={r.enrollment_id}>
                <td className={td}>{r.full_name}<span className="ms-2 text-xs text-ink-600" dir="ltr">{r.student_number}</span></td>
                <td className={td}>
                  <select name={`status_${r.enrollment_id}`} defaultValue={r.status ?? ''} aria-label={`حالة ${r.full_name}`} className={`${fieldClass} min-w-32`}>
                    <option value="">غير مسجّل</option>
                    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className={td}>
                  <input name={`note_${r.enrollment_id}`} defaultValue={r.note ?? ''} aria-label={`ملاحظة ${r.full_name}`} className={fieldClass} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FormShell>
  );
}
