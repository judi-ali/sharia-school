import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchInventory } from '@/app/lib/data';
import { deleteInventoryItem } from '@/app/lib/actions';
import { conditionLabel } from '@/app/lib/labels';
import { Badge, EmptyRow, LinkButton, Notice, PageHeader, RowActions } from '@/app/ui/kit';
import Search from '@/app/ui/search';
import { tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'المستلزمات' };

export default async function Page(props: { searchParams?: Promise<{ query?: string; error?: string }> }) {
  const sp = await props.searchParams;
  const items = await fetchInventory(sp?.query ?? '');
  return (
    <>
      <PageHeader title="المستلزمات" hint="جرد التجهيزات والقرطاسية والمواد في المدرسة."
        action={<LinkButton href="/dashboard/inventory/new">إضافة مادة</LinkButton>} />
      {sp?.error && <Notice>{sp.error}</Notice>}
      <Search placeholder="ابحث عن مادة" />
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink-100 bg-ink-50">
            <tr><th className={th}>المادة</th><th className={th}>الوحدة</th><th className={th}>العدد</th><th className={th}>الحالة</th><th className={th}><span className="sr-only">إجراءات</span></th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {items.length === 0 && <EmptyRow cols={5}>لا توجد مواد مطابقة.</EmptyRow>}
            {items.map((i) => (
              <tr key={i.id}>
                <td className={td}><Link href={`/dashboard/inventory/${i.id}`} className="font-medium hover:underline">{i.name}</Link></td>
                <td className={td}>{i.unit ?? '—'}</td>
                <td className={td}>{i.quantity ?? '—'}</td>
                <td className={td}>{i.condition ? <Badge tone={i.condition === 'new' ? 'good' : 'neutral'}>{conditionLabel[i.condition]}</Badge> : '—'}</td>
                <td className={td}>
                  <RowActions editHref={`/dashboard/inventory/${i.id}`} onDelete={deleteInventoryItem.bind(null, i.id)} confirm={`حذف «${i.name}»؟`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
