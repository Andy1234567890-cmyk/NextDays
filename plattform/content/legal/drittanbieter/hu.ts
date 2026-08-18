import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Harmadik felek szolgáltatásai és fizetési szolgáltatások",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "A myBestDays a Platform üzemeltetéséhez harmadik felek szolgáltatásait veszi igénybe. Ez az oldal megnevezi őket, és elmagyarázza, milyen szerepük van, és kinek a feltételei alkalmazandók.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Alapelv",
      paragraphs: [
        "Ahol egy harmadik fél közvetlenül Önnek nyújt szolgáltatást, ott az ő feltételei és adatvédelmi tájékoztatója a mieink mellett alkalmazandók. Erre az adott helyen felhívjuk a figyelmet.",
        "Ahol egy harmadik fél kizárólag a mi megbízásunkból kezel adatot, ott mi maradunk az Ön kapcsolattartója. Hogy mely adatfeldolgozókat vesszük igénybe, azt az [Adatvédelmi tájékoztató](https://mybestdays.dk/rechtliches/datenschutz) tartalmazza.",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Pénzforgalmi szolgáltató",
      paragraphs: [
        "A Platformon keresztüli fizetéseket a Stripe bonyolítja. A Stripe a fizetési adatokat közvetlenül gyűjti és kezeli, és ezért önálló adatkezelő. Kiegészítőleg a [Stripe adatvédelmi tájékoztatója](https://stripe.com/privacy) alkalmazandó.",
        "A házigazdáknak történő kifizetéshez a Stripe elvégzi a jogszabályban előírt személyazonosság-ellenőrzést.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Pénzforgalmi irányelv és harmadik felek hozzáférése",
      paragraphs: [
        "Az (EU) 2015/2366 irányelv („PSD2”) sok fizetéshez erős ügyfél-hitelesítést ír elő. Ezt az Ön bankja vagy kártyakibocsátója végzi; sikeres hitelesítés nélkül a fizetés elutasítható.",
        "A myBestDays nem fizetéskezdeményezési vagy számlainformációs szolgáltató, és nem fér hozzá az Ön bankszámláihoz.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Térképek, képek és beágyazott tartalom",
      paragraphs: [
        "Térképi megjelenítéshez és helyadatokhoz harmadik felek térképszolgáltatásait ágyazzuk be. Az ilyen tartalom betöltésekor adatok kerülhetnek átadásra az adott szolgáltatónak; a részleteket és a hozzájárulás kezelését a [Sütiszabályzat](https://mybestdays.dk/rechtliches/cookies) tartalmazza.",
        "A hirdetésekben szereplő képek és leírások az adott szolgáltatótól származnak, nem tőlünk.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Hivatkozott oldalak",
      paragraphs: [
        "A Platform harmadik felek oldalaira hivatkozhat. Azok tartalmára nincs befolyásunk, és értük felelősséget nem vállalunk. Amint jogsértésről tudomást szerzünk, haladéktalanul eltávolítjuk a hivatkozást.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Alkalmazásáruházak",
      paragraphs: [
        "Ha a myBestDays alkalmazást alkalmazásáruházon keresztül szerzi be, kiegészítőleg az adott áruház-üzemeltető feltételei alkalmazandók. Az áruház üzemeltetője nem szerződő fele az Ön és köztünk létrejött szerződésnek, és sem támogatással, sem szavatossággal nem tartozik az alkalmazásért.",
      ],
    },
  ],
};
