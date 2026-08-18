import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Impresszum",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    `A myBestDays piactér szolgáltatójának adatai. Az üzemeltető a ${ANBIETER.firma}; a myBestDays e társaság védjegye, nem önálló jogi személy.`,
    "Kötelező adatok a dán elektronikus kereskedelemről szóló törvény 7. §-a szerint, amely a 2000/31/EK irányelv 5. cikkét ülteti át, valamint az (EU) 2022/2065 rendelet 11. és 12. cikke szerint.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. A Platform üzemeltetője",
      paragraphs: [
        `${ANBIETER.firma} — korlátolt felelősségű társaság (anpartsselskab, ApS) a dán jog szerint`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Dánia`,
        `Törvényes képviselet: ${ANBIETER.direktion.join(" és ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Kapcsolat",
      paragraphs: [
        `E-mail: ${ANBIETER.email}`,
        `Telefon: ${ANBIETER.telefon}`,
        "Fennálló foglalással kapcsolatos ügyekben használja a fiókjában lévő üzenetküldő funkciót — akkor a foglalás és az előzmények már rendelkezésünkre állnak; lásd a [Panaszok és vitarendezés](https://mybestdays.dk/rechtliches/beschwerden) oldalt.",
      ],
    },
    {
      id: "register",
      heading: "3. Nyilvántartás és áfa",
      paragraphs: [
        `CVR-szám ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dánia.`,
        ...(ANBIETER.ustId
          ? [`Közösségi adószám: ${ANBIETER.ustId}.`]
          : [
              "Közösségi adószám jelenleg nincs; az elektronikus kereskedelemről szóló törvény 7. §-a annak feltüntetését csak fennálló áfaregisztráció esetén írja elő.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Kapcsolattartó pontok az (EU) 2022/2065 rendelet szerint",
      paragraphs: [
        `Egyablakos kapcsolattartó pont a hatóságok számára a 11. cikk szerint és a felhasználók számára a 12. cikk szerint: ${ANBIETER.email}, postai úton a fenti címen.`,
        "A kommunikáció nyelve a német, a dán és az angol.",
        "Az e rendelet szerinti eljárásokat — jogellenes tartalom bejelentése, intézkedések indokolása, panaszkezelés — a [Digitális szolgáltatásokról szóló jogszabály](https://mybestdays.dk/rechtliches/dsa) írja le.",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Illetékes hatóságok",
      paragraphs: [
        `Digitális szolgáltatási koordinátor az (EU) 2022/2065 rendelet 49. cikke szerint: ${DSA_KOORDINATOR.name}, Dánia ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Adatvédelmi felügyeleti hatóság: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Dánia, ${AUFSICHTSBEHOERDE.email}.`,
        "A szállásszolgáltatások közvetítése Dániában nem igényel külön engedélyt; ágazati felügyeleti hatóság ezért nincs.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Fogyasztói vitarendezés",
      paragraphs: [
        "Az Európai Bizottság online vitarendezési platformját az (EU) 2024/3228 rendelet hatályon kívül helyezte, és az beszüntette működését.",
        "Nem vagyunk kötelesek és nem is állunk készen arra, hogy fogyasztói békéltető testület előtti vitarendezési eljárásban részt vegyünk.",
        `Ettől függetlenül fogyasztóként fordulhat az illetékes dán szervhez: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Dánia ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Ha másik tagállamban lakik, országa Európai Fogyasztói Központja segít Önnek.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Megjegyzések a tartalmakhoz és hivatkozásokhoz",
      paragraphs: [
        "A hirdetések tartalma az adott szolgáltatóktól származik. A myBestDays azt nem teszi magáévá; lásd a [Felhasználási feltételek](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform) A4. szakaszát.",
        "A hivatkozott harmadik feles oldalak tartalmáért azok üzemeltetője felel. Amint jogsértésről tudomást szerzünk, haladéktalanul eltávolítjuk a hivatkozást.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Szerzői jog",
      paragraphs: [
        `Az e Platformon közzétett saját tartalmak, szövegek, grafikák és védjegyek szerzői jogi és védjegyjogi védelem alatt állnak. A törvényileg megengedett eseteken túlmenő felhasználás a ${ANBIETER.firma} előzetes írásbeli hozzájárulását igényli; a védjegyekre a [Védjegyekre vonatkozó szabályok](https://mybestdays.dk/rechtliches/markenzeichen) vonatkoznak.`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Alkalmazandó jog",
      paragraphs: [
        `A ${ANBIETER.firma} székhelye Dániában van, és kizárólag ott van letelepedve. Erre az online kínálatra ezért a dán jog alkalmazandó — a magyar változatra is (a származási ország elve a 2000/31/EK irányelv 3. cikke szerint). Az Ön lakóhelye szerinti állam kógens fogyasztóvédelmi rendelkezéseit ez nem érinti.`,
      ],
    },
  ],
};
