import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Diszkriminációellenes szabályzat",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "A myBestDays mindenki előtt nyitva áll. Aki a Platformon keresztül foglal vagy kínál, senkit sem részesíthet hátrányos bánásmódban személyes jellemzők miatt.",
    "A jelen szabályzat a [Felhasználási feltételek](https://mybestdays.dk/rechtliches/nutzungsbedingungen) részét képezi, és a vendégekre és a szolgáltatókra egyaránt vonatkozik.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Alapelv",
      paragraphs: [
        "A myBestDays-en nem megengedett, hogy valakit származása, bőrszíne, állampolgársága, etnikai hovatartozása, vallása vagy világnézete, neme, nemi identitása, szexuális irányultsága, fogyatékossága, életkora vagy családi állapota miatt hátrány érjen.",
        "Ez vonatkozik a foglalások elfogadására vagy elutasítására, az árakra és feltételekre, a tartózkodás alatti bánásmódra és a Platformon keresztüli kommunikációra.",
        "Kiegészítőleg az (EU) 2018/302 rendelet 20. cikke alkalmazandó: a szolgáltatók nem korlátozhatják az ajánlatukhoz való hozzáférést egy vendég Unión belüli állampolgársága, lakóhelye vagy letelepedési helye miatt.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. Mit jelent ez a szolgáltatók számára",
      paragraphs: ["Szolgáltatóként különösen nem szabad:"],
      list: [
        "foglalási kérelmet elutasítani a felsorolt jellemzők valamelyike miatt;",
        "eltérő árakat, kauciót vagy feltételeket kérni a vendégektől azért, mert valamelyik jellemzőnek megfelelnek;",
        "a hirdetésben vagy üzenetekben kijelenteni, hogy bizonyos személyi körök nem kívánatosak;",
        "segítő- vagy vakvezető kutyát elutasítani, akkor sem, ha a házirendje kizárja az állatokat;",
        "egy vendéget másként kezelni azért, mert az Unió más tagállamában lakik.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. Mi marad megengedett",
      paragraphs: [
        "Meghatározhatja a maximális férőhelyszámot, a fő foglaló minimális életkorát és tárgyszerű házirendet (például dohányzási tilalom vagy csendes időszakok), amennyiben azok minden vendégre egyformán vonatkoznak.",
        "Ha Ön is a szálláshelyen lakik és lakóteret oszt meg a vendéggel, ezt egyértelműen feltüntetheti a hirdetésben; az 1. szakaszban felsorolt jellemzők azonban ekkor sem indokolják az elutasítást.",
        "Elutasíthat egy foglalást, ha konkrét jelek utalnak a házirend megsértésére vagy csalásra. Az oknak a magatartásra kell vonatkoznia, nem a személyre.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Akadálymentesség",
      paragraphs: [
        "Egy szálláshely akadálymentességére vonatkozó adatoknak a valóságnak kell megfelelniük. Akadálymentesként leírni egy szálláshelyet, amely nem az, egyben a [Megfelelő tartalomra vonatkozó szabályok](https://mybestdays.dk/rechtliches/inhaltsrichtlinien) megsértése is.",
        "Ha egy alkalmazkodás aránytalan ráfordítás nélkül lehetséges, elvárjuk a szolgáltatóktól, hogy megtegyék.",
      ],
    },
    {
      id: "melden",
      heading: "5. Diszkrimináció bejelentése",
      paragraphs: [
        "Ha diszkriminációt élt át vagy észlelt, jelentse be nekünk a bejelentő funkción keresztül vagy a [Panaszok és vitarendezés](https://mybestdays.dk/rechtliches/beschwerden) oldalon található kapcsolattartási utakon.",
        "Minden bejelentést megvizsgálunk. Ha egy jogsértés beigazolódik, intézkedéseket hozunk, akár a fiók végleges letiltásáig. Ha emiatt lemondtak egy foglalását, segítünk hasonló szálláshelyet találni.",
      ],
    },
  ],
};
