import type { Metadata } from "next";
import type { ReactNode } from "react";
import ApplicationShell from "@/app/_components/ApplicationShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "TalentMatch AI | Candidate intelligence",
  description: "A technical showcase for evidence-grounded candidate intelligence.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><ApplicationShell>{children}</ApplicationShell></body>
    </html>
  );
}
