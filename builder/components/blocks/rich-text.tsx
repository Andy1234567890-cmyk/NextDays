// Rich-Text-Block: rendert das im Editor (TipTap) erzeugte HTML der aktiven
// Sprache. Das HTML stammt aus dem eingeloggten Agentur-Dashboard, wird hier
// aber defensiv gegen <script>/Event-Handler bereinigt (XSS-Schutz).
import { pickText } from "@/lib/i18n";
import { sanitizeHtml } from "@/lib/sanitize";

export function RichTextBlock({
  content,
}: {
  content: Record<string, unknown>;
}) {
  const html = sanitizeHtml(pickText(content.html));
  if (!html) return null;
  return (
    <div
      className="prose mx-auto max-w-3xl px-6 py-8"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
