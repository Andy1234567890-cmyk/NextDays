import { RuleEditorPage } from "@/components/reservierungen/rule-editor-page";

// Planmäßige Aufgabe anlegen (eigene Seite, kein Modal).
export default function RegelNeuPage() {
  return <RuleEditorPage kind="auto" ruleId={null} />;
}
