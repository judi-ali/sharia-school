'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { authenticate } from '@/app/lib/actions';
import { btnPrimary, fieldClass } from '@/app/ui/styles';

export default function LoginForm() {
  const callbackUrl = useSearchParams().get('callbackUrl') || '/dashboard';
  const [error, formAction, pending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">البريد الإلكتروني</label>
        <input id="email" name="email" type="email" required dir="ltr" className={`${fieldClass} text-end`} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">كلمة المرور</label>
        <input id="password" name="password" type="password" required minLength={6} dir="ltr" className={`${fieldClass} text-end`} />
      </div>
      <input type="hidden" name="redirectTo" value={callbackUrl} />
      <button className={`${btnPrimary} w-full`} aria-disabled={pending} disabled={pending}>
        {pending ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
      </button>
      <div aria-live="polite" className="min-h-6">
        {error && (
          <p className="flex items-center gap-1.5 text-sm text-red-700">
            <ExclamationCircleIcon className="h-5 w-5" /> {error}
          </p>
        )}
      </div>
    </form>
  );
}
