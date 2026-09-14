import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApplicationOps — Candidate Demonstrator",
  description: "Independent synthetic candidate demonstrator for application support workflows.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
