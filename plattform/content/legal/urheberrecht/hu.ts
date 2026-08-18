import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Szerzői jogi szabályzat",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "A myBestDays tiszteletben tartja harmadik felek jogait, és ugyanezt várja el felhasználóitól is. A jelen szabályzat leírja, hogyan jelenthet be szerzőijog-sértést, és hogyan kezeljük azt.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Alapelv",
      paragraphs: [
        "Aki tartalmat tölt fel a Platformra, szavatolja, hogy rendelkezik az ehhez szükséges jogokkal. Ez különösen a hirdetésekben szereplő fényképekre, alaprajzokra, szövegekre és térképrészletekre vonatkozik.",
        "Mások tartalmának engedély nélküli feltöltése a [Felhasználási feltételek](https://mybestdays.dk/rechtliches/nutzungsbedingungen) és a [Megfelelő tartalomra vonatkozó szabályok](https://mybestdays.dk/rechtliches/inhaltsrichtlinien) megsértése.",
      ],
    },
    {
      id: "meldung",
      heading: "2. Jogsértés bejelentése",
      paragraphs: [
        "Szerzőijog-sértést az érintett tartalomnál lévő bejelentő funkción keresztül vagy a [Digitális szolgáltatásokról szóló jogszabály](https://mybestdays.dk/rechtliches/dsa) alatt megnevezett kapcsolattartó ponton jelenthet be. A bejelentésnek tartalmaznia kell:",
      ],
      list: [
        "a kifogásolt tartalom pontos megjelölését, különösen az URL-címet;",
        "a védett mű leírását és annak igazolását, hogy Ön a jogosult, vagy jogosult a jogosult nevében eljárni;",
        "annak indokolását, hogy a felhasználás miért nem megengedett;",
        "az Ön nevét és egy kapcsolattartási címet;",
        "nyilatkozatot arról, hogy adatai legjobb tudomása szerint helyesek és teljesek.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Hogyan dolgozzuk fel a bejelentéseket",
      paragraphs: [
        "A bejelentése beérkezését haladéktalanul visszaigazoljuk, és gyorsan, gondosan döntünk.",
        "Ha a bejelentést megalapozottnak tartjuk, eltávolítjuk a tartalmat vagy letiltjuk a hozzáférést, és tájékoztatjuk a feltöltő személyt az okok és a panaszút megjelölésével.",
        "Ha a bejelentést megalapozatlannak tartjuk, ezt indokolással közöljük Önnel.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Az érintett személy kifogása",
      paragraphs: [
        "Ha a tartalmát eltávolították, és ezt jogosulatlannak tartja, hat hónapon belül díjmentesen panaszt nyújthat be. Fejtse ki, miért jogosult a felhasználásra.",
        "Ha a panasz megalapozottnak bizonyul, helyreállítjuk a tartalmat.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Ismételt jogsértések",
      paragraphs: [
        "Azokat a fiókokat, amelyeken keresztül ismételten jogsértő tartalmat töltenek fel, előzetes figyelmeztetést követően letiltjuk. Ez az (EU) 2022/2065 rendelet 23. cikkének felel meg.",
        "Ugyanígy letiltjuk a bejelentő funkciót azon személyek számára, akik ismételten nyilvánvalóan megalapozatlan bejelentéseket tesznek.",
      ],
    },
  ],
};
