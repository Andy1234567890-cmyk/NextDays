import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Oikeudelliset tiedot",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    `Tiedot myBestDays-markkinapaikan palveluntarjoajasta. Ylläpitäjä on ${ANBIETER.firma}; myBestDays on tämän yhtiön tavaramerkki eikä itsenäinen oikeushenkilö.`,
    "Pakolliset tiedot Tanskan verkkokauppalain 7 §:n mukaisesti, jolla pannaan täytäntöön direktiivin 2000/31/EY 5 artikla, sekä asetuksen (EU) 2022/2065 11 ja 12 artiklan mukaiset tiedot.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Alustan ylläpitäjä",
      paragraphs: [
        `${ANBIETER.firma} — Tanskan oikeuden mukainen rajavastuuyhtiö (anpartsselskab, ApS)`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Tanska`,
        `Edustamiseen oikeutettu johto: ${ANBIETER.direktion.join(" ja ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Yhteystiedot",
      paragraphs: [
        `Sähköposti: ${ANBIETER.email}`,
        `Puhelin: ${ANBIETER.telefon}`,
        "Voimassa olevaa varausta koskevissa asioissa käyttäkää tilinne viestitoimintoa — silloin varaus ja historia ovat jo tiedossamme; ks. [Valitukset ja riidanratkaisu](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Rekisteri ja arvonlisävero",
      paragraphs: [
        `CVR-nro ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Tanska.`,
        ...(ANBIETER.ustId
          ? [`Arvonlisäverotunniste: ${ANBIETER.ustId}.`]
          : [
              "Arvonlisäverotunnistetta ei tällä hetkellä ole; verkkokauppalain 7 § edellyttää sen ilmoittamista vain, jos arvonlisäverorekisteröinti on olemassa.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Asetuksen (EU) 2022/2065 mukaiset yhteyspisteet",
      paragraphs: [
        `Keskitetty yhteyspiste viranomaisille 11 artiklan mukaisesti ja käyttäjille 12 artiklan mukaisesti: ${ANBIETER.email}, postitse edellä mainittuun osoitteeseen.`,
        "Viestintäkielet ovat saksa, tanska ja englanti.",
        "Asetuksen mukaiset menettelyt — lainvastaisen sisällön ilmoittaminen, toimenpiteiden perustelu, valitusten käsittely — kuvataan kohdassa [Digipalvelusäädös](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Toimivaltaiset viranomaiset",
      paragraphs: [
        `Asetuksen (EU) 2022/2065 49 artiklan mukainen digitaalisten palvelujen koordinaattori: ${DSA_KOORDINATOR.name}, Tanska ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Tietosuojavalvontaviranomainen: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Tanska, ${AUFSICHTSBEHOERDE.email}.`,
        "Majoituspalvelujen välittäminen ei edellytä Tanskassa erityistä lupaa; toimialakohtaista valvontaviranomaista ei siksi ole.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Kuluttajariitojen ratkaisu",
      paragraphs: [
        "Euroopan komission verkkovälitteisen riidanratkaisun foorumi on kumottu asetuksella (EU) 2024/3228 ja lopettanut toimintansa.",
        "Emme ole velvollisia emmekä halukkaita osallistumaan kuluttajariitoja käsittelevän elimen riidanratkaisumenettelyyn.",
        `Tästä riippumatta voitte kuluttajana kääntyä toimivaltaisen tanskalaisen elimen puoleen: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Tanska ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Jos asutte toisessa jäsenvaltiossa, maanne Euroopan kuluttajakeskus auttaa eteenpäin.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Huomautuksia sisällöstä ja linkeistä",
      paragraphs: [
        "Ilmoitusten sisältö on peräisin kyseisiltä palveluntarjoajilta. myBestDays ei omaksu sitä omakseen; ks. [Käyttöehtojen](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform) kohta A4.",
        "Linkitettyjen kolmansien sivustojen sisällöstä vastaa niiden ylläpitäjä. Saatuamme tiedon oikeudenloukkauksesta poistamme linkin viipymättä.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Tekijänoikeus",
      paragraphs: [
        `Tällä alustalla julkaistut omat sisällöt, tekstit, grafiikat ja tavaramerkit ovat tekijänoikeudella ja tavaramerkkioikeudella suojattuja. Käyttö lain sallimien tapausten ulkopuolella edellyttää yhtiön ${ANBIETER.firma} ennakolta antamaa kirjallista suostumusta; tavaramerkkeihin sovelletaan [Tavaramerkkiohjeita](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Sovellettava laki",
      paragraphs: [
        `${ANBIETER.firma} on kotipaikaltaan Tanskassa ja sijoittautunut yksinomaan sinne. Tähän verkkotarjontaan sovelletaan siksi Tanskan lakia — myös suomenkieliseen versioon (alkuperämaaperiaate direktiivin 2000/31/EY 3 artiklan mukaisesti). Asuinvaltionne pakottavat kuluttajansuojasäännökset eivät rajoitu.`,
      ],
    },
  ],
};
