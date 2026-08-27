// Estnische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Küpsiste poliitika",
  metaDescription:
    "Milliseid küpsiseid myNextDays kasutab: tehniliselt vajalikud küpsised ja – ainult teie nõusolekul – funktsionaalsed, analüütilised ja turundusküpsised. Iga kategooria on eraldi sisse- ja väljalülitatav.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Käesolev poliitika selgitab, milliseid küpsiseid ja sarnaseid salvestustehnikaid ${ANBIETER.firma} kasutab sellel veebilehel ja platvormil myNextDays.`,
    "Lühidalt: Vajalikud on ainult need küpsised, ilma milleta veebisait ei tööta nõuetekohaselt. Kõik muu vajab teie nõusolekut ja ilma selleta ei laadita – meie kontaktivormi rämpspostikaitse, leviala mõõtmine ja turundusküpsised, millega mõõdame oma reklaami edukust. Saate iga kategooria eraldi lubada või keelata ja oma otsuse igal ajal tühistada.",
  ],
  sections: [
    {
      heading: "Mis on küpsised",
      paragraphs: [
        "Küpsised on väikesed tekstifailid, mida veebileht salvestab brauserisse. Need võimaldavad sessiooni ära tunda — näiteks selleks, et te jääksite pärast sisselogimist sisselogituks. Lisaks küpsistele kasutavad brauserid muid salvestusi, näiteks Local Storage't, mis toimivad tehniliselt sarnaselt.",
      ],
    },
    {
      heading: "Milleks me teie nõusolekut vajame",
      paragraphs: [
        "Nõusolek on vajalik Taani küpsiste määruse (Cookie-bekendtgørelsen) § 9 kohaselt (direktiivi 2002/58/EÜ artikli 5 lõike 3 ülevõtmine) ainult siis, kui juurdepääs teie seadmele ei teeni üksnes sõnumi edastamist või ei ole hädavajalik teie enda selgesõnaliselt taotletud teenuse jaoks.",
        "Kõik küpsised, mida me kasutame, on vajalikud sisselogimiseks, sessiooni turvalisuseks või teie enda tehtud seadistuse jaoks — selleks me midagi ei küsi ega sea vastupidi ka midagi, mis vajaks nõusolekut.",
        "Te peate nõustuma kolme kategooriaga, mida ilma teie loata ei laadita: meie kontaktivormi rämpspostikaitse (Google'i reCAPTCHA), selle veebisaidi leviala mõõtmine (Google Analytics 4) ja turundusküpsised (Meta, LinkedIn, Google Ads). Selleks küsib aken kategooriate loendiga – esimesel külastusel, ilma eelvalikuta, iga kategooria oma lülitiga. Kuni te pole otsustanud, kehtib „pole lubatud“ ja midagi ei hinnata ega reklaamita.",
        "Teie otsus asub teie brauseri salvestuses (Local Storage, väärtus „nd_consent“); see sisaldab ainult kategooriat, ajahetke ja versiooninumbrit, mitte teie isikut tuvastavat teavet. Iga lehe vasakus alanurgas oleva küpsiseikooni kaudu saate seda igal ajal muuta või tagasi võtta. Kuue kuu pärast küsime uuesti — nõusolek ei peaks kehtima piiramatult.",
      ],
    },
    {
      heading: "See veebileht",
      paragraphs: [
        "See veebisait ise küpsiseid ei kasuta. Fondid ja sümbolid asuvad meie enda serveris – selleks ei kutsuta ühtegi kolmanda osapoole sümboli- või fonditeenust. Lisaks on ainult need teenused, mida te lubate: kontaktivormi rämpspostikaitse, leviala mõõtmine ja turundusteenused. Milliseid küpsiseid seejuures kasutatakse, millise kehtivusajaga ja millisel hostil, on kirjas allpool jaotises „Kolmandate osapoolte küpsised“. Tühistamine vasakus allnurgas oleva küpsiseikooni kaudu – vastav teenus lõpeb koheselt ja selle küpsised kustutatakse. Üksikasjad on kirjas [Andmekaitseavalduses](/datenschutz).",
      ],
    },
    {
      heading: "Platvormi küpsised",
      paragraphs: [
        "Niipea kui logite sisse töölauale, turuplatsile või mobiilivaatesse, seatakse järgmised küpsised:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — sisselogimine (tehniliselt vajalik)",
          list: [
            "Eesmärk: tuvastab teie sisselogitud sessiooni serveri jaoks.",
            "Sisu: lühiajaline juurdepääsuluba; loetav ainult serverile (HttpOnly), edastatakse ainult HTTPS-i kaudu.",
            "Kehtivusaeg: sessioon või loa aegumine.",
          ],
        },
        {
          titel: "nd_refresh — sessiooni pikendamine (tehniliselt vajalik)",
          list: [
            "Eesmärk: uuendab juurdepääsuluba, et te ei peaks pidevalt uuesti sisse logima.",
            "Sisu: uuendusluba; HttpOnly, ainult HTTPS-i kaudu.",
            "Kehtivusaeg: kuni väljalogimiseni või aegumiseni.",
          ],
        },
        {
          titel: "nd_locale — keelevalik (funktsionaalne)",
          list: [
            "Eesmärk: jätab meelde teie valitud keele.",
            "Sisu: keelekood, nt „de“ või „en“.",
            "Kehtivusaeg: kuni muutmiseni või kustutamiseni.",
          ],
        },
        {
          titel: "sidebar_state — külgriba (funktsionaalne)",
          list: [
            "Eesmärk: jätab meelde, kas navigeerimisriba on avatud või kokku pandud.",
            "Sisu: „true“ või „false“.",
            "Kehtivusaeg: kuni muutmiseni või kustutamiseni.",
          ],
        },
        {
          titel:
            "sb-… — sisselogimine Google'iga (tehniliselt vajalik, ainult kasutamisel)",
          list: [
            "Eesmärk: hoiab sessiooni, kui logite sisse Google'i kaudu.",
            "Sisu: sisselogimisteenuse sessiooniluba.",
            "Kehtivusaeg: sessioon või loa aegumine. Seatakse ainult siis, kui valite Google'iga sisselogimise.",
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
            "Salvestab teie otsuse nõusolekut vajavate teenuste kohta (kontaktivormi rämpsposti kaitse ja ulatuse mõõtmine).",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Seatakse ainult siis, kui avate ise selle veebilehe vestluse ja saadate sõnumi. See on võti teie enda vestlusele — ilma selleta ei leiaks te pärast lehe vahetamist meie vastust üles. See ei sisalda teie kohta mingit teavet ja seda kasutatakse ainult selleks eesmärgiks.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Salvestab brauserisse, kas olete nõustunud häälsisestuse kasutamisega, et nõusolekut ei küsitaks iga külastuse korral uuesti. Väärtus ei lahku teie seadmest.",
          ],
        },
      ],
    },
    {
      heading: "Mobiilirakenduse küpsised",
      paragraphs: [
        "Mobiilirakendus ei kasuta küpsiseid. Juurdepääsu- ja uuendusload hoitakse seadme turvalises võtmehoidlas (iOS Keychain, Android Keystore) ning kustutatakse väljalogimisel.",
      ],
    },
    {
      heading: "Kolmandate osapoolte küpsised",
      paragraphs: [
        "Kui teete makse, võib makseteenuse pakkuja (Stripe või PayPal) seada oma lehel küpsiseid, mis on vajalikud tehingu läbiviimiseks ja pettuste ennetamiseks. Selle kohta kehtivad vastava pakkuja tingimused.",
        "Veebilehtedel, mida ettevõtted loovad meie ehitajaga, otsustab vastav ettevõte täiendavate küpsiste üle ja vastutab seal esitatud teabe eest.",
        "Ainult teie nõusolekul kasutavad Google'i teenused sellel veebisaidil järgmisi küpsiseid – kaks küpsist ulatuse mõõtmiseks, üks rämpsposti kaitseks. Ilma teie nõusolekuta vastavat skripti ei laeta ja ühtegi neist küpsistest ei seadistata; nõusoleku tagasivõtmisel kustutame need.",
      ],
      unterpunkte: [
        {
          titel: "_fbp – reklaami tulemuslikkuse mõõtmine (vajalik nõusolek)",
          list: [
            "Eesmärk: seostab teie külastuse reklaamiga, et saaksime mõõta oma kampaaniate edukust.",
            "Sisu: juhuslikult genereeritud identifikaator; me ei kogu nime, e-posti ega kontoteavet.",
            "Pakkuja: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Iirimaa.",
            "Host: mynextdays.com (esimese osapoole küpsis, mille on seadistanud Meta skript). Kehtivusaeg: umbes kolm kuud.",
          ],
        },
        {
          titel:
            "_gcl_au – Google Adsi tulemuslikkuse mõõtmine (vajalik nõusolek)",
          list: [
            "Eesmärk: seostab teie külastuse Google'i reklaamiga, et saaksime mõõta oma kampaaniate edukust.",
            "Sisu: juhuslikult genereeritud identifikaator, mis ei ole seotud teie isikuga.",
            "Pakkuja: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Iirimaa.",
            "Host: mynextdays.com (esimese osapoole küpsis). Kehtivusaeg: umbes kolm kuud.",
          ],
        },
        {
          titel: "li_gc ja bcookie – LinkedIni reklaam (vajalik nõusolek)",
          list: [
            "Eesmärk: tuvastab teie brauseri LinkedInile, et saaks reklaame ja nende edukust seostada; li_gc salvestab ka teie nõusoleku.",
            "Sisu: brauseri identifikaator ja nõusoleku olek; ei sisalda teavet teie konto kohta meie juures.",
            "Pakkuja: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Iirimaa.",
            "Host: linkedin.com (kolmanda osapoole küpsised). Kehtivusaeg: umbes kuus kuud või üks aasta.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA – kontaktivormi rämpspostikaitse (nõusolek vajalik)",
          list: [
            "Host: www.google.com (kolmanda osapoole küpsis).",
            "Eesmärk: võimaldab Google'il hinnata riske, eristades automatiseeritud masspostitusi tõelistest päringutest.",
            "Sisu: Google'i loodud identifikaator selle hindamiseks; me ei edasta nime, e-posti ega konto andmeid.",
            "Pakkuja: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Iirimaa.",
            "Kehtivusaeg: Google'i määratud, kuni kuus kuud. See määratakse alles siis, kui olete rämpspostikaitse lubanud ja kontaktivormi avanud.",
          ],
        },
        {
          titel: "_ga — ulatuse mõõtmine (nõusolek vajalik)",
          list: [
            "Host: mynextdays.com (esimese osapoole küpsis, mille on seadnud Google'i skript).",
            "Eesmärk: eristab külastajaid, et korduvaid külastusi ei loetaks topelt.",
            "Sisu: juhuslikult genereeritud tunnus, mis ei ole seotud teie isikuga; ei sisalda nime, e-posti ega konto andmeid.",
            "Pakkuja: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Iirimaa.",
            "Kehtivusaeg: kuni kaks aastat.",
          ],
        },
        {
          titel: "_ga_<tunnus> — mõõtmise sessiooni olek (nõusolek vajalik)",
          list: [
            "Host: mynextdays.com (esimese osapoole küpsis, mille on seadnud Google'i skript).",
            "Eesmärk: salvestab, millal teie praegune külastus algas, et lehevaatamised kuuluksid ühte sessiooni.",
            "Sisu: ajatempel ja sessiooni loendur; nimes olev tunnus tähistab meie vara, mitte teid.",
            "Pakkuja: Google Ireland Limited.",
            "Kehtivusaeg: kuni kaks aastat.",
          ],
        },
      ],
    },
    {
      heading: "Küpsiste kustutamine ja haldamine",
      paragraphs: [
        "Te saate küpsiseid igal ajal oma brauseri seadetes kustutada või blokeerida. Kui blokeerite vajalikud küpsised, ei ole sisselogimine platvormile tehniliselt võimalik — avalik veebileht ja turuplats jäävad ilma sisselogimiseta kasutatavaks.",
        "Väljalogimisel eemaldame sisselogimisküpsised ise.",
      ],
    },
    {
      heading: "Selle poliitika muudatused",
      paragraphs: [
        "Kui lisanduvad funktsioonid, mis vajavad täiendavaid küpsiseid, uuendame seda loetelu. Kehtib alati siin avaldatud versioon; ülal olev kuupäev näitab seisu.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
