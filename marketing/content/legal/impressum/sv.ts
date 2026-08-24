// Svensk översättning av den juridiska informationen. Referensversionen
// är ./de.ts — innehållsändringar görs FÖRST där, sedan här.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Juridisk information",
  metaDescription:
    "Leverantörsuppgifter för myNextDays ApS enligt § 7 i den danska e-handelslagen (e-handelslov): företag, adress, direktion, CVR-nummer och kontakt.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Uppgifter om leverantören av plattformen myNextDays — ett property management system och channel manager som drivs av ${ANBIETER.firma}.`,
    "Obligatoriska uppgifter enligt § 7 i den danska e-handelslagen (e-handelslov), som genomför artikel 5 i direktiv 2000/31/EG om elektronisk handel.",
  ],
  sections: [
    {
      heading: "Leverantör",
      zeilen: [
        {
          label: "Företag",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Adress",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Firmatecknande direktion",
          werte: [`${ANBIETER.direktion.join(" och ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Kontakt",
      zeilen: [
        {
          label: "E-post",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Webbplats",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Företagsregister och moms",
      zeilen: [
        {
          label: "Företagsregister",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danmark",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Momsregistreringsnummer",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Kontaktpunkt enligt förordningen om digitala tjänster",
      paragraphs: [
        `Central kontaktpunkt för myndigheter enligt artikel 11 och för användare enligt artikel 12 i förordning (EU) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Kommunikationsspråken är tyska, danska och engelska.",
      ],
    },
    {
      heading: "Tvistlösning för konsumenter",
      paragraphs: [
        "Vi är varken villiga eller skyldiga att delta i ett tvistlösningsförfarande inför en konsumenttvistnämnd.",
      ],
    },
    {
      heading: "Ansvar för länkar",
      paragraphs: [
        "Trots noggrann innehållskontroll tar vi inget ansvar för innehållet i externa länkar. För innehållet på de länkade sidorna ansvarar uteslutande respektive operatör.",
      ],
    },
    {
      heading: "Upphovsrätt",
      paragraphs: [
        `Det innehåll, de texter, grafik och varumärken som publiceras på denna webbplats är skyddade av upphovsrätt och varumärkesrätt. All användning utöver vad som är tillåtet enligt lag kräver ${ANBIETER.firma}s skriftliga medgivande i förväg.`,
      ],
    },
    {
      heading: "Övriga juridiska dokument",
      paragraphs: [
        "Användningen av plattformen regleras av våra allmänna villkor. Hur vi behandlar personuppgifter framgår av integritetspolicyn; de cookies som används anges i cookiepolicyn.",
      ],
      links: [
        { label: "Allmänna villkor", href: AGB_URL },
        { label: "Integritetspolicy", href: "/datenschutz" },
        { label: "Cookiepolicy", href: "/cookie-richtlinie" },
        { label: "Personuppgiftsbiträdesavtal (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Tillämplig lag",
      paragraphs: [
        `${ANBIETER.firma} har sitt säte och är uteslutande etablerat i Danmark. Danskt rätt gäller därför för detta onlineerbjudande — även för den svenskspråkiga versionen (ursprungslandsprincipen enligt artikel 3 i direktiv 2000/31/EG). Informationsskyldigheterna följer av § 7 i den danska e-handelslagen (e-handelslov).`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
