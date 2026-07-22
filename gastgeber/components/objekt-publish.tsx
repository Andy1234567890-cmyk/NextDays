"use client";

// Publish-Aktion auf der Objekt-Detailseite. draft→active. Das Backend verlangt
// einen hinterlegten Preis — fehlt er, kommt ein sprechender Fehler (Toast),
// kein stiller Fehlschlag (Wurzel 5).
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";

import { publishProperty } from "@/lib/properties-actions";

export function ObjektPublish({ id, status }: { id: string; status: string }) {
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
