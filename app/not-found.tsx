import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="font-display text-2xl font-bold">الصفحة غير موجودة</h1>
      <p className="text-ink-700">قد يكون السجل محذوفاً أو الرابط غير صحيح.</p>
      <Link href="/dashboard" className="rounded-lg bg-ink-800 px-4 py-2 text-sm text-white hover:bg-ink-700">
        العودة إلى الرئيسية
      </Link>
    </main>
  );
}
