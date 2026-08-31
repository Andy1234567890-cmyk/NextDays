"use client";

// Zusatzleistungen/Upsells je Objekt verwalten (wie Hostaway/Guesty). Liste +
// Anlegen/Bearbeiten/Löschen mit mehrsprachigem Namen/Beschreibung (de/en),
// Medien-Upload, Preis + Abrechnungsbasis, optional/pflicht, „erscheint in",
// „wann anzeigen", aktiv, Reihenfolge. Echtes Realtime (Supabase WebSocket,
// kein Polling) auf property_addons.
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import { ZuAnderenObjekten } from "@/components/objekte/pricing/zu-anderen-objekten";
import {
  applyAddonToProperties,
  createAddon,
  deleteAddon,
  listAddonLibrary,
  listAddons,
  updateAddon,
  uebersetzeAddon,
  uploadAddonMedia,
  type Addon,
  type AddonInput,
  type AddonLibraryEntry,
  type AddonSurface,
} from "@/lib/addons";
import { type Locale, LOCALES, LOCALE_LABELS } from "@/i18n/locales";
import { formatCurrency } from "@/lib/currency";
import { useRealtime } from "@/lib/use-realtime";

type TFunc = ReturnType<typeof useTranslations>;

function getBasisOptions(t: TFunc): { value: Addon["basis"]; label: string }[] {
  return [
    { value: "per_stay", label: t("addonsManager.basisPerStay") },
    { value: "per_night", label: t("addonsManager.basisPerNight") },
    { value: "per_guest", label: t("addonsManager.basisPerGuest") },
    { value: "per_unit", label: t("addonsManager.basisPerUnit") },
  ];
}
function getSurfaces(t: TFunc): { value: AddonSurface; label: string }[] {
  return [
    { value: "booking_engine", label: t("addonsManager.surfaceBookingEngine") },
    { value: "guest_portal", label: t("addonsManager.surfaceGuestPortal") },
    { value: "checkin", label: t("addonsManager.surfaceCheckin") },
  ];
}
function getAvailability(
  t: TFunc,
): { value: Addon["available_until"]; label: string }[] {
  return [
    { value: "anytime", label: t("addonsManager.availabilityAnytime") },
    { value: "before_checkin", label: t("addonsManager.availabilityBeforeCheckin") },
  ];
}

function emptyDraft(sortOrder: number): AddonInput {
  return {
    // LEER statt `{ de: "", en: "" }`: die beiden leeren Schluessel waren die
    // Vorgabe aus der Zeit der zwei festen Felder und landeten so in der
    // Datenbank — live tragen drei von vier Zusatzleistungen ein leeres `en`,
    // das nie jemand gefuellt hat. Ein leerer Wert ist keine Uebersetzung; er
    // laesst die Zeile nur so aussehen, als waere sie gepflegt.
    name: {},
    description: {},
    media: [],
    price: 0,
    basis: "per_stay",
    mandatory: false,
    appears_in: ["booking_engine", "guest_portal"],
    available_until: "anytime",
    tax_rate: null,
    active: true,
    sort_order: sortOrder,
  };
}

