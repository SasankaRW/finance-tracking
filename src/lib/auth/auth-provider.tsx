"use client";

import * as React from "react";
import type { User } from "firebase/auth";
import { onIdTokenChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

type AuthState = {
  user: User | null;
  loading: boolean;
};

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    user: null,
    loading: true,
  });

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onIdTokenChanged(auth, (user) => {
      setState({ user, loading: false });
    });
    return () => unsub();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}













