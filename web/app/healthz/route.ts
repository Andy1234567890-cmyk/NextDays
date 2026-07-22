// Liveness-/Readiness-Endpoint für Coolify/Traefik. Ohne Auth, ohne DB —
// signalisiert nur „Prozess läuft und nimmt HTTP an". Erst nach „healthy"
// schaltet Coolify den Traffic um → kein 502-Fenster beim Deploy.
export const dynamic = "force-dynamic";

export function GET(): Response {
  return new Response("ok", { status: 200 });
}
