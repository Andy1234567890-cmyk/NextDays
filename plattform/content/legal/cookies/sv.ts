import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Kakpolicy",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "Denna policy förklarar vilka kakor och liknande tekniker myBestDays använder, till vad, hur länge de lagras och hur du styr dem.",
    "Den kompletterar [Integritetspolicy](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Vad kakor är",
      paragraphs: [
        "Kakor är små textfiler som en webbplats lagrar i din webbläsare. Liknande tekniker är webbläsarens lokala lagring och räknepixlar i e-post.",
        "Kakor som är strikt nödvändiga för driften av plattformen får vi sätta utan ditt samtycke. För alla övriga inhämtar vi ditt samtycke (artikel 5.3 i direktiv 2002/58/EG).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Nödvändiga kakor",
      paragraphs: [
        "Dessa kakor är nödvändiga för driften och kan inte väljas bort. Vi sätter för närvarande:",
      ],
      list: [
        "„nd_access“ — håller dig inloggad. Endast läsbar för servern (HttpOnly), livslängd motsvarande sessionens giltighet.",
        "„nd_refresh“ — förnyar din inloggning så att du inte behöver logga in gång på gång. Endast läsbar för servern, livslängd 30 dagar.",
        "„nd_gast_locale“ — kommer ihåg ditt valda språk. Livslängd ett år.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Funktionella, statistiska och marknadsföringskakor",
      paragraphs: [
        "myBestDays sätter för närvarande inga kakor för statistik, räckviddsmätning eller reklam och bäddar inte in några annonsnätverk eller analystjänster.",
        "Skulle det ändras inhämtar vi först ditt samtycke via en valdialog där det är lika enkelt att avböja som att godkänna, och vi kompletterar denna policy med de konkreta kakorna.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Inbäddat innehåll från tredje part",
      paragraphs: [
        "På detaljsidor kan kartor vara inbäddade. Sådant innehåll laddar vi först när du uttryckligen aktiverar det; först då kan uppgifter överföras till respektive leverantör.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Så styr du kakor",
      paragraphs: [
        "Ditt samtycke kan du när som helst ändra eller återkalla via kakinställningarna i sidfoten.",
        "Dessutom kan du radera eller blockera kakor i din webbläsare. Raderar du de nödvändiga kakorna loggas du ut och plattformen fungerar begränsat.",
      ],
    },
  ],
};
