"use client";

// Publish-Aktion auf der Objekt-Detailseite. draft→active.
//
// Marktplatz-Regel: ohne freigeschaltetes Stripe-Konto geht KEIN Objekt auf
// myBestDays live. Das Backend erzwingt das (`_require_payments_ready`, 409) —
// hier wird es VORHER sichtbar: statt eines Knopfs, der immer scheitert, steht
// der Weg zur Einrichtung. Die Sperre bleibt serverseitig (Wurzel 3); die
// Oberfläche zeigt nur den Zustand. Objekte eines myNextDays-Betriebs folgen
// einem anderen Ablauf und tauchen in diesem Dashboard nicht auf.
//
// Fehlt sonst etwas (Preis, Foto, Adresse), kommt der sprechende 422-Text des
// Backends als Toast — kein stiller Fehlschlag (Wurzel 5).
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";

import { publishProperty } from "@/lib/properties-actions";

export function ObjektPublish({
  id,
  status,
  zahlungenBereit,
}: {
  id: string;
  status: string;
  /** Stripe charges_enabled des Betriebs — die Voraussetzung fürs Livegehen. */
  zahlungenBereit: boolean;
}) {
  const t = useTranslations("objektDetail");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (status === "active") {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800">
        {t("veroeffentlicht")}
      </span>
    );
  }

  if (!zahlungenBereit) {
    return (
      <Link
        href="/konto?bereich=zahlungen"
        title={t("zahlungenFehlenHinweis")}
        className="flex items-center gap-2 rounded-full bg-amber-100 px-6 py-3 text-sm font-semibold text-amber-900 shadow-lg transition-colors hover:bg-amber-200"
      >
        {t("zahlungenFehlen")}
      </Link>
    );
  }

  async function onPublish() {
    setPending(true);
    const res = await publishProperty(id);
    setPending(false);
    if (res.ok) {
      toast.success(t("veroeffentlicht"));
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Button onClick={onPublish} disabled={pending}>
      {pending ? t("veroeffentlichenLaeuft") : t("veroeffentlichen")}
    </Button>
  );
}
