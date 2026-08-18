import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Policy vid allvarliga störningar",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "Ibland hindrar en händelse resan eller vistelsen som varken gästen eller leverantören rår över. Denna policy beskriver vilka händelser det är och vad som då gäller.",
    "Den har företräde framför det avbokningsvillkor som valts i annonsen.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Vilka händelser som omfattas",
      paragraphs: [
        "Omfattas gör händelser som inträffar efter bokningen, var oförutsebara för båda parter och gör resan eller vistelsen omöjlig eller rättsligt otillåten:",
      ],
      list: [
        "myndighetsbeslutade rese- eller vistelseförbud, utegångsförbud och gränsstängningar som rör resmålet eller avreseorten;",
        "naturkatastrofer och naturhändelser som drabbar resmålet — jordbävning, översvämning, storm, storbrand, vulkanutbrott;",
        "krig, väpnade konflikter, terrorattentat och oroligheter på resmålet;",
        "en av myndighet fastställd epidemi eller pandemi med åtgärder som förbjuder vistelsen;",
        "bortfall av försörjningen med el, vatten eller värme på resmålet under en längre period;",
        "fullständigt bortfall av möjligheten att resa till resmålet till följd av någon av de föregående händelserna.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Vilka händelser som inte omfattas",
      paragraphs: ["Omfattas gör särskilt inte:"],
      list: [
        "sjukdom eller skada hos gästen eller dennes anhöriga — för detta är en reseförsäkring avsedd;",
        "yrkesmässigt hinder, tentamensdatum eller indragen semester;",
        "inställandet av ett evenemang som resan bokats för, om boendet förblir användbart;",
        "väder som inte utgör en naturkatastrof — regn, kyla, hetta, uteblivet snöfall;",
        "bortfall av enskilda transportmedel, så länge en rimlig resa förblir möjlig;",
        "inställandet av ett flyg eller en strejk hos ett transportföretag — för detta finns anspråk mot transportföretaget.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Vad som gäller när en omfattad händelse inträffar",
      paragraphs: [
        "Berör händelsen perioden för din bokning kan du avboka kostnadsfritt. Du får hela det belopp som betalats via plattformen återbetalat.",
        "Har vistelsen redan påbörjats återbetalar vi andelen för de nätter som inte längre kan användas.",
        "Leverantören drabbas inte av någon nackdel i bedömningen av sin pålitlighet till följd av en sådan avbokning.",
        "Alternativt kan du komma överens med leverantören om en förskjutning; vi hjälper till med ombokningen.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Så åberopar du denna policy",
      paragraphs: [
        "Kontakta oss via vägarna under [Klagomål och tvistlösning](https://mybestdays.dk/rechtliches/beschwerden) och ange bokningsnummer och händelse.",
        "Vi prövar utifrån offentligt tillgängliga källor — myndighetsbeslut, officiella varningar, rapporter från erkända nyhetskällor — och beslutar skyndsamt.",
        "Kan läget ännu inte bedömas slutgiltigt avvaktar vi utvecklingen till strax före ankomstdagen och beslutar då. Din bokning kvarstår oförändrad till dess.",
      ],
    },
  ],
};
