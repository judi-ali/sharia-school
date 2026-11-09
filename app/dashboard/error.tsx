'use client';

import { useEffect } from 'react';
import { btnPrimary } from '@/app/ui/styles';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <h2 className="font-display text-xl font-bold">حدث خطأ غير متوقّع</h2>
      <p className="text-sm text-ink-700">تعذّر تحميل الصفحة. جرّب مرة أخرى، وإن استمرت المشكلة تحقّق من اتصال قاعدة البيانات.</p>
      <button onClick={reset} className={btnPrimary}>إعادة المحاولة</button>
    </div>
  );
}
