import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika autorskih prava",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "myBestDays poštuje prava trećih osoba i isto očekuje od svojih korisnika. Ova politika opisuje kako prijaviti povredu autorskog prava i kako s njome postupamo.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Načelo",
      paragraphs: [
        "Tko objavljuje sadržaj na Platformi jamči da za to ima potrebna prava. To osobito vrijedi za fotografije, tlocrte, tekstove i isječke karata u oglasima.",
        "Objava tuđeg sadržaja bez dopuštenja povreda je [Uvjeta korištenja](https://mybestdays.dk/rechtliches/nutzungsbedingungen) i [Pravila o primjerenom sadržaju](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
      ],
    },
    {
      id: "meldung",
      heading: "2. Prijava povrede",
      paragraphs: [
        "Povredu autorskog prava prijavite putem funkcije prijave uz dotični sadržaj ili putem kontaktne točke navedene u dijelu [Akt o digitalnim uslugama](https://mybestdays.dk/rechtliches/dsa). Prijava treba sadržavati:",
      ],
      list: [
        "točnu oznaku spornog sadržaja, osobito URL adresu;",
        "opis zaštićenog djela i dokaz o Vašem nositeljstvu prava ili o Vašem ovlaštenju da postupate za nositelja prava;",
        "obrazloženje zašto korištenje nije dopušteno;",
        "Vaše ime i kontaktnu adresu;",
        "izjavu da su Vaši podaci prema najboljem saznanju točni i potpuni.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Kako obrađujemo prijave",
      paragraphs: [
        "Primitak Vaše prijave bez odgode potvrđujemo te odlučujemo brzo i pažljivo.",
        "Ako prijavu smatramo osnovanom, sadržaj uklanjamo ili blokiramo pristup njemu i obavještavamo osobu koja ga je objavila, uz navođenje razloga i pritužbenog puta.",
        "Ako prijavu smatramo neosnovanom, to Vam priopćavamo uz obrazloženje.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Prigovor pogođene osobe",
      paragraphs: [
        "Ako je Vaš sadržaj uklonjen, a to smatrate neopravdanim, možete u roku od šest mjeseci besplatno podnijeti pritužbu. Pritom izložite zašto ste ovlašteni na korištenje.",
        "Ako se pritužba pokaže osnovanom, sadržaj vraćamo.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Ponovljene povrede",
      paragraphs: [
        "Račune putem kojih se opetovano objavljuje sadržaj koji povređuje prava blokiramo nakon prethodnog upozorenja. To odgovara članku 23. Uredbe (EU) 2022/2065.",
        "Jednako tako blokiramo funkciju prijave osobama koje opetovano podnose očito neosnovane prijave.",
      ],
    },
  ],
};
