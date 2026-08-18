import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Pravne informacije",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    `Podatki o ponudniku tržnice myBestDays. Upravljavec je ${ANBIETER.firma}; myBestDays je blagovna znamka te družbe in ne samostojna pravna oseba.`,
    "Obvezni podatki po § 7 danskega zakona o elektronskem poslovanju, ki prenaša člen 5 Direktive 2000/31/ES, in po členih 11 in 12 Uredbe (EU) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Upravljavec Platforme",
      paragraphs: [
        `${ANBIETER.firma} — družba z omejeno odgovornostjo (anpartsselskab, ApS) po danskem pravu`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Danska`,
        `Zakonito zastopanje: ${ANBIETER.direktion.join(" in ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Kontakt",
      paragraphs: [
        `E-pošta: ${ANBIETER.email}`,
        `Telefon: ${ANBIETER.telefon}`,
        "V zadevah glede obstoječe rezervacije uporabite funkcijo sporočil v svojem računu — takrat imamo rezervacijo in zgodovino že na voljo; glej [Pritožbe in reševanje sporov](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Register in DDV",
      paragraphs: [
        `Št. CVR ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danska.`,
        ...(ANBIETER.ustId
          ? [`Identifikacijska številka za DDV: ${ANBIETER.ustId}.`]
          : [
              "Identifikacijska številka za DDV trenutno ne obstaja; § 7 zakona o elektronskem poslovanju zahteva njeno navedbo le ob obstoječi registraciji za DDV.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Kontaktne točke po Uredbi (EU) 2022/2065",
      paragraphs: [
        `Enotna kontaktna točka za organe po členu 11 in za uporabnike po členu 12: ${ANBIETER.email}, po pošti na zgoraj navedeni naslov.`,
        "Jeziki komunikacije so nemščina, danščina in angleščina.",
        "Postopki po tej uredbi — prijava protipravne vsebine, obrazložitev ukrepov, obravnava pritožb — so opisani v razdelku [Akt o digitalnih storitvah](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Pristojni organi",
      paragraphs: [
        `Koordinator digitalnih storitev po členu 49 Uredbe (EU) 2022/2065: ${DSA_KOORDINATOR.name}, Danska ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Nadzorni organ za varstvo podatkov: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danska, ${AUFSICHTSBEHOERDE.email}.`,
        "Posredovanje nastanitvenih storitev na Danskem ne zahteva posebnega dovoljenja; panožni nadzorni organ zato ne obstaja.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Reševanje potrošniških sporov",
      paragraphs: [
        "Platforma Evropske komisije za spletno reševanje sporov je bila razveljavljena z Uredbo (EU) 2024/3228 in je prenehala delovati.",
        "Nismo dolžni in nismo pripravljeni sodelovati v postopku reševanja sporov pred organom za izvensodno reševanje potrošniških sporov.",
        `Neodvisno od tega se lahko kot potrošnik obrnete na pristojni danski organ: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Danska ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Če prebivate v drugi državi članici, vam pomaga Evropski potrošniški center v vaši državi.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Opombe glede vsebine in povezav",
      paragraphs: [
        "Vsebina oglasov izhaja od posameznih ponudnikov. myBestDays si je ne prisvaja; glej razdelek A4 [Pogojev uporabe](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "Za vsebino povezanih strani tretjih oseb odgovarja njihov upravljavec. Takoj ko izvemo za kršitev prava, povezavo nemudoma odstranimo.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Avtorske pravice",
      paragraphs: [
        `Lastna vsebina, besedila, grafike in znamke, objavljene na tej Platformi, so zaščiteni z avtorskim in znamčnim pravom. Uporaba, ki presega zakonsko dovoljene primere, zahteva predhodno pisno soglasje družbe ${ANBIETER.firma}; za znamke veljajo [Pravila o znamkah](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Pravo, ki se uporablja",
      paragraphs: [
        `${ANBIETER.firma} ima sedež na Danskem in je ustanovljena izključno tam. Za to spletno ponudbo se zato uporablja dansko pravo — tudi za slovensko različico (načelo države izvora po členu 3 Direktive 2000/31/ES). Kogentni predpisi o varstvu potrošnikov države vašega prebivališča ostajajo nedotaknjeni.`,
      ],
    },
  ],
};
