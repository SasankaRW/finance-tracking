import { redirect } from "next/navigation";
import { getServerSessionUid } from "@/lib/auth/server-session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const uid = await getServerSessionUid();
  redirect(uid ? "/app" : "/login");
}
