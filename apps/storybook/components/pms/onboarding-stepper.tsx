// Fachliche PMS-Komponente Onboarding-Stepper (Lastenheft §6, Tabelle onboarding_step).
// Vertikaler 8-stufiger Stepper für die Objekt-Inbetriebnahme: zeigt je Schritt den
// Status (erledigt/aktiv/offen) mit Iconify-Checkmarks, optionaler Beschreibung
// und Klick-Navigation. Responsive (vertikal, volle Breite). Icons via Iconify — niemals lucide-react.

import { Icon } from "@iconify/react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Status einer Onboarding-Stufe (fachlich, nicht aus DB-Enum):
// completed = erledigt, active = aktueller Schritt, open = noch offen.
export type OnboardingStepStatus = "completed" | "active" | "open";

// Eine Onboarding-Stufe (entspricht onboarding_step).
export type OnboardingStep = {
  id: string;
  /** Schritt-Titel, z. B. "Objektinfo". */
  title: string;
  /** Kurze Beschreibung der Stufe. */
  description?: string;
  /** Iconify-Icon (ph:*) für die Stufe. */
  icon: string;
  /** Status der Stufe. */
  status: OnboardingStepStatus;
};

export type OnboardingStepperProps = {
  /** Die acht Onboarding-Stufen in Reihenfolge. */
  steps: OnboardingStep[];
  /** Callback bei Klick auf eine Stufe (z. B. Navigation zum Formular). */
  onStepClick?: (id: string) => void;
  className?: string;
};

// Die acht Standard-Stufen gem. Lastenheft §6 (Reihenfolge fix).
export const ONBOARDING_STEPS: Omit<OnboardingStep, "status">[] = [
  {
    id: "objektinfo",
    title: "Objektinfo",
    description: "Stammdaten, Adresse, Ausstattung und Fotos des Objekts.",
    icon: "ph:house-line",
  },
  {
    id: "vertrag",
    title: "Vertrag",
    description: "Verwaltervertrag, Provision und Konditionen festlegen.",
    icon: "ph:file-text",
  },
  {
    id: "zugang-technik",
    title: "Zugang & Technik",
    description: "Schlüssel, Schließsystem, WLAN und technische Zugänge.",
    icon: "ph:key",
  },
  {
    id: "servicevertraege",
    title: "Serviceverträge",
    description: "Reinigung, Wäsche, Wartung und sonstige Dienstleister.",
    icon: "ph:handshake",
  },
  {
    id: "handwerker",
    title: "Handwerker",
    description: "Handwerker-Kontakte und Zuständigkeiten hinterlegen.",
    icon: "ph:wrench",
  },
  {
    id: "marketing",
    title: "Marketing",
    description: "Beschreibungstexte, Highlights und Zielgruppe definieren.",
    icon: "ph:megaphone",
  },
  {
    id: "hausmappe",
    title: "Hausmappe",
    description: "Gäste-Infos, Hausordnung und Anleitungen zusammenstellen.",
    icon: "ph:book-open",
  },
  {
    id: "annoncierung",
    title: "Annoncierung",
    description: "Veröffentlichung auf Portalen und Direktbuchungs-Website.",
    icon: "ph:rocket-launch",
  },
];

// Status-Label + Badge-Variante je Stufen-Status (Status-Farben gem. BUILD_REFERENCE).
const STATUS_META: Record<
  OnboardingStepStatus,
  { label: string; variant: "secondary" | "warning" | "success" }
> = {
  completed: { label: "Erledigt", variant: "success" },
  active: { label: "In Arbeit", variant: "warning" },
  open: { label: "Offen", variant: "secondary" },
};

export function OnboardingStepper({
  steps,
  onStepClick,
  className,
}: OnboardingStepperProps) {
  // Lokaler Zustand für interaktive Demo (aktive Stufe per Klick verschieben).
  const [state, setState] = useState<OnboardingStep[]>(steps);

  const completedCount = state.filter((s) => s.status === "completed").length;
  const total = state.length;
  const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  function handleClick(id: string) {
    // Klick: gewählte Stufe wird aktiv, vorherige gelten als erledigt.
    setState((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      return prev.map((s, i) => ({
        ...s,
        status:
          i < idx ? "completed" : i === idx ? "active" : ("open" as OnboardingStepStatus),
      }));
    });
    onStepClick?.(id);
  }

  return (
    <Card className={cn("w-full max-w-lg", className)}>
      {/* Kopf: Titel + Fortschritt der Inbetriebnahme */}
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold leading-none tracking-tight">
              Objekt-Onboarding
            </h3>
            <p className="text-sm text-muted-foreground">
              {completedCount} von {total} Schritten erledigt
            </p>
          </div>
          <Badge variant={percent === 100 ? "success" : "secondary"}>
            <Icon icon="ph:chart-pie-slice" className="h-3.5 w-3.5" />
            {percent} %
          </Badge>
        </div>
      </CardHeader>

      <Separator />

      {/* Vertikale Schrittliste mit Verbindungslinie und Iconify-Checkmarks */}
      <CardContent className="pt-6">
        <ol className="flex flex-col">
          {state.map((step, i) => {
            const meta = STATUS_META[step.status];
            const isLast = i === state.length - 1;
            const interactive = Boolean(onStepClick);

            return (
              <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Verbindungslinie zwischen den Stufen */}
                {!isLast && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-[15px] top-9 h-[calc(100%-1.5rem)] w-px",
                      step.status === "completed" ? "bg-success" : "bg-border",
                    )}
                  />
                )}

                {/* Status-Marker: Checkmark (erledigt), aktiver Punkt oder Schritt-Icon */}
                <span
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    step.status === "completed" &&
                      "border-success bg-success text-success-foreground",
                    step.status === "active" &&
                      "border-warning bg-warning text-warning-foreground",
                    step.status === "open" &&
                      "border-border bg-background text-muted-foreground",
                  )}
                >
                  <Icon
                    icon={
                      step.status === "completed"
                        ? "ph:check-bold"
                        : step.status === "active"
                          ? "ph:circle-notch"
                          : step.icon
                    }
                    className={cn(
                      "h-4 w-4",
                      step.status === "active" && "animate-spin",
                    )}
                  />
                </span>

                {/* Schritt-Inhalt: Nummer, Titel, Status-Badge, Beschreibung */}
                <ContentTag
                  interactive={interactive}
                  onClick={interactive ? () => handleClick(step.id) : undefined}
                  className={cn(
                    "flex flex-1 flex-col gap-1 text-left",
                    interactive &&
                      "-mx-2 -my-1 rounded-(--radius) px-2 py-1 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  aria-current={step.status === "active" ? "step" : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Icon
                        icon={step.icon}
                        className="h-4 w-4 text-muted-foreground"
                      />
                      <span
                        className={cn(
                          "text-sm font-medium",
                          step.status === "open" && "text-muted-foreground",
                        )}
                      >
                        {i + 1}. {step.title}
                      </span>
                    </span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  {step.description && (
                    <p className="text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  )}
                </ContentTag>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

// Hilfs-Wrapper: als <button> wenn klickbar, sonst als <div> (semantisch korrekt).
function ContentTag({
  interactive,
  className,
  children,
  ...props
}: {
  interactive: boolean;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  if (interactive) {
    return (
      <button type="button" className={className} {...props}>
        {children}
      </button>
    );
  }
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
