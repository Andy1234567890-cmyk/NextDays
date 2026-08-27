// Litauische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Slapukų politika",
  metaDescription:
    "Kokius slapukus naudoja „myNextDays“: techniškai būtinus slapukus ir – tik su jūsų sutikimu – funkcinius, analizės ir rinkodaros slapukus. Kiekviena kategorija gali būti įjungiama ir išjungiama atskirai.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Ši politika paaiškina, kokius slapukus ir panašias saugojimo technologijas ${ANBIETER.firma} naudoja šioje svetainėje ir myNextDays platformoje.`,
    "Trumpai tariant: būtini yra tik tie slapukai, be kurių svetainė neveiktų taip, kaip reikalaujama. Visiems kitiems reikalingas jūsų sutikimas ir be jo jie neįkeliami – mūsų kontaktinės formos apsauga nuo brukalų, pasiekiamumo matavimas ir rinkodaros slapukai, kuriais matuojame savo reklamos sėkmę. Kiekvienai iš šių kategorijų galite leisti arba atmesti atskirai ir bet kada atšaukti savo sprendimą.",
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
        "Turite sutikti su trimis kategorijomis, kurios visos nebus įkeltos be jūsų leidimo: mūsų kontaktinės formos apsauga nuo brukalų („Google reCAPTCHA“), šios svetainės pasiekiamumo matavimas („Google Analytics 4“) ir rinkodaros slapukai („Meta“, „LinkedIn“, „Google Ads“). Tam pasirodo langas su kategorijų sąrašu – pirmojo apsilankymo metu, be išankstinio pasirinkimo, kiekviena kategorija su atskiru jungikliu. Kol neapsisprendėte, galioja „neleidžiama“, ir nebus atliekamas nei vertinimas, nei reklama.",
        "Jūsų sprendimas saugomas jūsų naršyklės atmintyje (Local Storage, reikšmė „nd_consent“); jame nurodoma tik kategorija, laikas ir versijos numeris, jokio jūsų asmens identifikatoriaus. Per slapukų piktogramą kiekvieno puslapio kairiajame apatiniame kampe galite jį bet kada pakeisti arba atšaukti. Po šešių mėnesių paklausime dar kartą — sutikimas neturi galioti neribotai.",
      ],
    },
    {
      heading: "Ši svetainė",
      paragraphs: [
        "Pati ši svetainė nenaudoja jokių slapukų. Šriftai ir simboliai yra mūsų pačių serveryje – tam nenaudojama jokia trečiosios šalies simbolių ar šriftų paslauga. Pridedamos tik tos paslaugos, kurioms leidžiate: kontaktinės formos apsauga nuo brukalų, pasiekiamumo matavimas ir rinkodaros paslaugos. Kokius slapukus, kokiam laikotarpiui ir kokiame serveryje jie nustatomi, rasite žemiau, skiltyje „Trečiųjų šalių slapukai“. Atšaukti galite per slapukų piktogramą apatiniame kairiajame kampe – atitinkama paslauga iškart nutraukiama ir jos slapukai ištrinami. Išsamesnė informacija pateikiama [privatumo politikoje](/datenschutz).",
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
          titel:
            "sb-… — Prisijungimas su Google (techniškai būtinas, tik naudojant)",
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
            "Išsaugo jūsų sprendimą dėl paslaugų, kurioms reikalingas sutikimas (kontaktinės formos apsauga nuo brukalų ir pasiekiamumo matavimas).",
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
        "Tik su jūsų sutikimu „Google“ paslaugos šioje svetainėje naudoja šiuos slapukus – du, skirtus auditorijos matavimui, ir vieną, skirtą apsaugai nuo brukalų. Be jūsų sutikimo atitinkamas scenarijus nebus įkeltas ir jokie slapukai nebus nustatyti; atšaukus sutikimą, juos ištrinsime.",
      ],
      unterpunkte: [
        {
          titel: "_fbp – reklamos efektyvumo matavimas (reikalingas sutikimas)",
          list: [
            "Tikslas: susieja jūsų apsilankymą su reklama, kad galėtume įvertinti kampanijų sėkmę.",
            "Turinys: atsitiktinai sugeneruotas identifikatorius; jokių vardų, el. pašto ar paskyros duomenų iš mūsų.",
            "Teikėjas: „Meta Platforms Ireland Limited“, Merrion Road, Dublin 4, Airija.",
            "Serveris: mynextdays.com (pirminis slapukas, nustatytas „Meta“ scenarijaus). Galiojimo laikas: apie trys mėnesiai.",
          ],
        },
        {
          titel:
            "_gcl_au – „Google Ads“ efektyvumo matavimas (reikalingas sutikimas)",
          list: [
            "Tikslas: susieja jūsų apsilankymą su „Google“ skelbimu, kad galėtume įvertinti kampanijų sėkmę.",
            "Turinys: atsitiktinai sugeneruotas identifikatorius, nesusijęs su jūsų asmeniu.",
            "Teikėjas: „Google Ireland Limited“, Gordon House, Barrow Street, Dublin 4, Airija.",
            "Serveris: mynextdays.com (pirminis slapukas). Galiojimo laikas: apie trys mėnesiai.",
          ],
        },
        {
          titel:
            "li_gc ir bcookie – „LinkedIn“ reklama (reikalingas sutikimas)",
          list: [
            "Tikslas: identifikuoja jūsų naršyklę „LinkedIn“ atžvilgiu, kad būtų galima susieti skelbimus ir jų sėkmę; li_gc papildomai išsaugo jūsų sutikimą.",
            "Turinys: naršyklės identifikatorius ir sutikimo būsena; jokių duomenų iš jūsų paskyros pas mus.",
            "Teikėjas: „LinkedIn Ireland Unlimited Company“, Wilton Plaza, Dublin 2, Airija.",
            "Serveris: linkedin.com (trečiųjų šalių slapukai). Galiojimo laikas: apie šešis mėnesius arba vienerius metus.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA – kontaktų formos apsauga nuo brukalų (reikalingas sutikimas)",
          list: [
            "Priegloba: www.google.com (trečiosios šalies slapukas).",
            "Tikslas: leidžia „Google“ įvertinti riziką, kuri atskiria automatizuotus masinius pranešimus nuo tikrų užklausų.",
            "Turinys: „Google“ sugeneruotas identifikatorius šiam įvertinimui; jokių mūsų vardo, el. pašto ar paskyros duomenų.",
            "Teikėjas: „Google Ireland Limited“, Gordon House, Barrow Street, Dublin 4, Airija.",
            "Galiojimo laikas: nustato „Google“, iki šešių mėnesių. Jis nustatomas tik tada, kai leidžiate apsaugą nuo brukalų ir atidarote kontaktų formą.",
          ],
        },
        {
          titel: "_ga – Pasiekiamumo matavimas (reikalingas sutikimas)",
          list: [
            "Priegloba: mynextdays.com (pirminis slapukas, nustatytas Google scenarijaus).",
            "Tikslas: atskiria lankytojus, kad pasikartojantys apsilankymai nebūtų skaičiuojami du kartus.",
            "Turinys: atsitiktinai sugeneruotas identifikatorius, nesusijęs su jūsų asmeniu; jokių vardo, el. pašto ar paskyros duomenų.",
            "Teikėjas: „Google Ireland Limited“, Gordon House, Barrow Street, Dublin 4, Airija.",
            "Galiojimo laikas: iki dvejų metų.",
          ],
        },
        {
          titel: "_ga_<ID> – Matavimo sesijos būsena (reikalingas sutikimas)",
          list: [
            "Priegloba: mynextdays.com (pirminis slapukas, nustatytas Google scenarijaus).",
            "Tikslas: fiksuoja, kada prasidėjo jūsų dabartinis apsilankymas, kad sesijos puslapio peržiūros būtų susijusios.",
            "Turinys: laiko žyma ir sesijos skaitiklis; ID pavadinime nurodo mūsų nuosavybę, o ne jus.",
            "Teikėjas: „Google Ireland Limited“.",
            "Galiojimo laikas: iki dvejų metų.",
          ],
        },
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
