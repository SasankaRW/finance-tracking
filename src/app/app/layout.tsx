import type { Metadata } from "next";
import { AppLayoutClient } from "@/app/app/layout-client";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayoutClient>{children}</AppLayoutClient>;
}


