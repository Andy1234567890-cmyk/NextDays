import { RuleList } from "@/components/reservierungen/rule-list";

// Regelmäßige Aufgaben: zeitplan-getriggerte Regeln (Häufigkeit/Intervall/Muster).
export default function RegelmaessigPage() {
  return <RuleList kind="recurring" />;
}
