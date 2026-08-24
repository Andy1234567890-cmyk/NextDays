// Eestikeelne tõlge õigusteabest. Lähtedokument on ./de.ts — sisulised
// muudatused tehakse ESMALT sinna, alles seejärel siia.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Juriidiline teave",
  metaDescription:
    "Teenusepakkuja myNextDays ApS andmed vastavalt Taani e-kaubanduse seaduse (e-handelslov) §-le 7: ettevõte, aadress, juhatus, CVR-number ja kontakt.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Andmed platvormi myNextDays teenusepakkuja kohta — property management system ja channel manager, mida haldab ${ANBIETER.firma}.`,
    "Kohustuslik teave vastavalt Taani e-kaubanduse seaduse (e-handelslov) §-le 7, millega võetakse üle e-kaubandust käsitleva direktiivi 2000/31/EÜ artikkel 5.",
  ],
  sections: [
    {
      heading: "Teenusepakkuja",
      zeilen: [
        {
          label: "Ettevõte",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Aadress",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Esindusõiguslik juhatus",
          werte: [`${ANBIETER.direktion.join(" ja ")} (direktører)`],
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
          label: "Veebileht",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Äriregister ja käibemaks",
      zeilen: [
        {
          label: "Äriregister",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Taani",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Käibemaksukohustuslase number",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Kontaktpunkt digiteenuste õigusakti alusel",
      paragraphs: [
        `Kesksed kontaktpunktid ametiasutustele vastavalt artiklile 11 ja kasutajatele vastavalt artiklile 12 määruse (EL) 2022/2065 (Digital Services Act) alusel: ${ANBIETER.email}.`,
        "Suhtluskeelteks on saksa, taani ja inglise keel.",
      ],
    },
    {
      heading: "Tarbijavaidluste lahendamine",
      paragraphs: [
        "Me ei ole valmis ega kohustatud osalema vaidluste lahendamise menetluses tarbijavaidluste komisjonis.",
      ],
    },
    {
      heading: "Vastutus linkide eest",
      paragraphs: [
        "Vaatamata hoolikale sisukontrollile ei vastuta me väliste linkide sisu eest. Lingitud lehekülgede sisu eest vastutavad ainuisikuliselt nende vastavad haldajad.",
      ],
    },
    {
      heading: "Autoriõigus",
      paragraphs: [
        `Sellel veebilehel avaldatud sisu, tekstid, graafika ja kaubamärgid on kaitstud autoriõiguse ja kaubamärgiõigusega. Igasugune kasutamine, mis ületab seaduses lubatud juhtusid, nõuab ${ANBIETER.firma} eelnevat kirjalikku nõusolekut.`,
      ],
    },
    {
      heading: "Muud õigusdokumendid",
      paragraphs: [
        "Platvormi kasutamist reguleerivad meie üldtingimused. Isikuandmete töötlemise viis on kirjeldatud privaatsuspoliitikas; kasutatavad küpsised on loetletud küpsiste poliitikas.",
      ],
      links: [
        { label: "Üldtingimused", href: AGB_URL },
        { label: "Privaatsuspoliitika", href: "/datenschutz" },
        { label: "Küpsiste poliitika", href: "/cookie-richtlinie" },
        { label: "Andmetöötlusleping (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Kohaldatav õigus",
      paragraphs: [
        `${ANBIETER.firma} asukoht on Taanis ja ta on asutatud ainult seal. Seetõttu kohaldatakse sellele veebipõhisele pakkumisele Taani õigust — ka eestikeelse versiooni suhtes (päritoluriigi põhimõte vastavalt direktiivi 2000/31/EÜ artiklile 3). Teavitamiskohustused tulenevad Taani e-kaubanduse seaduse (e-handelslov) §-st 7.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
