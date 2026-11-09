import bcrypt from 'bcrypt';
import { sql } from '../lib/db';
import { schema, dropAll } from '../lib/schema';
import {
  academicYear, admin, classes, groupNames, subjects, teachers, gradingSchemes,
  students, teachingAssignments, attendanceDates, gradedSubjects,
} from '../lib/placeholder-data';

export async function GET(request: Request) {
  // Protect the route: /seed?secret=<SEED_SECRET>   (add &reset=1 to drop and rebuild all tables)
  const url = new URL(request.url);
  if (!process.env.SEED_SECRET || url.searchParams.get('secret') !== process.env.SEED_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await sql.begin(async (tx) => {
      if (url.searchParams.get('reset') === '1') await tx.unsafe(dropAll);

      // 1. Schema
      await tx.unsafe(schema);

      // 2. Admin user
      const hash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? admin.password, 10);
      await tx`
        INSERT INTO users (name, email, password)
        VALUES (${admin.name}, ${admin.email}, ${hash})
        ON CONFLICT (email) DO NOTHING`;

      // 3. Academic year (current)
      await tx`
        INSERT INTO academic_years
          (name, start_date, end_date, is_current, periods_per_day, period_minutes, school_days_per_week)
        VALUES
          (${academicYear.name}, ${academicYear.start_date}, ${academicYear.end_date}, TRUE,
           ${academicYear.periods_per_day}, ${academicYear.period_minutes}, ${academicYear.school_days_per_week})
        ON CONFLICT (name) DO NOTHING`;

      // 4. Classes + class groups
      await tx`
        INSERT INTO classes ${tx(classes, 'name', 'grade_level', 'track')}
        ON CONFLICT (name) DO NOTHING`;
      for (const g of groupNames) {
        await tx`
          INSERT INTO class_groups (class_id, academic_year_id, name, capacity)
          SELECT c.id, y.id, ${g}::text, 30
          FROM classes c, academic_years y
          WHERE y.name = ${academicYear.name}
          ON CONFLICT DO NOTHING`;
      }

      // 5. Subjects, teachers
      const subjectRows = subjects.map((s, i) => ({ ...s, sort_order: i + 1 }));
      await tx`
        INSERT INTO subjects ${tx(subjectRows, 'name', 'category', 'sort_order')}
        ON CONFLICT (name) DO NOTHING`;
      await tx`
        INSERT INTO teachers ${tx(teachers, 'full_name', 'email', 'phone', 'hire_date')}
        ON CONFLICT (email) DO NOTHING`;

      // 6. Curriculum: official plan (weekly periods per class and subject)
      const plan = classes.flatMap((c) =>
        subjects
          .filter((s) => s.periods[c.plan] > 0)
          .map((s) => ({ cls: c.name, subject: s.name, periods: s.periods[c.plan] })),
      );
      await tx`
        INSERT INTO curriculum (academic_year_id, class_id, subject_id, weekly_periods)
        SELECT y.id, c.id, s.id, r.periods
        FROM jsonb_to_recordset(${tx.json(plan)}::jsonb) AS r(cls text, subject text, periods int)
        JOIN classes c ON c.name = r.cls
        JOIN subjects s ON s.name = r.subject
        JOIN academic_years y ON y.name = ${academicYear.name}
        ON CONFLICT DO NOTHING`;

      // 7. Default grading schemes per class (Geography grade book as placeholder)
      await tx`
        INSERT INTO grading_schemes (class_id, subject_id, oral_max, homework_max, quiz_max, exam_max, total_max)
        SELECT c.id, NULL, r.oral, r.homework, r.quiz, r.exam, r.total
        FROM jsonb_to_recordset(${tx.json(gradingSchemes)}::jsonb)
          AS r(cls text, oral int, homework int, quiz int, exam int, total int)
        JOIN classes c ON c.name = r.cls
        ON CONFLICT DO NOTHING`;

      // 8. Students + enrollments (current year)
      await tx`
        INSERT INTO students ${tx(
          students, 'student_number', 'full_name', 'gender', 'date_of_birth', 'guardian_name', 'guardian_phone',
        )}
        ON CONFLICT (student_number) DO NOTHING`;
      await tx`
        INSERT INTO enrollments (student_id, class_group_id, academic_year_id, class_id)
        SELECT st.id, g.id, g.academic_year_id, g.class_id
        FROM jsonb_to_recordset(${tx.json(students)}::jsonb)
          AS r(student_number text, cls text, grp text)
        JOIN students st ON st.student_number = r.student_number
        JOIN classes c ON c.name = r.cls
        JOIN class_groups g ON g.class_id = c.id AND g.name = r.grp
        JOIN academic_years y ON y.id = g.academic_year_id AND y.is_current
        ON CONFLICT DO NOTHING`;

      // 9. Teaching assignments (must exist in the class plan, enforced by FK)
      for (const [subject, email, cls, grp] of teachingAssignments) {
        await tx`
          INSERT INTO teaching_assignments (teacher_id, class_group_id, academic_year_id, class_id, subject_id)
          SELECT t.id, g.id, g.academic_year_id, g.class_id, s.id
          FROM teachers t, subjects s, class_groups g
          JOIN classes c ON c.id = g.class_id
          JOIN academic_years y ON y.id = g.academic_year_id
          WHERE t.email = ${email} AND s.name = ${subject}
            AND c.name = ${cls} AND g.name = ${grp} AND y.is_current
          ON CONFLICT DO NOTHING`;
      }

      // 10. Attendance (deterministic pattern: mostly present)
      const pattern = ['present', 'present', 'absent', 'present', 'late', 'present', 'excused'];
      const attendance = students.flatMap((s, i) =>
        attendanceDates.map((d, k) => ({
          student_number: s.student_number, on_date: d, status: pattern[(i + k * 3) % pattern.length],
        })),
      );
      await tx`
        INSERT INTO attendance (enrollment_id, date, status)
        SELECT e.id, r.on_date::date, r.status
        FROM jsonb_to_recordset(${tx.json(attendance)}::jsonb)
          AS r(student_number text, on_date text, status text)
        JOIN students st ON st.student_number = r.student_number
        JOIN enrollments e ON e.student_id = st.id
        ON CONFLICT DO NOTHING`;

      // 11. Semester 1 grades, as % of the class's max marks; only for subjects in the class plan
      const pct = (i: number, k: number) => +(0.6 + (((i + 1) * 7 + k * 5) % 35) / 100).toFixed(2);
      const grades = students.flatMap((s, i) =>
        gradedSubjects.map((subject, j) => ({
          student_number: s.student_number, subject,
          p_oral: pct(i + j, 1), p_homework: pct(i + j, 2), p_quiz: pct(i + j, 3), p_exam: pct(i + j, 4),
        })),
      );
      await tx`
        INSERT INTO grades (enrollment_id, academic_year_id, class_id, subject_id, semester, oral, homework, quiz, exam)
        SELECT e.id, e.academic_year_id, e.class_id, s.id, 1,
          ROUND(gs.oral_max * r.p_oral, 2), ROUND(gs.homework_max * r.p_homework, 2),
          ROUND(gs.quiz_max * r.p_quiz, 2), ROUND(gs.exam_max * r.p_exam, 2)
        FROM jsonb_to_recordset(${tx.json(grades)}::jsonb)
          AS r(student_number text, subject text, p_oral numeric, p_homework numeric, p_quiz numeric, p_exam numeric)
        JOIN students st ON st.student_number = r.student_number
        JOIN enrollments e ON e.student_id = st.id
        JOIN subjects s ON s.name = r.subject
        JOIN curriculum cu ON cu.academic_year_id = e.academic_year_id
                          AND cu.class_id = e.class_id AND cu.subject_id = s.id
        JOIN grading_schemes gs ON gs.class_id = e.class_id AND gs.subject_id IS NULL
        ON CONFLICT DO NOTHING`;

      // 12. Self-check: every class must total periods_per_day x school_days_per_week (35)
      const bad = await tx`
        SELECT c.name, l.total_periods
        FROM class_weekly_load l
        JOIN classes c ON c.id = l.class_id
        JOIN academic_years y ON y.id = l.academic_year_id
        WHERE l.total_periods <> y.periods_per_day * y.school_days_per_week`;
      if (bad.length > 0) {
        throw new Error('Weekly periods do not add up: ' + JSON.stringify(bad));
      }
    });

    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error(error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
