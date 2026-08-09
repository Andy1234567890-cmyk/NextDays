"use client";

// Zuordnungsmaske: wem gehört eine Gebühr, und ist sie provisionspflichtig?
//
// ZWEI UNABHÄNGIGE ACHSEN (Branchenstand OwnerRez/Guesty). Dass beide nötig
// sind, zeigen die realen Fälle:
//   Miete       → Eigentümer + provisionspflichtig
//   Nebenkosten → Eigentümer + provisionsFREI
//   Reinigung   → Betrieb    (der Betrieb erbringt die Leistung)
// Mit nur einer Achse ließen sich Nebenkosten und Reinigung nicht trennen:
// beide sind provisionsfrei, aber das Geld geht an zwei verschiedene Parteien.
//
// VORSCHLÄGE JA, GERATENE DATEN NEIN (Wurzel 4):
// Die Maske darf einen Vorschlag ANZEIGEN — die Reinigungsgebühr steht
// branchenüblich beim Betrieb. Gespeichert wird er aber erst, wenn die Agentur
// ihn bestätigt. In der DB steht deshalb nichts, was niemand entschieden hat;
// eine unzugeordnete Art bleibt sichtbar offen, statt still als „gehört dem
// Eigentümer, provisionspflichtig" durchzulaufen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  getFeeClassification,
  setFeeClassification,
  type FeeClassificationInput,
  type FeeTypeZuordnung,
  type GehoertZu,
} from "@/lib/owner-billing";

/**
 * Vorschlagswert je Gebührenart — NUR für die Vorauswahl in der Maske.
 *
 * Steht bewusst hier im Frontend und nicht in der Migration: ein per INSERT
 * gesetzter Wert wäre in der Maske nicht mehr als Vorschlag erkennbar, er sähe
 * aus wie eine Entscheidung der Agentur. Hier ist er sichtbar unbestätigt, und
 * erst „Speichern" macht ihn zur Vereinbarung.
 *
 * Arten ohne Eintrag bekommen KEINE Vorauswahl — die Agentur muss aktiv
 * wählen, statt einen voreingestellten Wert durchzuwinken.
 */
const VORSCHLAG: Record<string, { gehoert_zu: GehoertZu; pflichtig: boolean }> = {
  // Der Betrieb reinigt, also behält er die Reinigungsgebühr.
  cleaning_fee: { gehoert_zu: "betrieb", pflichtig: false },
  short_term_cleaning: { gehoert_zu: "betrieb", pflichtig: false },
  cleaning: { gehoert_zu: "betrieb", pflichtig: false },
  // Gehört Dritten und ist weder Ertrag des Betriebs noch des Eigentümers.
  security_deposit: { gehoert_zu: "durchlauf", pflichtig: false },
  damage_protection_insurance: { gehoert_zu: "durchlauf", pflichtig: false },
};

/** Eine Zeile im Formular; `gehoert_zu === ""` heißt „noch nicht gewählt". */
type Zeile = {
  fee_type: string;
  gehoert_zu: GehoertZu | "";
  provisionspflichtig: boolean;
};

