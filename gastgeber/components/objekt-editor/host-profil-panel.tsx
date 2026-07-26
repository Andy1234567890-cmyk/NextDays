"use client";

// „Über den Gastgeber" (Airbnb „About the host"). Host-Profil des eingeloggten
// Nutzers, im Objekt-Editor eingebettet (Daten sind user-, nicht objektgebunden).
// Links die Profil-Vorschau (Avatar, Name, Intro, Feld-Liste, Reisestempel-
// Toggle, Interessen-Chips); Klick auf ein Feld öffnet rechts die passende
// Inline-Detail-Sidebar (dasselbe 32rem-Muster wie Preise/Lage/Verfügbarkeit —
// kein Airbnb-Modal, konsistent mit den übrigen Tabs).
//
// An die ECHTE Datenwahrheit angeschlossen (Wurzel 4): host_profiles-Spalten via
// onPatch (PATCH /host-profile). full_name + „Hosting begann {Jahr}" sind
// abgeleitet (aus users) und read-only. Nichts erfunden.
import { Icon } from "@iconify/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  formatHostingSince,
  uploadAvatar,
  type HostProfile,
} from "@/lib/host-profil";
import type { HostProfilePatch } from "@/lib/host-profil-actions";

import { AdressSuche, type PlacesAddress } from "./adress-suche";
import { INTERESSEN, INTERESSEN_TOP, SPRACHEN } from "./host-profil-katalog";

// Freitext-Felder (einzeiliges/mehrzeiliges Textfeld in der Sidebar).
type TextKey =
  | "intro"
  | "work"
  | "dream_destination"
  | "spend_time_on"
  | "pets"
  | "school"
  | "useless_skill"
  | "favorite_song"
  | "fun_fact"
  | "obsessed_with"
  | "bio_title"
  | "lives_in";

// Der offene Detail-Abschnitt.
type Detail = TextKey | "decade" | "languages" | "interests";

