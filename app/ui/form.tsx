'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { createContext, useActionState, useContext } from 'react';
import { useFormStatus } from 'react-dom';
import type { State } from '@/app/lib/types';
import { btnPrimary, btnSecondary, fieldClass } from '@/app/ui/styles';

const Ctx = createContext<State>({});
export const useFormState = () => useContext(Ctx);

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" aria-disabled={pending} disabled={pending} className={btnPrimary}>
      {pending ? 'جارٍ الحفظ…' : children}
    </button>
  );
}

// Form with inline validation errors. Submitted values are kept when validation fails.
export function FormShell({
  action, children, cancelHref, submitLabel = 'حفظ', className, bare,
}: {
  action: (state: State, fd: FormData) => Promise<State>;
  children: React.ReactNode;
  cancelHref?: string;
  submitLabel?: string;
  className?: string;
  bare?: boolean; // no grid, for table-like children
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={clsx('rounded-xl border border-ink-100 bg-white p-5', className)}>
      <Ctx.Provider value={state}>
        <div className={bare ? undefined : 'grid gap-4 md:grid-cols-2'}>{children}</div>
      </Ctx.Provider>
      <div className="mt-5 flex flex-wrap items-center gap-3" aria-live="polite">
        <SubmitButton>{submitLabel}</SubmitButton>
        {cancelHref && <Link href={cancelHref} className={btnSecondary}>إلغاء</Link>}
        {state.message && (
          <p className={clsx('text-sm', state.ok ? 'text-ink-700' : 'text-red-700')}>{state.message}</p>
        )}
      </div>
    </form>
  );
}

function Wrap({ name, label, children }: { name: string; label: string; children: React.ReactNode }) {
  const errors = useFormState().errors?.[name];
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {errors?.map((e) => <p key={e} className="mt-1 text-xs text-red-700">{e}</p>)}
    </div>
  );
}

type Opt = { value: string; label: string };

export function Input({
  name, label, defaultValue, type = 'text', ltr, ...rest
}: { name: string; label: string; defaultValue?: string | null; ltr?: boolean } &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'defaultValue'>) {
  const v = useFormState().values?.[name] ?? defaultValue ?? '';
  return (
    <Wrap name={name} label={label}>
      <input id={name} name={name} type={type} defaultValue={v} dir={ltr ? 'ltr' : undefined}
        className={clsx(fieldClass, ltr && 'text-end')} {...rest} />
    </Wrap>
  );
}

export function Select({
  name, label, options, defaultValue, empty, disabled,
}: { name: string; label: string; options: Opt[]; defaultValue?: string | null; empty?: string; disabled?: boolean }) {
  const v = useFormState().values?.[name] ?? defaultValue ?? '';
  return (
    <Wrap name={name} label={label}>
      <select id={name} name={name} defaultValue={v} disabled={disabled} className={fieldClass}>
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Wrap>
  );
}

// Delete with confirmation; `action` is a bound server action
export function DeleteButton({ action, confirm: msg, label = 'حذف' }: { action: () => Promise<void>; confirm: string; label?: string }) {
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(msg)) e.preventDefault(); }}>
      <button className="rounded-md px-2 py-1 text-sm text-red-700 hover:bg-red-50">{label}</button>
    </form>
  );
}
