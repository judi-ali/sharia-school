'use client';

import {
  HomeIcon, UserGroupIcon, IdentificationIcon, BookOpenIcon, BuildingLibraryIcon, Squares2X2Icon,
  ClipboardDocumentCheckIcon, ChartBarIcon, TableCellsIcon, CalendarDaysIcon, BookmarkSquareIcon,
  TruckIcon, InboxArrowDownIcon, ArchiveBoxIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const sections = [
  {
    title: 'الدراسة',
    items: [
      { name: 'الرئيسية', href: '/dashboard', icon: HomeIcon },
      { name: 'الطلاب', href: '/dashboard/students', icon: UserGroupIcon },
      { name: 'المعلمون', href: '/dashboard/teachers', icon: IdentificationIcon },
      { name: 'المواد الدراسية', href: '/dashboard/subjects', icon: BookOpenIcon },
      { name: 'الصفوف', href: '/dashboard/classes', icon: BuildingLibraryIcon },
      { name: 'الشعب', href: '/dashboard/groups', icon: Squares2X2Icon },
      { name: 'الجدول الأسبوعي', href: '/dashboard/timetable', icon: CalendarDaysIcon },
      { name: 'الحضور والغياب', href: '/dashboard/attendance', icon: ClipboardDocumentCheckIcon },
      { name: 'العلامات', href: '/dashboard/grades', icon: ChartBarIcon },
      { name: 'النتائج', href: '/dashboard/results', icon: TableCellsIcon },
    ],
  },
  {
    title: 'الإدارة',
    items: [
      { name: 'الكتب', href: '/dashboard/books', icon: BookmarkSquareIcon },
      { name: 'النقل', href: '/dashboard/transport', icon: TruckIcon },
      { name: 'طلبات فتح الصفوف', href: '/dashboard/requests', icon: InboxArrowDownIcon },
      { name: 'المستلزمات', href: '/dashboard/inventory', icon: ArchiveBoxIcon },
    ],
  },
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {sections.map((s) => (
        <div key={s.title} className="flex gap-1 md:flex-col">
          <p className="hidden px-3 pb-1 pt-3 text-[11px] font-semibold tracking-wide text-gold-300/80 md:block">{s.title}</p>
          {s.items.map(({ name, href, icon: Icon }) => {
            const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex h-10 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors',
                  active ? 'bg-ink-800 text-gold-300' : 'text-ink-100 hover:bg-ink-800/60',
                )}>
                <Icon className="h-5 w-5" />
                <span>{name}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
