'use client';

import clsx from 'clsx';
import type { State } from '@/app/lib/types';
import { fmtNum } from '@/app/lib/utils';
import { FormShell, useFormState } from '@/app/ui/form';
import { fieldClass, tableWrap, td, th } from '@/app/ui/styles';

type Row = {
  enrollment_id: string; full_name: string; student_number: string;
  oral: string | null; homework: string | null; quiz: string | null; exam: string | null;
  coursework_total: string | null; semester_total: string | null; final_total: string | null;
};
type Max = { oral: number; homework: number; quiz: number; exam: number; total: number } | null;

function Cell({ name, defaultValue, max }: { name: string; defaultValue: string | null; max?: number }) {
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

export default function GradeSheet({
  rows, max, action,
}: { rows: Row[]; max: Max; action: (s: State, fd: FormData) => Promise<State> }) {
  const cols = [
    { key: 'oral', label: 'الشفهي' }, { key: 'homework', label: 'الوظائف' },
    { key: 'quiz', label: 'المذاكرة' }, { key: 'exam', label: 'الامتحان' },
  ] as const;
  return (
    <FormShell action={action} submitLabel="حفظ العلامات" bare className="mt-5">
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr>
              <th className={th}>الطالب</th>
              {cols.map((c) => (
                <th key={c.key} className={th}>{c.label}{max && <span className="ms-1 font-normal text-ink-600">({max[c.key]})</span>}</th>
              ))}
              <th className={th}>مجموع الأعمال</th>
              <th className={th}>محصلة الفصل{max && <span className="ms-1 font-normal text-ink-600">({max.total})</span>}</th>
              <th className={th}>المحصلة النهائية</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => (
              <tr key={r.enrollment_id}>
                <td className={td}>{r.full_name}</td>
                {cols.map((c) => (
                  <td key={c.key} className={td}>
                    <Cell name={`${c.key}_${r.enrollment_id}`} defaultValue={r[c.key]} max={max?.[c.key]} />
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
