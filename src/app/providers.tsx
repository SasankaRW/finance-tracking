"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { ThemeColorProvider } from "@/lib/theme/theme-color-provider";
import { ConfirmDialogProvider } from "@/components/confirm-dialog";
import { LenisProvider } from "@/lib/motion/lenis-provider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <MotionConfig reducedMotion="user">
        <ThemeColorProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ConfirmDialogProvider>
                <LenisProvider>{children}</LenisProvider>
                <Toaster richColors closeButton />
              </ConfirmDialogProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeColorProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}














