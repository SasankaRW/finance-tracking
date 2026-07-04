"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? "/app" : "/login");
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-sm">
          <span className="text-lg font-bold">C</span>
        </div>
        <p className="text-sm text-muted-foreground">Opening Cashly...</p>
      </div>
    </div>
  );
}
