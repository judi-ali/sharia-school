import type { Metadata } from 'next';
import { fetchGroupOptions, fetchHandoutSheet, fetchTextbooks } from '@/app/lib/data';
import { saveHandouts } from '@/app/lib/actions';
import { isUuid } from '@/app/lib/utils';
import { Notice, PageHeader } from '@/app/ui/kit';
import { AutoSelect } from '@/app/ui/filters';
import HandoutSheet from '@/app/ui/handout-sheet';

export const metadata: Metadata = { title: 'الكتب' };

export default async function Page(props: { searchParams?: Promise<{ group?: string }> }) {
  const sp = await props.searchParams;
  const groups = await fetchGroupOptions();
  const groupId = sp?.group && isUuid(sp.group) && groups.some((g) => g.value === sp.group) ? sp.group : '';
  const [books, rows] = groupId ? await Promise.all([fetchTextbooks(groupId), fetchHandoutSheet(groupId)]) : [[], []];

  return (
    <>
      <PageHeader title="الكتب المدرسية" hint="تسليم الكتب للطلاب: ضع إشارة عند استلام الطالب للكتاب." />
      <form method="get" className="flex flex-wrap items-end gap-4 rounded-xl border border-ink-100 bg-white p-4">
        <AutoSelect name="group" label="الشعبة" options={groups} defaultValue={groupId} empty="اختر الشعبة" />
      </form>
      {!groupId && <p className="mt-6 text-sm text-ink-700">اختر شعبة لعرض كتب صفّها.</p>}
      {groupId && books.length === 0 && <div className="mt-5"><Notice tone="info">لا توجد كتب مسجّلة لهذا الصف.</Notice></div>}
      {groupId && books.length > 0 && rows.length === 0 && <div className="mt-5"><Notice tone="info">لا يوجد طلاب مسجّلون في هذه الشعبة.</Notice></div>}
      {groupId && books.length > 0 && rows.length > 0 && (
        <HandoutSheet key={`${groupId}${rows.map((r) => r.delivered.length).join('.')}`} books={books} rows={rows} action={saveHandouts.bind(null, groupId)} />
      )}
    </>
  );
}
