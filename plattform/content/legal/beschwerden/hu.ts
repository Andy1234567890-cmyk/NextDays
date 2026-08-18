import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Panaszok és vitarendezés",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "Ez az oldal leírja, hogyan érheti el a myBestDays-t, hogyan kezeljük a panaszokat, és milyen utak állnak nyitva Ön előtt, ha nem ért egyet a döntésünkkel.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Hogyan ér el minket",
      paragraphs: [
        "A leggyorsabban a súgóközponton és az ott megadott kapcsolattartási utakon ér el minket. Fennálló foglaláshoz használja a fiókjában lévő üzenetküldő funkciót — akkor a foglalás és az előzmények már rendelkezésünkre állnak.",
        `Írásban a ${ANBIETER.email} címen vagy a ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dánia címen ér el minket; telefonon a ${ANBIETER.telefon} számon.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Mit tartalmazzon a panasza",
      paragraphs: ["Hogy gyorsan segíthessünk, kérjük, adja meg:"],
      list: [
        "a foglalási számát és a foglaláshoz használt e-mail-címet;",
        "a probléma rövid leírását;",
        "milyen megoldást szeretne;",
        "a hozzá tartozó bizonyítékokat — fényképek, üzenetek, nyugták, számlakivonatok.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Hogyan dolgozzuk fel",
      paragraphs: [
        "Minden panaszt rögzítünk, és ügyszámot kap, amellyel követheti az állapotát.",
        "A beérkezést haladéktalanul visszaigazoljuk, és érdemben rendszerint hét napon belül válaszolunk. Ha hosszabb vizsgálat szükséges, közöljük Önnel a köztes állapotot.",
        "Azokat a panaszokat, amelyeknél személyek vannak veszélyben vagy közvetlenül küszöbön áll egy érkezés, elsőbbséggel kezeljük.",
        "Döntésünket megindokoljuk, és megnevezzük az alapot, amelyen az nyugszik.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Panasz a mi intézkedésünk ellen",
      paragraphs: [
        "Ha tartalmat távolítottunk el, annak láthatóságát korlátoztuk, foglalást mondtunk le vagy fiókot tiltottunk le, ez ellen hat hónapon belül díjmentesen panaszt nyújthat be. Ez az (EU) 2022/2065 rendelet 20. cikkének felel meg.",
        "A panaszt emberek vizsgálják, nem kizárólag automatizált eljárások. Ha megalapozottnak bizonyul, visszavonjuk az intézkedést.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Peren kívüli vitarendezés",
      paragraphs: [
        "Az Európai Bizottság online vitarendezési platformját az (EU) 2024/3228 rendelet hatályon kívül helyezte, és az beszüntette működését. Rajta keresztül panasz már nem nyújtható be.",
        "Nem vagyunk kötelesek és nem is állunk készen arra, hogy fogyasztói békéltető testület előtti vitarendezési eljárásban részt vegyünk.",
        `Ettől függetlenül fogyasztóként fordulhat az illetékes dán szervhez: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Dánia ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Ha másik tagállamban lakik, országa Európai Fogyasztói Központja segít Önnek.`,
        "Ha a vita olyan intézkedést érint, amelyet a tartalma vagy a fiókja ellen hoztunk, kiegészítőleg az (EU) 2022/2065 rendelet 21. cikke szerint tanúsított peren kívüli vitarendezési testülethez is fordulhat. Annak döntései ránk nem kötelezőek, és ilyen eljárásokban való részvételre nem vagyunk kötelesek.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Bírósági út",
      paragraphs: [
        "A bírósági út bármikor nyitva áll Ön előtt, előzetes panaszeljárás nélkül is. Hogy mely bíróságok illetékesek, azt a [Felhasználási feltételek](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand) A19. szakasza tartalmazza.",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Szolgáltatói panaszok",
      paragraphs: [
        "A szolgáltatók ugyanezen eljárás keretében nyújthatnak be panaszt a jelen feltételek alkalmazásáról, a rangsorolási döntésekről és az ajánlatuk korlátozásáról. Ez az (EU) 2019/1150 rendelet 11. cikkének felel meg.",
        "Az ilyen panaszok számáról, tárgyáról és átlagos ügyintézési idejéről évente jelentést teszünk; a jelentés a [Digitális szolgáltatásokról szóló jogszabály](https://mybestdays.dk/rechtliches/dsa) alatt érhető el.",
      ],
    },
  ],
};
