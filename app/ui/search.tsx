'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';

export default function Search({ placeholder }: { placeholder: string }) {
  const searchParams = useSearchParams();
  const { replace } = useRouter();
  const pathname = usePathname();

  const handleSearch = useDebouncedCallback((term: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    params.delete('error');
    if (term) params.set('query', term);
    else params.delete('query');
    replace(`${pathname}?${params.toString()}`);
  }, 300);

  return (
    <div className="relative max-w-md">
      <label htmlFor="search" className="sr-only">بحث</label>
      <input id="search" placeholder={placeholder} defaultValue={searchParams.get('query') ?? ''}
        onChange={(e) => handleSearch(e.target.value)}
        className="peer block w-full rounded-lg border-ink-200 bg-white py-2 ps-10 text-sm placeholder:text-ink-600/50 focus:border-gold-500 focus:ring-2 focus:ring-gold-500/40" />
      <MagnifyingGlassIcon className="pointer-events-none absolute start-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-600" />
    </div>
  );
}
