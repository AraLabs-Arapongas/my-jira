import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/header";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "my-jira",
  description: "Personal Kanban board",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className="min-h-screen bg-[#F4F5F7] font-sans antialiased"
        suppressHydrationWarning
      >
        <Header />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
