'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { ThemeProvider } from '@/lib/theme-context';

export function RootLayoutContent({
  children,
  fontFamily,
}: {
  children: React.ReactNode;
  fontFamily: { variable: string };
}) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/auth");

  return (
    <ThemeProvider>
      <body
        className={`${fontFamily.variable} antialiased`}
      >
        {isAuthPage ? (
          children
        ) : (
          <div className="flex">
            <Sidebar />
            <main className="flex-1">{children}</main>
          </div>
        )}
      </body>
    </ThemeProvider>
  );
} 