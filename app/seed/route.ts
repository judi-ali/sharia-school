import bcrypt from 'bcrypt';
import { sql } from '../lib/db';
import { schema, dropAll, prepareLegacySchema, finalizeLegacySchema } from '../lib/schema';
import { academicYear, admin, classes, subjects, gradingSchemes, compositeSubjects } from '../lib/placeholder-data';
import {
  school, students, groups, attendance, transportRoutes, classRequests, inventory, textbooks,
  teachers, teachingAssignments, bellSchedule, timetable,
} from '../lib/school-data';

const GRADE = 'السابع'; // the only class opened so far

export async function GET(request: Request) {
  // Protect the route: /seed?secret=<SEED_SECRET>   (add &reset=1 to drop and rebuild all tables)
  const url = new URL(request.url);
  if (!process.env.SEED_SECRET || url.searchParams.get('secret') !== process.env.SEED_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const report = await sql.begin(async (tx) => {
      if (url.searchParams.get('reset') === '1') await tx.unsafe(dropAll);
      await tx.unsafe(prepareLegacySchema);
      await tx.unsafe(schema);
      await tx.unsafe(finalizeLegacySchema);

      // 1. Admin, academic year, school profile, bell schedule
      const hash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? admin.password, 10);
      await tx`INSERT INTO users (name, email, password) VALUES (${admin.name}, ${admin.email}, ${hash}) ON CONFLICT (email) DO NOTHING`;
      await tx`
        INSERT INTO academic_years (name, start_date, end_date, is_current, periods_per_day, period_minutes, school_days_per_week)
        VALUES (${academicYear.name}, ${academicYear.start_date}, ${academicYear.end_date}, TRUE,
                ${academicYear.periods_per_day}, ${academicYear.period_minutes}, ${academicYear.school_days_per_week})
        ON CONFLICT (name) DO NOTHING`;
      await tx`
        INSERT INTO school_profile (id, name, gender) VALUES (TRUE, ${school.name}, ${school.gender})
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, gender = EXCLUDED.gender`;
      await tx`
        INSERT INTO bell_schedule (academic_year_id, position, kind, period_no, label, starts_at, ends_at, note)
        SELECT y.id, r.position, r.kind, r.period_no, r.label, r.starts_at::time, r.ends_at::time, r.note
        FROM jsonb_to_recordset(${tx.json(bellSchedule)})
          AS r(position int, kind text, period_no int, label text, starts_at text, ends_at text, note text)
        JOIN academic_years y ON y.name = ${academicYear.name}
        ON CONFLICT DO NOTHING`;

      // 2. Classes (all levels of the plan) — class groups only where the school opened them
      await tx`INSERT INTO classes ${tx(classes, 'name', 'grade_level', 'track')} ON CONFLICT (name) DO NOTHING`;
      for (const g of groups) {
        await tx`
          INSERT INTO class_groups (class_id, academic_year_id, name)
          SELECT c.id, y.id, ${g}::text FROM classes c, academic_years y
          WHERE c.name = ${GRADE} AND y.name = ${academicYear.name}
          ON CONFLICT DO NOTHING`;
      }

      // 3. Subjects, curriculum (official plan, incl. computed Social Studies), grading schemes
      const subjectRows = subjects.map((s, i) => ({ ...s, sort_order: i + 1 }));
      await tx`INSERT INTO subjects ${tx(subjectRows, 'name', 'category', 'sort_order')} ON CONFLICT (name) DO NOTHING`;
      const plan = [
        ...classes.flatMap((c) =>
          subjects.filter((s) => s.periods[c.plan] > 0)
            .map((s) => ({ cls: c.name, subject: s.name, periods: s.periods[c.plan], part_of: null as string | null })),
        ),
        ...compositeSubjects.classes.flatMap((cls) =>
          compositeSubjects.parts.map((subject) => ({ cls, subject, periods: 0, part_of: compositeSubjects.parent as string | null })),
        ),
      ];
      await tx`
        INSERT INTO curriculum (academic_year_id, class_id, subject_id, weekly_periods, part_of_subject_id)
        SELECT y.id, c.id, s.id, r.periods, p.id
        FROM jsonb_to_recordset(${tx.json(plan)}) AS r(cls text, subject text, periods int, part_of text)
        JOIN classes c ON c.name = r.cls JOIN subjects s ON s.name = r.subject
        JOIN academic_years y ON y.name = ${academicYear.name}
        LEFT JOIN subjects p ON p.name = r.part_of
        ON CONFLICT DO NOTHING`;

      const schemeRows = gradingSchemes.map((g) => ({
        cls: g.cls, subject: g.subject, oral: g.oral, homework: g.homework, activity: g.activity, quiz: g.quiz,
        quiz2: g.quiz2, exam: g.exam, exam2: g.exam2, total: g.total, pass_mark: g.pass_mark, provisional: g.provisional, labels: g.labels,
      }));
      const [{ n }] = await tx`
        SELECT COUNT(*)::int AS n FROM jsonb_to_recordset(${tx.json(schemeRows)}) AS r(cls text, subject text)
        JOIN classes c ON c.name = r.cls JOIN subjects s ON s.name = r.subject`;
      if (n !== schemeRows.length) throw new Error('A grading scheme refers to an unknown class or subject.');
      await tx`
        INSERT INTO grading_schemes (class_id, subject_id, oral_max, homework_max, activity_max, quiz_max, quiz2_max,
                                     exam_max, exam2_max, total_max, pass_mark, is_provisional, labels)
        SELECT c.id, s.id, r.oral, r.homework, r.activity, r.quiz, r.quiz2, r.exam, r.exam2, r.total, r.pass_mark, r.provisional, r.labels
        FROM jsonb_to_recordset(${tx.json(schemeRows)})
          AS r(cls text, subject text, oral int, homework int, activity int, quiz int, quiz2 int, exam int, exam2 int,
               total int, pass_mark int, provisional boolean, labels jsonb)
        JOIN classes c ON c.name = r.cls JOIN subjects s ON s.name = r.subject
        ON CONFLICT DO NOTHING`;

      await tx`
        INSERT INTO grading_schemes (class_id, subject_id, oral_max, homework_max, activity_max, quiz_max, quiz2_max,
                                   exam_max, exam2_max, total_max, pass_mark, is_provisional, labels)
        SELECT cu.class_id, cu.subject_id, d.oral_max, d.homework_max, d.activity_max, d.quiz_max, d.quiz2_max,
             d.exam_max, d.exam2_max, d.total_max, d.pass_mark, d.is_provisional, d.labels
        FROM curriculum cu
        JOIN grading_schemes d ON d.class_id = cu.class_id AND d.subject_id IS NULL
        WHERE NOT EXISTS (
        SELECT 1 FROM curriculum p
        WHERE p.academic_year_id = cu.academic_year_id AND p.class_id = cu.class_id
          AND p.part_of_subject_id = cu.subject_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM grading_schemes s
          WHERE s.class_id = cu.class_id AND s.subject_id = cu.subject_id
        )
        ON CONFLICT DO NOTHING`;

      // 4. Teachers, buses, students (+ enrollment, bus), teaching assignments
      await tx`
        INSERT INTO teachers (full_name)
        SELECT r.full_name FROM jsonb_array_elements_text(${tx.json(teachers)}) AS r(full_name)
        WHERE NOT EXISTS (SELECT 1 FROM teachers t WHERE t.full_name = r.full_name)`;
      await tx`
        INSERT INTO transport_routes (name, driver_name, driver_phone)
        SELECT r.name, r.driver_name, r.driver_phone
        FROM jsonb_to_recordset(${tx.json(transportRoutes)}) AS r(name text, driver_name text, driver_phone text)
        WHERE NOT EXISTS (SELECT 1 FROM transport_routes t WHERE t.name = r.name)`;

      const studentRows = students.map((s) => ({ ...s, route_name: s.route === null ? null : transportRoutes[s.route].name }));
      await tx`
        INSERT INTO students (full_name, status, registration_status, missing_documents, address,
                              guardian_phone, guardian_phone2, transport_route_id)
        SELECT r.full_name, r.status, r.registration_status, r.missing_documents, r.address,
               r.guardian_phone, r.guardian_phone2, tr.id
        FROM jsonb_to_recordset(${tx.json(studentRows)})
          AS r(full_name text, status text, registration_status text, missing_documents text, address text,
               guardian_phone text, guardian_phone2 text, route_name text)
        LEFT JOIN transport_routes tr ON tr.name = r.route_name
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.full_name = r.full_name)`;
      await tx`
        INSERT INTO enrollments (student_id, class_group_id, academic_year_id, class_id)
        SELECT st.id, g.id, g.academic_year_id, g.class_id
        FROM jsonb_to_recordset(${tx.json(studentRows)}) AS r(full_name text, grp text)
        JOIN students st ON st.full_name = r.full_name
        JOIN classes c ON c.name = ${GRADE}
        JOIN class_groups g ON g.class_id = c.id AND g.name = r.grp
        JOIN academic_years y ON y.id = g.academic_year_id AND y.is_current
        ON CONFLICT DO NOTHING`;
      await tx`
        INSERT INTO teaching_assignments (teacher_id, class_group_id, academic_year_id, class_id, subject_id)
        SELECT t.id, g.id, g.academic_year_id, g.class_id, s.id
        FROM jsonb_to_recordset(${tx.json(teachingAssignments)}) AS r(subject text, teacher text)
        JOIN teachers t ON t.full_name = r.teacher
        JOIN subjects s ON s.name = r.subject
        JOIN classes c ON c.name = ${GRADE}
        JOIN class_groups g ON g.class_id = c.id
        JOIN academic_years y ON y.id = g.academic_year_id AND y.is_current
        ON CONFLICT DO NOTHING`;

      // 5. Weekly timetable (each slot needs an assignment: composite FK)
      await tx`
        INSERT INTO timetable_entries (class_group_id, academic_year_id, day_of_week, period_no, subject_id, teacher_id)
        SELECT g.id, g.academic_year_id, r.day, r.period, s.id, ta.teacher_id
        FROM jsonb_to_recordset(${tx.json(timetable)}) AS r(grp text, day int, period int, subject text)
        JOIN classes c ON c.name = ${GRADE}
        JOIN class_groups g ON g.class_id = c.id AND g.name = r.grp
        JOIN subjects s ON s.name = r.subject
        JOIN teaching_assignments ta ON ta.class_group_id = g.id AND ta.subject_id = s.id
        ON CONFLICT DO NOTHING`;

      // 6. Attendance from the school's sheets (م present, غ absent, خ excused)
      await tx`
        INSERT INTO attendance (enrollment_id, date, status)
        SELECT e.id, r.on_date::date, r.status
        FROM jsonb_to_recordset(${tx.json(attendance)}) AS r(student text, on_date text, status text)
        JOIN students st ON st.full_name = r.student
        JOIN enrollments e ON e.student_id = st.id
        ON CONFLICT DO NOTHING`;

      // 7. Textbooks, class-opening requests, inventory
      await tx`
        INSERT INTO textbooks (class_id, subject_id, title)
        SELECT c.id, s.id, r.title
        FROM jsonb_to_recordset(${tx.json(textbooks)}) AS r(title text, subject text)
        JOIN classes c ON c.name = ${GRADE}
        LEFT JOIN subjects s ON s.name = r.subject
        ON CONFLICT DO NOTHING`;
      await tx`
        INSERT INTO class_requests (class_id, full_name, phone, status)
        SELECT c.id, r.full_name, r.phone, r.status
        FROM jsonb_to_recordset(${tx.json(classRequests)}) AS r(cls text, full_name text, phone text, status text)
        JOIN classes c ON c.name = r.cls
        WHERE NOT EXISTS (SELECT 1 FROM class_requests q WHERE q.class_id = c.id AND q.full_name = r.full_name)`;
      await tx`
        INSERT INTO inventory_items (name, unit, quantity, condition)
        SELECT r.name, r.unit, r.quantity, r.condition
        FROM jsonb_to_recordset(${tx.json(inventory)}) AS r(name text, unit text, quantity int, condition text)
        WHERE NOT EXISTS (SELECT 1 FROM inventory_items i WHERE i.name = r.name AND i.unit IS NOT DISTINCT FROM r.unit)`;

      // 8. Self-checks
      const bad = await tx`
        SELECT c.name, l.total_periods FROM class_weekly_load l
        JOIN classes c ON c.id = l.class_id JOIN academic_years y ON y.id = l.academic_year_id
        WHERE l.total_periods <> y.periods_per_day * y.school_days_per_week`;
      if (bad.length > 0) throw new Error('Weekly periods do not add up: ' + JSON.stringify(bad));
      const gaps = await tx`
        SELECT g.name AS grp, s.name AS subject, l.planned, l.scheduled
        FROM timetable_load l JOIN class_groups g ON g.id = l.class_group_id JOIN subjects s ON s.id = l.subject_id
        WHERE l.scheduled <> l.planned`;
      if (gaps.length > 0) throw new Error('Timetable differs from the plan: ' + JSON.stringify(gaps));

      const noScheme = await tx`
        SELECT c.name AS cls, s.name AS subject FROM curriculum_without_scheme m
        JOIN classes c ON c.id = m.class_id JOIN subjects s ON s.id = m.subject_id`;
      const [{ provisional }] = await tx`SELECT COUNT(*)::int AS provisional FROM grading_schemes WHERE is_provisional`;
      const [counts] = await tx`
        SELECT (SELECT COUNT(*) FROM students)::int AS students, (SELECT COUNT(*) FROM attendance)::int AS attendance,
               (SELECT COUNT(*) FROM timetable_entries)::int AS timetable_slots`;
      return { ...counts, provisional_schemes: provisional, subjects_without_scheme: noScheme.length };
    });

    return Response.json({ message: 'Database seeded successfully', ...report });
  } catch (error) {
    console.error(error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
