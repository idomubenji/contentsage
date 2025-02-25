import type { Metadata } from "next";
import { Scope_One } from "next/font/google";
import "./globals.css";
import { RootLayoutContent } from "@/components/RootLayoutContent";
import { AuthProvider } from "@/lib/auth-context";

const scopeOne = Scope_One({
  weight: ['400'],
  subsets: ["latin"],
  variable: "--font-scope-one",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "ContentSage",
  description: "Content management application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <AuthProvider>
        <RootLayoutContent fontFamily={scopeOne}>
          {children}
        </RootLayoutContent>
      </AuthProvider>
    </html>
  );
}
