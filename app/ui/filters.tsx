'use client';

import { fieldClass } from '@/app/ui/styles';

export function AutoSelect({
  name, label, options, defaultValue, empty,
}: { name: string; label: string; options: { value: string; label: string }[]; defaultValue?: string; empty?: string }) {
  return (
    <div className="min-w-48">
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">{label}</label>
      <select id={name} name={name} defaultValue={defaultValue ?? ''} className={fieldClass}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function AutoDate({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">{label}</label>
      <input id={name} name={name} type="date" defaultValue={defaultValue} className={fieldClass}
        onChange={(e) => e.currentTarget.value && e.currentTarget.form?.requestSubmit()} />
    </div>
  );
}
