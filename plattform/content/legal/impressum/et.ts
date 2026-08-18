import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Õiguslik teave",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    `Turuplatsi myBestDays teenusepakkuja andmed. Käitaja on ${ANBIETER.firma}; myBestDays on selle äriühingu kaubamärk, mitte iseseisev juriidiline isik.`,
    "Kohustuslikud andmed Taani e-kaubanduse seaduse § 7 kohaselt, millega on üle võetud direktiivi 2000/31/EÜ artikkel 5, ning määruse (EL) 2022/2065 artiklite 11 ja 12 kohaselt.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Platvormi käitaja",
      paragraphs: [
        `${ANBIETER.firma} – Taani õiguse järgi asutatud osaühing (anpartsselskab, ApS)`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Taani`,
        `Seaduslik esindus: ${ANBIETER.direktion.join(" ja ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Kontakt",
      paragraphs: [
        `E-post: ${ANBIETER.email}`,
        `Telefon: ${ANBIETER.telefon}`,
        "Olemasolevat broneeringut puudutavates küsimustes kasutage oma kontol olevat sõnumifunktsiooni – siis on broneering ja ajalugu meil juba olemas; vt [Kaebused ja vaidluste lahendamine](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Register ja käibemaks",
      paragraphs: [
        `CVR nr ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Taani.`,
        ...(ANBIETER.ustId
          ? [`Käibemaksukohustuslasena registreerimise number: ${ANBIETER.ustId}.`]
          : [
              "Käibemaksukohustuslasena registreerimise numbrit praegu ei ole; e-kaubanduse seaduse § 7 nõuab selle esitamist üksnes olemasoleva käibemaksukohustuslasena registreerimise korral.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Kontaktpunktid määruse (EL) 2022/2065 kohaselt",
      paragraphs: [
        `Ühtne kontaktpunkt ametiasutustele artikli 11 kohaselt ja kasutajatele artikli 12 kohaselt: ${ANBIETER.email}, posti teel ülalnimetatud aadressil.`,
        "Suhtluskeeled on saksa, taani ja inglise keel.",
        "Kõnealuse määruse kohased menetlused – õigusvastasest sisust teatamine, meetmete põhjendamine, kaebuste menetlemine – on kirjeldatud jaotises [Digiteenuste õigusakt](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Pädevad asutused",
      paragraphs: [
        `Digiteenuste koordinaator määruse (EL) 2022/2065 artikli 49 kohaselt: ${DSA_KOORDINATOR.name}, Taani ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Andmekaitse järelevalveasutus: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Taani, ${AUFSICHTSBEHOERDE.email}.`,
        "Majutusteenuste vahendamiseks ei ole Taanis vaja eriluba; valdkondlikku järelevalveasutust seetõttu ei ole.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Tarbijavaidluste lahendamine",
      paragraphs: [
        "Euroopa Komisjoni veebipõhine vaidluste lahendamise platvorm tunnistati kehtetuks määrusega (EL) 2024/3228 ja lõpetas tegevuse.",
        "Me ei ole kohustatud ega valmis osalema vaidluste lahendamise menetluses tarbijavaidluste kohtuvälise lahendamise organis.",
        `Sellest sõltumatult võite tarbijana pöörduda pädeva Taani organi poole: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Taani ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Kui elate teises liikmesriigis, aitab Teid Teie riigi Euroopa tarbijakeskus.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Märkused sisu ja linkide kohta",
      paragraphs: [
        "Kuulutuste sisu pärineb vastavatelt pakkujatelt. myBestDays ei omanda seda; vt [Kasutustingimuste](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform) punkti A4.",
        "Lingitud kolmandate isikute lehtede sisu eest vastutab nende käitaja. Saades teada õigusrikkumisest, eemaldame lingi viivitamata.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Autoriõigus",
      paragraphs: [
        `Sellel Platvormil avaldatud oma sisu, tekstid, graafika ja kaubamärgid on kaitstud autori- ja kaubamärgiõigusega. Kasutamine väljaspool seaduses lubatud juhtumeid nõuab ${ANBIETER.firma} eelnevat kirjalikku nõusolekut; kaubamärkidele kohalduvad [Kaubamärgireeglid](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Kohaldatav õigus",
      paragraphs: [
        `${ANBIETER.firma} asukoht on Taanis ja ta on asutatud üksnes seal. Käesolevale veebipakkumisele kohaldatakse seetõttu Taani õigust – ka eestikeelsele versioonile (päritoluriigi põhimõte direktiivi 2000/31/EÜ artikli 3 kohaselt). Teie elukohariigi imperatiivsed tarbijakaitsesätted jäävad puutumata.`,
      ],
    },
  ],
};
