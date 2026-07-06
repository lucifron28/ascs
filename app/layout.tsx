import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "@/providers/query-provider";

import { cookies } from 'next/headers';

// Static local fallback variables to allow building in offline sandbox environments
const geistSans = { variable: "font-sans" };
const geistMono = { variable: "font-mono" };

export const metadata: Metadata = {
  title: "Automated Student Clearance System",
  description: "Pambayang Kolehiyo ng Mauban",
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
      <body className="min-h-full flex flex-col bg-base-300 text-base-content transition-colors duration-200">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

