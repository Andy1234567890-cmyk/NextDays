import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Beschwerden und Streitbeilegung",
  stand: "Stand: 18. August 2026",
  intro: [
    "Diese Seite beschreibt, wie Sie myBestDays erreichen, wie wir Beschwerden bearbeiten und welche Wege Ihnen offenstehen, wenn Sie mit unserer Entscheidung nicht einverstanden sind.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Wie Sie uns erreichen",
      paragraphs: [
        "Am schnellsten erreichen Sie uns über das Hilfe-Center und die dort hinterlegten Kontaktwege. Zu einer bestehenden Buchung nutzen Sie die Nachrichtenfunktion in Ihrem Konto — dann liegen uns Buchung und Verlauf bereits vor.",
        `Schriftlich erreichen Sie uns unter ${ANBIETER.email} oder ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}; telefonisch unter ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Was Ihre Beschwerde enthalten sollte",
      paragraphs: ["Damit wir schnell helfen können, geben Sie bitte an:"],
      list: [
        "Ihre Buchungsnummer und die für die Buchung verwendete E-Mail-Adresse;",
        "eine kurze Beschreibung des Problems;",
        "was Sie sich als Lösung wünschen;",
        "die zugehörigen Belege — Fotos, Nachrichten, Quittungen, Kontoauszüge.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Wie wir bearbeiten",
      paragraphs: [
        "Jede Beschwerde wird erfasst und erhält eine Vorgangsnummer, unter der Sie den Stand verfolgen können.",
        "Wir bestätigen den Eingang unverzüglich und antworten in der Sache in der Regel innerhalb von sieben Tagen. Ist eine längere Prüfung nötig, teilen wir Ihnen den Zwischenstand mit.",
        "Beschwerden, bei denen Personen gefährdet sind oder eine Anreise unmittelbar bevorsteht, behandeln wir vorrangig.",
        "Unsere Entscheidung begründen wir und nennen die Grundlage, auf der sie beruht.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Beschwerde gegen eine Maßnahme von uns",
      paragraphs: [
        "Haben wir Inhalte entfernt, deren Sichtbarkeit eingeschränkt, eine Buchung storniert oder ein Konto gesperrt, können Sie dagegen innerhalb von sechs Monaten kostenfrei Beschwerde einlegen. Das entspricht Artikel 20 der Verordnung (EU) 2022/2065.",
        "Die Beschwerde prüfen Menschen, nicht allein automatisierte Verfahren. Erweist sie sich als begründet, nehmen wir die Maßnahme zurück.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Außergerichtliche Streitbeilegung",
      paragraphs: [
        "Die Plattform der Europäischen Kommission zur Online-Streitbeilegung (OS-Plattform) wurde durch die Verordnung (EU) 2024/3228 aufgehoben und hat ihren Betrieb eingestellt. Über sie können keine Beschwerden mehr eingereicht werden.",
        "Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
        `Unabhängig davon können Sie sich als Verbraucher an die zuständige dänische Stelle wenden: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, ${VERBRAUCHERSCHLICHTUNG.land} ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Wohnen Sie in einem anderen Mitgliedstaat, hilft Ihnen das Europäische Verbraucherzentrum Ihres Landes weiter.`,
        "Betrifft der Streit eine Maßnahme, die wir gegen Ihre Inhalte oder Ihr Konto ergriffen haben, können Sie zusätzlich eine nach Artikel 21 der Verordnung (EU) 2022/2065 zertifizierte außergerichtliche Streitbeilegungsstelle anrufen. Deren Entscheidungen sind für uns nicht bindend, und wir sind zur Teilnahme an solchen Verfahren nicht verpflichtet.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Gerichtlicher Weg",
      paragraphs: [
        "Der Weg zu den Gerichten steht Ihnen jederzeit offen, auch ohne vorheriges Beschwerdeverfahren. Welche Gerichte zuständig sind, steht in Abschnitt A19 der [Nutzungsbedingungen](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Beschwerden von Anbietern",
      paragraphs: [
        "Anbieter können Beschwerden über die Anwendung dieser Bedingungen, über Ranking-Entscheidungen und über Einschränkungen ihres Angebots über dasselbe Verfahren einreichen. Das entspricht Artikel 11 der Verordnung (EU) 2019/1150.",
        "Über Zahl, Gegenstand und durchschnittliche Bearbeitungsdauer solcher Beschwerden berichten wir jährlich; der Bericht ist unter [Gesetz über digitale Dienste](https://mybestdays.dk/rechtliches/dsa) abrufbar.",
      ],
    },
  ],
};
