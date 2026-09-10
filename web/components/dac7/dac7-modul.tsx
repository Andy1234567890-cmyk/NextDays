"use client";

// Der Rahmen des DAC7-Moduls: Kopf, Bereitschaft, dann die Meldung selbst.
//
// WARUM DIE BEREITSCHAFT VORNE STEHT: Die Meldung bricht ab, wenn Steuer-
// angaben oder Objektdaten fehlen — fail-closed, damit keine falsche Datei
// zur Behoerde geht. Ohne diesen Block sieht der Gastgeber nur „geht nicht"
// und weiss nicht, woran es liegt. Hier steht es, BEVOR er auf „Berechnen"
// drueckt.
import { Icon } from "@iconify/react";
import Link from "next/link";

import type { Meldelauf } from "@/lib/dac7";
import {
  angabeErledigt,
  type ObjektAngabeStatus,
  type TaxpayerOverview,
} from "@/lib/dac7-steuerangaben";

import { Dac7Meldung } from "./dac7-meldung";

/** Eine Voraussetzung der Meldung samt Weg, sie zu erfuellen. */
interface Voraussetzung {
  erfuellt: boolean;
  titel: string;
  erlaeuterung: string;
  /** Weg, die Angabe zu erfassen. Fehlt er, steht nur der Mangel da —
   *  besser als ein Link auf eine Seite, die es nicht gibt (404). */
  pfad?: string;
  pfadText?: string;
}

function VoraussetzungZeile({ punkt }: { punkt: Voraussetzung }) {
  return (
    <li className="flex items-start gap-3">
      <Icon
        icon={
          punkt.erfuellt
            ? "solar:check-circle-bold"
            : "solar:danger-triangle-bold"
        }
        className={`mt-0.5 size-5 shrink-0 ${
          punkt.erfuellt ? "text-green-600" : "text-amber-600"
        }`}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium">{punkt.titel}</p>
        <p className="text-sm text-muted-foreground">
          {punkt.erlaeuterung}
          {!punkt.erfuellt && punkt.pfad && (
            <>
              {" "}
              <Link
                href={punkt.pfad}
                className="font-medium underline underline-offset-4"
              >
                {punkt.pfadText ?? "Jetzt erfassen"}
              </Link>
            </>
          )}
        </p>
      </div>
    </li>
  );
}

/** Was vorliegen muss, bevor eine Meldung entstehen kann. */
function Bereitschaft({
  steuern,
  objektangaben,
}: {
  steuern: TaxpayerOverview | null;
  objektangaben: ObjektAngabeStatus[] | null;
}) {
  const eintraege = steuern?.eintraege ?? [];
  // Maßgeblich ist, ob eine Objektkennung VORLIEGT — nicht, ob jemand ein
  // Bestätigungsdatum gesetzt hat. In Dänemark ist das die BFE-Nummer aus
  // der Objektkartei; `confirmed_at` allein zu prüfen erklärte 18 gepflegte
  // Objekte für unvollständig.
  const offeneObjekte = (objektangaben ?? []).filter(
    (o) => !angabeErledigt(o),
  ).length;

  const punkte: Voraussetzung[] = [
    {
      erfuellt: eintraege.length > 0,
      titel: "Steuerangaben des Betriebs",
      erlaeuterung:
        eintraege.length > 0
          ? `${eintraege.length} ${eintraege.length === 1 ? "Land" : "Länder"} erfasst.`
          : "Ohne Land und Steuernummer kann keine Meldung erzeugt werden. Die Angaben werden derzeit über den Support erfasst.",
    },
    {
      erfuellt: (objektangaben?.length ?? 0) > 0 && offeneObjekte === 0,
      titel: "Angaben je Objekt",
      erlaeuterung:
        objektangaben === null
          ? "Der Stand konnte nicht geladen werden."
          : offeneObjekte === 0 && objektangaben.length > 0
            ? `Alle ${objektangaben.length} Objekte sind erfasst.`
            : `${offeneObjekte} von ${objektangaben.length} Objekten ohne Objektkennung (BFE- oder Matrikelnummer).`,
      pfad: "/objekte",
      pfadText: "Zu den Objekten",
    },
  ];

  const alleErfuellt = punkte.every((p) => p.erfuellt);
  if (alleErfuellt) return null;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950">
      <h2 className="font-medium">Bevor die Meldung erzeugt werden kann</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Die Meldung entsteht nur, wenn alle Pflichtangaben vorliegen. Eine
        Datei mit geratenen Werten wäre gegenüber der Steuerbehörde schlimmer
        als gar keine.
      </p>
      <ul className="mt-4 space-y-3">
        {punkte.map((punkt) => (
          <VoraussetzungZeile key={punkt.titel} punkt={punkt} />
        ))}
      </ul>
    </section>
  );
}

/** Was DAC7 ist — einmal erklärt, damit niemand danach suchen muss. */
function Einleitung() {
  return (
    <section className="rounded-xl border border-border p-5">
      <div className="flex items-start gap-3">
        <Icon
          icon="solar:document-add-line-duotone"
          className="mt-0.5 size-5 shrink-0 text-muted-foreground"
        />
        <div className="min-w-0 text-sm">
          <p>
            DAC7 ist die EU-weite Meldepflicht für Plattformen: Einmal im Jahr
            werden die Vermietungsumsätze je Verkäufer und Objekt an die
            Steuerbehörde übermittelt. In Dänemark läuft das über eine
            CSV-Datei bei TastSelv Erhverv.
          </p>
          <p className="mt-2 text-muted-foreground">
            Die Meldung enthält <strong>eine Zeile je Objekt</strong> — mit
            Anschrift, BFE-Nummer, vermieteten Tagen und den Beträgen je
            Quartal. Vor der Abgabe sehen Sie jede Zeile im Klartext.
          </p>
        </div>
      </div>
    </section>
  );
}

export function Dac7Modul({
  laeufe,
  steuern,
  objektangaben,
}: {
  laeufe: Meldelauf[] | null;
  steuern: TaxpayerOverview | null;
  objektangaben: ObjektAngabeStatus[] | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold">DAC7-Meldung</h1>
        <p className="mt-1 text-muted-foreground">
          Die jährliche Meldung Ihrer Vermietungsumsätze an die
          Steuerbehörde.
        </p>
      </header>

      <Einleitung />

      <Bereitschaft steuern={steuern} objektangaben={objektangaben} />

      <Dac7Meldung laeufe={laeufe} />
    </div>
  );
}
