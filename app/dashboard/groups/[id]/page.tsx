import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  fetchClassOptions, fetchGroup, fetchGroupAssignments, fetchGroupStudents,
  fetchTeacherOptions, fetchUnassignedStudents,
} from '@/app/lib/data';
import { assignTeacher, createGroup, enrollStudent, unenrollStudent, updateGroup } from '@/app/lib/actions';
import { isUuid } from '@/app/lib/utils';
import { EmptyRow, Notice, PageHeader, Section } from '@/app/ui/kit';
import { DeleteButton, FormShell, Input, Select } from '@/app/ui/form';
import { btnPrimary, btnSecondary, fieldClass, tableWrap, td, th } from '@/app/ui/styles';

export const metadata: Metadata = { title: 'بيانات الشعبة' };

export default async function Page(props: { params: Promise<{ id: string }>; searchParams?: Promise<{ error?: string }> }) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const isNew = id === 'new';
  if (!isNew && !isUuid(id)) notFound();

  if (isNew) {
    const classes = await fetchClassOptions();
    return (
      <>
        <PageHeader title="إضافة شعبة" hint="تُنشأ الشعبة للعام الدراسي الحالي." />
        <FormShell action={createGroup} cancelHref="/dashboard/groups">
          <Select name="class_id" label="الصف" options={classes.map((c) => ({ value: c.id, label: c.name }))} empty="اختر الصف" />
          <Input name="name" label="اسم الشعبة" placeholder="مثال: الشعبة 1" required />
          <Input name="capacity" label="السعة (اختياري)" type="number" min={1} />
        </FormShell>
      </>
    );
  }

  const group = await fetchGroup(id);
  if (!group) notFound();
  const [students, unassigned, assignments, teachers] = await Promise.all([
    fetchGroupStudents(id), fetchUnassignedStudents(), fetchGroupAssignments(id), fetchTeacherOptions(),
  ]);

  return (
    <>
      <PageHeader title={`${group.class_name} - ${group.name}`} />
      {sp?.error && <Notice>{sp.error}</Notice>}
      <FormShell action={updateGroup.bind(null, id)} cancelHref="/dashboard/groups">
        <Select name="class_id" label="الصف" options={[{ value: group.class_id, label: group.class_name }]} defaultValue={group.class_id} disabled />
        <Input name="name" label="اسم الشعبة" defaultValue={group.name} required />
        <Input name="capacity" label="السعة (اختياري)" type="number" min={1} defaultValue={group.capacity ? String(group.capacity) : ''} />
      </FormShell>

      <Section title={`طلاب الشعبة (${students.length}${group.capacity ? ` / ${group.capacity}` : ''})`}>
        <div className={tableWrap}>
          <table className="min-w-full text-sm">
            <thead className="border-b border-ink-100 bg-ink-50">
              <tr><th className={th}>الاسم</th><th className={th}>رقم الطالب</th><th className={th}><span className="sr-only">إجراءات</span></th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {students.length === 0 && <EmptyRow cols={3}>لا يوجد طلاب في هذه الشعبة بعد.</EmptyRow>}
              {students.map((s) => (
                <tr key={s.enrollment_id}>
                  <td className={td}>{s.full_name}</td>
                  <td className={td} dir="ltr">{s.student_number ?? '—'}</td>
                  <td className={td}>
                    <div className="flex justify-end">
                      <DeleteButton action={unenrollStudent.bind(null, id, s.enrollment_id)} label="إزالة"
                        confirm={`إزالة «${s.full_name}» من الشعبة؟ سيُحذف حضوره وعلاماته لهذا العام.`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={enrollStudent.bind(null, id)} className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-ink-100 bg-white p-4">
          <div className="min-w-56 flex-1">
            <label htmlFor="student_id" className="mb-1.5 block text-sm font-medium">إضافة طالب غير مسجّل في أي شعبة</label>
            <select id="student_id" name="student_id" required defaultValue="" className={fieldClass} disabled={unassigned.length === 0}>
              <option value="" disabled>{unassigned.length ? 'اختر الطالب' : 'كل الطلاب النشطين موزّعون على شعب'}</option>
              {unassigned.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>
          <button className={btnPrimary} disabled={unassigned.length === 0}>إضافة إلى الشعبة</button>
        </form>
      </Section>

      <Section title="المواد والمعلمون" hint="مواد خطة الصف. اختر معلم كل مادة في هذه الشعبة.">
        <div className={tableWrap}>
          <table className="min-w-full text-sm">
            <thead className="border-b border-ink-100 bg-ink-50">
              <tr><th className={th}>المادة</th><th className={th}>الحصص</th><th className={th}>المعلم</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {assignments.length === 0 && <EmptyRow cols={3}>لا توجد مواد في خطة هذا الصف. أضِفها من صفحة الصف.</EmptyRow>}
              {assignments.map((a) => {
                const parts = assignments.filter((x) => x.part_of_subject_id === a.subject_id);
                return (
                  <tr key={a.subject_id}>
                    <td className={td}>{a.part_of_subject_id && <span className="me-2 text-ink-600">↳</span>}{a.name}</td>
                    <td className={td}>{a.part_of_subject_id ? '—' : a.weekly_periods}</td>
                    <td className={td}>
                      <form action={assignTeacher.bind(null, id, a.subject_id)} className="flex items-center gap-2">
                        <select name="teacher_id" defaultValue={a.teacher_id ?? ''} aria-label={`معلم ${a.name}`} className={`${fieldClass} min-w-44`}>
                          <option value="">— غير محدّد —</option>
                          {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                        </select>
                        <button className={btnSecondary}>حفظ</button>
                      </form>
                      {a.is_parent && (
                        <span className="mt-1 block text-xs text-ink-600">علاماتها محسوبة تلقائياً من: {parts.map((x) => x.name).join(' و')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
