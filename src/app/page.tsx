"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useAuth } from "@/lib/auth/auth-provider";
import { CashlyLogo } from "@/components/cashly-logo";
import { iosIn } from "@/lib/motion/variants";

// Background matches the native Android splash gradient exactly, so this
// screen reads as a continuation of the splash instead of a jarring flash to
// a plain page while auth state resolves and we redirect to /app or /login.
export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? "/app" : "/login");
    }
  }, [user, loading, router]);

  return (
    <div
      className="flex min-h-dvh items-center justify-center px-6"
      style={{ background: "linear-gradient(135deg, #163832 0%, #1f5c4a 50%, #2f8f6b 100%)" }}
    >
      <motion.div
        role="status"
        aria-label="Loading Cashly"
        className="flex flex-col items-center gap-5 text-center"
        variants={iosIn}
        initial="initial"
        animate="animate"
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="drop-shadow-[0_18px_36px_rgba(0,0,0,0.35)]"
        >
          <CashlyLogo className="h-20 w-20" />
        </motion.div>
        <div className="flex flex-col items-center gap-2">
          <p className="font-display text-2xl font-bold tracking-tight text-white">Cashly</p>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-white/70"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
