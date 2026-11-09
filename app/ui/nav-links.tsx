'use client';

import {
  HomeIcon, UserGroupIcon, IdentificationIcon, BookOpenIcon, BuildingLibraryIcon,
  Squares2X2Icon, ClipboardDocumentCheckIcon, ChartBarIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const links = [
  { name: 'الرئيسية', href: '/dashboard', icon: HomeIcon },
  { name: 'الطلاب', href: '/dashboard/students', icon: UserGroupIcon },
  { name: 'المعلمون', href: '/dashboard/teachers', icon: IdentificationIcon },
  { name: 'المواد الدراسية', href: '/dashboard/subjects', icon: BookOpenIcon },
  { name: 'الصفوف', href: '/dashboard/classes', icon: BuildingLibraryIcon },
  { name: 'الشعب', href: '/dashboard/groups', icon: Squares2X2Icon },
  { name: 'الحضور والغياب', href: '/dashboard/attendance', icon: ClipboardDocumentCheckIcon },
  { name: 'العلامات', href: '/dashboard/grades', icon: ChartBarIcon },
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {links.map(({ name, href, icon: Icon }) => {
        const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            aria-label={name}
            title={name}
            className={clsx(
              'flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors md:w-full md:justify-start md:gap-2.5 md:px-3',
              active ? 'bg-ink-800 text-gold-300' : 'text-ink-100 hover:bg-ink-800/60',
            )}>
            <Icon className="h-5 w-5 shrink-0" />
            <span className="hidden md:inline">{name}</span>
          </Link>
        );
      })}
    </>
  );
}
