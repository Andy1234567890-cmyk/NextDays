import { RuleList } from "@/components/reservierungen/rule-list";

// Planmäßige Aufgaben: buchungs-getriggerte Auto-Regeln (relativ zu Check-in/out).
export default function PlanmaessigPage() {
  return <RuleList kind="auto" />;
}
