// Aistriúchán Gaeilge ar an bhFógra Dlíthiúil. Is í ./de.ts an leagan
// tagartha — déantar athruithe ábhair ANSIN i dtosach, ansin anseo.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Fógra Dlíthiúil",
  metaDescription:
    "Faisnéis faoin soláthraí myNextDays ApS de réir Airteagal 7 den dlí Danmhargach maidir le tráchtáil leictreonach (e-handelslov): cuideachta, seoladh, bainistíocht, uimhir CVR agus teagmháil.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Faisnéis faoin soláthraí ar an ardán myNextDays — property management system agus channel manager arna oibriú ag ${ANBIETER.firma}.`,
    "Faisnéis éigeantach de réir Airteagal 7 den dlí Danmhargach maidir le tráchtáil leictreonach (e-handelslov), lena gcuirtear Airteagal 5 de Threoir 2000/31/CE maidir le tráchtáil leictreonach chun feidhme.",
  ],
  sections: [
    {
      heading: "Soláthraí",
      zeilen: [
        {
          label: "Cuideachta",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Seoladh",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Bainistíocht atá údaraithe ionadaíocht a dhéanamh",
          werte: [`${ANBIETER.direktion.join(" agus ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Teagmháil",
      zeilen: [
        {
          label: "Ríomhphost",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Teileafón",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Suíomh gréasáin",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Clár tráchtála agus CBL",
      zeilen: [
        {
          label: "Clár tráchtála",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, an Danmhairg",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Uimhir aitheantais CBL",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Pointe teagmhála faoin Acht um Sheirbhísí Digiteacha",
      paragraphs: [
        `Príomhphointe teagmhála d'údaráis de réir Airteagal 11 agus d'úsáideoirí de réir Airteagal 12 de Rialachán (AE) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Is iad an Ghearmáinis, an Danmhairgis agus an Béarla na teangacha cumarsáide.",
      ],
    },
    {
      heading: "Réiteach díospóidí tomhaltóirí",
      paragraphs: [
        "Níl muid sásta ná faoi oibleagáid páirt a ghlacadh in imeachtaí um réiteach díospóidí os comhair bord eadrána tomhaltóirí.",
      ],
    },
    {
      heading: "Dliteanas i leith nasc",
      paragraphs: [
        "In ainneoin seiceáil chúramach ar an ábhar, ní ghlacaimid dliteanas ar bith as ábhar naisc sheachtracha. Is iad na hoibreoirí ábhartha amháin atá freagrach as ábhar na leathanach lena nascann na naisc sin.",
      ],
    },
    {
      heading: "Cóipcheart",
      paragraphs: [
        `Tá an t-ábhar, na téacsanna, na grafaicí agus na trádmharcanna a fhoilsítear ar an suíomh gréasáin seo faoi chosaint ag an dlí cóipchirt agus trádmharcanna. Ní mór toiliú scríofa roimh ré ó ${ANBIETER.firma} d'aon úsáid a théann thar na cásanna atá ceadaithe faoin dlí.`,
      ],
    },
    {
      heading: "Doiciméid dhlíthiúla eile",
      paragraphs: [
        "Tá úsáid an ardáin faoi rialú ag ár dTéarmaí agus Coinníollacha Ginearálta. Tá cur síos ar an gcaoi a ndéanaimid próiseáil ar shonraí pearsanta sa Pholasaí Príobháideachais; tá na fianáin a úsáidtear liostaithe sa Pholasaí Fianán.",
      ],
      links: [
        { label: "Téarmaí agus Coinníollacha Ginearálta", href: AGB_URL },
        { label: "Polasaí Príobháideachais", href: "/datenschutz" },
        { label: "Polasaí Fianán", href: "/cookie-richtlinie" },
        { label: "Comhaontú Próiseála Sonraí (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "An dlí is infheidhme",
      paragraphs: [
        `Tá ceanncheathrú ${ANBIETER.firma} agus tá sí bunaithe go heisiach sa Danmhairg. Dá bhrí sin, tá dlí na Danmhairge infheidhme maidir leis an tairiscint ar líne seo — fiú don leagan Gaeilge (prionsabal thír an tionscnaimh de réir Airteagal 3 de Threoir 2000/31/CE). Eascraíonn na hoibleagáidí faisnéise as Airteagal 7 den dlí Danmhargach maidir le tráchtáil leictreonach (e-handelslov).`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
