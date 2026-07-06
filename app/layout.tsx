import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "@/providers/query-provider";

// Static local fallback variables to allow building in offline sandbox environments
const geistSans = { variable: "font-sans" };
const geistMono = { variable: "font-mono" };

export const metadata: Metadata = {
  title: "Automated Student Clearance System",
  description: "Pambayang Kolehiyo ng Mauban",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

