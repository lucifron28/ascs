import type { Metadata } from 'next';
import './globals.css';
import QueryProvider from '@/providers/query-provider';
import { cookies } from 'next/headers';

const DARK_THEME_ALIASES = new Set(['ascs-dark', 'dark', 'night']);

function normalizeTheme(theme: string | undefined) {
  return theme && DARK_THEME_ALIASES.has(theme) ? 'ascs-dark' : 'ascs-light';
}

export const metadata: Metadata = {
  title: 'ASCS — Automated Student Clearance System',
  description: 'Pambayang Kolehiyo ng Mauban',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = normalizeTheme(cookieStore.get('theme')?.value);

  return (
    <html
      lang="en"
      data-theme={theme}
      className="h-full antialiased font-sans"
    >
      <head>
        <title>ASCS — Automated Student Clearance System</title>
      </head>
      <body className="min-h-full flex flex-col bg-base-300 text-base-content font-sans transition-colors duration-200">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
