"use client";

// Das Geschäftsprofil des KI-Assistenten (`site_ai_profile`, 0464) — die
// gemeinsame Grundlage JEDER Erzeugung: Tonfall, Zielgruppe, Alleinstellung,
// verbotene Wörter, eine freie Notiz. Jeder Prompt im Backend liest genau
// diese fünf Felder (`ki_texte._system_grundregeln`).
//
// „Ableiten statt abfragen" (Repo-Regel „Kontodaten automatisch, nicht per
// Knopf"): Duda lässt den Kunden all das eintippen. Wir schlagen es aus den
// erfassten Objekten VOR (`kiProfilVorschlag`) — der Kunde bearbeitet nur
// noch nach. Der Vorschlag füllt die Felder als ENTWURF, nicht gespeichert:
// „Speichern" bleibt der einzige Weg, ihn wirklich zu übernehmen (dieselbe
// Regel wie beim SEO-Vorschlag — kein stilles Durchwinken).
//
// Die manuellen Felder funktionieren AUCH ohne Vertex-Zugang — nur der
// „Vorschlag"-Knopf braucht ihn. `PUT /ki/profil` ist keine der
// KI-Erzeugungs-Routen und läuft nicht über `client.is_configured`.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Textarea } from "@nextdays/ui/textarea";
import {
  type KiProfil,
  kiProfilLesen,
  kiProfilSpeichern,
  kiProfilVorschlag,
} from "@/lib/site-ki";

import { BereichsKopf } from "../bereichs-kopf";
import { useKi } from "../ki/ki-context";

const LEER: KiProfil = {
  ton: null,
  zielgruppe: null,
  alleinstellung: null,
  verbotene_woerter: [],
  notiz: null,
};

export function KiProfilLeiste() {
  const t = useTranslations("website.ki");
  const { verfuegbar } = useKi();
  const [profil, setProfil] = useState<KiProfil | null>(null);
  const [woerterText, setWoerterText] = useState("");
  const [speichert, setSpeichert] = useState(false);
  const [holtVorschlag, setHoltVorschlag] = useState(false);
  const [vorschlagFehler, setVorschlagFehler] = useState<string | null>(null);

  useEffect(() => {
    void kiProfilLesen().then((res) => {
      const p = res.ok ? res.data : LEER;
      setProfil(p);
      setWoerterText(p.verbotene_woerter.join(", "));
    });
  }, []);

  async function vorschlagHolen() {
    setHoltVorschlag(true);
    setVorschlagFehler(null);
    const res = await kiProfilVorschlag();
    setHoltVorschlag(false);
    if (!res.ok) {
      setVorschlagFehler(res.error);
      return;
    }
    // Nur die drei abgeleiteten Felder füllen — verbotene Wörter und die
    // freie Notiz sind reine Kundenangaben, die kein Modell erfinden soll.
    setProfil((p) => ({
      ...(p ?? LEER),
      ton: res.data.ton ?? p?.ton ?? null,
      zielgruppe: res.data.zielgruppe ?? p?.zielgruppe ?? null,
      alleinstellung: res.data.alleinstellung ?? p?.alleinstellung ?? null,
    }));
    toast.success(t("profilVorschlagUebernommen"));
  }

  async function speichern() {
    if (!profil) return;
    setSpeichert(true);
    const woerter = woerterText
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);
    const res = await kiProfilSpeichern({ ...profil, verbotene_woerter: woerter });
    setSpeichert(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setProfil(res.data);
    toast.success(t("profilGespeichert"));
  }

  if (!profil) {
    return <p className="text-sm text-muted-foreground">{t("profilLaedt")}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <BereichsKopf
        titel={t("profilTitel")}
        beschreibung={t("profilHinweis")}
        aktion={
          verfuegbar ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={holtVorschlag}
              onClick={() => void vorschlagHolen()}
              className="gap-1.5"
            >
              <Icon
                icon={
                  holtVorschlag
                    ? "svg-spinners:180-ring"
                    : "solar:magic-stick-3-linear"
                }
                className="size-4"
              />
              {t("profilVorschlagKnopf")}
            </Button>
          ) : undefined
        }
      />

      {vorschlagFehler ? (
        <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {vorschlagFehler}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t("profilTon")}</span>
        <span className="text-xs text-muted-foreground">
          {t("profilTonHinweis")}
        </span>
        <Input
          value={profil.ton ?? ""}
          maxLength={200}
          onChange={(e) =>
            setProfil((p) => ({ ...(p ?? LEER), ton: e.target.value || null }))
          }
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t("profilZielgruppe")}</span>
        <span className="text-xs text-muted-foreground">
          {t("profilZielgruppeHinweis")}
        </span>
        <Input
          value={profil.zielgruppe ?? ""}
          maxLength={200}
          onChange={(e) =>
            setProfil((p) => ({
              ...(p ?? LEER),
              zielgruppe: e.target.value || null,
            }))
          }
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t("profilAlleinstellung")}</span>
        <span className="text-xs text-muted-foreground">
          {t("profilAlleinstellungHinweis")}
        </span>
        <Textarea
          rows={2}
          maxLength={400}
          value={profil.alleinstellung ?? ""}
          onChange={(e) =>
            setProfil((p) => ({
              ...(p ?? LEER),
              alleinstellung: e.target.value || null,
            }))
          }
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t("profilVerboteneWoerter")}</span>
        <span className="text-xs text-muted-foreground">
          {t("profilVerboteneWoerterHinweis")}
        </span>
        <Input
          value={woerterText}
          onChange={(e) => setWoerterText(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t("profilNotiz")}</span>
        <span className="text-xs text-muted-foreground">
          {t("profilNotizHinweis")}
        </span>
        <Textarea
          rows={3}
          maxLength={1000}
          value={profil.notiz ?? ""}
          onChange={(e) =>
            setProfil((p) => ({ ...(p ?? LEER), notiz: e.target.value || null }))
          }
        />
      </label>

      <Button
        type="button"
        disabled={speichert}
        onClick={() => void speichern()}
        className="self-start"
      >
        {speichert ? t("profilSpeichertGerade") : t("profilSpeichern")}
      </Button>
    </div>
  );
}
