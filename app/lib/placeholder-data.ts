export const academicYear = {
  name: '2026/2027',
  start_date: '2026-09-01',
  end_date: '2027-06-30',
  periods_per_day: 7, // Ministry decision, article 2
  period_minutes: 40, // the school's bell schedule (the ministry decision says 45)
  school_days_per_week: 5, // inferred: 35 weekly periods / 7 per day
};

export const admin = {
  name: 'مدير النظام',
  email: 'admin@school.test',
  // overridden by SEED_ADMIN_PASSWORD when set
  password: 'ChangeMe123!',
};

// `plan` = index of the column in the official plan:
// 0: Grade 7/8 (shared), 1: Grade 9, 2: G10 Lit, 3: G10 Sci, 4: G11 Lit, 5: G11 Sci, 6: Bac Lit, 7: Bac Sci
export const classes = [
  { name: 'السابع', grade_level: 7, track: 'general', plan: 0 },
  { name: 'الثامن', grade_level: 8, track: 'general', plan: 0 },
  { name: 'التاسع', grade_level: 9, track: 'general', plan: 1 },
  { name: 'عاشر أدبي', grade_level: 10, track: 'literary', plan: 2 },
  { name: 'عاشر علمي', grade_level: 10, track: 'scientific', plan: 3 },
  { name: 'حادي عشر أدبي', grade_level: 11, track: 'literary', plan: 4 },
  { name: 'حادي عشر علمي', grade_level: 11, track: 'scientific', plan: 5 },
  { name: 'بكالوريا أدبي', grade_level: 12, track: 'literary', plan: 6 },
  { name: 'بكالوريا علمي', grade_level: 12, track: 'scientific', plan: 7 },
];


// Official plan 2026/2027 (ministry decision). `periods` = weekly periods per plan column:
// [G7/8, G9, G10 Lit, G10 Sci, G11 Lit, G11 Sci, Bac Lit, Bac Sci]  (0 = not taught)
// Column totals: Sharia 12,9,14,8,16,8,12,4 · Educational 23,26,21,27,19,27,23,31 · All 35.
type Subject = { name: string; category: 'sharia' | 'educational'; periods: number[] };
export const subjects: Subject[] = [
  // ── Sharia subjects ──
  { name: 'التجويد والاستحفاظ', category: 'sharia', periods: [2, 2, 2, 2, 2, 2, 2, 0] },
  { name: 'التفسير / التفسير التحليلي', category: 'sharia', periods: [2, 2, 2, 0, 2, 0, 2, 0] },
  { name: 'الحديث النبوي / الحديث التحليلي', category: 'sharia', periods: [1, 2, 2, 0, 1, 0, 1, 0] },
  { name: 'الفقه الإسلامي', category: 'sharia', periods: [2, 2, 2, 2, 2, 2, 2, 0] },
  { name: 'العقيدة الإسلامية', category: 'sharia', periods: [1, 1, 1, 0, 1, 0, 1, 0] },
  { name: 'الدعوة والخطابة / الدعوة والإعلام', category: 'sharia', periods: [2, 0, 1, 0, 1, 0, 0, 0] },
  { name: 'فن الحوار وأدب الاختلاف', category: 'sharia', periods: [0, 0, 1, 1, 0, 0, 0, 0] },
  { name: 'السيرة والشمائل النبوية / السيرة', category: 'sharia', periods: [2, 0, 1, 1, 1, 1, 0, 0] },
  { name: 'علوم القرآن الكريم', category: 'sharia', periods: [0, 0, 0, 0, 1, 0, 0, 0] },
  { name: 'مصطلح الحديث', category: 'sharia', periods: [0, 0, 0, 0, 1, 1, 1, 0] },
  { name: 'أصول الفقه وتاريخ التشريع', category: 'sharia', periods: [0, 0, 1, 2, 2, 2, 2, 0] },
  { name: 'علم الفرائض', category: 'sharia', periods: [0, 0, 1, 0, 2, 0, 1, 0] },
  { name: 'العلوم الشرعية', category: 'sharia', periods: [0, 0, 0, 0, 0, 0, 0, 4] },
  // ── Educational subjects ──
  { name: 'اللغة العربية', category: 'educational', periods: [5, 6, 6, 5, 6, 4, 7, 5] },
  { name: 'اللغة الإنجليزية', category: 'educational', periods: [3, 4, 4, 4, 3, 4, 4, 4] },
  { name: 'اللغة الأجنبية الثانية', category: 'educational', periods: [1, 1, 1, 1, 1, 1, 1, 1] },
  { name: 'الرياضيات (إحصاء واحتمالات)', category: 'educational', periods: [4, 6, 2, 6, 1, 6, 0, 9] },
  { name: 'الدراسات الاجتماعية', category: 'educational', periods: [3, 4, 0, 0, 0, 0, 0, 0] },
  { name: 'علم الأحياء والأرض', category: 'educational', periods: [2, 2, 0, 3, 0, 3, 0, 3] },
  { name: 'الفيزياء والكيمياء إعدادي', category: 'educational', periods: [2, 2, 0, 0, 0, 0, 0, 0] },
  { name: 'تكنولوجيا المعلومات والاتصالات', category: 'educational', periods: [1, 0, 1, 1, 1, 1, 0, 0] },
  { name: 'التربية الرياضية للبنين / الفنون للبنات', category: 'educational', periods: [1, 1, 1, 1, 1, 1, 0, 0] },
  { name: 'الفلسفة والعلوم الإنسانية', category: 'educational', periods: [0, 0, 2, 1, 2, 1, 5, 0] },
  { name: 'التاريخ', category: 'educational', periods: [0, 0, 2, 0, 2, 0, 3, 0] },
  { name: 'الجغرافيا', category: 'educational', periods: [0, 0, 2, 0, 2, 0, 3, 0] },
  { name: 'الفيزياء', category: 'educational', periods: [0, 0, 0, 3, 0, 4, 0, 6] },
  { name: 'الكيمياء', category: 'educational', periods: [0, 0, 0, 2, 0, 2, 0, 3] },
  { name: 'الأنشطة', category: 'educational', periods: [1, 0, 0, 0, 0, 0, 0, 0] },
];

