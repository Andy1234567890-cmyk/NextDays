import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Értékelési szabályzat",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "Az értékelések a vendégek számára a legfontosabb független forrást jelentik. A jelen szabályzat leírja, ki adhat értékelést, hogyan biztosítjuk, hogy az értékelések valós vendégektől származzanak, és mikor távolítunk el egy értékelést.",
  ],
  sections: [
    {
      id: "echtheit",
      heading: "1. Hogyan biztosítjuk a hitelességet",
      paragraphs: [
        "Értékelést csak az adhat le, aki a szálláshelyet a myBestDays-en keresztül foglalta le, és akinek a tartózkodási időszaka megkezdődött. Az értékelést technikailag a konkrét foglaláshoz kötjük.",
        "Ezzel teljesítjük a 2005/29/EK irányelv I. mellékletének 23b. pontjából eredő kötelezettséget, hogy vendégértékelésként csak olyanokat mutassunk be, amelyek esetében ésszerű lépéseket tettünk annak ellenőrzésére, hogy valós vendégektől származnak.",
        "Nem vásárolunk értékeléseket, nem rendelünk meg értékeléseket, és nem teszünk közzé hamis értékeléseket. Azt sem tűrjük el, hogy a szolgáltatók ezt tegyék.",
      ],
    },
    {
      id: "frist",
      heading: "2. Határidő és közzététel",
      paragraphs: [
        "A távozás után 14 nap áll rendelkezésére értékelés leadására. A szolgáltató ugyanezen határidőn belül értékelést adhat Önről.",
        "Mindkét értékelést egyszerre tesszük közzé, amint mindkettő beérkezett vagy a határidő lejárt. Így egyik fél sem befolyásolja a másikat.",
        "A leadott értékelést a határidőn belül visszavonhatja. A közzététel után módosítás már nem lehetséges; kérheti a törlését.",
      ],
    },
    {
      id: "antwort",
      heading: "3. A szolgáltató válasza",
      paragraphs: [
        "A szolgáltató nyilvánosan válaszolhat egy értékelésre. A válaszra ugyanazok a szabályok vonatkoznak, mint magára az értékelésre.",
        "A válasz nem módosítja az értékelést, és nem változtat az összesített osztályzaton.",
      ],
    },
    {
      id: "entfernung",
      heading: "4. Mikor távolítunk el egy értékelést",
      paragraphs: [
        "Nem távolítunk el értékelést azért, mert negatív, vagy mert a szolgáltató elégedetlen vele. Akkor távolítjuk el, ha:",
      ],
      list: [
        "sérti a [Megfelelő tartalomra vonatkozó szabályokat](https://mybestdays.dk/rechtliches/inhaltsrichtlinien);",
        "harmadik személyek személyes adatait tartalmazza;",
        "felismerhetően más szálláshelyre vagy más tartózkodásra vonatkozik;",
        "lényegében olyan körülményeket érint, amelyekre sem a vendégnek, sem a szolgáltatónak nem volt befolyása (pl. időjárás, önkormányzati építkezés, érkezési forgalom) — ebben az esetben csak az érintett részt távolítjuk el, ha az elkülöníthető;",
        "felismerhetően zsarolást szolgál, például mert követeléshez kapcsolódik;",
        "ösztönzéssel vásárolták meg, vagy összehangolt szándékkal adták le.",
      ],
    },
    {
      id: "anreize",
      heading: "5. Az ösztönzők nem megengedettek",
      paragraphs: [
        "A szolgáltatók értékelésért nem ajánlhatnak pénzt, kedvezményt, felminősítést, ajándékot vagy egyéb előnyt — az értékelés elhagyásáért sem.",
        "A szolgáltatók meghívhatják a vendégeket értékelésre anélkül, hogy az osztályzatot befolyásolnák. Az olyan meghívás, amely csak pozitív élmény esetén szólít fel értékelésre, nem megengedett.",
      ],
    },
    {
      id: "darstellung",
      heading: "6. Hogyan jelenítjük meg az értékeléseket",
      paragraphs: [
        "Az összesített osztályzat egy szálláshely valamennyi közzétett értékelésének súlyozatlan átlaga. Egyetlen értékelést sem súlyozunk magasabban azért, mert jobb.",
        "Az alapértelmezett rendezés a legújabb értékeléseket mutatja elsőként. Átválthat más rendezésre; hogy melyik rendezés aktív, azt megjelenítjük.",
        "Megadjuk, hány értékelés áll egy összesített osztályzat mögött. Háromnál kevesebb értékelés esetén nem jelenítünk meg összesített osztályzatot, csak az egyes értékeléseket.",
      ],
    },
    {
      id: "beschwerde",
      heading: "7. Panasz egy döntés ellen",
      paragraphs: [
        "Ha eltávolítjuk az értékelését, vagy elutasítjuk egy értékelés eltávolítását, azt megindokoljuk, és felhívjuk a figyelmet a panasz útjára — lásd a [Panaszok és vitarendezés](https://mybestdays.dk/rechtliches/beschwerden) oldalt.",
      ],
    },
  ],
};