export function HostProfilPanel({
  profile,
  onPatch,
  onProfil,
  onDetailOffen,
}: {
  profile: HostProfile;
  // host_profiles-Feld(er) patchen. true bei Erfolg.
  onPatch: (patch: HostProfilePatch) => Promise<boolean>;
  // Ein vom Server zurückgegebenes Profil übernehmen (Avatar-Upload liefert das
  // vollständige Profil zurück — kein zweiter Roundtrip nötig).
  onProfil: (p: HostProfile) => void;
  // Meldet dem Editor, ob eine Detail-Sidebar offen ist (linke Liste ausblenden).
  onDetailOffen?: (offen: boolean) => void;
}) {
  const t = useTranslations("objektEditor");
  const reduziert = useReducedMotion();
  const [detail, setDetailState] = useState<Detail | null>(null);
  // Avatar-Upload-Zustand (kein Draft: das Foto ist sofort gespeichert).
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const dateiFeld = useRef<HTMLInputElement>(null);
  function setDetail(d: Detail | null) {
    setDetailState(d);
    onDetailOffen?.(d != null);
  }

  // Datei gewählt → hochladen; der Server speichert avatar_url und gibt das
  // aktualisierte Profil zurück. Fehler ehrlich anzeigen (Wurzel 5).
  async function fotoGewaehlt(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    e.target.value = ""; // gleiche Datei erneut wählbar machen
    if (!datei) return;
    setLaedt(true);
    setFehler(null);
    try {
      onProfil(await uploadAvatar(datei));
    } catch (exc) {
      setFehler(exc instanceof Error ? exc.message : t("hostAvatarFehler"));
    } finally {
      setLaedt(false);
    }
  }

  // Die editierbaren Freitext-Felder als Liste mit Icon (Airbnb-Reihenfolge).
  const felder: { key: TextKey; icon: string; mehrzeilig?: boolean; max: number }[] = [
    { key: "work", icon: "ph:briefcase", max: 100 },
    { key: "dream_destination", icon: "ph:globe-hemisphere-west", max: 100 },
    { key: "spend_time_on", icon: "ph:clock", max: 100 },
    { key: "pets", icon: "ph:paw-print", max: 100 },
    { key: "school", icon: "ph:graduation-cap", max: 100 },
    { key: "useless_skill", icon: "ph:magic-wand", max: 100 },
    { key: "favorite_song", icon: "ph:music-notes", max: 100 },
    { key: "fun_fact", icon: "ph:lightbulb", max: 100 },
    { key: "obsessed_with", icon: "ph:heart", max: 100 },
    { key: "bio_title", icon: "ph:book", max: 100 },
    { key: "lives_in", icon: "ph:map-pin", max: 120 },
  ];

  const initiale = (profile.full_name ?? "").trim().charAt(0).toUpperCase() || "?";
  const decadeLabel =
    profile.decade_born != null
      ? t("hostDecadeWert", { n: profile.decade_born })
      : t("hostHinzufuegen");

  return (
    <div className="flex h-full min-h-0">
      <section className="min-w-0 flex-1 overflow-y-auto px-8 py-8 lg:py-12">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-sans text-[2rem] font-bold tracking-tight">
            {t("secGastgeber")}
          </h2>

          {/* Avatar + Name + „Hosting begann {Jahr}" (Airbnb-Kopf). Avatar mit
              „Foto ändern"-Overlay → öffnet die Avatar-Sidebar. */}
          <div className="mt-8 flex flex-col items-center text-center">
            {/* Avatar + Foto-Upload (Airbnb: Kreis mit „Hinzufügen"-Pill). Der
                Klick öffnet den Dateidialog; der Upload speichert sofort. */}
            <div className="relative">
              <span className="flex size-40 items-center justify-center overflow-hidden rounded-full bg-accent/15">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="font-sans text-6xl font-bold text-accent">
                    {initiale}
                  </span>
                )}
              </span>
              <input
                ref={dateiFeld}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={fotoGewaehlt}
              />
              <button
                type="button"
                disabled={laedt}
                onClick={() => dateiFeld.current?.click()}
                className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-background px-4 py-2 text-sm font-semibold shadow-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-60"
              >
                <Icon icon="ph:camera" className="size-4" />
                {laedt ? t("hostAvatarLaedt") : t("hostAvatarCta")}
              </button>
            </div>
            {fehler && (
              <p className="mt-6 text-sm text-destructive">{fehler}</p>
            )}
            {profile.full_name && (
              <p className="mt-5 font-sans text-2xl font-bold tracking-tight">
                {profile.full_name}
              </p>
            )}
            {formatHostingSince(profile.hosting_since) && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("hostSeit", { zeit: formatHostingSince(profile.hosting_since)! })}
              </p>
            )}
          </div>

          {/* Intro (Bio) als gestrichelte Karte (Airbnb „Schreib etwas Witziges"). */}
          <button
            type="button"
            onClick={() => setDetail("intro")}
            className="mt-8 block w-full rounded-2xl border border-dashed border-border p-6 text-left outline-none transition-colors hover:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/20"
          >
            {profile.intro?.trim() ? (
              <p className="text-[0.9375rem] leading-relaxed">{profile.intro}</p>
            ) : (
              <>
                <p className="text-muted-foreground">{t("hostIntroPlaceholder")}</p>
                <p className="mt-1 font-semibold underline underline-offset-4">
                  {t("hostIntroCta")}
                </p>
              </>
            )}
          </button>

          {/* Feld-Liste mit Icons + Divider (Airbnb-Muster). */}
          <div className="mt-8 divide-y divide-border border-y border-border">
            {felder.map((f) => (
              <ZeileButton
                key={f.key}
                icon={f.icon}
                titel={t(`host_${f.key}`)}
                wert={profile[f.key]?.trim() || t("hostHinzufuegen")}
                fehlt={!profile[f.key]?.trim()}
                onClick={() => setDetail(f.key)}
              />
            ))}
            <ZeileButton
              icon="ph:cake"
              titel={t("hostDecadeTitel")}
              wert={profile.show_decade ? decadeLabel : t("hostHinzufuegen")}
              fehlt={!profile.show_decade || profile.decade_born == null}
              onClick={() => setDetail("decade")}
            />
            <ZeileButton
              icon="ph:translate"
              titel={t("hostLanguagesTitel")}
              wert={
                profile.languages.length
                  ? t("hostAnzahlGewaehlt", { n: profile.languages.length })
                  : t("hostHinzufuegen")
              }
              fehlt={profile.languages.length === 0}
              onClick={() => setDetail("languages")}
            />
          </div>

          {/* Reisestempel-Sicht (Airbnb „Wo ich gewesen bin") — reiner Toggle. */}
          <div className="mt-8 flex items-start justify-between gap-4 rounded-2xl border border-border p-6">
            <div className="min-w-0">
              <p className="font-semibold">{t("hostTravelStampsTitel")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("hostTravelStampsHint")}
              </p>
            </div>
            <Toggle
              an={profile.show_travel_stamps}
              onChange={(v) => void onPatch({ show_travel_stamps: v })}
            />
          </div>

          {/* Interessen als Chips (Airbnb „Meine Interessen"). */}
          <div className="mt-8">
            <p className="font-semibold">{t("hostInterestsTitel")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("hostInterestsHint")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.interests.map((slug) => {
                const eintrag = INTERESSEN.find((i) => i.slug === slug);
                return (
                  <span
                    key={slug}
                    className="flex items-center gap-2 rounded-full border border-foreground px-4 py-2 text-sm font-medium"
                  >
                    {eintrag && <Icon icon={eintrag.icon} className="size-4" />}
                    {t(`interest_${slug}`)}
                  </span>
                );
              })}
              <button
                type="button"
                onClick={() => setDetail("interests")}
                className="flex items-center gap-2 rounded-full border border-dashed border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              >
                <Icon icon="ph:plus" className="size-4" />
                {t("hostInterestsCta")}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Inline-Detail-Sidebar (kein Overlay): fährt aus, schiebt die Vorschau zusammen. */}
      <AnimatePresence initial={false}>
        {detail != null && (
          <motion.aside
            key="host-sidebar"
            className="shrink-0 overflow-hidden border-l border-border"
            initial={reduziert ? false : { width: 0, opacity: 0 }}
            animate={{ width: "32rem", opacity: 1 }}
            exit={reduziert ? { opacity: 0 } : { width: 0, opacity: 0 }}
            transition={
              reduziert ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }
            }
          >
            <div className="h-full w-[32rem]">
              {isTextKey(detail) && (
                <TextSidebar
                  titel={t(`host_${detail}`)}
                  hint={t(`host_${detail}_hint`)}
                  wert={profile[detail] ?? ""}
                  maxLen={felder.find((f) => f.key === detail)?.max ?? 100}
                  onSpeichere={(v) => onPatch({ [detail]: v })}
                  onZurueck={() => setDetail(null)}
                />
              )}
              {detail === "intro" && (
                <TextSidebar
                  titel={t("hostIntroTitel")}
                  hint={t("hostIntroHint")}
                  wert={profile.intro ?? ""}
                  maxLen={450}
                  mehrzeilig
                  onSpeichere={(v) => onPatch({ intro: v })}
                  onZurueck={() => setDetail(null)}
                />
              )}
              {detail === "lives_in" && (
                <StadtSidebar
                  profile={profile}
                  onSpeichere={onPatch}
                  onZurueck={() => setDetail(null)}
                />
              )}
              {detail === "decade" && (
                <DecadeSidebar
                  decade={profile.decade_born}
                  show={profile.show_decade}
                  onSpeichere={(d, s) => onPatch({ decade_born: d, show_decade: s })}
                  onZurueck={() => setDetail(null)}
                />
              )}
              {detail === "languages" && (
                <SprachenSidebar
                  gewaehlt={profile.languages}
                  onSpeichere={(neu) => onPatch({ languages: neu })}
                  onZurueck={() => setDetail(null)}
                />
              )}
              {detail === "interests" && (
                <InteressenSidebar
                  gewaehlt={profile.interests}
                  onSpeichere={(neu) => onPatch({ interests: neu })}
                  onZurueck={() => setDetail(null)}
                />
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

// Freitext-Listeneinträge. „intro" hat einen eigenen (mehrzeiligen) Zweig,
// „lives_in" bekommt statt Freitext eine Stadt-Suche (Places) — beide raus.
function isTextKey(d: Detail): d is Exclude<TextKey, "intro" | "lives_in"> {
  return (
    d !== "intro" &&
    d !== "lives_in" &&
    d !== "decade" &&
    d !== "languages" &&
    d !== "interests"
  );
}

/* ------------------------------------------------------------------ */
/* Sidebars                                                           */
/* ------------------------------------------------------------------ */

// Freitext (ein-/mehrzeilig) mit Zeichenzähler + Abbrechen/Speichern-Fuß.
function TextSidebar({
  titel,
  hint,
  wert,
  maxLen,
  mehrzeilig,
  onSpeichere,
  onZurueck,
}: {
  titel: string;
  hint: string;
  wert: string;
  maxLen: number;
  mehrzeilig?: boolean;
  onSpeichere: (v: string) => Promise<boolean>;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  const [entwurf, setEntwurf] = useState(wert);
  const [speichert, setSpeichert] = useState(false);
  useEffect(() => setEntwurf(wert), [wert]);

  const geaendert = entwurf.trim() !== wert.trim();

  async function speichern() {
    if (!geaendert) return;
    setSpeichert(true);
    const ok = await onSpeichere(entwurf.trim());
    setSpeichert(false);
    if (ok) onZurueck();
  }

  return (
    <SidebarRahmen
      titel={titel}
      onZurueck={onZurueck}
      onSpeichern={speichern}
      speichert={speichert}
      speichernAus={!geaendert}
    >
      <p className="text-sm text-muted-foreground">{hint}</p>
      <p className="mb-2 mt-6 text-xs font-medium text-muted-foreground">
        {t("zeichenVerbleibend", { n: maxLen - entwurf.length, max: maxLen })}
      </p>
      <textarea
        value={entwurf}
        maxLength={maxLen}
        rows={mehrzeilig ? 6 : 2}
        aria-label={titel}
        onChange={(e) => setEntwurf(e.target.value)}
        className="w-full resize-none rounded-2xl border border-border bg-transparent p-4 text-[0.9375rem] leading-relaxed outline-none focus:border-foreground"
        autoFocus
      />
    </SidebarRahmen>
  );
}

// „Wo ich wohne" — Ortssuche über Google Places. Speichert die Bestandteile
// STRUKTURIERT (Straße/Hausnr./PLZ/Stadt/Land/lat/lng) plus den Anzeigetext
// lives_in („Stadt, Land"), der im Profil sichtbar ist. Kein Regex-Raten aus
// einem String, keine erfundenen Teile (Wurzel 4).
function StadtSidebar({
  profile,
  onSpeichere,
  onZurueck,
}: {
  profile: HostProfile;
  onSpeichere: (patch: HostProfilePatch) => Promise<boolean>;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  // Der Anzeigetext im Suchfeld …
  const [text, setText] = useState(profile.lives_in ?? "");
  // … und die strukturierten Bestandteile aus der Places-Auswahl.
  const [teile, setTeile] = useState({
    street: profile.lives_in_street ?? "",
    houseNumber: profile.lives_in_house_number ?? "",
    postalCode: profile.lives_in_postal_code ?? "",
    city: profile.lives_in_city ?? "",
    country: profile.lives_in_country ?? "",
    lat: profile.lives_in_lat,
    lng: profile.lives_in_lng,
  });
  const [speichert, setSpeichert] = useState(false);

  useEffect(() => {
    setText(profile.lives_in ?? "");
    setTeile({
      street: profile.lives_in_street ?? "",
      houseNumber: profile.lives_in_house_number ?? "",
      postalCode: profile.lives_in_postal_code ?? "",
      city: profile.lives_in_city ?? "",
      country: profile.lives_in_country ?? "",
      lat: profile.lives_in_lat,
      lng: profile.lives_in_lng,
    });
  }, [profile]);

  const geaendert =
    text.trim() !== (profile.lives_in ?? "").trim() ||
    teile.street !== (profile.lives_in_street ?? "") ||
    teile.houseNumber !== (profile.lives_in_house_number ?? "") ||
    teile.postalCode !== (profile.lives_in_postal_code ?? "") ||
    teile.city !== (profile.lives_in_city ?? "") ||
    teile.country !== (profile.lives_in_country ?? "") ||
    teile.lat !== profile.lives_in_lat ||
    teile.lng !== profile.lives_in_lng;

  // Places-Auswahl → alle Bestandteile übernehmen; Anzeigetext = „Stadt, Land".
  function gewaehlt(a: PlacesAddress) {
    setTeile({
      street: a.street,
      houseNumber: a.houseNumber,
      postalCode: a.postalCode,
      city: a.city,
      country: a.country,
      lat: a.lat,
      lng: a.lng,
    });
    setText([a.city, a.country].filter(Boolean).join(", "));
  }

  async function speichern() {
    if (!geaendert) return;
    setSpeichert(true);
    const ok = await onSpeichere({
      lives_in: text.trim(),
      lives_in_street: teile.street,
      lives_in_house_number: teile.houseNumber,
      lives_in_postal_code: teile.postalCode,
      lives_in_city: teile.city,
      lives_in_country: teile.country,
      lives_in_lat: teile.lat,
      lives_in_lng: teile.lng,
    });
    setSpeichert(false);
    if (ok) onZurueck();
  }

  // Gefundene Bestandteile (nur die vorhandenen) als Beleg anzeigen.
  const details: { label: string; wert: string }[] = [
    { label: t("lageStrasse"), wert: [teile.street, teile.houseNumber].filter(Boolean).join(" ") },
    { label: t("lagePlz"), wert: teile.postalCode },
    { label: t("lageStadt"), wert: teile.city },
    { label: t("lageLand"), wert: teile.country },
    {
      label: t("hostLivesInKoords"),
      wert:
        teile.lat != null && teile.lng != null
          ? `${teile.lat.toFixed(5)}, ${teile.lng.toFixed(5)}`
          : "",
    },
  ].filter((d) => d.wert);

  return (
    <SidebarRahmen
      titel={t("host_lives_in")}
      onZurueck={onZurueck}
      onSpeichern={speichern}
      speichert={speichert}
      speichernAus={!geaendert}
    >
      <p className="text-sm text-muted-foreground">{t("host_lives_in_hint")}</p>
      <div className="mt-6">
        <AdressSuche
          value={text}
          onChange={setText}
          onPick={gewaehlt}
          placeholder={t("hostLivesInSuche")}
          cityOnly
        />
      </div>

      {details.length > 0 && (
        <div className="mt-6 divide-y divide-border rounded-2xl border border-border">
          {details.map((d) => (
            <div key={d.label} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <span className="text-sm text-muted-foreground">{d.label}</span>
              <span className="text-sm font-medium">{d.wert}</span>
            </div>
          ))}
        </div>
      )}

      {/* Datenschutz-Hinweis: im Profil sichtbar ist nur die Stadt-Ebene. */}
      <p className="mt-4 text-xs text-muted-foreground">
        {t("hostLivesInPrivat")}
      </p>
    </SidebarRahmen>
  );
}

// Jahrzehnt (Zahl-Stepper in 10er-Schritten) + Sicht-Toggle (Airbnb).
function DecadeSidebar({
  decade,
  show,
  onSpeichere,
  onZurueck,
}: {
  decade: number | null;
  show: boolean;
  onSpeichere: (decade: number, show: boolean) => Promise<boolean>;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  // Default 1990er, falls noch nichts gesetzt (plausibler Startpunkt zum Wählen —
  // kein gespeicherter Fantasiewert; erst „Speichern" persistiert).
  const [d, setD] = useState<number>(decade ?? 1990);
  const [an, setAn] = useState(show);
  const [speichert, setSpeichert] = useState(false);
  useEffect(() => {
    setD(decade ?? 1990);
    setAn(show);
  }, [decade, show]);

  const geaendert = d !== (decade ?? 1990) || an !== show;

  async function speichern() {
    if (!geaendert) return;
    setSpeichert(true);
    const ok = await onSpeichere(d, an);
    setSpeichert(false);
    if (ok) onZurueck();
  }

  return (
    <SidebarRahmen
      titel={t("hostDecadeTitel")}
      onZurueck={onZurueck}
      onSpeichern={speichern}
      speichert={speichert}
      speichernAus={!geaendert}
    >
      <p className="text-sm text-muted-foreground">{t("hostDecadeHint")}</p>
      <div className="mt-8 flex flex-col items-center">
        <p className="text-4xl font-bold tracking-tight">
          {t("hostDecadeWert", { n: d })}
        </p>
        <div className="mt-8 flex items-center gap-6">
          <button
            type="button"
            aria-label="−10"
            disabled={d <= 1900}
            onClick={() => setD((v) => Math.max(1900, v - 10))}
            className="flex size-11 items-center justify-center rounded-full border border-border transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon icon="ph:minus" className="size-4" />
          </button>
          <span className="min-w-16 text-center text-2xl font-semibold tabular-nums">
            {d}
          </span>
          <button
            type="button"
            aria-label="+10"
            disabled={d >= 2020}
            onClick={() => setD((v) => Math.min(2020, v + 10))}
            className="flex size-11 items-center justify-center rounded-full border border-border transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon icon="ph:plus" className="size-4" />
          </button>
        </div>
      </div>
      <div className="mt-10 flex items-start justify-between gap-4 border-t border-border pt-6">
        <div className="min-w-0">
          <p className="font-semibold">{t("hostDecadeToggle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("hostDecadeToggleHint")}</p>
        </div>
        <Toggle an={an} onChange={setAn} />
      </div>
    </SidebarRahmen>
  );
}

// Sprachen: durchsuchbare Checkbox-Liste (Airbnb „Sprachen, die Sie sprechen").
function SprachenSidebar({
  gewaehlt,
  onSpeichere,
  onZurueck,
}: {
  gewaehlt: string[];
  onSpeichere: (neu: string[]) => Promise<boolean>;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  const [lokal, setLokal] = useState<string[]>(gewaehlt);
  const [suche, setSuche] = useState("");
  const [speichert, setSpeichert] = useState(false);
  useEffect(() => setLokal(gewaehlt), [gewaehlt]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return SPRACHEN;
    return SPRACHEN.filter((code) => t(`lang_${code}`).toLowerCase().includes(q));
  }, [suche, t]);

  const geaendert =
    lokal.length !== gewaehlt.length || lokal.some((c) => !gewaehlt.includes(c));

  function toggle(code: string) {
    setLokal((v) => (v.includes(code) ? v.filter((x) => x !== code) : [...v, code]));
  }

  async function speichern() {
    if (!geaendert) return;
    setSpeichert(true);
    const ok = await onSpeichere(lokal);
    setSpeichert(false);
    if (ok) onZurueck();
  }

  return (
    <SidebarRahmen
      titel={t("hostLanguagesTitel")}
      onZurueck={onZurueck}
      onSpeichern={speichern}
      speichert={speichert}
      speichernAus={!geaendert}
    >
      <div className="relative">
        <Icon
          icon="ph:magnifying-glass"
          className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder={t("hostLanguagesSuche")}
          className="w-full rounded-full border border-border bg-transparent py-3 pl-11 pr-4 outline-none focus:border-foreground"
        />
      </div>
      <div className="mt-4 divide-y divide-border">
        {gefiltert.map((code) => {
          const an = lokal.includes(code);
          return (
            <button
              key={code}
              type="button"
              onClick={() => toggle(code)}
              className="flex w-full items-center justify-between gap-4 py-4 text-left"
            >
              <span className="font-medium">{t(`lang_${code}`)}</span>
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${
                  an ? "border-foreground bg-foreground text-background" : "border-border"
                }`}
              >
                {an && <Icon icon="ph:check" className="size-4" />}
              </span>
            </button>
          );
        })}
      </div>
    </SidebarRahmen>
  );
}

// Interessen: Chip-Auswahl (Airbnb „Worauf stehst du?", max 20).
function InteressenSidebar({
  gewaehlt,
  onSpeichere,
  onZurueck,
}: {
  gewaehlt: string[];
  onSpeichere: (neu: string[]) => Promise<boolean>;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  const [lokal, setLokal] = useState<string[]>(gewaehlt);
  const [speichert, setSpeichert] = useState(false);
  // Airbnb zeigt initial nur eine kuratierte Auswahl; „Alle anzeigen" klappt die
  // komplette (~143) Liste samt Suche auf.
  const [alleZeigen, setAlleZeigen] = useState(false);
  const [suche, setSuche] = useState("");
  useEffect(() => setLokal(gewaehlt), [gewaehlt]);

  const MAX = 20;
  const geaendert =
    lokal.length !== gewaehlt.length || lokal.some((s) => !gewaehlt.includes(s));

  // Sichtbare Chips: zugeklappt die Top-Auswahl PLUS bereits gewählte (damit eine
  // Wahl außerhalb der Top-Liste nicht unsichtbar wird); aufgeklappt alle,
  // gefiltert nach der Suche.
  const sichtbar = useMemo(() => {
    if (alleZeigen) {
      const q = suche.trim().toLowerCase();
      if (!q) return INTERESSEN;
      return INTERESSEN.filter((i) =>
        t(`interest_${i.slug}`).toLowerCase().includes(q),
      );
    }
    const top = new Set([...INTERESSEN_TOP, ...lokal]);
    return INTERESSEN.filter((i) => top.has(i.slug));
  }, [alleZeigen, suche, lokal, t]);

  function toggle(slug: string) {
    setLokal((v) => {
      if (v.includes(slug)) return v.filter((x) => x !== slug);
      if (v.length >= MAX) return v; // harte Obergrenze (Airbnb 20).
      return [...v, slug];
    });
  }

  async function speichern() {
    if (!geaendert) return;
    setSpeichert(true);
    const ok = await onSpeichere(lokal);
    setSpeichert(false);
    if (ok) onZurueck();
  }

  return (
    <SidebarRahmen
      titel={t("hostInterestsDialogTitel")}
      onZurueck={onZurueck}
      onSpeichern={speichern}
      speichert={speichert}
      speichernAus={!geaendert}
    >
      <p className="text-sm text-muted-foreground">{t("hostInterestsDialogHint")}</p>

      {/* Suchfeld erst in der aufgeklappten Vollliste (Airbnb-Muster). */}
      {alleZeigen && (
        <div className="relative mt-6">
          <Icon
            icon="ph:magnifying-glass"
            className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder={t("hostInterestsSuche")}
            className="w-full rounded-full border border-border bg-transparent py-3 pl-11 pr-4 outline-none focus:border-foreground"
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {sichtbar.map((i) => {
          const an = lokal.includes(i.slug);
          // Bei erreichtem Maximum sind nicht-gewählte Chips inaktiv (Airbnb 20).
          const gesperrt = !an && lokal.length >= MAX;
          return (
            <button
              key={i.slug}
              type="button"
              disabled={gesperrt}
              onClick={() => toggle(i.slug)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                an ? "border-foreground bg-muted/50" : "border-border hover:border-foreground"
              } ${gesperrt ? "cursor-not-allowed opacity-40" : ""}`}
            >
              <Icon icon={i.icon} className="size-4" />
              {t(`interest_${i.slug}`)}
            </button>
          );
        })}
      </div>

      {!alleZeigen && (
        <button
          type="button"
          onClick={() => setAlleZeigen(true)}
          className="mt-6 text-sm font-semibold underline underline-offset-4"
        >
          {t("hostInterestsAlle")}
        </button>
      )}

      <p className="mt-6 text-xs font-medium text-muted-foreground">
        {t("hostInterestsGewaehlt", { n: lokal.length, max: MAX })}
      </p>
    </SidebarRahmen>
  );
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                          */
/* ------------------------------------------------------------------ */

function SidebarRahmen({
  titel,
  onZurueck,
  onSpeichern,
  speichert,
  speichernAus,
  children,
}: {
  titel: string;
  onZurueck: () => void;
  onSpeichern: () => void;
  speichert?: boolean;
  speichernAus?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("objektEditor");
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-8">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onZurueck}
            aria-label={t("schliessen")}
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>
        <h2 className="font-sans text-[1.5rem] font-bold tracking-tight">{titel}</h2>
        <div className="mt-4">{children}</div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-4">
        <button
          type="button"
          onClick={onZurueck}
          className="text-sm font-semibold underline-offset-4 hover:underline"
        >
          {t("abbrechen")}
        </button>
        <button
          type="button"
          onClick={onSpeichern}
          disabled={speichert || speichernAus}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {speichert ? t("speichert") : t("speichern")}
        </button>
      </div>
    </div>
  );
}

function ZeileButton({
  icon,
  titel,
  wert,
  fehlt,
  onClick,
}: {
  icon: string;
  titel: string;
  wert: string;
  fehlt?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 py-4 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-foreground/20"
    >
      <Icon icon={icon} className="size-6 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{titel}</p>
        <p className={`mt-0.5 truncate text-sm ${fehlt ? "text-muted-foreground" : "text-foreground"}`}>
          {wert}
        </p>
      </div>
      <Icon icon="ph:caret-right" className="size-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function Toggle({ an, onChange }: { an: boolean; onChange: (an: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      onClick={() => onChange(!an)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
        an ? "bg-foreground" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`inline-block size-5 rounded-full bg-background shadow transition-transform ${
          an ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
