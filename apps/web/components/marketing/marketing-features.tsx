// Features — "Ein System. Ein Login. Viele Funktionen." mit Tab-Navigation
// und Vorschau-Panel. Figma: horizontale Tab-Leiste über einem Produkt-Bild.
"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

const FEATURES = [
  {
    key: "calendar",
    label: "Kalender",
    icon: "ph:calendar-blank",
    title: "Kalender",
    text: "Starte deinen Tag mit dem Blick auf deinen zentralen Kalender und die täglichen Abläufe.",
  },
  {
    key: "channel",
    label: "Channel-Manager",
    icon: "ph:share-network",
    title: "Channel-Manager",
    text: "Verwalte alle Buchungskanäle zentral und vermeide Doppelbuchungen durch Echtzeit-Synchronisation.",
  },
  {
    key: "booking",
    label: "Direktbuchung",
    icon: "ph:globe-hemisphere-west",
    title: "Direktbuchungs-Engine",
    text: "Nimm provisionsfreie Direktbuchungen über deine eigene Website entgegen.",
  },
  {
    key: "insights",
    label: "Auswertungen",
    icon: "ph:chart-bar",
    title: "Auswertungen",
    text: "Behalte Umsatz, Auslastung und Kennzahlen deiner Unterkunft jederzeit im Blick.",
  },
  {
    key: "channels-plus",
    label: "Kanäle Plus",
    icon: "ph:plugs-connected",
    title: "Kanäle Plus",
    text: "Erweitere deine Reichweite mit zusätzlichen Premium-Buchungskanälen und Metasuche.",
  },
  {
    key: "revenue",
    label: "Dynamische Preise",
    icon: "ph:trend-up",
    title: "Dynamische Preisgestaltung",
    text: "Optimiere deine Raten automatisch nach Nachfrage und Auslastung – für mehr Umsatz.",
  },
  {
    key: "guest",
    label: "Gästeerlebnis",
    icon: "ph:users-three",
    title: "Gästeerlebnis",
    text: "Automatisiere Nachrichten und biete deinen Gästen einen reibungslosen Aufenthalt.",
  },
  {
    key: "website",
    label: "Website-Baukasten",
    icon: "ph:browser",
    title: "Website-Baukasten",
    text: "Erstelle deine eigene Unterkunfts-Website mit integrierter Buchungsmöglichkeit.",
  },
  {
    key: "payments",
    label: "Zahlungen",
    icon: "ph:credit-card",
    title: "Zahlungen",
    text: "Verarbeite Zahlungen sicher und behalte deine Finanzen an einem Ort im Blick.",
  },
  {
    key: "app",
    label: "Mobile App",
    icon: "ph:device-mobile-camera",
    title: "Mobile App",
    text: "Verwalte deine Unterkunft von überall – direkt vom Smartphone aus.",
  },
  {
    key: "metasearch",
    label: "Metasuche",
    icon: "ph:magnifying-glass",
    title: "Metasuche",
    text: "Werde auf Metasuch-Plattformen sichtbar und gewinne mehr Direktbuchungen.",
  },
];

export function MarketingFeatures() {
  const [active, setActive] = useState(FEATURES[0].key);
  const current = FEATURES.find((f) => f.key === active) ?? FEATURES[0];

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Ein System. Ein Login. Viele Funktionen.
        </h2>

        <div className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-2">
          {FEATURES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActive(f.key)}
              className={
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors " +
                (active === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-muted")
              }
            >
              <Icon icon={f.icon} className="size-4" />
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-2xl font-semibold">{current.title}</h3>
            <p className="mt-4 text-muted-foreground">{current.text}</p>
            <a
              href="#preise"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
            >
              Mehr erfahren
              <Icon icon="ph:arrow-right" className="size-4" />
            </a>
          </div>
          <div className="aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-secondary to-muted shadow-lg" />
        </div>
      </div>
    </section>
  );
}
