"use client";

// Objekte-Übersicht des Gastgebers im Airbnb-„Your listings"-Tabellen-Look:
// Kopf mit Titel + Raster-/Hinzufügen-Buttons, darunter eine Tabelle
// (Objekt · Typ · Ort · Status). Status als farbiger Punkt — aktiv = grün,
// sonst „Aktion nötig" in unserem Akzent (nicht Airbnb-Rot). Farben aus den
// myNextDays-Tokens. Realtime auf properties (kein Polling).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { Property, PropertyStatus } from "@/lib/properties";
import { useRealtime } from "@/lib/use-realtime";

const TYP_LABEL: Record<string, string> = {
  ferienhaus: "Ferienhaus",
  appartement: "Appartement",
  glamping: "Glamping",
  tiny_house: "Tiny House",
  hausboot: "Hausboot",
  einzelzimmer: "Einzelzimmer",
  doppelzimmer: "Doppelzimmer",
  suite: "Suite",
};

export function ObjekteListe({ items }: { items: Property[] }) {
  const t = useTranslations("objekte");
  const router = useRouter();

  useRealtime({ table: "properties", onChange: () => router.refresh() });

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-20 text-center">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
          <Icon icon="solar:home-angle-2-bold-duotone" className="size-7 text-muted-foreground" />
        </span>
        <p className="text-lg font-semibold">{t("leer")}</p>
        <Link
          href="/objekt-einstellen"
          className="mt-5 inline-flex rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          {t("neu")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Kopf: Titel + Aktionen */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-sans text-[2rem] font-bold tracking-tight text-foreground">
          {t("titel")}
        </h1>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
          >
            <Icon icon="ph:squares-four" className="size-5" />
          </span>
          <Link
            href="/objekt-einstellen"
            aria-label={t("ansichtNeu")}
            className="flex size-11 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/70"
          >
            <Icon icon="ph:plus" className="size-5" />
          </Link>
        </div>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border text-start">
              <Th className="w-[45%]">{t("spalteObjekt")}</Th>
              <Th>{t("spalteTyp")}</Th>
              <Th>{t("spalteOrt")}</Th>
              <Th>{t("spalteStatus")}</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr
                key={p.id}
                className="group cursor-pointer border-b border-border transition-colors hover:bg-muted/40"
                onClick={() => router.push(`/objekte/${p.id}`)}
              >
                <td className="py-4 pe-4">
                  <Link
                    href={`/objekte/${p.id}`}
                    className="flex items-center gap-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {p.photos[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photos[0]}
                          alt={p.title}
                          className="size-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center text-muted-foreground">
                          <Icon icon="solar:gallery-bold-duotone" className="size-6" />
                        </span>
                      )}
                    </span>
                    <span className="truncate font-medium text-foreground group-hover:underline">
                      {p.title}
                    </span>
                  </Link>
                </td>
                <td className="py-4 pe-4 text-[0.9375rem] text-muted-foreground">
                  {TYP_LABEL[p.property_type] ?? p.property_type}
                </td>
                <td className="py-4 pe-4 text-[0.9375rem] text-muted-foreground">
                  {[p.city, p.country].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="py-4">
                  <StatusZelle status={p.status} label={statusLabel(p.status, t)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`pb-3 text-sm font-semibold text-foreground ${className}`}
    >
      {children}
    </th>
  );
}

// Status-Punkt: aktiv = grün, sonst „Aktion nötig" im Akzent (myNextDays-Rot).
function StatusZelle({ status, label }: { status: PropertyStatus; label: string }) {
  const farbe = status === "active" ? "bg-emerald-500" : "bg-accent";
  return (
    <span className="flex items-center gap-2 text-[0.9375rem] text-foreground">
      <span className={`size-2 rounded-full ${farbe}`} />
      {label}
    </span>
  );
}

function statusLabel(
  status: PropertyStatus,
  t: ReturnType<typeof useTranslations>,
): string {
  // „Aktion nötig" für alles, was noch nicht aktiv ist (Airbnb-Sprache).
  return status === "active" ? t("status.active") : t("statusAktionNoetig");
}
