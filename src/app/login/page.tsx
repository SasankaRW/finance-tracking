import { Suspense } from "react";
import { LoginClient } from "@/app/login/login-client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}


