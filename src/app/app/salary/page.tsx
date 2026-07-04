import { redirect } from "next/navigation";

export default function SalaryPage() {
  redirect("/app/settings?tab=salary");
}