export function GebuehrenZuordnung() {
  const t = useTranslations("ownerBilling");
  const [items, setItems] = useState<FeeTypeZuordnung[]>([]);
  const [zeilen, setZeilen] = useState<Record<string, Zeile>>({});
  const [offen, setOffen] = useState(0);
  const [laedt, setLaedt] = useState(true);
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const uebernehmen = useCallback((liste: FeeTypeZuordnung[]) => {
    const naechste: Record<string, Zeile> = {};
    for (const item of liste) {
      const gespeichert = item.klassifikation;
      if (gespeichert) {
        naechste[item.fee_type] = {
          fee_type: item.fee_type,
          gehoert_zu: gespeichert.gehoert_zu,
          provisionspflichtig: gespeichert.provisionspflichtig,
        };
        continue;
      }
      // Unzugeordnet: Vorschlag anbieten, falls es einen gibt — sonst leer
      // lassen, damit die Agentur aktiv wählen muss.
      const vorschlag = VORSCHLAG[item.fee_type];
      naechste[item.fee_type] = {
        fee_type: item.fee_type,
        gehoert_zu: vorschlag?.gehoert_zu ?? "",
        provisionspflichtig: vorschlag?.pflichtig ?? false,
      };
    }
    setZeilen(naechste);
  }, []);

  const laden = useCallback(async () => {
    setLaedt(true);
    const res = await getFeeClassification();
    setLaedt(false);
    if (!res.ok) {
      // Kein `?? []`: „konnte nicht geladen werden" ist etwas anderes als
      // „dieser Betrieb hat keine Gebühren".
      setLadefehler(res.error);
      return;
    }
    setLadefehler(null);
    setItems(res.data.items);
    setOffen(res.data.offen);
    uebernehmen(res.data.items);
  }, [uebernehmen]);

  useEffect(() => {
    void laden();
  }, [laden]);

  function setZeile(feeType: string, patch: Partial<Zeile>) {
    setZeilen((z) => ({ ...z, [feeType]: { ...z[feeType], ...patch } }));
  }

  async function speichern() {
    const eingaben: FeeClassificationInput[] = [];
    for (const item of items) {
      const zeile = zeilen[item.fee_type];
      // Nicht gewählt = nicht gespeichert. Eine unvollständige Zeile wird
      // übersprungen, nicht mit einem Standardwert aufgefüllt (Wurzel 4).
      if (!zeile || !zeile.gehoert_zu) continue;
      eingaben.push({
        fee_type: item.fee_type,
        gehoert_zu: zeile.gehoert_zu,
        provisionspflichtig: zeile.provisionspflichtig,
      });
    }
    if (eingaben.length === 0) {
      setFehler(t("classifyNothingChosen"));
      return;
    }
    setBusy(true);
    setFehler(null);
    const res = await setFeeClassification(eingaben);
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    toast.success(t("saved"));
    setItems(res.data.items);
    setOffen(res.data.offen);
    uebernehmen(res.data.items);
  }

  if (laedt) {
    return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  }
  if (ladefehler) {
    return <p className="text-sm text-destructive">{ladefehler}</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("classifyEmpty")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("classifyHint")}</p>

      {offen > 0 && (
        <div className="flex items-start gap-2 rounded-(--radius) border border-border bg-secondary/40 p-3">
          <Icon
            icon="ph:warning-circle"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <p className="text-sm text-muted-foreground">
            {t("classifyOpen", { count: offen })}
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const zeile = zeilen[item.fee_type];
          const zugeordnet = item.klassifikation !== null;
          return (
            <li
              key={item.fee_type}
              className="flex flex-col gap-3 rounded-(--radius) border border-border p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{item.label}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {t("feeCount", { count: item.anzahl })}
                </span>
                {!zugeordnet && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    {t("unassigned")}
                  </span>
                )}
                {item.beispiel_namen.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {item.beispiel_namen.join(" · ")}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("belongsTo")}
                  </span>
                  <NativeSelect
                    value={zeile?.gehoert_zu ?? ""}
                    onChange={(e) =>
                      setZeile(item.fee_type, {
                        gehoert_zu: e.target.value as GehoertZu | "",
                      })
                    }
                  >
                    <option value="">{t("pleaseChoose")}</option>
                    <option value="betrieb">{t("belongs.betrieb")}</option>
                    <option value="eigentuemer">
                      {t("belongs.eigentuemer")}
                    </option>
                    <option value="durchlauf">{t("belongs.durchlauf")}</option>
                  </NativeSelect>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("commissionable")}
                  </span>
                  <NativeSelect
                    value={zeile?.provisionspflichtig ? "ja" : "nein"}
                    onChange={(e) =>
                      setZeile(item.fee_type, {
                        provisionspflichtig: e.target.value === "ja",
                      })
                    }
                  >
                    <option value="ja">{t("commissionableYes")}</option>
                    <option value="nein">{t("commissionableNo")}</option>
                  </NativeSelect>
                </label>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        {fehler && (
          <span className="mr-auto text-sm text-destructive">{fehler}</span>
        )}
        <Button
          className={fehler ? "" : "ml-auto"}
          disabled={busy}
          onClick={() => void speichern()}
        >
          {busy ? (
            <Icon icon="ph:spinner" className="size-4 animate-spin" />
          ) : (
            <Icon icon="ph:check" className="size-4" />
          )}
          {t("confirmAssignment")}
        </Button>
      </div>
    </div>
  );
}
