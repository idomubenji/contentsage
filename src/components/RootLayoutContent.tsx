'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { ThemeProvider } from '@/lib/theme-context';
import dynamic from 'next/dynamic';

// Dynamically import the CookieConsent component with no SSR
// This prevents hydration errors since cookie consent relies on localStorage
const CookieConsent = dynamic(
  () => import('@/components/privacy/CookieConsent'),
  { ssr: false }
);

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
            <main className="flex-1 ml-64">{children}</main>
          </div>
        )}
        
        {/* Show cookie consent for all pages */}
        <CookieConsent />
      </body>
    </ThemeProvider>
  );
} 