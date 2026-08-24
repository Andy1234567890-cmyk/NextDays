// Lietuviškas teisinės informacijos vertimas. Pagrindinė versija yra
// ./de.ts — turinio pakeitimai pirmiausia daromi ten, tik po to čia.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Teisinė informacija",
  metaDescription:
    "Paslaugų teikėjo myNextDays ApS duomenys pagal Danijos elektroninės prekybos įstatymo (e-handelslov) 7 §: įmonė, adresas, vadovybė, CVR numeris ir kontaktai.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Duomenys apie platformos myNextDays paslaugų teikėją — property management system ir channel manager, kurį valdo ${ANBIETER.firma}.`,
    "Privaloma informacija pagal Danijos elektroninės prekybos įstatymo (e-handelslov) 7 §, kuriuo perkeliamas Direktyvos 2000/31/EB dėl elektroninės prekybos 5 straipsnis.",
  ],
  sections: [
    {
      heading: "Paslaugų teikėjas",
      zeilen: [
        {
          label: "Įmonė",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Adresas",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Atstovauti įgaliota vadovybė",
          werte: [`${ANBIETER.direktion.join(" ir ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Kontaktai",
      zeilen: [
        {
          label: "El. paštas",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefonas",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Interneto svetainė",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Įmonių registras ir PVM",
      zeilen: [
        {
          label: "Įmonių registras",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danija",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "PVM mokėtojo kodas",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Kontaktinis punktas pagal Skaitmeninių paslaugų aktą",
      paragraphs: [
        `Centrinis kontaktinis punktas institucijoms pagal 11 straipsnį ir naudotojams pagal 12 straipsnį, numatytas Reglamente (ES) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Bendravimo kalbos yra vokiečių, danų ir anglų.",
      ],
    },
    {
      heading: "Vartotojų ginčų sprendimas",
      paragraphs: [
        "Mes nesame nei pasirengę, nei įpareigoti dalyvauti ginčų sprendimo procedūroje vartotojų arbitražo institucijoje.",
      ],
    },
    {
      heading: "Atsakomybė už nuorodas",
      paragraphs: [
        "Nepaisant atidžios turinio kontrolės, mes neprisiimame atsakomybės už išorinių nuorodų turinį. Už susietų puslapių turinį atsako išimtinai atitinkami jų valdytojai.",
      ],
    },
    {
      heading: "Autorių teisės",
      paragraphs: [
        `Šioje svetainėje skelbiamas turinys, tekstai, grafika ir prekių ženklai yra saugomi autorių teisių ir prekių ženklų teisės. Bet koks naudojimas, viršijantis įstatymo leidžiamus atvejus, reikalauja išankstinio rašytinio ${ANBIETER.firma} sutikimo.`,
      ],
    },
    {
      heading: "Kiti teisiniai dokumentai",
      paragraphs: [
        "Platformos naudojimą reglamentuoja mūsų Bendrosios sutarties sąlygos. Kaip mes tvarkome asmens duomenis, aprašyta Privatumo politikoje; naudojami slapukai išvardyti Slapukų politikoje.",
      ],
      links: [
        { label: "Bendrosios sutarties sąlygos", href: AGB_URL },
        { label: "Privatumo politika", href: "/datenschutz" },
        { label: "Slapukų politika", href: "/cookie-richtlinie" },
        { label: "Duomenų tvarkymo sutartis (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Taikytina teisė",
      paragraphs: [
        `${ANBIETER.firma} buveinė yra ir ji yra įsteigta išimtinai Danijoje. Todėl šiam internetiniam pasiūlymui taikoma Danijos teisė — taip pat ir lietuviškai versijai (kilmės šalies principas pagal Direktyvos 2000/31/EB 3 straipsnį). Informavimo pareigos kyla iš Danijos elektroninės prekybos įstatymo (e-handelslov) 7 §.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