// Social Studies (grades 7-9) is COMPUTED: the average of its parts' results. The parts are taught and
// graded on their own (0 periods: the plan's periods belong to Social Studies) and are not counted in totals.
export const compositeSubjects = {
  parent: 'الدراسات الاجتماعية',
  parts: ['التاريخ', 'الجغرافيا'],
  classes: ['السابع', 'الثامن', 'التاسع'],
};

// ───────── Grading schemes (ministry grade books 2026/2027), per class and subject ─────────
// Components: oral · homework · activity · quiz · quiz2 (coursework) and exam · exam2 (exam).
// coursework total = exam total = total; semester result = (coursework + exam) / 2.
type BaseScheme = {
  subject: string; cls: string; total: number;
  oral: number; homework: number; activity: number; quiz: number; quiz2: number; exam: number; exam2: number;
  labels: Record<string, string>;
};
type Row = [cls: string, total: number];

const C7 = 'السابع', C8 = 'الثامن', C9 = 'التاسع';
const L10 = 'عاشر أدبي', S10 = 'عاشر علمي', L11 = 'حادي عشر أدبي', S11 = 'حادي عشر علمي';
const L12 = 'بكالوريا أدبي', S12 = 'بكالوريا علمي';

// Standard book: oral 25% + homework 25% + quiz 50%; a single exam
const std = (subject: string, rows: Row[]): BaseScheme[] =>
  rows.map(([cls, t]) => ({ subject, cls, total: t, oral: t / 4, homework: t / 4, activity: 0, quiz: t / 2, quiz2: 0, exam: t, exam2: 0, labels: {} }));

// Same coursework, exam split in two equal parts (written + oral/practical/theory-practical)
const split = (subject: string, rows: Row[], labels: Record<string, string>): BaseScheme[] =>
  rows.map(([cls, t]) => ({ subject, cls, total: t, oral: t / 4, homework: t / 4, activity: 0, quiz: t / 2, quiz2: 0, exam: t / 2, exam2: t / 2, labels }));

const ENGLISH_ROWS: Row[] = [[C7, 400], [C8, 400], [C9, 400], [L10, 400], [S10, 300], [L11, 400], [S11, 300], [L12, 400], [S12, 300]];
const engLabels = { exam: 'الامتحان (تحريري)', exam2: 'الامتحان (شفهي: تحدث واستماع)' };

// Arabic: oral 20% + homework 15% + activity 15% + quiz 50%
const arabic = (cls: string, t: number, o: number, h: number, a: number, q: number): BaseScheme =>
  ({ subject: 'اللغة العربية', cls, total: t, oral: o, homework: h, activity: a, quiz: q, quiz2: 0, exam: t, exam2: 0, labels: { activity: 'النشاط (مبادرات وأوراق عمل)' } });

// Tajweed: oral 25%, homework 25%, quiz = written 20% + practical 30%; exam = practical 60% + written 40%
const tajweedLabels = { quiz: 'المذاكرة (كتابي)', quiz2: 'المذاكرة (عملي)', exam: 'الامتحان (عملي)', exam2: 'الامتحان (تحريري)' };
const tajweed = (cls: string, practicalOnly: boolean): BaseScheme => ({
  subject: 'التجويد والاستحفاظ', cls, total: 200, oral: 50, homework: 50, activity: 0, quiz: 40, quiz2: 60,
  exam: practicalOnly ? 200 : 120, exam2: practicalOnly ? 0 : 80, labels: tajweedLabels,
});

