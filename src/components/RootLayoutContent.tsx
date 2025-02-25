'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

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
  );
} 