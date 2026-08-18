import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Antidiskrimineringspolicy",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "myBestDays är öppet för alla. Den som bokar eller erbjuder via plattformen får inte behandla någon sämre på grund av personliga egenskaper.",
    "Denna policy utgör en del av [Användarvillkoren](https://mybestdays.dk/rechtliches/nutzungsbedingungen) och gäller för gäster liksom för leverantörer.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Utgångspunkt",
      paragraphs: [
        "På myBestDays är det otillåtet att missgynna en person på grund av ursprung, hudfärg, medborgarskap, etnisk tillhörighet, religion eller övertygelse, kön, könsidentitet, sexuell läggning, funktionsnedsättning, ålder eller civilstånd.",
        "Detta gäller för godkännande eller avslag av bokningar, för priser och villkor, för bemötandet under vistelsen och för kommunikationen via plattformen.",
        "Därutöver gäller artikel 20 i förordning (EU) 2018/302: leverantörer får inte begränsa tillgången till sitt erbjudande på grund av en gästs medborgarskap, hemvist eller etableringsort inom unionen.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. Vad detta innebär för leverantörer",
      paragraphs: ["Som leverantör får du särskilt inte:"],
      list: [
        "avslå en bokningsförfrågan på grund av någon av de nämnda egenskaperna;",
        "kräva olika priser, depositioner eller villkor av gäster för att de har någon av egenskaperna;",
        "i annonsen eller i meddelanden förklara att vissa persongrupper är oönskade;",
        "neka assistans- eller ledarhundar, även om dina ordningsregler utesluter djur;",
        "behandla en gäst annorlunda på grund av hemvist i en annan medlemsstat i unionen.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. Vad som förblir tillåtet",
      paragraphs: [
        "Du får fastställa maximal beläggning, en åldersgräns för huvudbokaren och sakliga ordningsregler (t.ex. rökförbud eller tysta tider), så länge de gäller lika för alla gäster.",
        "Bor du själv i boendet och delar bostad med gästen får du tydliggöra det i annonsen; egenskaperna i avsnitt 1 rättfärdigar ändå inte ett avslag.",
        "Du får avslå en bokning när det finns konkreta hållpunkter för en överträdelse av ordningsreglerna eller för bedrägeri. Skälet måste avse beteendet, inte personen.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Tillgänglighet",
      paragraphs: [
        "Uppgifter om ett boendes tillgänglighet måste stämma. Att beskriva ett boende som tillgängligt när det inte är det är samtidigt en överträdelse av [Riktlinjer för lämpligt innehåll](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
        "När en anpassning är möjlig utan orimlig ansträngning förväntar vi oss att leverantörer genomför den.",
      ],
    },
    {
      id: "melden",
      heading: "5. Anmäla diskriminering",
      paragraphs: [
        "Har du upplevt eller iakttagit diskriminering, anmäl det till oss via anmälningsfunktionen eller via kontaktvägarna under [Klagomål och tvistlösning](https://mybestdays.dk/rechtliches/beschwerden).",
        "Vi prövar varje anmälan. Bekräftas en överträdelse vidtar vi åtgärder upp till permanent spärr av kontot. Har en bokning nekats dig av det skälet hjälper vi dig att hitta ett jämförbart boende.",
      ],
    },
  ],
};
