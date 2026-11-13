import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchInventoryItem } from '@/app/lib/data';
import { createInventoryItem, updateInventoryItem } from '@/app/lib/actions';
import { conditionLabel, toOptions } from '@/app/lib/labels';
import { isUuid } from '@/app/lib/utils';
import { PageHeader } from '@/app/ui/kit';
import { FormShell, Input, Select } from '@/app/ui/form';

export const metadata: Metadata = { title: 'مادة من المستلزمات' };

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const isNew = id === 'new';
  if (!isNew && !isUuid(id)) notFound();
  const item = isNew ? null : await fetchInventoryItem(id);
  if (!isNew && !item) notFound();
  return (
    <>
      <PageHeader title={isNew ? 'إضافة مادة' : 'تعديل المادة'} />
      <FormShell action={isNew ? createInventoryItem : updateInventoryItem.bind(null, id)} cancelHref="/dashboard/inventory">
        <Input name="name" label="اسم المادة" defaultValue={item?.name} required />
        <Input name="unit" label="الوحدة" placeholder="مثال: علبة، دستة" defaultValue={item?.unit} />
        <Input name="quantity" label="العدد" type="number" min={0} defaultValue={item?.quantity == null ? '' : String(item.quantity)} />
        <Select name="condition" label="الحالة" options={toOptions(conditionLabel)} defaultValue={item?.condition} empty="غير محدّدة" />
        <Input name="note" label="ملاحظة" defaultValue={item?.note} />
      </FormShell>
    </>
  );
}
