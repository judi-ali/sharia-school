'use client';

import {
  HomeIcon, UserGroupIcon, IdentificationIcon, BookOpenIcon, BuildingLibraryIcon, Squares2X2Icon,
  ClipboardDocumentCheckIcon, ChartBarIcon, TableCellsIcon, CalendarDaysIcon, BookmarkSquareIcon,
  TruckIcon, InboxArrowDownIcon, ArchiveBoxIcon, BuildingOffice2Icon, UsersIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

type Role = 'education_director' | 'school_director' | 'school_admin';
const SCHOOL: Role[] = ['school_director', 'school_admin'];
const ALL: Role[] = ['education_director', 'school_director', 'school_admin'];

const sections = [
  {
    title: 'الدراسة',
    items: [
      { name: 'الرئيسية', href: '/dashboard', icon: HomeIcon, roles: SCHOOL },
      { name: 'الطلاب', href: '/dashboard/students', icon: UserGroupIcon, roles: SCHOOL },
      { name: 'المعلمون', href: '/dashboard/teachers', icon: IdentificationIcon, roles: SCHOOL },
      { name: 'المواد الدراسية', href: '/dashboard/subjects', icon: BookOpenIcon, roles: ALL },
      { name: 'الصفوف', href: '/dashboard/classes', icon: BuildingLibraryIcon, roles: ALL },
      { name: 'الشعب', href: '/dashboard/groups', icon: Squares2X2Icon, roles: SCHOOL },
      { name: 'الجدول الأسبوعي', href: '/dashboard/timetable', icon: CalendarDaysIcon, roles: SCHOOL },
      { name: 'الحضور والغياب', href: '/dashboard/attendance', icon: ClipboardDocumentCheckIcon, roles: SCHOOL },
      { name: 'العلامات', href: '/dashboard/grades', icon: ChartBarIcon, roles: SCHOOL },
      { name: 'النتائج', href: '/dashboard/results', icon: TableCellsIcon, roles: SCHOOL },
    ],
  },
  {
    title: 'الإدارة',
    items: [
      { name: 'الكتب', href: '/dashboard/books', icon: BookmarkSquareIcon, roles: SCHOOL },
      { name: 'النقل', href: '/dashboard/transport', icon: TruckIcon, roles: SCHOOL },
      { name: 'طلبات فتح الصفوف', href: '/dashboard/requests', icon: InboxArrowDownIcon, roles: SCHOOL },
      { name: 'المستلزمات', href: '/dashboard/inventory', icon: ArchiveBoxIcon, roles: SCHOOL },
    ],
  },
  {
    title: 'النظام',
    items: [
      { name: 'المدارس', href: '/dashboard/schools', icon: BuildingOffice2Icon, roles: ['education_director'] as Role[] },
      { name: 'المستخدمون', href: '/dashboard/users', icon: UsersIcon, roles: ['school_director'] as Role[] },
      { name: 'سجل العمليات', href: '/dashboard/history', icon: ClockIcon, roles: ['school_director'] as Role[] },
    ],
  },
];

export default function NavLinks({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <>
      {sections.map((s) => {
        const items = s.items.filter((i) => i.roles.includes(role));
        if (items.length === 0) return null;
        return (
          <div key={s.title} className="flex gap-1 md:flex-col">
            <p className="hidden px-3 pb-1 pt-3 text-[11px] font-semibold tracking-wide text-gold-300/80 md:block">{s.title}</p>
            {items.map(({ name, href, icon: Icon }) => {
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
        );
      })}
    </>
  );
}
