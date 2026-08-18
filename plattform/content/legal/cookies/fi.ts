import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Evästekäytäntö",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Tämä käytäntö selittää, mitä evästeitä ja vastaavia tekniikoita myBestDays käyttää, mihin tarkoitukseen, kuinka kauan niitä säilytetään ja miten voitte hallita niitä.",
    "Se täydentää [Tietosuojaselostetta](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Mitä evästeet ovat",
      paragraphs: [
        "Evästeet ovat pieniä tekstitiedostoja, joita verkkosivusto tallentaa selaimeenne. Vastaavia tekniikoita ovat selaimen paikallinen tallennustila ja sähköposteissa olevat laskuripikselit.",
        "Alustan toiminnan kannalta ehdottoman välttämättömät evästeet saamme asettaa ilman suostumustanne. Kaikkien muiden osalta pyydämme suostumuksenne (direktiivin 2002/58/EY 5 artiklan 3 kohta).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Välttämättömät evästeet",
      paragraphs: [
        "Nämä evästeet ovat toiminnan kannalta välttämättömiä eikä niitä voi poistaa käytöstä. Asetamme tällä hetkellä:",
      ],
      list: [
        "”nd_access” — pitää kirjautumisenne voimassa. Vain palvelimen luettavissa (HttpOnly), voimassaoloaika istunnon keston mukaan.",
        "”nd_refresh” — uusii kirjautumisenne, jotta teidän ei tarvitse kirjautua jatkuvasti uudelleen. Vain palvelimen luettavissa, voimassaoloaika 30 päivää.",
        "”nd_gast_locale” — muistaa valitsemanne kielen. Voimassaoloaika yksi vuosi.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Toiminnalliset, tilasto- ja markkinointievästeet",
      paragraphs: [
        "myBestDays ei tällä hetkellä aseta evästeitä tilastointia, kävijämittausta tai mainontaa varten eikä upota mainosverkostoja tai analytiikkapalveluja.",
        "Jos tämä muuttuisi, pyytäisimme ensin suostumuksenne valintaikkunassa, jossa kieltäytyminen on yhtä helppoa kuin hyväksyminen, ja täydentäisimme tätä käytäntöä konkreettisilla evästeillä.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Upotettu kolmansien sisältö",
      paragraphs: [
        "Yksityiskohtasivuilla voi olla upotettuja karttoja. Lataamme tällaisen sisällön vasta, kun aktivoitte sen nimenomaisesti; vasta silloin tietoja voidaan siirtää kyseiselle palveluntarjoajalle.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Miten hallitsette evästeitä",
      paragraphs: [
        "Voitte muuttaa tai peruuttaa suostumuksenne milloin tahansa alatunnisteen evästeasetuksista.",
        "Lisäksi voitte poistaa tai estää evästeitä selaimessanne. Jos poistatte välttämättömät evästeet, teidät kirjataan ulos ja alusta toimii rajoitetusti.",
      ],
    },
  ],
};
