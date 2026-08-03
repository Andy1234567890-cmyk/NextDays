"use client";

// „Einschränkungen" einer Promotion: auf welchen Kanälen gilt sie?
//
// BEWUSST EIN EIGENER DIALOG, nicht ein Feld im Promotion-Editor — genau so führt
// es der Branchenstandard (Zeilenmenü: Bearbeiten · Einschränkungen · Entfernen,
// live abgelesen 03.08.2026). Der Grund ist fachlich derselbe wie bei Gebühren und
// Steuern (einschraenkungen-editor.tsx): die Einschränkung beschreibt nicht die
// Promotion, sondern ihren Vertriebsweg. Wer nur die Kanäle ändert, soll nicht die
// ganze Promotion neu speichern müssen.
import { useState } from "react";
import { useTranslations } from "next-intl";

import { EditorShell, Footer, useSaver } from "@/components/objekte/editor-primitives";
import { KanalEinschraenkung } from "@/components/objekte/pricing/kanal-einschraenkung";
import { updatePromotion, type Promotion } from "@/lib/promotions";

export function PromotionEinschraenkungen({
  propertyId,
  promotion,
  onSaved,
  onClose,
}: {
  propertyId: string;
  promotion: Promotion;
  onSaved: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [scope, setScope] = useState<string[]>(promotion.portal_scope ?? []);
  const { busy, error, run } = useSaver(speichern);

  async function speichern(): Promise<true | string> {
    // Leere Auswahl heißt „keine Einschränkung" — als leeres Array gespeichert,
    // weil die Spalte ein Array ist; der Server liest leer als „alle Kanäle"
    // (nicht als „an keinen Kanal").
    const res = await updatePromotion(propertyId, promotion.id, {
      portal_scope: scope,
    });
    if (!res.ok) return res.error;
    onSaved();
    return true;
  }

  return (
    <EditorShell
      title={t("pricingForm.restrictionsTitle")}
      subtitle={t("pricingForm.restrictionsHint")}
      onClose={onClose}
      footer={
        <Footer
          busy={busy}
          error={error}
          onCancel={onClose}
          onSave={() => void run()}
        />
      }
    >
      <KanalEinschraenkung
        propertyId={propertyId}
        selected={scope}
        onChange={setScope}
      />
    </EditorShell>
  );
}
