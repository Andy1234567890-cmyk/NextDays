// Estnische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Küpsiste poliitika",
  metaDescription:
    "Milliseid küpsiseid myNextDays kasutab: ainult tehniliselt vajalikud ja funktsionaalsed küpsised, ei mingeid jälgimis- ega reklaamiküpsiseid.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Käesolev poliitika selgitab, milliseid küpsiseid ja sarnaseid salvestustehnikaid ${ANBIETER.firma} kasutab sellel veebilehel ja platvormil myNextDays.`,
    "Lühidalt: kasutame ainult tehniliselt vajalikke ja funktsionaalseid küpsiseid. Analüüsi-, reklaami- ega jälgimisküpsiseid ei ole ning kasutusandmeid ei anta edasi reklaamivõrgustikele.",
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
        "Nõusolekut vajame täpselt ühe asja jaoks: meie kontaktvormi rämpspostikaitse jaoks. See tuleb Google'ilt (reCAPTCHA Enterprise) ehk on väline teenus ja laaditakse ainult siis, kui olete selle lubanud. Selleks küsib ekraani allservas riba — esimesel külastusel, võrdväärsete nuppudega „Keeldu“ ja „Nõustu“ ning ilma eelvalikuta. Kuni te ei ole otsustanud, kehtib „ei ole lubatud“.",
        "Teie otsus asub teie brauseri salvestuses (Local Storage, väärtus „nd_consent“); see sisaldab ainult kategooriat, ajahetke ja versiooninumbrit, mitte teie isikut tuvastavat teavet. Selle lehe lõpus saate seda igal ajal muuta või tagasi võtta.",
      ],
    },
    {
      heading: "See veebileht",
      paragraphs: [
        "Turundusveebileht ei kasuta küpsiseid. Fondid ja ikoonid asuvad meie enda serveris — selleks ei kasutata ühegi kolmanda osapoole ikooni- või fonditeenust. Selle lehe ainus väline teenus on kontaktvormi rämpspostikaitse ja see laaditakse ainult teie nõusolekul. Üksikasjad on [Privaatsuspoliitikas](/datenschutz).",
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
          titel: "sb-… — sisselogimine Google'iga (tehniliselt vajalik, ainult kasutamisel)",
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
            "Salvestab teie otsuse kontaktvormi rämpspostikaitse kohta, et nõusolekuriba ei küsiks seda iga külastuse korral uuesti. Salvestatakse ainult kategooria, ajahetk ja versiooninumber. Väärtus ei lahku teie seadmest ega edastata meie serverile; see kehtib selle brauseri jaoks. Kui kustutate selle, küsib riba järgmisel külastusel uuesti.",
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
