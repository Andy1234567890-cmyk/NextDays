import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Korttidsuthyrning och registreringsplikter",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "I många städer och regioner kräver korttidsuthyrning av bostad tillstånd, registrering eller anmälan. Denna sida förklarar vad det innebär för leverantörer och för gäster.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Rättslig ram",
      paragraphs: [
        "Förordning (EU) 2024/1028 om insamling och utbyte av data om korttidsuthyrning av boende skapar en enhetlig ram: där en medlemsstat eller en lokal myndighet har infört ett registreringsförfarande får varje enhet ett registreringsnummer.",
        "Plattformar måste visa detta nummer, kontrollera dess giltighet stickprovsvis och regelbundet överföra uppgifter om verksamheten till behöriga myndigheter.",
        "Därutöver gäller fortsatt nationella och lokala föreskrifter — t.ex. om ändrad användning av bostäder, högsta antal uthyrningsdagar, brandskydd och registrering av gäster.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Vad leverantörer måste göra",
      paragraphs: [
        "Kontrollera före publiceringen om en registrerings-, tillstånds- eller anmälningsplikt gäller för ditt boende och uppfyll den.",
        "Ange registreringsnumret i objektet om ett sådant finns. Vi visar det i annonsen.",
        "Iaktta högsta antal uthyrningsdagar och övriga lokala gränser. Att bevaka dem är din uppgift, inte vår.",
        "Vi får inte varaktigt visa en annons utan det nödvändiga registreringsnumret. Saknas det eller visar det sig ogiltigt begär vi in det; uteblir uppgiften inaktiverar vi annonsen.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Vad detta innebär för gäster",
      paragraphs: [
        "Gäller en registreringsplikt för ett boende ser du registreringsnumret i annonsen. Det är en indikation på att uthyrningen anmälts till behörig myndighet.",
        "På resmålet kan en registrering krävas (registreringsblankett, id-uppgifter, turistskatteförklaring). Leverantören begär in de nödvändiga uppgifterna; tillhandahåll dem i god tid.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Överföring av uppgifter till myndigheter",
      paragraphs: [
        "I den mån förordning (EU) 2024/1028 eller nationell rätt föreskriver det överför vi uppgifter om uthyrningsverksamheten till behöriga myndigheter — särskilt registreringsnummer, enhetens adress, antal belagda nätter och antal gäster.",
        "Denna överföring sker för att uppfylla en rättslig förpliktelse enligt artikel 6.1 c i förordning (EU) 2016/679. Närmare framgår av [Integritetspolicy](https://mybestdays.dk/rechtliches/datenschutz).",
        "Skild från detta finns den skattemässiga rapporteringsskyldigheten enligt DAC7; se [Skattepolicy](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Anmäla överträdelser",
      paragraphs: [
        "Har du hållpunkter för att ett boende erbjuds utan nödvändigt tillstånd eller registrering, anmäl det till oss via anmälningsfunktionen vid annonsen. Vi följer upp varje anmälan.",
      ],
    },
  ],
};
