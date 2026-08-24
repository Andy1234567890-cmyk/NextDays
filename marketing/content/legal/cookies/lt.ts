// Litauische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Slapukų politika",
  metaDescription:
    "Kokius slapukus naudoja myNextDays: tik techniškai būtinus ir funkcinius slapukus, jokių stebėjimo ar reklaminių slapukų.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Ši politika paaiškina, kokius slapukus ir panašias saugojimo technologijas ${ANBIETER.firma} naudoja šioje svetainėje ir myNextDays platformoje.`,
    "Trumpai: naudojame tik techniškai būtinus ir funkcinius slapukus. Nėra jokių analitinių, reklaminių ar stebėjimo slapukų, o naudojimo duomenys neperduodami reklamos tinklams.",
  ],
  sections: [
    {
      heading: "Kas yra slapukai",
      paragraphs: [
        "Slapukai — tai maži tekstiniai failai, kuriuos svetainė išsaugo naršyklėje. Jie leidžia atpažinti sesiją — pavyzdžiui, kad prisijungus liktumėte prisijungę. Be slapukų, naršyklės naudoja ir kitas saugyklas, pvz., Local Storage, kurios veikia technologiškai panašiai.",
      ],
    },
    {
      heading: "Kam reikalingas jūsų sutikimas",
      paragraphs: [
        "Sutikimas pagal Danijos slapukų reglamento (Cookie-bekendtgørelsen) 9 straipsnį (kuriuo įgyvendinama Direktyvos 2002/58/EB 5 straipsnio 3 dalis) reikalingas tik tuomet, kai prieiga prie jūsų įrenginio nėra skirta išimtinai pranešimo perdavimui arba nėra būtinai reikalinga jūsų aiškiai užsakytai paslaugai teikti.",
        "Visi mūsų naudojami slapukai yra būtini prisijungimui, sesijos saugumui arba jūsų pačių pasirinktam nustatymui — dėl to mes nieko neklausiame ir taip pat nenustatome nieko, kam reikėtų sutikimo.",
        "Sutikimą turite duoti tik dėl vieno dalyko: mūsų kontaktų formos apsaugos nuo šlamšto. Ją teikia Google (reCAPTCHA Enterprise), t. y. tai išorinė paslauga, ir ji įkeliama tik tuomet, jei tai leidote. Dėl to pirmojo apsilankymo metu ekrano apačioje rodoma juosta su lygiaverčiais mygtukais „Atmesti“ ir „Sutikti“, be jokio išankstinio pasirinkimo. Kol nenusprendėte, galioja „neleista“.",
        "Jūsų sprendimas saugomas jūsų naršyklės atmintyje (Local Storage, reikšmė „nd_consent“); jame nurodoma tik kategorija, laikas ir versijos numeris, jokio jūsų asmens identifikatoriaus. Per slapukų piktogramą kiekvieno puslapio kairiajame apatiniame kampe galite jį bet kada pakeisti arba atšaukti. Po šešių mėnesių paklausime dar kartą — sutikimas neturi galioti neribotai.",
      ],
    },
    {
      heading: "Ši svetainė",
      paragraphs: [
        "Rinkodaros svetainė slapukų nenustato. Šriftai ir piktogramos saugomi mūsų pačių serveryje — tam nesikreipiama į jokią trečiosios šalies šriftų ar piktogramų paslaugą. Vienintelė šios svetainės išorinė paslauga yra kontaktų formos apsauga nuo šlamšto, kuri įkeliama tik gavus jūsų sutikimą. Išsamiau žr. [Privatumo politikoje](/datenschutz).",
      ],
    },
    {
      heading: "Platformos slapukai",
      paragraphs: [
        "Prisijungę prie valdymo skydelio, prekyvietės arba mobiliosios versijos, nustatomi šie slapukai:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Prisijungimas (techniškai būtinas)",
          list: [
            "Paskirtis: identifikuoja jūsų prisijungusią sesiją serveriui.",
            "Turinys: trumpalaikis prieigos raktas (token); jį gali skaityti tik serveris (HttpOnly), perduodamas tik per HTTPS.",
            "Galiojimas: sesijos trukmė arba rakto galiojimo pabaiga.",
          ],
        },
        {
          titel: "nd_refresh — Sesijos pratęsimas (techniškai būtinas)",
          list: [
            "Paskirtis: atnaujina prieigos raktą, kad jums nereikėtų nuolat prisijungti iš naujo.",
            "Turinys: atnaujinimo raktas; HttpOnly, tik per HTTPS.",
            "Galiojimas: iki atsijungimo arba galiojimo pabaigos.",
          ],
        },
        {
          titel: "nd_locale — Kalbos pasirinkimas (funkcinis)",
          list: [
            "Paskirtis: įsimena jūsų pasirinktą kalbą.",
            "Turinys: kalbos kodas, pvz., „de“ arba „en“.",
            "Galiojimas: iki pakeitimo arba ištrynimo.",
          ],
        },
        {
          titel: "sidebar_state — Šoninė juosta (funkcinis)",
          list: [
            "Paskirtis: įsimena, ar naršymo juosta išskleista, ar suskleista.",
            "Turinys: „true“ arba „false“.",
            "Galiojimas: iki pakeitimo arba ištrynimo.",
          ],
        },
        {
          titel: "sb-… — Prisijungimas su Google (techniškai būtinas, tik naudojant)",
          list: [
            "Paskirtis: palaiko sesiją, kai prisijungiate per Google.",
            "Turinys: prisijungimo paslaugos sesijos raktas.",
            "Galiojimas: sesijos trukmė arba rakto galiojimo pabaiga. Nustatomas tik pasirinkus prisijungimą per Google.",
          ],
        },
      ],
    },
    {
      heading: "Local Storage",
      unterpunkte: [
        {
          titel: "nd_consent",
          paragraphs: [
            "Saugo jūsų sprendimą dėl kontaktų formos apsaugos nuo šlamšto, kad sutikimo juosta neklaustų iš naujo kaskart apsilankius. Saugoma tik kategorija, laikas ir versijos numeris. Reikšmė nepalieka jūsų įrenginio ir neperduodama į mūsų serverį; ji galioja šiai naršyklei. Galiojimo laikas: šeši mėnesiai — po to juosta paklaus dar kartą. Ištrynus reikšmę, juosta vėl paklaus kito apsilankymo metu.",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Nustatomas tik tuomet, kai patys atidarote pokalbį šioje svetainėje ir išsiunčiate žinutę. Tai jūsų pačių pokalbio raktas — be jo pakeitus puslapį nerastumėte mūsų atsakymo. Jame nėra jokios informacijos apie jus ir jis naudojamas tik šiam tikslui.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Naršyklėje saugo informaciją, ar sutikote su balso įvesties naudojimu, kad sutikimo nebūtų klausiama iš naujo kaskart apsilankius. Reikšmė nepalieka jūsų įrenginio.",
          ],
        },
      ],
    },
    {
      heading: "Mobiliosios programėlės slapukai",
      paragraphs: [
        "Mobilioji programėlė slapukų nenaudoja. Prieigos ir atnaujinimo raktai saugomi saugioje įrenginio raktų saugykloje (iOS Keychain, Android Keystore) ir ištrinami atsijungus.",
      ],
    },
    {
      heading: "Trečiųjų šalių slapukai",
      paragraphs: [
        "Jei atliekate mokėjimą, mokėjimo paslaugų teikėjas (Stripe arba PayPal) savo svetainėje gali nustatyti slapukus, būtinus atsiskaitymui ir apsaugai nuo sukčiavimo. Tokiu atveju taikomos atitinkamo teikėjo nuostatos.",
        "Svetainėse, kurias įmonės sukuria naudodamos mūsų svetainių kūrimo įrankį, dėl papildomų slapukų sprendžia atitinkama įmonė ir ji atsako už ten pateikiamą informaciją.",
      ],
    },
    {
      heading: "Slapukų šalinimas ir valdymas",
      paragraphs: [
        "Slapukus galite bet kada ištrinti arba blokuoti savo naršyklės nustatymuose. Blokavus būtinuosius slapukus, prisijungti prie platformos techniškai neįmanoma — viešoji svetainė ir prekyvietė lieka naudojamos be prisijungimo.",
        "Atsijungus, prisijungimo slapukus pašaliname patys.",
      ],
    },
    {
      heading: "Šios politikos pakeitimai",
      paragraphs: [
        "Atsiradus funkcijoms, kurioms reikia papildomų slapukų, atnaujiname šį sąrašą. Visada galioja čia paskelbta versija; data viršuje rodo atnaujinimo datą.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
