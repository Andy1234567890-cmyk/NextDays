// Minimaler serverseitiger HTML-Sanitizer für TipTap-Inhalte (rich_text-Block).
// Ohne externe Dependency: entfernt script/style-Blöcke, alle on*-Event-Handler
// und javascript:-URLs. Das HTML kommt aus dem eingeloggten Agentur-Dashboard;
// dies ist die Defense-in-Depth gegen gespeichertes XSS im öffentlichen Renderer.
//
// Bewusst konservativ — lieber zu viel entfernen als Markup durchlassen, das ein
// fremder Tenant-Nutzer im Browser eines Gastes ausführen könnte.
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  let out = html;
  // <script>…</script> und <style>…</style> komplett entfernen.
  out = out.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  // Verwaiste öffnende/schließende script/style-Tags.
  out = out.replace(/<\/?(script|style)\b[^>]*>/gi, "");
  // on*-Event-Handler-Attribute (onclick=, onload=, …) entfernen.
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // javascript:- und data:-URLs in href/src neutralisieren.
  out = out.replace(
    /\s(href|src)\s*=\s*("|')\s*(javascript|data):[^"']*\2/gi,
    ' $1="#"',
  );
  return out;
}
