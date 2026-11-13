'use client';

import type { State } from '@/app/lib/types';
import { FormShell } from '@/app/ui/form';
import { tableWrap, td, th } from '@/app/ui/styles';

type Book = { id: string; title: string };
type Row = { student_id: string; full_name: string; delivered: string[] };

export default function HandoutSheet({ books, rows, action }: { books: Book[]; rows: Row[]; action: (s: State, fd: FormData) => Promise<State> }) {
  return (
    <FormShell action={action} submitLabel="حفظ التسليم" bare className="mt-5">
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr>
              <th className={`${th} sticky start-0 bg-ink-50`}>الطالب</th>
              {books.map((b) => <th key={b.id} className={`${th} min-w-24 whitespace-normal text-center`}>{b.title}</th>)}
              <th className={th}>المستلَم</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => (
              <tr key={r.student_id}>
                <td className={`${td} sticky start-0 whitespace-nowrap bg-white font-medium`}>{r.full_name}</td>
                {books.map((b) => (
                  <td key={b.id} className={`${td} text-center`}>
                    <input type="checkbox" name={`book_${r.student_id}_${b.id}`} defaultChecked={r.delivered.includes(b.id)}
                      aria-label={`${b.title} - ${r.full_name}`} className="h-4 w-4 rounded border-ink-200 text-ink-800 focus:ring-gold-500" />
                  </td>
                ))}
                <td className={`${td} text-ink-700`}>{r.delivered.filter((id) => books.some((b) => b.id === id)).length} / {books.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FormShell>
  );
}
