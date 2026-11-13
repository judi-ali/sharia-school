'use client';

import type { State } from '@/app/lib/types';
import { dayLabel } from '@/app/lib/labels';
import { FormShell } from '@/app/ui/form';
import { fieldClass, tableWrap, th } from '@/app/ui/styles';

type Bell = { position: number; kind: string; period_no: number | null; label: string; starts_at: string; ends_at: string; note: string | null };
type Option = { subject_id: string; name: string; teacher: string };

// Editable weekly grid for one group: a subject per day/period (the teacher comes from the group's assignment)
export default function TimetableGrid({
  bell, options, entries, action,
}: {
  bell: Bell[]; options: Option[]; entries: Record<string, string>; action: (s: State, fd: FormData) => Promise<State>;
}) {
  return (
    <FormShell action={action} submitLabel="حفظ الجدول" bare className="mt-5">
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr>
              <th className={th}>الحصة</th>
              {dayLabel.map((d) => <th key={d} className={th}>{d}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {bell.map((b) =>
              b.kind === 'lesson' ? (
                <tr key={b.position}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs"><b>{b.label}</b><span className="block text-ink-600" dir="ltr">{b.starts_at} – {b.ends_at}</span></td>
                  {dayLabel.map((_, d) => (
                    <td key={d} className="px-2 py-1.5">
                      <select name={`slot_${d}_${b.period_no}`} defaultValue={entries[`${d}_${b.period_no}`] ?? ''}
                        aria-label={`${dayLabel[d]} - ${b.label}`} className={`${fieldClass} min-w-40 !py-1.5 !text-xs`}>
                        <option value="">—</option>
                        {options.map((o) => <option key={o.subject_id} value={o.subject_id}>{o.name} ({o.teacher})</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
              ) : (
                <tr key={b.position} className="bg-gold-50/70">
                  <td className="whitespace-nowrap px-3 py-1.5 text-xs font-medium">{b.label}<span className="block font-normal text-ink-600" dir="ltr">{b.starts_at} – {b.ends_at}</span></td>
                  <td colSpan={dayLabel.length} className="px-3 py-1.5 text-center text-xs text-ink-700">{b.note ?? ''}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </FormShell>
  );
}
