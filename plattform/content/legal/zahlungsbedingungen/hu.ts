import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Fizetési feltételek",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "A jelen fizetési feltételek azt szabályozzák, hogyan bonyolódnak le a myBestDays-en keresztüli foglalással összefüggő fizetések. Kiegészítik a [Felhasználási feltételeket vendégeknek](https://mybestdays.dk/rechtliches/nutzungsbedingungen); fizetési kérdésekben fennálló ellentmondás esetén a jelen fizetési feltételek az irányadók.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Szerepünk a fizetésben",
      paragraphs: [
        "A myBestDays a szolgáltató megbízásából bonyolítja a fizetéseket. Nem vagyunk pénzforgalmi intézmény és nem vagyunk elektronikuspénz-kibocsátó intézmény; magát a pénzforgalmi szolgáltatást a pénzforgalmi szolgáltatónk nyújtja.",
        "A Platformon keresztüli fizetéseket a Stripe (Stripe Payments Europe, Limited) bonyolítja. A kártyaadatokat és egyéb fizetési adatokat közvetlenül a Stripe gyűjti és kezeli. A myBestDays nem tárol teljes kártyaadatokat.",
        "Ha a Platformon keresztül fizet, a szolgáltatóval szembeni fizetési kötelezettsége a megfizetett összeg erejéig teljesítettnek minősül, amint a fizetést a pénzforgalmi szolgáltatónk sikeresen engedélyezte és beszedte.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Fizetési módok",
      paragraphs: [
        "Hogy mely fizetési módok állnak rendelkezésre, az a hirdetéstől, a szolgáltató országától és az Ön országától függ. Az elérhető fizetési módokat a foglalás lezárása előtt megjelenítjük.",
        "Bizonyos fizetési módokhoz az (EU) 2015/2366 irányelv szerinti erős ügyfél-hitelesítés szükséges. Sikeres hitelesítés nélkül a fizetés nem hajtható végre.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Esedékesség, előleg és hátralék",
      paragraphs: [
        "Hogy mikor melyik összeg válik esedékessé, azt a szolgáltató határozza meg a hirdetésben. Három modell szokásos: teljes fizetés a foglaláskor, előleg a foglaláskor a hátralék érkezés előtti kifizetésével, vagy helyszíni fizetés a szolgáltatónál.",
        "A foglalására vonatkozó modellt és az esedékességi időpontokat a foglalás lezárása előtt megjelenítjük, és a foglalási visszaigazolásban megismételjük.",
        "A hátralék esedékessége előtt emlékeztetőt küldünk a megadott e-mail-címre. Ha a hátralék nem érkezik meg, a szolgáltató a lemondási feltételei szerint elállhat a szerződéstől.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Pénznem",
      paragraphs: [
        "Az elszámolás a hirdetés pénznemében történik. Ezt a pénznemet minden árnál és a fizetési folyamatban feltüntetjük.",
        "Ha egy összeget kiegészítésképpen más pénznemben is megjelenítünk, az nem kötelező érvényű, tájékoztató jellegű átváltás, nem pedig kötelező ár.",
        "Ha az Ön pénzforgalmi szolgáltatója más pénznemre vált át vagy külföldi tranzakciós díjat számít fel, e költségeket Ön viseli. Ezek nem részei a teljes árnak, és azokat nem mi határozzuk meg, illetve nem mi szedjük be.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Kaució",
      paragraphs: [
        "Ha a hirdetés kauciót ír elő, annak összegét a foglalás lezárása előtt feltüntetjük.",
        "A hirdetéstől függően a kauciót a fizetési eszközén előzetesen engedélyezzük (az összeget zároljuk, de nem terheljük le) vagy beszedjük. Az előzetes engedélyezés átmenetileg csökkentheti a kártyája rendelkezésre álló keretét.",
        "A tartózkodás után az előzetes engedélyezést feloldjuk, illetve a beszedett kauciót visszatérítjük, amennyiben a szolgáltató nem érvényesít kárt. Ha a szolgáltató kárt érvényesít, azt bizonyítania kell; a megalapozottságról az Ön és a szolgáltató közötti jogviszony dönt.",
        "Ha a szolgáltató a kauciót ehelyett a helyszínen kéri, az helyszíni költségtétel, és nem a Platformon keresztül bonyolódik.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Visszatérítések",
      paragraphs: [
        "A visszatérítések a fizetéshez használt fizetési eszközre történnek, kivéve ha más megállapodás született vagy ez technikailag nem lehetséges.",
        "A visszatérítést haladéktalanul kezdeményezzük, amint annak oka megállapítást nyert. Hogy mennyi idő alatt válik láthatóvá a jóváírás a számláján vagy kártyáján, azt az Ön pénzforgalmi szolgáltatója határozza meg; szokásosan öt-tíz banki munkanap.",
        "Hogy fennáll-e és milyen összegben visszatérítési igény, az a [Lemondási feltételektől](https://mybestdays.dk/rechtliches/stornierungsbedingungen) és az [Átfoglalási és visszatérítési szabályzattól](https://mybestdays.dk/rechtliches/rueckerstattung) függ.",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Meghiúsult fizetések és visszaterhelések",
      paragraphs: [
        "Ha egy fizetés meghiúsul, tájékoztatjuk Önt, és lehetőséget adunk másik fizetési eszköz megadására. Ha a fizetés elmarad, a foglalás lemondható.",
        "Ha egy már végrehajtott fizetést visszaterheltet anélkül, hogy visszatérítési igény állna fenn, a szolgáltató továbbra is követelheti az összeget. A jogosulatlan visszaterhelésből nálunk felmerülő költségeket kiszámlázhatjuk Önnek.",
        "Ha egy fizetést csalárdnak tartunk, visszatarthatjuk azt vagy lemondhatjuk a foglalást. Erről tájékoztatjuk Önt, és megindokoljuk a döntést.",
      ],
    },
    {
      id: "belege",
      heading: "8. Bizonylatok és elszámolások",
      paragraphs: [
        "A Platformon keresztül fizetett összegekről bizonylatot bocsátunk rendelkezésére, amelyet a fiókjában a „Foglalások” alatt érhet el.",
        "A szállásszolgáltatásról a szolgáltató állít ki számlát; ő a teljesítő vállalkozó. Az adókhoz lásd az [Adózási szabályzatot](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. A jelen fizetési feltételek módosítása",
      paragraphs: [
        "A jelen fizetési feltételek módosítására a [Felhasználási feltételek](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen) A22. szakasza alkalmazandó.",
      ],
    },
  ],
};
