import type { Meta, StoryObj } from "@storybook/react";

import { ONBOARDING_STEPS, OnboardingStepper } from "@/components/pms/onboarding-stepper";

/**
 * Onboarding-Stepper — Lastenheft-Modul §6 (Objekt-Inbetriebnahme / Onboarding).
 *
 * Zugehörige Tabelle: `onboarding_step` (je Objekt eine Stufe mit Titel,
 * Reihenfolge und Status).
 *
 * Vertikaler 8-stufiger Stepper für die Inbetriebnahme eines Objekts:
 * Objektinfo, Vertrag, Zugang & Technik, Serviceverträge, Handwerker,
 * Marketing, Hausmappe und Annoncierung. Jede Stufe zeigt ihren Status
 * (erledigt/aktiv/offen) über Iconify-Checkmarks (ph:check-bold), einen
 * animierten Marker für den aktiven Schritt sowie eine Status-Badge.
 * Klickbar zur Navigation; responsive und vertikal aufgebaut.
 *
 * Stufen-Status (fachlich): completed | active | open.
 */
const meta = {
  title: "PMS-Komponenten/Onboarding-Stepper",
  component: OnboardingStepper,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof OnboardingStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

// Hilfsfunktion: erzeugt die acht Standard-Stufen mit gewünschtem Status-Verlauf.
// completedUntil = Anzahl erledigter Stufen, activeIndex = Index der aktiven Stufe.
function buildSteps(completedUntil: number, activeIndex: number) {
  return ONBOARDING_STEPS.map((step, i) => ({
    ...step,
    status:
      i < completedUntil
        ? ("completed" as const)
        : i === activeIndex
          ? ("active" as const)
          : ("open" as const),
  }));
}

/** Standard: Inbetriebnahme begonnen, erste Stufe (Objektinfo) aktiv. */
export const Standard: Story = {
  args: {
    steps: buildSteps(0, 0),
  },
};

/** Mitten im Prozess: drei Stufen erledigt, Serviceverträge aktiv. */
export const InBearbeitung: Story = {
  args: {
    steps: buildSteps(3, 3),
  },
};

/** Kurz vor Abschluss: sieben Stufen erledigt, Annoncierung aktiv. */
export const FastFertig: Story = {
  args: {
    steps: buildSteps(7, 7),
  },
};

/** Abgeschlossen: alle acht Stufen erledigt, Objekt ist annonciert. */
export const Abgeschlossen: Story = {
  args: {
    steps: ONBOARDING_STEPS.map((step) => ({
      ...step,
      status: "completed" as const,
    })),
  },
};

/** Interaktiv: Klick auf eine Stufe markiert sie als aktiv (vorherige gelten als erledigt). */
export const Interaktiv: Story = {
  args: {
    steps: buildSteps(2, 2),
    onStepClick: (id: string) => console.log("Schritt gewählt:", id),
  },
};
