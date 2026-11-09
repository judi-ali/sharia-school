import type { Metadata } from 'next';
// import '@/app/ui/global.css';
// import { body, display } from '@/app/ui/fonts';

export const metadata: Metadata = {
  title: { template: '%s | إدارة الثانوية الشرعية', default: 'إدارة الثانوية الشرعية' },
  description: 'لوحة إدارة الطلاب والمعلمين والصفوف والعلامات والحضور.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
      {/* <body className={`${body.variable} ${display.variable} font-body`}>{children}</body> */}
    </html>
  );
}
