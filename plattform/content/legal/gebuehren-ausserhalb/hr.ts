import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Naknade izvan platforme",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "Ova politika uređuje koje iznose pružatelj smije tražiti izvan Platforme, a koje ne. Štiti goste od toga da se na licu mjesta suoče sa zahtjevima kojih u oglasu nije bilo.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Načelo",
      paragraphs: [
        "Sve što se za rezerviranu uslugu treba platiti mora prije završetka rezervacije biti navedeno u oglasu — bilo kao dio ukupne cijene bilo kao stavka troškova na licu mjesta.",
        "Iznos koji nije bio naveden ni u ukupnoj cijeni ni kao trošak na licu mjesta gost ne duguje.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Što se smije tražiti na licu mjesta",
      paragraphs: ["Na licu mjesta smiju se tražiti isključivo:"],
      list: [
        "iznosi izričito navedeni u oglasu kao troškovi na licu mjesta (primjerice završno čišćenje, paket posteljine, parkirno mjesto);",
        "mjesna davanja poput boravišne pristojbe, ako se prema mjesnim propisima plaćaju na licu mjesta;",
        "polog naveden u oglasu;",
        "usluge koje gost dodatno naruči tek na licu mjesta i dobrovoljno, po prethodno navedenoj cijeni;",
        "naknada dokazane štete koju je gost uzrokovao.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Što se ne smije tražiti",
      paragraphs: ["Nedopušteno je osobito:"],
      list: [
        "naknadni zahtjev na cijenu noćenja nakon završetka rezervacije;",
        "naknada za to što je rezervacija obavljena putem myBestDays;",
        "naknada za obradu, rezervaciju ili karticu koja nije bila navedena u oglasu;",
        "poziv da se rezervacija otkaže i isti smještaj ponovno rezervira izvan Platforme;",
        "poziv da se cijena ili njezin dio podmiri doznakom, gotovinom ili platnom uslugom izvan Platforme, kada oglas predviđa plaćanje putem Platforme.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Zaobilaženje Platforme",
      paragraphs: [
        "Ako je kontakt između gosta i pružatelja nastao putem Platforme, rezervacija se ne smije provesti mimo nje. To vrijedi za obje strane.",
        "Tko zaobilazi Platformu, gubi njezinu zaštitu: plaćanja nisu osigurana, naše politike otkazivanja i povrata ne primjenjuju se, a u slučaju spora ne možemo posredovati.",
        "Povrede mogu dovesti do blokade računa. Kod pružatelja možemo dodatno potraživati izgubljenu naknadu za uslugu.",
      ],
    },
    {
      id: "melden",
      heading: "5. Prijava",
      paragraphs: [
        "Ako se od Vas na licu mjesta traži iznos kojeg u oglasu nije bilo, nemojte ga platiti i prijavite nam to putem kontaktnih putova u dijelu [Pritužbe i rješavanje sporova](https://mybestdays.dk/rechtliches/beschwerden). Ako ste već platili, pomažemo pri povratu.",
      ],
    },
  ],
};
