// Rollen-/Capability-Gating (Mobile) — spiegelt die Logik aus
// apps/web/components/app-sidebar.tsx: admin darf alles; sonst muss die
// Capability/Permission im Grant-Set (capabilities ∪ permissions) liegen. Wird
// aus dem Server-`/auth/me` gespeist, nie clientseitig „aufgemacht" (CLAUDE.md
// Mobile: Gating aus GET /auth/me).
import type { Me } from "@/contexts/AuthContext";

/** Darf `me` die genannte Capability/Permission nutzen? */
export function can(me: Me | null, capability: string): boolean {
  if (!me) return false;
  if (me.role === "admin") return true;
  const grantSet = new Set([...me.capabilities, ...me.permissions]);
  return grantSet.has(capability);
}
