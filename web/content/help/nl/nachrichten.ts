import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Berichten & gasten",
  description: "Postvak, sjablonen en gastcommunicatie.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Communicatie",
      articles: [
        {
          slug: "posteingang",
          title: "Het platform-postvak",
          excerpt: "Alle gastberichten van uw objecten komen centraal samen in het platform-postvak.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Eén postvak voor alle objecten" },
            {
              type: "p",
              text: "Het platform-postvak bundelt alle berichten van uw gasten op één plek — ongeacht via welk object of welke periode het gesprek loopt. U opent het onder /nachrichten en ziet daar elk gesprek als eigen thread.",
            },
            { type: "h2", text: "Opbouw van het postvak" },
            {
              type: "ul",
              items: [
                "Linkerkolom: lijst van alle gesprekken, nieuwste eerst",
                "Middelste kolom: de actieve berichtengeschiedenis met de gast",
                "Rechterkolom: context bij de reservering — periode, object, gastgegevens",
              ],
            },
            { type: "h2", text: "Op een bericht reageren" },
            {
              type: "steps",
              items: [
                "Open /nachrichten en selecteer het gewenste gesprek",
                "Schrijf uw antwoord in het tekstveld of gebruik een snelantwoord",
                "Verstuur het bericht — de gast ontvangt het via hetzelfde kanaal waarlangs hij heeft geschreven",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Het platform-postvak toont uitsluitend de directe communicatie tussen u en uw gasten op myNextDays — berichten uit de portalen verwerkt u nog steeds daar.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Snelantwoorden",
          excerpt: "Sjablonen voor veelgestelde vragen besparen tijd in het gastcontact.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Wat snelantwoorden zijn" },
            {
              type: "p",
              text: "Snelantwoorden zijn vooraf geformuleerde tekstblokken voor terugkerende vragen — bijvoorbeeld over de aankomst, het wifiwachtwoord of de parkeersituatie. In plaats van elk antwoord opnieuw te typen, voegt u het passende sjabloon met één klik in in het [platform-postvak](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Een snelantwoord aanmaken" },
            {
              type: "steps",
              items: [
                "Open /nachrichten en klik op “Snelantwoorden beheren”",
                "Klik op “Nieuw sjabloon” en geef een titel, bijvoorbeeld “Check-in-info”",
                "Schrijf de antwoordtekst; plaatshouders zoals gastnaam of aankomstdatum worden bij het verzenden automatisch ingevuld",
                "Sla het sjabloon op — het is vanaf dat moment in elk gesprek beschikbaar",
              ],
            },
            { type: "h2", text: "Snelantwoorden dagelijks gebruiken" },
            {
              type: "p",
              text: "In het berichtenvenster opent u de sjablonenlijst via het bliksemsymbool, kiest u het passende antwoord en past u dit indien nodig nog individueel aan voordat u het verstuurt.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Maak sjablonen aan voor de meest voorkomende vijf tot tien vragen — dat dekt in de praktijk het grootste deel van de binnenkomende berichten af.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Automatische berichten",
          excerpt: "Bevestigingen, check-in-info en herinneringen kunnen automatisch naar gasten worden verstuurd.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Terugkerende berichten automatiseren" },
            {
              type: "p",
              text: "In plaats van boekingsbevestigingen, check-in-informatie of bedankberichten handmatig te versturen, legt u ze eenmalig vast als regel — myNextDays verstuurt ze dan automatisch op het juiste moment vóór, tijdens of na het verblijf.",
            },
            { type: "h2", text: "Typische triggers voor automatische berichten" },
            {
              type: "ul",
              items: [
                "Direct na de boeking — bevestiging met de belangrijkste gegevens",
                "Enkele dagen vóór aankomst — check-in-informatie en toegangscode",
                "Op de vertrekdag — dank en verzoek om een beoordeling",
              ],
            },
            { type: "h2", text: "Een automatisch bericht instellen" },
            {
              type: "steps",
              items: [
                "Open /nachrichten, sectie “Automatische berichten”",
                "Kies de trigger, bijvoorbeeld “X dagen vóór aankomst”",
                "Leg de tekst vast — plaatshouders zoals gastnaam, object of aankomstdatum worden automatisch ingevuld",
                "Activeer de regel; deze geldt voor alle objecten, tenzij anders beperkt",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Automatische berichten verschijnen gewoon in het [platform-postvak](/hilfe/nachrichten/posteingang) en kunnen daar altijd achteraf worden bekeken.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Berichten blokkeren",
          excerpt: "U kunt een persoon rechtstreeks vanuit de berichtengeschiedenis blokkeren voor verder contact.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Wanneer een blokkering zinvol is" },
            {
              type: "p",
              text: "Bij beledigende berichten, intimidatie of herhaaldelijk ongepast gedrag kunt u een persoon rechtstreeks vanuit de berichtenthread blokkeren. Een geblokkeerde persoon kan u daarna geen nieuwe berichten meer sturen en geen nieuwe boeking meer bij u aanmaken.",
            },
            { type: "h2", text: "Een persoon vanuit de thread blokkeren" },
            {
              type: "steps",
              items: [
                "Open het betreffende gesprek in het [platform-postvak](/hilfe/nachrichten/posteingang)",
                "Klik bovenaan de thread op het menu en kies “Persoon blokkeren”",
                "Bevestig de actie — de blokkering geldt direct",
              ],
            },
            { type: "h2", text: "Wat de blokkering betekent — en wat niet" },
            {
              type: "ul",
              items: [
                "Nieuwe berichten van de geblokkeerde persoon worden niet meer afgeleverd",
                "Nieuwe boekingsaanvragen van deze persoon worden geweigerd",
                "Loopt er momenteel een reservering van deze persoon, dan blijft de communicatie bij wijze van uitzondering mogelijk voor de duur van het verblijf",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Een blokkering kan altijd worden opgeheven in het overzicht “Geblokkeerde personen” in het account. Controleer vóór het blokkeren of er al een lopende boeking bestaat.",
            },
          ],
        },
      ],
    },
  ],
};
