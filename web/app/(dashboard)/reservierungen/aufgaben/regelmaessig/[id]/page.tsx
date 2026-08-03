import { RuleEditorPage } from "@/components/reservierungen/rule-editor-page";

// Regelmäßige Aufgabe bearbeiten (eigene Seite, kein Modal).
export default async function RegelBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RuleEditorPage kind="recurring" ruleId={id} />;
}
