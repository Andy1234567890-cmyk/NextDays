// Logout (Client-Insel): ruft die Server Action logout() (löscht die Cookies)
// und leitet zur Anmeldung.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { logout } from "@/lib/auth";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await logout();
        router.push("/anmelden");
        router.refresh();
      }}
      className="rounded-full border border-border px-4 py-2 text-sm disabled:opacity-60"
    >
      {busy ? "…" : "Abmelden"}
    </button>
  );
}
