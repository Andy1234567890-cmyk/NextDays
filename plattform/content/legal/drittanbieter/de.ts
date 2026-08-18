import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Drittanbieter und Zahlungsdienste",
  stand: "Stand: 18. August 2026",
  intro: [
    "myBestDays setzt für den Betrieb der Plattform Dienste Dritter ein. Diese Seite nennt sie und erklärt, welche Rolle sie haben und wessen Bedingungen jeweils gelten.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Grundsatz",
      paragraphs: [
        "Wo ein Drittanbieter eine Leistung unmittelbar Ihnen gegenüber erbringt, gelten dessen Bedingungen und dessen Datenschutzerklärung zusätzlich zu unseren. Wir weisen an der jeweiligen Stelle darauf hin.",
        "Wo ein Drittanbieter ausschließlich in unserem Auftrag verarbeitet, bleiben wir Ihr Ansprechpartner. Welche Auftragsverarbeiter wir einsetzen, steht in der [Datenschutzerklärung](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Zahlungsdienstleister",
      paragraphs: [
        "Zahlungen über die Plattform wickelt Stripe ab. Stripe erhebt und verarbeitet Zahlungsdaten unmittelbar und ist dafür eigenständig verantwortlich. Es gilt zusätzlich die [Stripe-Datenschutzerklärung](https://stripe.com/privacy).",
        "Für die Auszahlung an Gastgeber führt Stripe die gesetzlich vorgeschriebene Identitätsprüfung durch.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Zahlungsdiensterichtlinie und Zugriff Dritter",
      paragraphs: [
        "Die Richtlinie (EU) 2015/2366 („PSD2“) verlangt für viele Zahlungen eine starke Kundenauthentifizierung. Ihre Bank oder Ihr Kartenherausgeber führt sie durch; ohne erfolgreiche Authentifizierung kann eine Zahlung abgelehnt werden.",
        "myBestDays ist kein Zahlungsauslöse- oder Kontoinformationsdienst und greift nicht auf Ihre Bankkonten zu.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Karten, Bilder und eingebettete Inhalte",
      paragraphs: [
        "Für Kartendarstellungen und Standortangaben binden wir Kartendienste Dritter ein. Beim Laden solcher Inhalte können Daten an den jeweiligen Anbieter übertragen werden; Einzelheiten und die Einwilligungssteuerung stehen in der [Cookie-Richtlinie](https://mybestdays.dk/rechtliches/cookies).",
        "Bilder und Beschreibungen in Angeboten stammen vom jeweiligen Anbieter, nicht von uns.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Verlinkte Seiten",
      paragraphs: [
        "Die Plattform kann auf Seiten Dritter verlinken. Auf deren Inhalte haben wir keinen Einfluss und übernehmen für sie keine Verantwortung. Erlangen wir Kenntnis von einer Rechtsverletzung, entfernen wir den Link unverzüglich.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. App-Stores",
      paragraphs: [
        "Beziehen Sie die myBestDays-App über einen App-Store, gelten zusätzlich die Bedingungen des jeweiligen Store-Betreibers. Der Store-Betreiber ist nicht Partei des Vertrags zwischen Ihnen und uns und schuldet weder Support noch Gewährleistung für die App.",
      ],
    },
  ],
};
