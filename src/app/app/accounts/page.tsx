"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export default function AccountsRedirectPage() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace("/app/settings?tab=accounts");
  }, [router]);

  return null;
}
