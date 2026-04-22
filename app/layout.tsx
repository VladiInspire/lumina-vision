import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "Lumina Vision",
  description: "Když chceš, aby vizuál nebyl jen hezký, ale i chytrý.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className={`${montserrat.variable} h-full`}>
      <body className="min-h-full flex flex-col font-montserrat">{children}</body>
    </html>
  );
}
