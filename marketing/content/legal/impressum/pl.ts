// Polskie tłumaczenie informacji prawnych. Wersją referencyjną jest
// ./de.ts — zmiany merytoryczne wprowadza się NAJPIERW tam, dopiero potem tu.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Informacje prawne",
  metaDescription:
    "Dane dostawcy myNextDays ApS zgodnie z § 7 duńskiej ustawy o handlu elektronicznym (e-handelslov): firma, adres, zarząd, numer CVR i kontakt.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Dane dotyczące dostawcy platformy myNextDays — property management system i channel manager prowadzony przez ${ANBIETER.firma}.`,
    "Informacje obowiązkowe zgodnie z § 7 duńskiej ustawy o handlu elektronicznym (e-handelslov), która wdraża art. 5 dyrektywy 2000/31/WE o handlu elektronicznym.",
  ],
  sections: [
    {
      heading: "Dostawca",
      zeilen: [
        {
          label: "Przedsiębiorstwo",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Adres",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Zarząd uprawniony do reprezentacji",
          werte: [`${ANBIETER.direktion.join(" i ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Kontakt",
      zeilen: [
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Strona internetowa",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Rejestr handlowy i VAT",
      zeilen: [
        {
          label: "Rejestr handlowy",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dania",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Numer identyfikacyjny VAT",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Punkt kontaktowy zgodnie z aktem o usługach cyfrowych",
      paragraphs: [
        `Centralny punkt kontaktowy dla organów na podstawie art. 11 oraz dla użytkowników na podstawie art. 12 rozporządzenia (UE) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Językami komunikacji są niemiecki, duński i angielski.",
      ],
    },
    {
      heading: "Rozstrzyganie sporów konsumenckich",
      paragraphs: [
        "Nie jesteśmy ani gotowi, ani zobowiązani do udziału w postępowaniu w sprawie rozstrzygania sporów przed konsumenckim organem polubownym.",
      ],
    },
    {
      heading: "Odpowiedzialność za odnośniki",
      paragraphs: [
        "Mimo starannej kontroli treści nie ponosimy odpowiedzialności za treść zewnętrznych odnośników. Za treść stron, do których prowadzą odnośniki, odpowiadają wyłącznie ich operatorzy.",
      ],
    },
    {
      heading: "Prawa autorskie",
      paragraphs: [
        `Treści, teksty, grafiki i znaki towarowe publikowane na tej stronie internetowej są chronione prawem autorskim i prawem znaków towarowych. Wszelkie wykorzystanie wykraczające poza przypadki dozwolone przez prawo wymaga uprzedniej pisemnej zgody ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Pozostałe dokumenty prawne",
      paragraphs: [
        "Korzystanie z platformy podlega naszym ogólnym warunkom handlowym. Sposób przetwarzania danych osobowych opisano w polityce prywatności; stosowane pliki cookie wymieniono w polityce plików cookie.",
      ],
      links: [
        { label: "Ogólne warunki handlowe", href: AGB_URL },
        { label: "Polityka prywatności", href: "/datenschutz" },
        { label: "Polityka plików cookie", href: "/cookie-richtlinie" },
        { label: "Umowa powierzenia przetwarzania danych (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Prawo właściwe",
      paragraphs: [
        `${ANBIETER.firma} ma siedzibę i jest ustanowiona wyłącznie w Danii. Do niniejszej oferty online stosuje się zatem prawo duńskie — również do wersji w języku polskim (zasada kraju pochodzenia zgodnie z art. 3 dyrektywy 2000/31/WE). Obowiązki informacyjne wynikają z § 7 duńskiej ustawy o handlu elektronicznym (e-handelslov).`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
