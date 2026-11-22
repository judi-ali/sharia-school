export const genderLabel: Record<string, string> = { male: 'ذكر', female: 'أنثى' };
export const personStatusLabel: Record<string, string> = { active: 'نشط', inactive: 'غير نشط', graduated: 'متخرّج', transferred: 'منقول' };
export const registrationLabel: Record<string, string> = { complete: 'مكتمل', pending: 'أوراق ناقصة' };
export const conditionLabel: Record<string, string> = { new: 'جديد', old: 'قديم' };
export const requestStatusLabel: Record<string, string> = { pending: 'قيد الانتظار', enrolled: 'سُجّل', dropped: 'منقطع' };
export const dayLabel = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
export const trackLabel: Record<string, string> = { general: 'عام', literary: 'أدبي', scientific: 'علمي' };
export const stageLabel: Record<string, string> = { preparatory: 'إعدادية', secondary: 'ثانوية شرعية' };
export const categoryLabel: Record<string, string> = { sharia: 'المواد الشرعية', educational: 'المواد التربوية' };
export const attendanceLabel: Record<string, string> = {
  present: 'حاضر', absent: 'غائب', late: 'متأخر', excused: 'غياب بعذر',
};
export const semesterLabel: Record<string, string> = { '1': 'الفصل الأول', '2': 'الفصل الثاني' };
export const gradeLevelLabel: Record<string, string> = {
  '7': 'السابع', '8': 'الثامن', '9': 'التاسع', '10': 'العاشر', '11': 'الحادي عشر', '12': 'البكالوريا',
};

export const toOptions = (m: Record<string, string>) =>
  Object.entries(m).map(([value, label]) => ({ value, label }));

export const roleLabel: Record<string, string> = {
  education_director: 'مدير التعليم الشرعي', school_director: 'مدير المدرسة', school_admin: 'إداري المدرسة',
};
export const schoolTypeLabel: Record<string, string> = { boys: 'بنين', girls: 'بنات', mixed: 'مختلطة' };
export const entityLabel: Record<string, string> = {
  student: 'الطلاب', teacher: 'المعلمون', group: 'الشعب', enrollment: 'تسجيل الطلاب في الشعب', assignment: 'إسناد المعلمين',
  attendance: 'الحضور والغياب', grades: 'العلامات', timetable: 'الجدول الأسبوعي', route: 'خطوط النقل', passenger: 'ركاب النقل',
  request: 'طلبات فتح الصفوف', inventory: 'المستلزمات', handout: 'تسليم الكتب', user: 'المستخدمون',
};
export const auditActionLabel: Record<string, string> = { create: 'إضافة', update: 'تعديل', delete: 'حذف', save: 'حفظ' };
