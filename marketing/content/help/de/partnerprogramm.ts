import type { HelpCategory } from "../types";

// Hilfe zum Partnerprogramm (0517/0520). Zahlen der Staffel stehen NICHT hier,
// sondern kommen auf /partner live aus der API — der Artikel verweist dorthin.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Partnerprogramm",
  description: "Betriebe empfehlen, ein Team aufbauen und am Abo-Umsatz mitverdienen.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "So funktioniert es",
      articles: [
        {
          slug: "ueberblick",
          title: "Das Partnerprogramm im Überblick",
          excerpt: "Wer teilnehmen kann, wie Provision entsteht und was Sie sehen.",
          updated: "Stand: September 2026",
          body: [
            {
              type: "p",
              text: "Als Partner empfehlen Sie myNextDays an Vermieter, Agenturen und Hotels. Registriert sich ein Betrieb mit Ihrem Code oder über Ihren Link und bezahlt seine Abo-Rechnungen, erhalten Sie zwölf Monate lang einen Anteil am Netto-Abo-Umsatz. Die Staffel nach zahlenden Kunden steht live auf der Programmseite.",
            },
            { type: "h2", text: "Wer Partner werden kann" },
            {
              type: "ul",
              items: [
                "Personen und Firmen in der EU, in der Schweiz oder im Vereinigten Königreich mit einem echten Kanal zu Gastgebern: Influencer, Berater, Agenturen, Steuerkanzleien, Verbände.",
                "Auch myNextDays-Kunden selbst — ein Abo ist keine Voraussetzung.",
                "Pflicht in der Bewerbung: mindestens ein Social-Media-Konto (Instagram, TikTok, YouTube, Facebook, LinkedIn …) mit Adresse, Handle und Reichweite. Website oder Newsletter gern zusätzlich.",
              ],
            },
            { type: "h2", text: "Wie ein Betrieb Ihnen zugeordnet wird" },
            {
              type: "steps",
              items: [
                "Sie teilen Ihren Link (mynextdays.com/p/IHR-CODE) oder Ihren Code.",
                "Der Betrieb sieht den Code bei der Registrierung im Feld „Empfohlen von“ und bestätigt ihn durch das Absenden — ohne Cookie.",
                "Mit der ersten bezahlten Abo-Rechnung beginnt die zwölfmonatige Laufzeit.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Sie sehen Ihre Kunden pseudonym (Kunde #1, #2 …) mit Land, Status und Beträgen — nie Name oder E-Mail. Ein Betrieb wird genau einem Partner zugeordnet; der erste gewinnt.",
            },
            { type: "h2", text: "Was Sie im Dashboard finden" },
            {
              type: "ul",
              items: [
                "Übersicht: Rang, Klicks, registrierte und zahlende Betriebe, offene, auszahlbare und ausgezahlte Provision.",
                "Provisionen: jede bezahlte Abo-Rechnung als Zeile mit Basis, Satz, Betrag und Status.",
                "Auszahlungen: monatlich je Währung ab dem Mindestbetrag, mit Gutschrift (Self-Billing) als Beleg.",
                "Links & Material: Ihre Codes, Werbematerial und die Pflicht-Kennzeichnung je Land.",
                "Nachrichten: der direkte Draht zum Partnerteam.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Team aufbauen: die Team-Provision",
          excerpt: "Partner werben, die mit Ihrem Code beitreten — und am Umsatz ihrer Kunden mitverdienen.",
          updated: "Stand: September 2026",
          body: [
            {
              type: "p",
              text: "Sie können andere Partner in Ihr Team holen. Bewirbt sich jemand über Ihren Team-Link (mynextdays.com/p/IHR-CODE?team=1) und trägt Ihren Code in der Bewerbung sichtbar ein, gehört er nach der Freigabe zu Ihrem Team. Auf den Netto-Abo-Umsatz der Kunden Ihrer Team-Partner erhalten Sie eine Team-Provision.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Der Team-Satz richtet sich nach IHREM Rang zum Zeitpunkt der Zahlung — nicht nach der Größe Ihres Teams. Die Sätze stehen auf der Programmseite.",
                "Ihr Rang entsteht nur aus Ihren eigenen zahlenden Kunden. Team-Kunden zählen nicht für den Rang.",
                "Genau eine Ebene: Ihre Team-Partner bauen kein eigenes Team unter Ihnen auf.",
                "Kein Teilnahmebeitrag, kein Geld für das Anwerben eines Partners. Team-Provision entsteht ausschließlich aus bezahltem Abo-Umsatz.",
                "Zwölf Monate ab der ersten bezahlten Rechnung des jeweiligen Team-Kunden, 30 Tage Erstattungsfenster, Rücknahme bei Erstattung oder Chargeback — wie bei der eigenen Provision.",
                "Team-Provision entsteht nur, wenn Sie und Ihr Team-Partner freigegeben sind; sonst wird sie angehalten.",
              ],
            },
            { type: "h2", text: "Die Team-Auswertung" },
            {
              type: "p",
              text: "Unter „Team“ sehen Sie jeden Team-Partner mit Rang, zahlenden Kunden, Abo-Umsatz seiner Kunden (30 Tage und gesamt) und Ihrer Team-Provision daraus — offen, auszahlbar, ausgezahlt — sowie den Verlauf der letzten zwölf Monate. Kundendetails Ihrer Team-Partner sehen Sie nicht; die gehören ihnen.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Über „Team“ erreichen Sie Ihre Team-Partner direkt per Nachricht — und Ihr Sponsor Sie.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Gleiche E-Mail-Domain oder gleiche Bankverbindung zwischen Sponsor und Team-Partner werden markiert und vom Partnerteam geprüft, bevor Team-Provision ausgezahlt wird.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Auszahlung, Gutschrift und Steuern",
          excerpt: "Wann Provision auszahlbar wird, wie die Gutschrift aussieht und was steuerlich gilt.",
          updated: "Stand: September 2026",
          body: [
            {
              type: "steps",
              items: [
                "Eine Provisionszeile entsteht mit der bezahlten Abo-Rechnung und ist 30 Tage „offen“ (Erstattungsfenster).",
                "Danach ist sie auszahlbar. Am Monatsersten bündeln wir alle auszahlbaren Zeilen je Währung.",
                "Liegt die Summe über dem Mindestbetrag Ihrer Währung, entsteht eine Auszahlung mit Gutschrift (Self-Billing). Sie brauchen keine Rechnung zu stellen.",
                "Nach der Überweisung steht die Auszahlung als „Bezahlt“ mit Referenz im Dashboard.",
              ],
            },
            {
              type: "ul",
              items: [
                "Unternehmen: Die Gutschrift trägt den Reverse-Charge-Vermerk; Voraussetzung ist eine bestätigte USt-IdNr. (VIES-Prüfung).",
                "Privatpersonen: Die Gutschrift weist keine Umsatzsteuer aus; die Provision ist selbst zu versteuern.",
                "Auszahlung per SEPA, Wise oder PayPal — die Daten tragen Sie im Profil ein; Änderungen verlangen Ihr Passwort.",
                "Keine Umrechnung: Provision in DKK wird in DKK ausgezahlt, Provision in EUR in EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Werbung muss als Werbung erkennbar sein — am Anfang des Beitrags, in der Sprache des Beitrags. Die belegten Wortlaute je Land finden Sie unter „Links & Material“. Verstöße können zur Sperre führen.",
            },
          ],
        },
      ],
    },
  ],
};
