'use client';

import clsx from 'clsx';
import type { State } from '@/app/lib/types';
import { activeSlots, maxOf, slotLabel, type Scheme } from '@/app/lib/grading';
import { fmtNum } from '@/app/lib/utils';
import { FormShell, useFormState } from '@/app/ui/form';
import { fieldClass, tableWrap, td, th } from '@/app/ui/styles';

type Row = {
  enrollment_id: string; full_name: string; student_number: string | null;
  oral: string | null; homework: string | null; activity: string | null; quiz: string | null;
  quiz2: string | null; exam: string | null; exam2: string | null;
  coursework_total: string | null; semester_total: string | null; final_total: string | null;
};

function Cell({ name, defaultValue, max }: { name: string; defaultValue: string | null; max: number }) {
  const s = useFormState();
  const err = s.errors?.[name]?.[0];
  return (
    <div>
      <input name={name} type="number" inputMode="decimal" step="0.25" min={0} max={max}
        defaultValue={s.values?.[name] ?? fmtNum(defaultValue)} aria-invalid={!!err}
        className={clsx(fieldClass, '!w-24', err && '!border-red-500')} />
      {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
    </div>
  );
}

// Columns follow the subject's grading scheme (components with max 0 are hidden)
export default function GradeSheet({
  rows, scheme, action,
}: { rows: Row[]; scheme: Scheme; action: (s: State, fd: FormData) => Promise<State> }) {
  const slots = activeSlots(scheme);
  return (
    <FormShell action={action} submitLabel="حفظ العلامات" bare className="mt-5">
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr>
              <th className={th}>الطالب</th>
              {slots.map((k) => (
                <th key={k} className={th}>
                  {slotLabel(scheme, k)}<span className="ms-1 font-normal text-ink-600">({maxOf(scheme, k)})</span>
                </th>
              ))}
              <th className={th}>مجموع الأعمال</th>
              <th className={th}>محصلة الفصل <span className="font-normal text-ink-600">({scheme.total_max})</span></th>
              <th className={th}>المحصلة النهائية</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => (
              <tr key={r.enrollment_id}>
                <td className={td}>{r.full_name}</td>
                {slots.map((k) => (
                  <td key={k} className={td}>
                    <Cell name={`${k}_${r.enrollment_id}`} defaultValue={r[k]} max={maxOf(scheme, k)} />
                  </td>
                ))}
                <td className={td}>{fmtNum(r.coursework_total) || '—'}</td>
                <td className={clsx(td, 'font-semibold')}>{fmtNum(r.semester_total) || '—'}</td>
                <td className={td}>{fmtNum(r.final_total) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FormShell>
  );
}
