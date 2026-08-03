"use client";

// „Einschränkungen": auf welchen Kanälen wird diese Gebühr/Steuer erhoben?
//
// BEWUSST EIN EIGENER DIALOG, nicht ein Feld im Gebühren-/Steuer-Editor — genau
// so führt es der Branchenstandard (Zeilenmenü: Bearbeiten · Einschränkungen ·
// Entfernen, live abgelesen 03.08.2026). Der Grund ist fachlich: die
// Einschränkung beschreibt nicht den Posten, sondern seinen Vertriebsweg. Wer
// nur die Kanäle ändert, soll nicht den ganzen Posten neu speichern müssen.
import { useState } from "react";
import { useTranslations } from "next-intl";

import { EditorShell, Footer, useSaver } from "@/components/objekte/editor-primitives";
import { KanalEinschraenkung } from "@/components/objekte/pricing/kanal-einschraenkung";
import type { Pricing } from "@/lib/pricing-meta";

export function EinschraenkungenEditor({
  pr,
  propertyId,
  kind,
  id,
  onSave,
  onClose,
}: {
  pr: Pricing;
  propertyId: string;
  /** Gebühr oder Steuer — dieselbe Achse, zwei Listen. */
  kind: "fee" | "tax";
  id: string;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const posten =
    kind === "fee"
      ? pr.fees.find((x) => x.id === id)
      : pr.taxes.find((x) => x.id === id);
  const [scope, setScope] = useState<string[]>(posten?.portalScope ?? []);
  const { busy, error, run } = useSaver(onSave);

  function commit() {
    if (!posten) return;
    // Leere Auswahl heißt „keine Einschränkung" — dann das Feld ENTFERNEN, nicht
    // als leeres Array speichern: ein leeres Array liest sich sonst wie „an
    // keinen Kanal".
    const naechster = { ...posten, portalScope: scope.length > 0 ? scope : undefined };
    run(
      kind === "fee"
        ? { ...pr, fees: pr.fees.map((x) => (x.id === id ? { ...x, ...naechster } : x)) }
        : { ...pr, taxes: pr.taxes.map((x) => (x.id === id ? { ...x, ...naechster } : x)) },
    );
  }

  return (
    <EditorShell
      title={t("pricingForm.restrictionsTitle")}
      subtitle={t("pricingForm.restrictionsHint")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} />}
    >
      <KanalEinschraenkung
        propertyId={propertyId}
        selected={scope}
        onChange={setScope}
      />
    </EditorShell>
  );
}
