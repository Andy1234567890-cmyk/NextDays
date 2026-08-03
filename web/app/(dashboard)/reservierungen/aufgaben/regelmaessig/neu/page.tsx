import { RuleEditorPage } from "@/components/reservierungen/rule-editor-page";

// Regelmäßige Aufgabe anlegen (eigene Seite, kein Modal).
export default function RegelNeuPage() {
  return <RuleEditorPage kind="recurring" ruleId={null} />;
}
