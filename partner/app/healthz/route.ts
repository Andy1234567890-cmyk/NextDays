// Healthcheck für Coolify/Traefik — ohne Cookie erreichbar (middleware: FREI).
export function GET(): Response {
  return Response.json({ status: "ok", app: "partner" });
}
