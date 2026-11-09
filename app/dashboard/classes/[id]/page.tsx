import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchClass, fetchCurriculum, fetchSubjectOptions, getCurrentYear } from '@/app/lib/data';
import { createClass, updateClass, removeCurriculum, saveCurriculum } from '@/app/lib/actions';
import { categoryLabel, gradeLevelLabel, toOptions, trackLabel } from '@/app/lib/labels';
import { isUuid } from '@/app/lib/utils';
import { Notice, PageHeader, Section } from '@/app/ui/kit';
import { DeleteButton, FormShell, Input, Select } from '@/app/ui/form';
import { btnPrimary, btnSecondary, fieldClass, tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'بيانات الصف' };

function PeriodsBar({ sharia, educational, target }: { sharia: number; educational: number; target: number }) {
  const total = sharia + educational;
  const pct = (n: number) => `${Math.min(100, (n / target) * 100)}%`;
  return (
    <div className="mt-3 rounded-xl border border-ink-100 bg-white p-4">
      <div className="flex h-4 overflow-hidden rounded-full bg-ink-50" role="img"
        aria-label={`${total} من ${target} حصة: ${sharia} شرعية و${educational} تربوية`}>
        <div className="bg-ink-700" style={{ width: pct(sharia) }} />
        <div className="bg-gold-500" style={{ width: pct(educational) }} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span><span className="me-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-ink-700" />شرعية {sharia}</span>
        <span><span className="me-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-gold-500" />تربوية {educational}</span>
        <span className={total === target ? 'font-semibold text-emerald-800' : 'font-semibold text-amber-800'}>
          المجموع {total} من {target}{total === target ? ' ✓' : total < target ? ` — ينقص ${target - total}` : ` — زائد ${total - target}`}
        </span>
      </div>
    </div>
  );
}

export default async function Page(props: { params: Promise<{ id: string }>; searchParams?: Promise<{ error?: string }> }) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const isNew = id === 'new';
  if (!isNew && !isUuid(id)) notFound();
  const cls = isNew ? null : await fetchClass(id);
  if (!isNew && !cls) notFound();

  const levels = toOptions(gradeLevelLabel);
  const tracks = toOptions(trackLabel);

  if (isNew || !cls) {
    return (
      <>
        <PageHeader title="إضافة صف" hint="بعد الحفظ تستطيع إضافة مواد الصف وحصصه الأسبوعية." />
        <FormShell action={createClass} cancelHref="/dashboard/classes">
          <Input name="name" label="اسم الصف" placeholder="مثال: عاشر أدبي" required />
          <Select name="grade_level" label="المستوى" options={levels} defaultValue="7" />
          <Select name="track" label="الاختصاص" options={tracks} defaultValue="general" />
        </FormShell>
      </>
    );
  }

  const [curriculum, subjects, year] = await Promise.all([fetchCurriculum(id), fetchSubjectOptions(), getCurrentYear()]);
  const target = year.periods_per_day * year.school_days_per_week;
  const sum = (cat: string) => curriculum.filter((c) => c.category === cat).reduce((a, c) => a + c.weekly_periods, 0);

  return (
    <>
      <PageHeader title={cls.name} />
      {sp?.error && <Notice>{sp.error}</Notice>}
      <FormShell action={updateClass.bind(null, id)} cancelHref="/dashboard/classes">
        <Input name="name" label="اسم الصف" defaultValue={cls.name} required />
        <Select name="grade_level" label="المستوى" options={levels} defaultValue={String(cls.grade_level)} />
        <Select name="track" label="الاختصاص" options={tracks} defaultValue={cls.track} />
      </FormShell>

      <Section title="مواد الصف والحصص الأسبوعية" hint={`الخطة الدرسية للعام ${year.name}: ${year.periods_per_day} حصص يومياً، مدة الحصة ${year.period_minutes} دقيقة.`}>
        <PeriodsBar sharia={sum('sharia')} educational={sum('educational')} target={target} />

        <div className={tableWrap}>
          <table className="min-w-full text-sm">
            <thead className="border-b border-ink-100 bg-ink-50">
              <tr><th className={th}>المادة</th><th className={th}>التصنيف</th><th className={th}>الحصص في الأسبوع</th><th className={th}><span className="sr-only">إجراءات</span></th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {curriculum.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-right text-ink-700">لا توجد مواد في خطة هذا الصف بعد. أضِف المادة الأولى من الأسفل.</td></tr>
              )}
              {curriculum.map((c) => (
                <tr key={c.subject_id}>
                  <td className={td}>{c.name}</td>
                  <td className={td}>{categoryLabel[c.category]}</td>
                  <td className={td}>
                    <form action={saveCurriculum.bind(null, id)} className="flex items-center gap-2">
                      <input type="hidden" name="subject_id" value={c.subject_id} />
                      <input type="number" name="weekly_periods" defaultValue={c.weekly_periods} min={1} max={35}
                        aria-label={`حصص ${c.name}`} className={`${fieldClass} !w-20`} />
                      <button className={btnSecondary}>حفظ</button>
                    </form>
                  </td>
                  <td className={td}>
                    <div className="flex justify-end">
                      <DeleteButton action={removeCurriculum.bind(null, id, c.subject_id)} confirm={`إزالة «${c.name}» من خطة ${cls.name}؟`} label="إزالة" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={saveCurriculum.bind(null, id)} className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-ink-100 bg-white p-4">
          <div className="min-w-56 flex-1">
            <label htmlFor="subject_id" className="mb-1.5 block text-sm font-medium">إضافة مادة إلى الخطة</label>
            <select id="subject_id" name="subject_id" required defaultValue="" className={fieldClass}>
              <option value="" disabled>اختر المادة</option>
              {(['sharia', 'educational'] as const).map((cat) => (
                <optgroup key={cat} label={categoryLabel[cat]}>
                  {subjects.filter((s) => s.category === cat && !curriculum.some((c) => c.subject_id === s.id))
                    .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="weekly_periods" className="mb-1.5 block text-sm font-medium">الحصص</label>
            <input id="weekly_periods" type="number" name="weekly_periods" min={1} max={35} required className={`${fieldClass} !w-24`} />
          </div>
          <button className={btnPrimary}>إضافة المادة</button>
        </form>
      </Section>
    </>
  );
}
