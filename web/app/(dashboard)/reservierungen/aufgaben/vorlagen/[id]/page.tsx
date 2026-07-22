import { TemplateEditorPage } from "@/components/reservierungen/template-editor-page";

// Aufgabenvorlage bearbeiten (eigene Seite).
export default async function VorlageBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TemplateEditorPage ruleId={id} />;
}
