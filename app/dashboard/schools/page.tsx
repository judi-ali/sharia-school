import type { Metadata } from 'next';
import Link from 'next/link';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { fetchSchools } from '@/app/lib/directory';
import { schoolTypeLabel } from '@/app/lib/labels';
import { Badge, EmptyRow, LinkButton, PageHeader } from '@/app/ui/kit';
import { tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'المدارس' };

export default async function Page() {
  const schools = await fetchSchools();
  return (
    <>
      <PageHeader title="المدارس الشرعية" hint="أضِف مدرسة جديدة وحدّد مديرها (بريده وكلمة مروره). يُنشئ المدير بعدها بقية مستخدمي مدرسته."
        action={<LinkButton href="/dashboard/schools/new">إضافة مدرسة</LinkButton>} />
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr>
              <th className={th}>المدرسة</th><th className={th}>النوع</th><th className={th}>المديرية</th><th className={th}>المدير</th>
              <th className={th}>الطلاب</th><th className={th}>المعلمون</th><th className={th}>الحالة</th><th className={th}><span className="sr-only">إجراءات</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {schools.length === 0 && <EmptyRow cols={8}>لا توجد مدارس بعد.</EmptyRow>}
            {schools.map((s) => (
              <tr key={s.id}>
                <td className={td}><Link href={`/dashboard/schools/${s.id}`} className="font-medium hover:underline">{s.name}</Link></td>
                <td className={td}>{schoolTypeLabel[s.gender]}</td>
                <td className={td}>{s.directorate ?? '—'}</td>
                <td className={td}>{s.director_name ?? '—'}<span className="block text-xs text-ink-600" dir="ltr">{s.director_email}</span></td>
                <td className={td}>{s.students}</td>
                <td className={td}>{s.teachers}</td>
                <td className={td}><Badge tone={s.is_active ? 'good' : 'bad'}>{s.is_active ? 'نشطة' : 'معطّلة'}</Badge></td>
                <td className={td}>
                  <Link href={`/dashboard/schools/${s.id}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-ink-800 hover:bg-ink-50">
                    <PencilSquareIcon className="h-4 w-4" /> تعديل
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
