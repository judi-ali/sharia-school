// Shared grading model (used by server and client code).
// A scheme has 7 component slots; a slot with max 0 is not used by that subject.
//   coursework = oral + homework + activity + quiz + quiz2      (درجة الأعمال)
//   exam       = exam + exam2                                    (الامتحان)
//   semester   = (coursework + exam) / 2                         (محصلة الفصل)
export const SLOTS = ['oral', 'homework', 'activity', 'quiz', 'quiz2', 'exam', 'exam2'] as const;
export type Slot = (typeof SLOTS)[number];

export const defaultLabels: Record<Slot, string> = {
  oral: 'الشفهي', homework: 'الوظائف', activity: 'النشاط', quiz: 'المذاكرة',
  quiz2: 'المذاكرة (2)', exam: 'الامتحان', exam2: 'الامتحان (2)',
};

export type Scheme = {
  oral_max: number; homework_max: number; activity_max: number; quiz_max: number; quiz2_max: number;
  exam_max: number; exam2_max: number; total_max: number; pass_mark: number | null; is_provisional: boolean;
  labels: Record<string, string> | null;
};

export const maxOf = (s: Scheme, slot: Slot): number => s[`${slot}_max` as const];
export const activeSlots = (s: Scheme) => SLOTS.filter((k) => maxOf(s, k) > 0);
export const slotLabel = (s: Scheme | null | undefined, k: Slot) => s?.labels?.[k] || defaultLabels[k];
