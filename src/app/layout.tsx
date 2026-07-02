import "./globals.css";
import type { Metadata } from "next";
import React from "react";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "CalmingBeats Survey Site",
  description: "Survey workflows for Day 7/14/21 and intervention check-ins"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
