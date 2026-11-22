import type { Metadata } from 'next';
import Link from 'next/link';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { fetchSchoolUsers } from '@/app/lib/directory';
import { roleLabel } from '@/app/lib/labels';
import { Badge, LinkButton, PageHeader } from '@/app/ui/kit';
import { tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'المستخدمون' };

export default async function Page() {
  const users = await fetchSchoolUsers();
  return (
    <>
      <PageHeader title="المستخدمون" hint="أنشئ حسابات إدارية لمدرستك. كل ما يفعلونه يُسجَّل في سجل العمليات."
        action={<LinkButton href="/dashboard/users/new">إضافة مستخدم</LinkButton>} />
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr><th className={th}>الاسم</th><th className={th}>البريد الإلكتروني</th><th className={th}>الدور</th><th className={th}>الحالة</th><th className={th}><span className="sr-only">إجراءات</span></th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className={`${td} font-medium`}>{u.name}</td>
                <td className={td} dir="ltr">{u.email}</td>
                <td className={td}><Badge tone={u.role === 'school_director' ? 'good' : 'neutral'}>{roleLabel[u.role]}</Badge></td>
                <td className={td}><Badge tone={u.is_active ? 'good' : 'bad'}>{u.is_active ? 'نشط' : 'معطّل'}</Badge></td>
                <td className={td}>
                  {u.role === 'school_admin' ? (
                    <Link href={`/dashboard/users/${u.id}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-ink-800 hover:bg-ink-50">
                      <PencilSquareIcon className="h-4 w-4" /> تعديل
                    </Link>
                  ) : (
                    <Link href="/dashboard/profile" className="text-sm text-ink-700 hover:underline">ملفي الشخصي</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
