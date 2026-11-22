import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { sql } from './db';
import { isUuid } from './utils';

// education_director: global (no school) · school_director / school_admin: belong to exactly one school
export type Role = 'education_director' | 'school_director' | 'school_admin';
export type Scope = {
  userId: string; name: string; email: string; role: Role;
  schoolId: string | null; schoolName: string | null;
};
export type SchoolScope = Scope & { schoolId: string; schoolName: string };

// The database is the source of truth (role, school and active flags are re-read on every request),
// the session cookie only carries the user id.
export const getScope = cache(async (): Promise<Scope | null> => {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id || !isUuid(id)) return null;
  const [u] = await sql<
    { id: string; name: string; email: string; role: Role; school_id: string | null; school_name: string | null }[]
  >`SELECT u.id, u.name, u.email, u.role, u.school_id, s.name AS school_name
    FROM users u LEFT JOIN schools s ON s.id = u.school_id
    WHERE u.id = ${id} AND u.is_active AND (u.school_id IS NULL OR s.is_active)`;
  return u ? { userId: u.id, name: u.name, email: u.email, role: u.role, schoolId: u.school_id, schoolName: u.school_name } : null;
});

// A session whose user was deactivated is ended (a route handler can clear the cookie)
export async function requireScope(): Promise<Scope> {
  const s = await getScope();
  if (!s) redirect('/api/session-ended');
  return s;
}

export async function requireRole(...roles: Role[]): Promise<Scope> {
  const s = await requireScope();
  if (!roles.includes(s.role)) redirect('/dashboard');
  return s;
}

// School-level pages and actions: school director or school admin of a school
export async function requireSchool(): Promise<SchoolScope> {
  const s = await requireScope();
  if (!s.schoolId) redirect('/dashboard/schools');
  return s as SchoolScope;
}
