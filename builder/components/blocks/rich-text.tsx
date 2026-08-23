// Rich-Text-Block: rendert das im Editor erzeugte HTML der aktiven Sprache mit
// großzügiger Lesetypografie (Maßstab, Zeilenhöhe, max-width). Das HTML stammt
// aus dem eingeloggten Agentur-Dashboard und wird hier defensiv gegen
// <script>/Event-Handler bereinigt (XSS-Schutz).
import { fontStack } from "@/lib/fonts-catalog";
import { type EditierModus, NICHT_EDITIERBAR } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { sanitizeHtml } from "@/lib/sanitize";

export function RichTextBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  // Formatierter Text wird NICHT in der Vorschau bearbeitet: contentEditable
  // würde das gespeicherte HTML zerstören (Listen, Überschriften, Links). Dafür
  // gibt es den Editor im Formular links. Der Modus liefert hier nur die Sprache.
  modus?: EditierModus;
}) {
  const html = sanitizeHtml(pickText(content.html, modus.locale));
  if (!html) return null;
  const centered = content.align === "center";
  const stack = fontStack(
    typeof content.font_family === "string" ? content.font_family : null,
  );
  return (
    <div
      className={
        "mx-auto max-w-3xl px-6 py-14 text-lg leading-relaxed text-foreground/90 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-2xl [&_h3]:font-semibold [&_p]:mt-4 " +
        (centered ? "text-center" : "")
      }
      style={stack ? { fontFamily: stack } : undefined}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
