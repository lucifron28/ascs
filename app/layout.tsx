import type { Metadata } from 'next';
import './globals.css';
import QueryProvider from '@/providers/query-provider';
import { cookies } from 'next/headers';

const geistSans = { variable: 'font-sans' };
const geistMono = { variable: 'font-mono' };

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
  const theme = cookieStore.get('theme')?.value || 'dark';

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <title>ASCS — Automated Student Clearance System</title>
      </head>
      <body className="min-h-full flex flex-col bg-base-300 text-base-content transition-colors duration-200">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
