"use client";

// Setup-Assistent fürs Hotel-Onboarding. Führt durch:
//  1) Willkommen
//  2) Verzweigung: "Schon auf Buchungsportalen aktiv?" (ja/nein)
//  3) Erstes Objekt anlegen (legt echtes Objekt an → Auto-Sync zum Provider)
//  4) Preis setzen (Basispreis je Nacht)
//  5) Kanäle: Neu → verbinden | Bestand → Portale verbinden + importieren
// Business-Logik im Backend; hier nur Orchestrierung (lib/properties, lib/channex).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ChannelConnectButton } from "@/components/channel-manager/channel-connect-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OnboardingStatus } from "@/lib/onboarding";
import { updateOnboarding } from "@/lib/onboarding";
import { createProperty } from "@/lib/properties";

type Step = "welcome" | "branch" | "object" | "price" | "channels" | "done";

// Portale, die ein Hotel evtl. schon nutzt (für den Bestands-Pfad).
const PORTALE = [
  { code: "BookingCom", label: "Booking.com", icon: "simple-icons:bookingdotcom" },
  { code: "Expedia", label: "Expedia", icon: "simple-icons:expedia" },
  { code: "Airbnb", label: "Airbnb", icon: "simple-icons:airbnb" },
] as const;

export function OnboardingWizard({
  channelManagerReady,
  initialStatus,
}: {
  channelManagerReady: boolean;
  initialStatus?: OnboardingStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Startschritt anhand des gespeicherten Fortschritts wählen (Wiederaufnahme).
  function firstOpenStep(s?: OnboardingStatus): Step {
    if (!s) return "welcome";
    if (!s.object_created) return s.has_ota === null ? "welcome" : "object";
    if (!s.price_set) return "price";
    if (!s.channels_done) return "channels";
    return "done";
  }

  const [step, setStep] = useState<Step>(firstOpenStep(initialStatus));
  const [error, setError] = useState<string | null>(null);

  // Verzweigung: schon auf Portalen aktiv?
  const [hasOta, setHasOta] = useState<boolean | null>(
    initialStatus?.has_ota ?? null,
  );
  const [selectedPortals, setSelectedPortals] = useState<string[]>(
    initialStatus?.selected_portals ?? [],
  );

  // Erstes Objekt
  const [objectTitle, setObjectTitle] = useState("");
  const [maxGuests, setMaxGuests] = useState(2);

  // Preis (Basispreis je Nacht, in Euro)
  const [basePrice, setBasePrice] = useState("");

  // Fortschritt im Hintergrund speichern (best-effort; blockiert die UI nicht).
  function persist(patch: Partial<OnboardingStatus>) {
    void updateOnboarding(patch);
  }

  function togglePortal(code: string) {
    setSelectedPortals((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function saveObject() {
    setError(null);
    startTransition(async () => {
      const res = await createProperty({
        title: objectTitle.trim(),
        property_type: "appartement",
        max_guests: maxGuests,
        status: "draft",
      });
      if (res.ok) {
        persist({ object_created: true });
        setStep("price");
      } else {
        setError(res.error);
      }
    });
  }

  function goToObject() {
    persist({ has_ota: hasOta, selected_portals: selectedPortals });
    setStep("object");
  }

  function goToChannels() {
    persist({ price_set: true });
    setStep("channels");
  }

  function finish() {
    // Onboarding abschließen → Dashboard zeigt danach die normale Übersicht.
    startTransition(async () => {
      await updateOnboarding({ channels_done: true, completed: true });
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ProgressBar step={step} />

      {step === "welcome" && (
        <Card>
          <Icon icon="ph:hand-waving" className="size-10 text-accent" />
          <h1 className="font-display text-2xl font-extrabold">
            Willkommen bei myNextDays
          </h1>
          <p className="text-muted-foreground">
            In wenigen Schritten ist dein Betrieb startklar. Wir legen dein
            erstes Objekt an, setzen einen Preis und verbinden deine
            Buchungskanäle.
          </p>
          <Button onClick={() => setStep("branch")} className="self-start">
            Los geht&apos;s
          </Button>
        </Card>
      )}

      {step === "branch" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            Bist du schon auf Buchungsportalen aktiv?
          </h1>
          <p className="text-muted-foreground">
            Wenn du z.&nbsp;B. schon auf Booking.com oder Airbnb vermietest,
            verbinden wir deine bestehenden Konten und übernehmen deine Objekte
            &amp; Buchungen — du musst nichts doppelt anlegen.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectCard
              active={hasOta === true}
              icon="ph:plugs-connected"
              title="Ja, bin ich schon"
              desc="Bestehende Portale verbinden & importieren"
              onClick={() => setHasOta(true)}
            />
            <SelectCard
              active={hasOta === false}
              icon="ph:sparkle"
              title="Nein, ich starte neu"
              desc="Objekt neu anlegen und Kanäle frisch verbinden"
              onClick={() => setHasOta(false)}
            />
          </div>

          {hasOta === true && (
            <div className="flex flex-col gap-3 rounded-(--radius) border border-border p-4">
              <p className="text-sm font-medium">
                Welche Portale nutzt du bereits?
              </p>
              <div className="flex flex-wrap gap-2">
                {PORTALE.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => togglePortal(p.code)}
                    className={
                      "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors " +
                      (selectedPortals.includes(p.code)
                        ? "border-accent bg-accent/10 text-foreground"
                        : "border-border hover:bg-secondary")
                    }
                  >
                    <Icon icon={p.icon} className="size-4" />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={goToObject}
            disabled={hasOta === null}
            className="self-start"
          >
            Weiter
          </Button>
        </Card>
      )}

      {step === "object" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            Dein erstes Objekt
          </h1>
          <p className="text-muted-foreground">
            Lege dein erstes vermietbares Objekt an. Details (Adresse, Fotos,
            Ausstattung) kannst du später ergänzen.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="objTitle" className="text-sm font-medium">
              Name des Objekts
            </label>
            <Input
              id="objTitle"
              value={objectTitle}
              onChange={(e) => setObjectTitle(e.target.value)}
              placeholder="z. B. Doppelzimmer Seeblick"
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="guests" className="text-sm font-medium">
              Maximale Gästezahl
            </label>
            <Input
              id="guests"
              type="number"
              min={1}
              max={50}
              value={maxGuests}
              onChange={(e) => setMaxGuests(Number(e.target.value) || 1)}
              className="w-32"
            />
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("branch")}>
              Zurück
            </Button>
            <Button
              onClick={saveObject}
              disabled={pending || objectTitle.trim().length === 0}
            >
              {pending ? "Wird angelegt …" : "Objekt anlegen"}
            </Button>
          </div>
        </Card>
      )}

      {step === "price" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            Basispreis je Nacht
          </h1>
          <p className="text-muted-foreground">
            Setze einen Startpreis. Saison- und Kanalpreise kannst du später
            feinjustieren.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="price" className="text-sm font-medium">
              Preis pro Nacht (€)
            </label>
            <Input
              id="price"
              type="number"
              min={0}
              step="1"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="z. B. 120"
              className="w-40"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("object")}>
              Zurück
            </Button>
            <Button onClick={goToChannels}>Weiter</Button>
          </div>
        </Card>
      )}

      {step === "channels" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            {hasOta ? "Portale verbinden & importieren" : "Buchungskanäle verbinden"}
          </h1>

          {!channelManagerReady && (
            <p className="rounded-(--radius) border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Die Kanal-Anbindung wird gerade für deinen Betrieb vorbereitet. Du
              kannst sie jederzeit später unter „Channel Manager"
              abschließen.
            </p>
          )}

          {hasOta ? (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground">
                Wir verbinden deine bestehenden Konten und übernehmen Objekte
                &amp; Buchungen. Wähle die Portale, die du verbinden möchtest:
              </p>
              <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
                {PORTALE.filter(
                  (p) =>
                    selectedPortals.length === 0 ||
                    selectedPortals.includes(p.code),
                ).map((p) => (
                  <li key={p.code} className="flex items-center gap-3 p-3">
                    <Icon icon={p.icon} className="size-5" />
                    <span className="flex-1 text-sm font-medium">{p.label}</span>
                  </li>
                ))}
              </ul>
              {channelManagerReady ? (
                <ChannelConnectButton label="Portale jetzt verbinden" />
              ) : null}
              <p className="text-xs text-muted-foreground">
                Der Verbindungs-Assistent (Zugang + Objekt-Zuordnung) öffnet sich
                eingebettet. Du kannst ihn auch später unter „Einstellungen →
                Channel-Manager" aufrufen.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground">
                Dein Objekt ist angelegt. Sobald du Kanäle verbindest, verteilen
                wir Verfügbarkeit und Preise automatisch an Booking.com, Airbnb
                &amp; Co. — und Buchungen landen direkt in deinem Kalender.
              </p>
              {channelManagerReady ? (
                <ChannelConnectButton label="Kanäle verbinden" variant="outline" />
              ) : null}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("price")}>
              Zurück
            </Button>
            <Button onClick={() => setStep("done")}>Setup abschließen</Button>
          </div>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Icon icon="ph:check-bold" className="size-6" />
          </span>
          <h1 className="font-display text-2xl font-extrabold">
            Geschafft — dein Betrieb ist startklar!
          </h1>
          <p className="text-muted-foreground">
            Du kannst jetzt im Dashboard weitere Objekte anlegen, Preise
            verfeinern und deine Kanäle final verbinden.
          </p>
          <Button onClick={finish} className="self-start">
            Zum Dashboard
          </Button>
        </Card>
      )}
    </div>
  );
}

// --- Hilfskomponenten -------------------------------------------------------
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-8 shadow-sm">
      {children}
    </div>
  );
}

function SelectCard({
  active,
  icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  icon: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex flex-col items-start gap-2 rounded-(--radius) border p-4 text-left transition-colors " +
        (active ? "border-accent bg-accent/10" : "border-border hover:bg-secondary")
      }
    >
      <Icon icon={icon} className="size-6 text-accent" />
      <span className="font-medium">{title}</span>
      <span className="text-sm text-muted-foreground">{desc}</span>
    </button>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}

function ProgressBar({ step }: { step: Step }) {
  const order: Step[] = ["welcome", "branch", "object", "price", "channels", "done"];
  const idx = order.indexOf(step);
  const pct = Math.round((idx / (order.length - 1)) * 100);
  return (
    <div className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Schritt {idx + 1} von {order.length}
      </p>
    </div>
  );
}
