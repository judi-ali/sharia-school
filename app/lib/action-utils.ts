// Helpers shared by the server action files (not itself a 'use server' module).
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { sql } from './db';
import type { State } from './types';

export const values = (fd: FormData) => {
  const o: Record<string, string> = {};
  fd.forEach((v, k) => { if (typeof v === 'string') o[k] = v; });
  return o;
};
export const fail = (e: z.ZodError, fd: FormData): State => ({
  errors: e.flatten().fieldErrors as Record<string, string[]>,
  message: 'تعذّر الحفظ، يرجى مراجعة الحقول.',
  values: values(fd),
});
export const dbMessage = (e: unknown, fallback: string, fk?: string) => {
  if (e instanceof Error && e.message === 'GROUP_FULL') return 'الشعبة ممتلئة أو غير متاحة.';
  const code = (e as { code?: string })?.code;
  if (code === '23505') return 'هذه القيمة مسجّلة مسبقاً.';
  if (code === '23503') return fk ?? 'لا يمكن إتمام العملية بسبب بيانات مرتبطة بهذا السجل.';
  if (code === '23514') return 'القيم المدخلة غير صالحة.';
  return fallback;
};
export const back = (path: string, error?: string): never =>
  redirect(error ? `${path}?error=${encodeURIComponent(error)}` : path);

export const text = (msg: string) => z.string({ required_error: msg }).trim().min(1, msg);
export const optText = z.string().trim().optional().transform((v) => v || null);
export const optInt = z.string().trim().optional().transform((v) => (v ? Number(v) : null));

/* ───────── before/after snapshots for the operations history ───────── */
export type Change = { field: string; from: string; to: string };
export type SnapTable = 'students' | 'teachers' | 'class_groups' | 'transport_routes' | 'class_requests' | 'inventory_items';

// Row as JSON (dates come out as 'YYYY-MM-DD'); only rows of the given school
export async function snapshot(table: SnapTable, id: string, schoolId: string): Promise<Record<string, unknown> | null> {
  const [r] = await sql<{ j: Record<string, unknown> }[]>`
    SELECT to_jsonb(t) AS j FROM ${sql(table)} t WHERE t.id = ${id} AND t.school_id = ${schoolId}`;
  return r?.j ?? null;
}

const valueLabels: Record<string, string> = {
  male: 'ذكر', female: 'أنثى', active: 'نشط', inactive: 'غير نشط', graduated: 'متخرّج', transferred: 'منقول',
  complete: 'مكتمل', pending: 'قيد الانتظار', enrolled: 'سُجّل', dropped: 'منقطع', new: 'جديد', old: 'قديم',
};
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : valueLabels[String(v)] ?? String(v));
const norm = (v: unknown) => (v === null || v === undefined ? '' : String(v));

// Changed fields only, with Arabic names; `labels` maps column -> Arabic name
export function diffFields(before: Record<string, unknown> | null, after: Record<string, unknown>, labels: Record<string, string>): Change[] {
  const out: Change[] = [];
  for (const [k, label] of Object.entries(labels)) {
    if (!(k in after)) continue;
    if (norm(before?.[k]) !== norm(after[k])) out.push({ field: label, from: show(before?.[k]), to: show(after[k]) });
  }
  return out;
}
