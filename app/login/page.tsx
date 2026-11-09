import { Suspense } from 'react';
import type { Metadata } from 'next';
import LoginForm from '@/app/ui/login-form';
import Mark from '@/app/ui/mark';

export const metadata: Metadata = { title: 'تسجيل الدخول' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3 text-gold-300">
          <Mark className="h-12 w-12" />
          <div className="font-display leading-snug">
            <p className="text-sm text-ink-200">وزارة الأوقاف</p>
            <p className="text-xl font-bold text-white">إدارة الثانوية الشرعية</p>
          </div>
        </div>
        <div className="rounded-xl bg-white p-6">
          <h1 className="mb-5 font-display text-lg font-bold">تسجيل الدخول</h1>
          <Suspense><LoginForm /></Suspense>
        </div>
      </div>
    </main>
  );
}
