import Link from 'next/link';
import clsx from 'clsx';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { DeleteButton } from '@/app/ui/form';
import { btnPrimary } from '@/app/ui/styles';

export function PageHeader({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">{title}</h1>
        {hint && <p className="mt-1 text-sm text-ink-700">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className={btnPrimary}>{children}</Link>;
}

export function Notice({ children, tone = 'error' }: { children: React.ReactNode; tone?: 'error' | 'info' }) {
  return (
    <p role="alert" className={clsx('mb-4 rounded-lg border px-4 py-3 text-sm',
      tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-gold-300 bg-gold-50 text-ink-800')}>
      {children}
    </p>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const tones = {
    neutral: 'bg-ink-50 text-ink-700', good: 'bg-emerald-50 text-emerald-800',
    warn: 'bg-amber-50 text-amber-800', bad: 'bg-red-50 text-red-800',
  };
  return <span className={clsx('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-ink-700">{hint}</p>}
      {children}
    </section>
  );
}

export function EmptyRow({ cols, children }: { cols: number; children: React.ReactNode }) {
  return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-ink-700">{children}</td></tr>;
}

export function RowActions({ editHref, onDelete, confirm }: { editHref: string; onDelete: () => Promise<void>; confirm: string }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={editHref} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-ink-800 hover:bg-ink-50">
        <PencilSquareIcon className="h-4 w-4" /> تعديل
      </Link>
      <DeleteButton action={onDelete} confirm={confirm} />
    </div>
  );
}