export function AddonsManager({
  propertyId,
  initial,
  currency,
}: {
  propertyId: string;
  initial: Addon[];
  // Objekt-Währung (aus dem Rate-Plan); null = keine hinterlegt → kein €-Fallback.
  currency: string | null;
}) {
  const t = useTranslations("objects");
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState<Addon[]>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<AddonInput | null>(null);
  const [busy, setBusy] = useState(false);
  // Objekte, auf die dieselbe Zusatzleistung mitgeschrieben wird (Block „Zu
  // anderen Objekten hinzufügen" — wie im Gebühren-/Steuer-Editor).
  const [ziele, setZiele] = useState<string[]>([]);
  // Übernahme einer schon woanders angelegten Leistung. `null` = Auswahl zu,
  // sonst die geladene Bibliothek.
  const [uebernahme, setUebernahme] = useState<AddonLibraryEntry[] | null>(null);
  const [uebernahmeWaehrungFehlt, setUebernahmeWaehrungFehlt] = useState(false);
  const basisOptions = getBasisOptions(t);
  const surfaces = getSurfaces(t);

  // Betrag in Objekt-Währung; ohne hinterlegte Währung nur der nackte Wert
  // (nie € erfinden — Mehrwährung über 27 EU-Länder).
  const money = (v: number) =>
    currency ? formatCurrency(v, currency) : v.toLocaleString(locale);

  // Echtes Realtime (Supabase WebSocket): bei jeder Änderung an property_addons
  // die Liste direkt aus dem Backend neu in den State laden (kein Reload-Flackern).
  useRealtime({
    table: "property_addons",
    filter: `property_id=eq.${propertyId}`,
    onChange: () => {
      void listAddons(propertyId).then((res) => {
        if (res.ok) setItems(res.data.items);
      });
    },
  });

  function startCreate() {
    setEditing("new");
    setZiele([]);
    setDraft(emptyDraft(items.length));
  }

  /** „Bestehende Zusatzleistung übernehmen": Bibliothek laden und zeigen. */
  async function startPick() {
    const res = await listAddonLibrary(propertyId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setUebernahmeWaehrungFehlt(res.data.currency === null);
    setUebernahme(res.data.items);
  }

  /** Eine Leistung aus der Bibliothek als Entwurf übernehmen — der Betrieb
   *  sieht vor dem Speichern, was er kopiert, und kann sie noch anpassen. */
  function pick(entry: AddonLibraryEntry) {
    const a = entry.addon;
    setUebernahme(null);
    setEditing("new");
    setZiele([]);
    setDraft({
      name: { ...a.name },
      description: { ...a.description },
      media: [...a.media],
      price: a.price,
      basis: a.basis,
      mandatory: a.mandatory,
      appears_in: [...a.appears_in],
      available_until: a.available_until,
      tax_rate: a.tax_rate,
      active: a.active,
      sort_order: items.length,
    });
  }

  function startEdit(a: Addon) {
    setEditing(a.id);
    setZiele([]);
    setDraft({
      name: { ...a.name },
      description: { ...a.description },
      media: [...a.media],
      price: a.price,
      basis: a.basis,
      mandatory: a.mandatory,
      appears_in: [...a.appears_in],
      available_until: a.available_until,
      tax_rate: a.tax_rate,
      active: a.active,
      sort_order: a.sort_order,
    });
  }

  function cancel() {
    setEditing(null);
    setDraft(null);
    setZiele([]);
  }

  function patch<K extends keyof AddonInput>(key: K, value: AddonInput[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function toggleSurface(s: AddonSurface) {
    setDraft((d) => {
      if (!d) return d;
      const cur = d.appears_in ?? [];
      const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
      return { ...d, appears_in: next };
    });
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    const res =
      editing === "new"
        ? await createAddon(propertyId, draft)
        : await updateAddon(editing as string, draft);
    if (!res.ok) {
      setBusy(false);
      toast.error(res.error);
      return;
    }
    // Erst wenn diese Leistung steht, geht sie an die gewählten weiteren
    // Objekte. Schlägt die Verteilung fehl (z. B. anderes Objekt rechnet in
    // anderer Währung), bleibt die HIER gespeicherte Leistung gültig — der
    // Fehler wird benannt statt verschluckt, und der Editor bleibt offen, damit
    // die Auswahl nicht verloren ist.
    if (ziele.length > 0) {
      const verteilt = await applyAddonToProperties(res.data.id, ziele);
      setBusy(false);
      if (!verteilt.ok) {
        toast.error(verteilt.error);
        router.refresh();
        return;
      }
      toast.success(
        t("addonsManager.toastApplied", { count: verteilt.data.applied_to.length }),
      );
    } else {
      setBusy(false);
      toast.success(t("addonsManager.toastSaved"));
    }
    cancel();
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm(t("addonsManager.confirmDelete"))) return;
    const res = await deleteAddon(id);
    if (res.ok) {
      setItems((xs) => xs.filter((x) => x.id !== id));
      toast.success(t("addonsManager.toastDeleted"));
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function onMedia(addonId: string, file: File | undefined) {
    if (!file) return;
    const res = await uploadAddonMedia(addonId, file);
    if (res.ok) {
      patch("media", res.data.media);
      toast.success(t("addonsManager.toastMediaUploaded"));
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-extrabold">
            {t("addonsManager.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("addonsManager.subtitle")}
          </p>
        </div>
        {editing === null && uebernahme === null && (
          <div className="flex gap-2">
            {/* Der Zwischenschritt aus dem Gebühren-Editor: wer dieselbe
                Leistung auf vielen Objekten führt, tippt sie nicht erneut ab. */}
            <Button variant="outline" onClick={() => void startPick()}>
              <Icon icon="ph:copy" className="size-4" />
              {t("addonsManager.pickExisting")}
            </Button>
            <Button onClick={startCreate}>
              <Icon icon="ph:plus" className="size-4" />
              {t("addonsManager.new")}
            </Button>
          </div>
        )}
      </div>

      {uebernahme !== null && (
        <AddonUebernahme
          items={uebernahme}
          waehrungFehlt={uebernahmeWaehrungFehlt}
          money={money}
          basisLabel={(b) => basisOptions.find((x) => x.value === b)?.label ?? b}
          onPick={pick}
          onClose={() => setUebernahme(null)}
        />
      )}

      {editing !== null && draft && (
        <AddonForm
          /* Ohne `key` montiert React dieselbe Komponente wieder: der Wechsel
             von einer Zusatzleistung zur naechsten behielte die zuletzt
             bearbeitete Sprache, obwohl die neue Zeile ganz andere Sprachen
             gepflegt haben kann. Der Schluessel erzwingt einen frischen
             Startwert je Zeile. */
          key={editing}
          draft={draft}
          editingId={editing === "new" ? null : (editing as string)}
          busy={busy}
          currency={currency}
          propertyId={propertyId}
          ziele={ziele}
          onZieleChange={setZiele}
          onPatch={patch}
          onToggleSurface={toggleSurface}
          onMedia={onMedia}
          onSave={() => void save()}
          onCancel={cancel}
        />
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("addonsManager.emptyState")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((a) => (
            <Card
              key={a.id}
              className="flex flex-wrap items-center gap-4 p-4"
            >
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-(--radius) bg-secondary">
                {a.media[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.media[0]} alt="" className="size-full object-cover" />
                ) : (
                  <Icon icon="ph:plus-circle" className="size-5 text-muted-foreground" />
                )}
              </span>
              <div className="flex min-w-40 flex-1 flex-col">
                <span className="font-medium">
                  {a.name.de || a.name.en || t("addonsManager.unnamed")}
                  {a.mandatory && (
                    <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {t("addonsManager.mandatoryBadge")}
                    </span>
                  )}
                  {!a.active && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {t("addonsManager.inactiveBadge")}
                    </span>
                  )}
                </span>
                <span className="text-sm text-muted-foreground">
                  {money(a.price)}{" "}
                  {basisOptions.find((b) => b.value === a.basis)?.label}
                  {" · "}
                  {a.appears_in
                    .map((s) => surfaces.find((x) => x.value === s)?.label)
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => startEdit(a)}>
                  {t("addonsManager.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void remove(a.id)}
                  aria-label={t("addonsManager.delete")}
                >
                  <Icon icon="ph:trash" className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddonForm({
  draft,
  editingId,
  busy,
  currency,
  propertyId,
  ziele,
  onZieleChange,
  onPatch,
  onToggleSurface,
  onMedia,
  onSave,
  onCancel,
}: {
  draft: AddonInput;
  editingId: string | null;
  busy: boolean;
  currency: string | null;
  propertyId: string;
  /** Weitere Objekte, auf die dieselbe Leistung mitgeschrieben wird. */
  ziele: string[];
  onZieleChange: (next: string[]) => void;
  onPatch: <K extends keyof AddonInput>(key: K, value: AddonInput[K]) => void;
  onToggleSurface: (s: AddonSurface) => void;
  onMedia: (addonId: string, file: File | undefined) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("objects");
  const anzeigeSprache = useLocale();
  // Welche Sprache gerade BEARBEITET wird.
  //
  // NEUE Leistung: die Sprache der Oberflaeche — wer auf Daenisch arbeitet,
  // tippt zuerst Daenisch. (Vorher stand hier fest Deutsch, was fuer jeden
  // nicht-deutschen Betrieb der falsche Anfang war.)
  //
  // BESTEHENDE Leistung: die erste GEPFLEGTE Sprache, auch wenn die
  // Oberflaeche eine andere spricht. Live gesehen (31.08.2026): das Dashboard
  // stand auf Englisch, die Leistung trug ihren Text auf Deutsch — der
  // Bearbeiter sah ein leeres englisches Feld vor einer vollstaendig
  // gepflegten Zeile. Schlimmer als der leere Eindruck waere der naechste
  // Klick gewesen: „Alle Sprachen uebersetzen" nimmt die ANGEZEIGTE Sprache
  // als Quelle, haette hier also aus einem leeren Englisch uebersetzt statt
  // aus dem deutschen Original.
  const [sprache, setSprache] = useState<Locale>(() => {
    const bevorzugt = (LOCALES as readonly string[]).includes(anzeigeSprache)
      ? (anzeigeSprache as Locale)
      : "de";
    if ((draft.name?.[bevorzugt] ?? "").trim()) return bevorzugt;
    // Reihenfolge von LOCALES, nicht die der jsonb-Schluessel: die haengt
    // davon ab, in welcher Folge jemand die Felder gefuellt hat, und waere
    // damit von Zeile zu Zeile verschieden.
    return (
      LOCALES.find((l) => (draft.name?.[l] ?? "").trim()) ?? bevorzugt
    );
  });
  // Wie viele Sprachen einen NAMEN tragen. Die Beschreibung zaehlt bewusst
  // nicht mit: sie ist optional, ein Name ohne Beschreibung ist gepflegt, eine
  // Beschreibung ohne Namen dagegen unbrauchbar.
  const gepflegteSprachen = LOCALES.filter((l) =>
    (draft.name?.[l] ?? "").trim(),
  ).length;
  const [laeuft, setLaeuft] = useState(false);

  async function uebersetzen() {
    if (!editingId) return;
    setLaeuft(true);
    try {
      const res = await uebersetzeAddon(editingId, sprache);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Die Karten aus der ANTWORT uebernehmen, nicht lokal zusammenbauen:
      // der Server hat geschrieben, und nur er weiss, welche Sprachen wirklich
      // dazukamen (eine gefuellte wird nie ueberschrieben).
      onPatch("name", res.data.addon.name);
      onPatch("description", res.data.addon.description);

      const { uebersetzt: neu, fehlgeschlagen, zeilen } = res.data;
      // Fehler NICHT verschlucken (Wurzel 5): eine Sprache, die nicht
      // durchkam, muss sichtbar sein — sonst haelt der Bearbeiter sie fuer
      // uebersetzt und wundert sich Wochen spaeter.
      const gescheitert = Object.keys(fehlgeschlagen);
      if (gescheitert.length) {
        toast.warning(
          t("addonsManager.translatePartial", {
            count: neu.length,
            failed: gescheitert.length,
          }),
        );
      } else if (neu.length === 0) {
        toast.info(t("addonsManager.translateNothing"));
      } else {
        toast.success(
          // Die Zeilenzahl gehoert in die Meldung: derselbe Text steht auf n
          // Objekten, und der Bearbeiter soll wissen, dass er sie alle
          // getroffen hat, statt es fuer einen Fehler zu halten.
          t("addonsManager.translateDone", { count: neu.length, rows: zeilen }),
        );
      }
    } finally {
      setLaeuft(false);
    }
  }
  const basisOptions = getBasisOptions(t);
  const surfaces = getSurfaces(t);
  const availability = getAvailability(t);
  return (
    <Card className="flex flex-col gap-4 p-6">
      {/* ALLE 24 EU-Amtssprachen statt zwei festen Feldern.
          `property_addons.name/description` sind seit jeher `jsonb` und das
          Backend-Schema `dict[str, str]` ohne Einschraenkung — die Grenze stand
          allein hier im Formular. Ein daenischer Betrieb konnte seine
          Zusatzleistungen also nicht auf Daenisch benennen, obwohl Datenbank
          und API es koennen; live standen drei von vier Eintraegen mit leerem
          `en` da, weil das Feld erzwungen wirkte.

          Dropdown statt 24 Schaltflaechen und bewusst OHNE Flaggen: eine
          Flagge ist ein Land, keine Sprache. Deutsch wird in drei Laendern
          gesprochen, und Irisch und Englisch teilten sich dieselbe irische
          Flagge. Gleiche Form wie im Extra- und Steuer-Editor nebenan, damit
          nicht zwei Bauarten fuer dieselbe Frage existieren. */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-2">
              {LOCALE_LABELS[sprache]}
              <Icon
                icon="ph:caret-down"
                className="size-3.5 text-muted-foreground"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-80 overflow-y-auto"
          >
            {LOCALES.map((l) => (
              <DropdownMenuItem key={l} onClick={() => setSprache(l)}>
                {LOCALE_LABELS[l]}
                {/* Haekchen = in dieser Sprache gepflegt. Ohne das muesste man
                    24 Sprachen durchklicken, um zu sehen, was fehlt. */}
                {draft.name?.[l]?.trim() && (
                  <Icon
                    icon="ph:check"
                    className="ml-auto size-4 text-muted-foreground"
                  />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-xs text-muted-foreground">
          {t("addonsManager.languagesFilled", {
            count: gepflegteSprachen,
            total: LOCALES.length,
          })}
        </span>

        {/* Uebersetzen ist eine EIGENE Handlung, kein Nebeneffekt des
            Speicherns: der Lauf kostet je Sprache einen bezahlten Aufruf, und
            beim Tippen wird mehrfach gespeichert, bevor der Text steht.

            Nur bei einer GESPEICHERTEN Zeile: der Server uebersetzt, was in
            der Datenbank steht. Auf einem ungespeicherten Entwurf haette der
            Knopf den alten Text uebersetzt — sichtbar erst hinterher. */}
        {editingId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={busy || laeuft || !(draft.name?.[sprache] ?? "").trim()}
            onClick={() => void uebersetzen()}
          >
            <Icon
              icon={laeuft ? "ph:circle-notch" : "ph:translate"}
              className={`size-4 ${laeuft ? "animate-spin" : ""}`}
            />
            {t("addonsManager.translateAll")}
          </Button>
        )}
      </div>

      <Field label={t("addonsManager.nameLabel")}>
        <Input
          value={draft.name?.[sprache] ?? ""}
          onChange={(e) =>
            onPatch("name", { ...draft.name, [sprache]: e.target.value })
          }
        />
      </Field>

      <Field label={t("addonsManager.descriptionLabel")}>
        <Textarea
          value={draft.description?.[sprache] ?? ""}
          onChange={(e) =>
            onPatch("description", {
              ...draft.description,
              [sprache]: e.target.value,
            })
          }
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          label={
            currency
              ? t("addonsManager.priceWithCurrency", { currency })
              : t("addonsManager.price")
          }
        >
          <Input
            type="number"
            min={0}
            step={0.5}
            value={draft.price ?? 0}
            onChange={(e) => onPatch("price", Number(e.target.value))}
          />
        </Field>
        <Field label={t("addonsManager.basisLabel")}>
          <NativeSelect
            value={draft.basis}
            onChange={(e) => onPatch("basis", e.target.value as Addon["basis"])}
          >
            {basisOptions.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("addonsManager.taxRateLabel")}>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={draft.tax_rate ?? ""}
            onChange={(e) =>
              onPatch("tax_rate", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t("addonsManager.appearsIn")}
        </span>
        <div className="flex flex-wrap gap-4">
          {surfaces.map((s) => (
            <label key={s.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-accent)]"
                checked={(draft.appears_in ?? []).includes(s.value)}
                onChange={() => onToggleSurface(s.value)}
              />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t("addonsManager.availableUntilLabel")}>
          <NativeSelect
            value={draft.available_until}
            onChange={(e) =>
              onPatch("available_until", e.target.value as Addon["available_until"])
            }
          >
            {availability.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("addonsManager.sortOrderLabel")}>
          <Input
            type="number"
            min={0}
            value={draft.sort_order ?? 0}
            onChange={(e) => onPatch("sort_order", Number(e.target.value))}
          />
        </Field>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-accent)]"
              checked={draft.mandatory ?? false}
              onChange={(e) => onPatch("mandatory", e.target.checked)}
            />
            {t("addonsManager.mandatoryCheckbox")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-accent)]"
              checked={draft.active ?? true}
              onChange={(e) => onPatch("active", e.target.checked)}
            />
            {t("addonsManager.activeCheckbox")}
          </label>
        </div>
      </div>

      {/* Medien: Upload nur möglich, wenn das Add-on schon existiert (braucht ID). */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t("addonsManager.mediaCount", { count: (draft.media ?? []).length })}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {(draft.media ?? []).map((url) => (
            <span
              key={url}
              className="size-16 overflow-hidden rounded-(--radius) bg-secondary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="size-full object-cover" />
            </span>
          ))}
          {editingId ? (
            <label className="flex size-16 cursor-pointer items-center justify-center rounded-(--radius) border border-dashed text-muted-foreground hover:text-foreground">
              <Icon icon="ph:plus" className="size-5" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onMedia(editingId, e.target.files?.[0])}
              />
            </label>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t("addonsManager.mediaUploadHint")}
            </span>
          )}
        </div>
      </div>

      {/* Derselbe Block wie im Gebühren-/Steuer-Editor, dieselbe Komponente:
          dieselbe Zusatzleistung auf weitere Objekte übernehmen, statt sie
          dort erneut abzutippen. Steht wie dort am Ende des Editors. */}
      <ZuAnderenObjekten
        propertyId={propertyId}
        kind="addon"
        selected={ziele}
        onChange={onZieleChange}
      />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t("addonsManager.cancel")}
        </Button>
        <Button onClick={onSave} disabled={busy}>
          {busy ? t("addonsManager.saving") : t("addonsManager.save")}
        </Button>
      </div>
    </Card>
  );
}

/** „Bestehende Zusatzleistung übernehmen" — Gegenstück zu `GebuehrAuswahl`.
 *
 *  Zeigt, was der Betrieb auf ANDEREN Objekten schon angelegt hat; die Auswahl
 *  landet als Entwurf im Formular, damit vor dem Speichern sichtbar ist, was
 *  kopiert wird. Die Liste kommt tenant-gescopt vom Server, nicht im Browser
 *  zusammengesucht — dort wird auch die Währung geprüft (ein DKK-Betrag ist auf
 *  einem EUR-Objekt keine übernehmbare Zahl). */
function AddonUebernahme({
  items,
  waehrungFehlt,
  money,
  basisLabel,
  onPick,
  onClose,
}: {
  items: AddonLibraryEntry[];
  waehrungFehlt: boolean;
  money: (v: number) => string;
  basisLabel: (b: Addon["basis"]) => string;
  onPick: (entry: AddonLibraryEntry) => void;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [suche, setSuche] = useState("");
  const q = suche.trim().toLowerCase();
  const gefiltert = q
    ? items.filter((e) =>
        Object.values(e.addon.name).some((n) => n.toLowerCase().includes(q)),
      )
    : items;

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-extrabold">
            {t("addonsManager.pickExistingTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("addonsManager.pickExistingSubtitle")}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("addonsManager.cancel")}>
          <Icon icon="ph:x" className="size-4" />
        </Button>
      </div>

      {/* Suchfeld nur, wenn es etwas zu durchsuchen gibt — ein leeres Feld über
          einer leeren Liste ist eine Attrappe. */}
      {items.length > 0 && (
        <>
          <div className="relative">
            <Icon
              icon="ph:magnifying-glass"
              className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground"
            />
            <Input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder={t("addonsManager.pickExistingSearch")}
              className="pl-9"
            />
          </div>
          <div className="flex flex-col gap-2">
            {gefiltert.length === 0 ? (
              <p className="rounded-(--radius) border border-border p-4 text-sm text-muted-foreground">
                {t("addonsManager.pickExistingNoMatches")}
              </p>
            ) : (
              gefiltert.map((eintrag) => (
                <div
                  key={eintrag.addon.id}
                  className="flex items-start justify-between gap-3 rounded-(--radius) border border-border p-4"
                >
                  <div className="min-w-0 leading-tight">
                    <p className="truncate font-semibold">
                      {eintrag.addon.name.de ||
                        eintrag.addon.name.en ||
                        t("addonsManager.unnamed")}
                    </p>
                    <span className="mt-2 inline-flex w-fit items-center rounded-full bg-muted/60 px-3 py-1.5 text-sm">
                      {money(eintrag.addon.price)} · {basisLabel(eintrag.addon.basis)}
                    </span>
                    {/* Woher sie stammt: bei zwei „Reinigung" der einzige
                        Unterschied, den der Betrieb sieht. */}
                    {eintrag.property_title && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {t("addonsManager.pickExistingFrom", {
                          title: eintrag.property_title,
                        })}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => onPick(eintrag)}
                  >
                    {t("addonsManager.pickExistingAdd")}
                  </Button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Warum nichts zur Auswahl steht, wird GESAGT statt weggelassen: ohne
          Objektwährung ist kein Betrag übernehmbar, und „woanders noch nichts
          angelegt" ist eine andere Aussage. */}
      {items.length === 0 && (
        <p className="rounded-(--radius) border border-border p-4 text-sm text-muted-foreground">
          {waehrungFehlt
            ? t("addonsManager.pickExistingNoCurrency")
            : t("addonsManager.pickExistingEmpty")}
        </p>
      )}
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
