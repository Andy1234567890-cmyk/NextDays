// Slovenski prevod pravnih informacij. Referenčna različica je ./de.ts —
// vsebinske spremembe se najprej naredijo tam, šele nato tukaj.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Pravne informacije",
  metaDescription:
    "Podatki o ponudniku myNextDays ApS v skladu s § 7 danskega zakona o elektronskem poslovanju (e-handelslov): podjetje, naslov, poslovodstvo, številka CVR in kontakt.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Podatki o ponudniku platforme myNextDays — property management system in channel manager, ki ga upravlja ${ANBIETER.firma}.`,
    "Obvezni podatki v skladu s § 7 danskega zakona o elektronskem poslovanju (e-handelslov), ki prenaša člen 5 Direktive 2000/31/ES o elektronskem poslovanju.",
  ],
  sections: [
    {
      heading: "Ponudnik",
      zeilen: [
        {
          label: "Podjetje",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Naslov",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Zastopniško poslovodstvo",
          werte: [`${ANBIETER.direktion.join(" in ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Kontakt",
      zeilen: [
        {
          label: "E-pošta",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Splet",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Poslovni register in DDV",
      zeilen: [
        {
          label: "Poslovni register",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danska",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Identifikacijska številka za DDV",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Kontaktna točka po aktu o digitalnih storitvah",
      paragraphs: [
        `Osrednja kontaktna točka za organe po členu 11 in za uporabnike po členu 12 Uredbe (EU) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Komunikacijski jeziki so nemščina, danščina in angleščina.",
      ],
    },
    {
      heading: "Reševanje potrošniških sporov",
      paragraphs: [
        "Nismo niti pripravljeni niti dolžni sodelovati v postopku reševanja sporov pred potrošniškim arbitražnim organom.",
      ],
    },
    {
      heading: "Odgovornost za povezave",
      paragraphs: [
        "Kljub skrbnemu nadzoru vsebine ne prevzemamo nobene odgovornosti za vsebino zunanjih povezav. Za vsebino povezanih strani so izključno odgovorni njihovi upravljavci.",
      ],
    },
    {
      heading: "Avtorske pravice",
      paragraphs: [
        `Vsebine, besedila, grafike in znamke, objavljene na tem spletnem mestu, so zaščitene z avtorskimi in znamčnimi pravicami. Vsaka uporaba, ki presega z zakonom dovoljene primere, zahteva predhodno pisno soglasje družbe ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Drugi pravni dokumenti",
      paragraphs: [
        "Uporabo platforme urejajo naši splošni pogoji poslovanja. Način obdelave osebnih podatkov je opisan v politiki zasebnosti; uporabljeni piškotki so navedeni v politiki piškotkov.",
      ],
      links: [
        { label: "Splošni pogoji poslovanja", href: AGB_URL },
        { label: "Politika zasebnosti", href: "/datenschutz" },
        { label: "Politika piškotkov", href: "/cookie-richtlinie" },
        { label: "Pogodba o obdelavi podatkov (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Veljavno pravo",
      paragraphs: [
        `${ANBIETER.firma} ima sedež in je ustanovljena izključno na Danskem. Za to spletno ponudbo zato velja dansko pravo — tudi za slovensko jezikovno različico (načelo države izvora po členu 3 Direktive 2000/31/ES). Obveznosti obveščanja izhajajo iz § 7 danskega zakona o elektronskem poslovanju (e-handelslov).`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
