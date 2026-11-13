import SideNav from '@/app/ui/sidenav';

export const dynamic = 'force-dynamic';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <SideNav />
      <main className="min-w-0 flex-1 p-4 md:overflow-y-auto md:p-8">{children}</main>
    </div>
  );
}
