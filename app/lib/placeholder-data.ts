export const academicYear = {
  name: '2026/2027',
  start_date: '2026-09-01',
  end_date: '2027-06-30',
  periods_per_day: 7, // Ministry decision, article 2
  period_minutes: 45,
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

export const groupNames = ['الشعبة 1', 'الشعبة 2'];

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

export const teachers = [
  { full_name: 'خالد الحموي', email: 'khaled@school.test', phone: '0911000001', hire_date: '2018-09-01' },
  { full_name: 'رانيا درويش', email: 'rania@school.test', phone: '0911000002', hire_date: '2020-09-01' },
  { full_name: 'عمر حداد', email: 'omar@school.test', phone: '0911000003', hire_date: '2015-09-01' },
  { full_name: 'لينا صباغ', email: 'lina@school.test', phone: '0911000004', hire_date: '2022-09-01' },
];

// Default max marks per class, from the Geography grade book (placeholder for all subjects).
// Grade 10 = 200 in the book; the Scientific tracks are NOT in the book, so Literary values are copied.
const std = { oral: 75, homework: 75, quiz: 150, exam: 300, total: 300 };
const g10 = { oral: 50, homework: 50, quiz: 100, exam: 200, total: 200 };
export const gradingSchemes = [
  { cls: 'السابع', ...std },
  { cls: 'الثامن', ...std },
  { cls: 'التاسع', ...std },
  { cls: 'عاشر أدبي', ...g10 },
  { cls: 'عاشر علمي', ...g10 }, // placeholder (copied)
  { cls: 'حادي عشر أدبي', ...std },
  { cls: 'حادي عشر علمي', ...std }, // placeholder (copied)
  { cls: 'بكالوريا أدبي', ...std },
  { cls: 'بكالوريا علمي', ...std }, // placeholder (copied)
];

export const students = [
  { student_number: 'S-0001', full_name: 'أحمد ناصر', gender: 'male', date_of_birth: '2013-03-14', guardian_name: 'ناصر علي', guardian_phone: '0922000001', cls: 'السابع', grp: 'الشعبة 1' },
  { student_number: 'S-0002', full_name: 'سارة منصور', gender: 'female', date_of_birth: '2013-07-02', guardian_name: 'منصور عيسى', guardian_phone: '0922000002', cls: 'السابع', grp: 'الشعبة 1' },
  { student_number: 'S-0003', full_name: 'يوسف قاسم', gender: 'male', date_of_birth: '2013-11-21', guardian_name: 'قاسم عمر', guardian_phone: '0922000003', cls: 'السابع', grp: 'الشعبة 2' },
  { student_number: 'S-0004', full_name: 'مايا حجازي', gender: 'female', date_of_birth: '2013-01-30', guardian_name: 'حجازي سمير', guardian_phone: '0922000004', cls: 'السابع', grp: 'الشعبة 2' },
  { student_number: 'S-0005', full_name: 'بلال زيدان', gender: 'male', date_of_birth: '2012-05-09', guardian_name: 'زيدان فادي', guardian_phone: '0922000005', cls: 'الثامن', grp: 'الشعبة 1' },
  { student_number: 'S-0006', full_name: 'هنين عرفلي', gender: 'female', date_of_birth: '2012-09-17', guardian_name: 'عرفلي حسن', guardian_phone: '0922000006', cls: 'الثامن', grp: 'الشعبة 1' },
  { student_number: 'S-0007', full_name: 'تامر الإدلبي', gender: 'male', date_of_birth: '2012-12-05', guardian_name: 'الإدلبي نبيل', guardian_phone: '0922000007', cls: 'الثامن', grp: 'الشعبة 2' },
  { student_number: 'S-0008', full_name: 'دانة كردي', gender: 'female', date_of_birth: '2011-04-25', guardian_name: 'كردي عماد', guardian_phone: '0922000008', cls: 'التاسع', grp: 'الشعبة 1' },
  { student_number: 'S-0009', full_name: 'رامي الشامي', gender: 'male', date_of_birth: '2011-08-12', guardian_name: 'الشامي لؤي', guardian_phone: '0922000009', cls: 'التاسع', grp: 'الشعبة 1' },
  { student_number: 'S-0010', full_name: 'نور الحلبي', gender: 'female', date_of_birth: '2010-02-19', guardian_name: 'الحلبي وليد', guardian_phone: '0922000010', cls: 'عاشر أدبي', grp: 'الشعبة 1' },
  { student_number: 'S-0011', full_name: 'زين موسى', gender: 'male', date_of_birth: '2010-06-23', guardian_name: 'موسى هاني', guardian_phone: '0922000011', cls: 'عاشر علمي', grp: 'الشعبة 1' },
  { student_number: 'S-0012', full_name: 'كريم دعبول', gender: 'male', date_of_birth: '2009-06-03', guardian_name: 'دعبول عادل', guardian_phone: '0922000012', cls: 'حادي عشر علمي', grp: 'الشعبة 1' },
  { student_number: 'S-0013', full_name: 'لميس طباع', gender: 'female', date_of_birth: '2008-10-28', guardian_name: 'طباع مجد', guardian_phone: '0922000013', cls: 'بكالوريا أدبي', grp: 'الشعبة 1' },
  { student_number: 'S-0014', full_name: 'آدم الرفاعي', gender: 'male', date_of_birth: '2008-03-08', guardian_name: 'الرفاعي ياسر', guardian_phone: '0922000014', cls: 'بكالوريا علمي', grp: 'الشعبة 1' },
];

// [subject, teacher email, class, group]. Subject must exist in that class's plan.
export const teachingAssignments: [string, string, string, string][] = [
  ['اللغة العربية', 'omar@school.test', 'السابع', 'الشعبة 1'],
  ['اللغة العربية', 'omar@school.test', 'السابع', 'الشعبة 2'],
  ['الدراسات الاجتماعية', 'khaled@school.test', 'السابع', 'الشعبة 1'],
  ['الدراسات الاجتماعية', 'khaled@school.test', 'السابع', 'الشعبة 2'],
  ['الرياضيات (إحصاء واحتمالات)', 'lina@school.test', 'السابع', 'الشعبة 1'],
  ['الفقه الإسلامي', 'omar@school.test', 'التاسع', 'الشعبة 1'],
  ['الجغرافيا', 'rania@school.test', 'عاشر أدبي', 'الشعبة 1'],
  ['الفيزياء', 'khaled@school.test', 'عاشر علمي', 'الشعبة 1'],
];

export const attendanceDates = ['2026-11-02', '2026-11-03', '2026-11-04'];

// Grades are seeded for these subjects, only where the class's plan includes them
export const gradedSubjects = ['اللغة العربية', 'الجغرافيا'];
