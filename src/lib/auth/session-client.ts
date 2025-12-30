// For Capacitor/Static export, we rely on Firebase JS SDK persistence.
// We do not need to hit an API route to set an HttpOnly cookie.

export async function createSession(idToken: string) {
  // no-op: Firebase Auth handles persistence on the client
  console.log("Session created (client-side only)");
}

export async function clearSession() {
  // no-op: Firebase Auth signOut handles clearing tokens
  console.log("Session cleared (client-side only)");
}




