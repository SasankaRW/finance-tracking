"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { signInWithEmail, signInWithGoogle } from "@/lib/auth/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export function LoginClient() {
  const router = useRouter();
  const search = useSearchParams();
  const nextPath = search?.get("next") ?? "/app";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await signInWithEmail(values.email, values.password);
      router.replace(nextPath);
    } catch (err) {
      toast.error("Login failed", {
        description:
          err instanceof Error ? err.message : "Please check your credentials.",
      });
    }
  });

  const [forgotPasswordOpen, setForgotPasswordOpen] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState("");
  const [resetLoading, setResetLoading] = React.useState(false);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    try {
      await import("@/lib/auth/auth-actions").then((mod) =>
        mod.resetPassword(resetEmail)
      );
      toast.success("Reset email sent", {
        description: "Check your email for a link to reset your password.",
      });
      setForgotPasswordOpen(false);
      setResetEmail("");
    } catch (err) {
      toast.error("Failed to send reset email", {
        description:
          err instanceof Error ? err.message : "Please check the email address.",
      });
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={form.formState.isSubmitting}
              onClick={async () => {
                try {
                  await signInWithGoogle();
                  router.replace(nextPath);
                } catch (err) {
                  console.error(err);
                  toast.error("Google sign-in failed", {
                    description:
                      err instanceof Error
                        ? err.message
                        : "Please try again.",
                  });
                }
              }}
            >
              Continue with Google
            </Button>

            <div className="my-4 text-center text-xs text-muted-foreground">
              or
            </div>

            <form className="grid gap-4" onSubmit={onSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...form.register("email")}
                />
                {form.formState.errors.email ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs text-muted-foreground"
                    onClick={() => {
                      // Carry over whatever was already typed on the login form.
                      setResetEmail((current) => current || form.getValues("email"));
                      setForgotPasswordOpen(true);
                    }}
                  >
                    Forgot password?
                  </Button>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...form.register("password")}
                />
                {form.formState.errors.password ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                ) : null}
              </div>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
              </Button>

              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link className="text-foreground underline" href="/signup">
                  Create one
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Forgot Password — the shared Dialog (bottom sheet on phones,
            Escape/tap-outside to close, focus trap), not a one-off overlay. */}
        <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reset password</DialogTitle>
              <DialogDescription>
                Enter your email and we&apos;ll send you a link to reset your password.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleResetPassword}>
              <DialogBody className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="h-11"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                />
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setForgotPasswordOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={resetLoading} className="min-w-32">
                  {resetLoading ? "Sending…" : "Send reset link"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


