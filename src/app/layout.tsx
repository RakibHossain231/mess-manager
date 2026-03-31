import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mess Manager",
  description: "Smart mess meal and expense manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}