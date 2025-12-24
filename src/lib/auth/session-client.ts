export async function createSession(idToken: string) {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    throw new Error("Failed to create session");
  }
}

export async function clearSession() {
  const res = await fetch("/api/session", { method: "DELETE" });
  if (!res.ok) {
    throw new Error("Failed to clear session");
  }
}