const baseSchemes: BaseScheme[] = [
  // ── Sharia subjects ──
  ...[C7, C8, L10, S10, L11, S11].map((c) => tajweed(c, false)),
  ...[C9, L12].map((c) => tajweed(c, true)),
  ...std('التفسير / التفسير التحليلي', [[C7, 200], [C8, 200], [C9, 200], [L10, 200], [L11, 300], [L12, 400]]),
  ...std('الحديث النبوي / الحديث التحليلي', [[C7, 200], [C8, 200], [C9, 200], [L10, 200], [L11, 200], [L12, 200]]),
  ...std('الفقه الإسلامي', [[C7, 200], [C8, 200], [C9, 300], [L10, 300], [S10, 300], [L11, 400], [S11, 400], [L12, 400]]),
  ...std('العقيدة الإسلامية', [[C7, 200], [C8, 200], [C9, 200], [L10, 200], [L11, 200], [L12, 200]]),
  ...split('الدعوة والخطابة / الدعوة والإعلام', [[C7, 200], [C8, 200], [L10, 100]],
    { homework: 'العملي', exam: 'الامتحان (تحريري)', exam2: 'الامتحان (خطابة عملي)' }),
  ...std('الدعوة والخطابة / الدعوة والإعلام', [[L11, 200]]),
  ...std('فن الحوار وأدب الاختلاف', [[L10, 100], [S10, 100]]),
  ...std('السيرة والشمائل النبوية / السيرة', [[C7, 400], [C8, 400], [L10, 200], [S10, 200], [L11, 200], [S11, 200]]),
  ...std('علوم القرآن الكريم', [[L11, 100]]),
  ...std('مصطلح الحديث', [[L11, 200], [S11, 200], [L12, 200]]),
  ...std('أصول الفقه وتاريخ التشريع', [[L10, 200], [S10, 200], [L11, 200], [S11, 200], [L12, 200]]),
  ...std('علم الفرائض', [[L10, 200], [L11, 200], [L12, 200]]),
  // ── Educational subjects ──
  arabic(C7, 600, 120, 90, 90, 300), arabic(C8, 600, 120, 90, 90, 300), arabic(C9, 600, 120, 90, 90, 300),
  arabic(L10, 500, 100, 75, 75, 250), arabic(S10, 500, 100, 75, 75, 250),
  arabic(L11, 600, 120, 90, 90, 300), arabic(S11, 400, 80, 60, 60, 200),
  arabic(L12, 600, 120, 90, 90, 300), arabic(S12, 400, 80, 60, 60, 200),
  ...split('اللغة الإنجليزية', ENGLISH_ROWS, engLabels),
  ...split('اللغة الأجنبية الثانية', ENGLISH_ROWS, engLabels), // same book as English
  ...std('الرياضيات (إحصاء واحتمالات)', [[C7, 600], [C8, 600], [C9, 600], [L10, 400], [S10, 400], [L11, 100], [S11, 600], [S12, 600]]),
  ...std('علم الأحياء والأرض', [[C7, 200], [C8, 200], [C9, 200], [S10, 200], [S11, 300], [S12, 300]]),
  ...std('الفيزياء والكيمياء إعدادي', [[C7, 200], [C8, 200], [C9, 200]]),
  ...split('تكنولوجيا المعلومات والاتصالات', [[C7, 200], [C8, 200], [L10, 200], [S10, 200], [L11, 200], [S11, 200]],
    { exam: 'الامتحان (نظري)', exam2: 'الامتحان (عملي)' }),
  ...std('الفلسفة والعلوم الإنسانية', [[L10, 200], [S10, 200], [L11, 400], [S11, 200], [L12, 400]]),
  ...std('التاريخ', [[C7, 300], [C8, 300], [C9, 300], [L10, 200], [L11, 300], [L12, 300]]),
  ...std('الجغرافيا', [[C7, 300], [C8, 300], [C9, 300], [L10, 200], [L11, 300], [L12, 300]]),
  ...std('الفيزياء', [[S10, 200], [S11, 400], [S12, 400]]),
  ...std('الكيمياء', [[S10, 200], [S11, 200], [S12, 200]]),
  // ── PROVISIONAL: totals from circular 3107 (200), internal split not issued yet → standard split ──
  ...std('التربية الرياضية للبنين / الفنون للبنات', [[C7, 200], [C8, 200], [C9, 200], [L10, 200], [S10, 200], [L11, 200], [S11, 200]]),
  ...std('الأنشطة', [[C7, 200], [C8, 200]]),
  // ── PROVISIONAL: no book/circular for Baccalaureate Scientific yet (placeholder total) ──
  ...std('العلوم الشرعية', [[S12, 400]]),
];

const PROVISIONAL = new Set(['التربية الرياضية للبنين / الفنون للبنات', 'الأنشطة', 'العلوم الشرعية']);
const NO_PASS_MARK = new Set(['التربية الرياضية للبنين / الفنون للبنات', 'الأنشطة']); // practical / no exam

export type GradingScheme = BaseScheme & { pass_mark: number | null; provisional: boolean };

// Pass mark ("الدرجة الصغرى") per circular 3107: 40% of the subject total, Arabic 50% (Grade 10 Scientific 40%)
export const gradingSchemes: GradingScheme[] = baseSchemes.map((s) => {
  const ratio = s.subject === 'اللغة العربية' && s.cls !== S10 ? 0.5 : 0.4;
  return { ...s, pass_mark: NO_PASS_MARK.has(s.subject) ? null : Math.round(s.total * ratio), provisional: PROVISIONAL.has(s.subject) };
});

