import Link from 'next/link';
import { PowerIcon } from '@heroicons/react/24/outline';
import { signOut } from '@/auth';
import NavLinks from '@/app/ui/nav-links';
import Mark from '@/app/ui/mark';
import { fetchSchool } from '@/app/lib/data';

export default async function SideNav() {
  const school = await fetchSchool();
  return (
    <aside className="flex flex-col bg-ink-900 text-white md:h-screen md:w-64 md:flex-none md:overflow-y-auto">
      <Link href="/dashboard" className="flex items-center gap-3 px-4 py-4 text-gold-300 md:py-6">
        <Mark />
        <span className="font-display leading-snug">
          <span className="block text-xs text-ink-200">وزارة الأوقاف</span>
          <span className="block text-sm font-bold leading-snug text-white">{school.name}</span>
        </span>
      </Link>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:gap-0 md:overflow-visible md:px-3 md:pb-4">
        <NavLinks />
        <form
          className="md:mt-auto"
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/login' });
          }}
        >
          <button className="flex h-11 w-full shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium text-ink-100 hover:bg-ink-800/60">
            <PowerIcon className="h-5 w-5" />
            <span>تسجيل الخروج</span>
          </button>
        </form>
      </nav>
    </aside>
  );
}
