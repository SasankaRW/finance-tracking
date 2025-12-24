import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthedUid } from "@/lib/auth/server-session";
import { AppShell } from "@/app/app/shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const uid = await requireAuthedUid();
  if (!uid) redirect("/login");

  return <AppShell>{children}</AppShell>;
}


