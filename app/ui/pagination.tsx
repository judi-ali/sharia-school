'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { generatePagination } from '@/app/lib/utils';

export default function Pagination({ totalPages }: { totalPages: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = Number(searchParams.get('page')) || 1;
  const href = (n: number | string) => {
    const p = new URLSearchParams(searchParams);
    p.set('page', String(n));
    p.delete('error');
    return `${pathname}?${p.toString()}`;
  };
  if (totalPages <= 1) return null;

  const box = 'flex h-10 w-10 items-center justify-center rounded-lg border text-sm';
  const arrow = (to: number, disabled: boolean, icon: React.ReactNode, label: string) =>
    disabled ? (
      <span className={clsx(box, 'pointer-events-none border-ink-100 text-ink-200')} aria-label={label}>{icon}</span>
    ) : (
      <Link href={href(to)} className={clsx(box, 'border-ink-200 bg-white hover:bg-ink-50')} aria-label={label}>{icon}</Link>
    );

  return (
    <nav className="mt-5 flex items-center justify-center gap-1.5" aria-label="التنقّل بين الصفحات">
      {arrow(current - 1, current <= 1, <ChevronRightIcon className="w-4" />, 'الصفحة السابقة')}
      {generatePagination(current, totalPages).map((p, i) =>
        p === '...' ? (
          <span key={`d${i}`} className={clsx(box, 'border-transparent text-ink-600')}>…</span>
        ) : p === current ? (
          <span key={p} aria-current="page" className={clsx(box, 'border-ink-800 bg-ink-800 text-white')}>{p}</span>
        ) : (
          <Link key={p} href={href(p)} className={clsx(box, 'border-ink-200 bg-white hover:bg-ink-50')}>{p}</Link>
        ),
      )}
      {arrow(current + 1, current >= totalPages, <ChevronLeftIcon className="w-4" />, 'الصفحة التالية')}
    </nav>
  );
}
