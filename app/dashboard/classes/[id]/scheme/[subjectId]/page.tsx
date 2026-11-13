import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchClass, fetchSchemeByClass, fetchSubject } from '@/app/lib/data';
import { saveScheme } from '@/app/lib/actions';
import { SLOTS, defaultLabels, maxOf, slotLabel } from '@/app/lib/grading';
import { isUuid } from '@/app/lib/utils';
import { Notice, PageHeader } from '@/app/ui/kit';
import { FormShell, Input } from '@/app/ui/form';

export const metadata: Metadata = { title: 'سلّم العلامات' };

export default async function Page(props: { params: Promise<{ id: string; subjectId: string }> }) {
  const { id, subjectId } = await props.params;
  if (!isUuid(id) || !isUuid(subjectId)) notFound();
  const [cls, subject, scheme] = await Promise.all([fetchClass(id), fetchSubject(subjectId), fetchSchemeByClass(id, subjectId)]);
  if (!cls || !subject) notFound();

  return (
    <>
      <PageHeader title={`سلّم العلامات: ${subject.name}`} hint={`الصف: ${cls.name}`} />
      {scheme?.is_provisional && <Notice tone="info">هذا السلّم مؤقت (البنية الداخلية غير صادرة بعد). عدّله واحفظه لتأكيده.</Notice>}
      <p className="mb-4 max-w-2xl text-sm text-ink-700">
        أدخل الدرجة العظمى لكل مكوّن، واترك 0 للمكوّن غير المستخدم. مجموع درجات الأعمال يجب أن يساوي مجموع درجات الامتحان
        (وهو الدرجة العظمى للمادة). محصلة الفصل = (مجموع الأعمال + الامتحان) ÷ 2.
      </p>
      <FormShell action={saveScheme.bind(null, id, subjectId)} cancelHref={`/dashboard/classes/${id}`}>
        {SLOTS.map((k) => (
          <div key={k} className="grid grid-cols-2 gap-3 md:col-span-2 md:grid-cols-[1fr_1fr]">
            <Input name={`${k}_max`} label={`${defaultLabels[k]} — الدرجة العظمى`} type="number" min={0}
              defaultValue={scheme ? String(maxOf(scheme, k)) : '0'} />
            <Input name={`label_${k}`} label="اسم العمود (اختياري)" defaultValue={scheme ? slotLabel(scheme, k) : defaultLabels[k]} />
          </div>
        ))}
        <Input name="pass_mark" label="الدرجة الصغرى للمادة (النجاح) — اختياري" type="number" min={0}
          defaultValue={scheme?.pass_mark == null ? '' : String(scheme.pass_mark)} />
      </FormShell>
    </>
  );
}
