import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Richtlinie für schwerwiegende Beeinträchtigungen",
  stand: "Stand: 18. August 2026",
  intro: [
    "Manchmal verhindert ein Ereignis die Reise oder den Aufenthalt, für das weder der Gast noch der Anbieter etwas kann. Diese Richtlinie beschreibt, welche Ereignisse das sind und was dann gilt.",
    "Sie geht der im Angebot gewählten Stornierungsbedingung vor.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Welche Ereignisse erfasst sind",
      paragraphs: [
        "Erfasst sind Ereignisse, die nach der Buchung eintreten, für beide Seiten unvorhersehbar waren und die Reise oder den Aufenthalt unmöglich oder rechtlich unzulässig machen:",
      ],
      list: [
        "behördliche Reise- oder Aufenthaltsverbote, Ausgangssperren und Grenzschließungen, die den Zielort oder den Herkunftsort betreffen;",
        "Naturkatastrophen und Naturereignisse, die den Zielort betreffen — Erdbeben, Überschwemmung, Sturm, Großbrand, Vulkanausbruch;",
        "Krieg, bewaffnete Auseinandersetzungen, Terroranschläge und Unruhen am Zielort;",
        "eine behördlich festgestellte Epidemie oder Pandemie mit Maßnahmen, die den Aufenthalt untersagen;",
        "der Ausfall der Versorgung mit Strom, Wasser oder Wärme am Zielort über einen längeren Zeitraum;",
        "der vollständige Ausfall der Anreisemöglichkeit zum Zielort aufgrund eines der vorgenannten Ereignisse.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Welche Ereignisse nicht erfasst sind",
      paragraphs: ["Nicht erfasst sind insbesondere:"],
      list: [
        "Krankheit oder Verletzung des Gastes oder seiner Angehörigen — dafür ist eine Reiseversicherung vorgesehen;",
        "berufliche Verhinderung, Prüfungstermine oder Wegfall des Urlaubs;",
        "die Absage einer Veranstaltung, wegen der die Reise gebucht wurde, sofern die Unterkunft nutzbar bleibt;",
        "Wetter, das keine Naturkatastrophe darstellt — Regen, Kälte, Hitze, fehlender Schnee;",
        "der Ausfall einzelner Verkehrsmittel, solange eine zumutbare Anreise möglich bleibt;",
        "die Streichung eines Fluges oder ein Streik bei einem Verkehrsunternehmen — dafür bestehen Ansprüche gegen das Verkehrsunternehmen.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Was gilt, wenn ein erfasstes Ereignis eintritt",
      paragraphs: [
        "Betrifft das Ereignis den Zeitraum Ihrer Buchung, können Sie kostenfrei stornieren. Sie erhalten den über die Plattform gezahlten Betrag vollständig erstattet.",
        "Ist der Aufenthalt bereits angetreten, erstatten wir den Anteil für die nicht mehr nutzbaren Nächte.",
        "Dem Anbieter entstehen aus einer solchen Stornierung keine Nachteile in der Bewertung seiner Verlässlichkeit.",
        "Alternativ können Sie mit dem Anbieter eine Verschiebung vereinbaren; wir helfen bei der Umbuchung.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Wie Sie sich darauf berufen",
      paragraphs: [
        "Melden Sie sich über die Kontaktwege unter [Beschwerden und Streitbeilegung](https://mybestdays.dk/rechtliches/beschwerden) und nennen Sie Buchungsnummer und Ereignis.",
        "Wir prüfen anhand öffentlich zugänglicher Quellen — behördliche Anordnungen, amtliche Warnungen, Berichte anerkannter Nachrichtenquellen — und entscheiden zügig.",
        "Ist die Lage noch nicht abschließend zu beurteilen, warten wir die Entwicklung bis kurz vor dem Anreisetag ab und entscheiden dann. Ihre Buchung bleibt bis dahin unverändert bestehen.",
      ],
    },
  ],
};
