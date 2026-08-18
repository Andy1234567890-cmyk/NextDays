import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika za zahtjeve tijela i tijela kaznenog progona",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "Ova je politika namijenjena tijelima, sudovima i tijelima kaznenog progona koja od myBestDays traže podatke ili upućuju nalog protiv sadržaja. Ovdje je javna kako bi i korisnici mogli pročitati pod kojim uvjetima podatke izdajemo.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Načelo",
      paragraphs: [
        "Podatke korisnika izdajemo samo kada postoji valjana pravna osnova i zahtjev ispunjava formalne pretpostavke. Neformalna molba za podatke nije dovoljna.",
        "Svaki zahtjev provjeravamo u pogledu nadležnosti, pravne osnove, određenosti i razmjernosti te izdajemo samo podatke koje zahtjev navodi.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Pretpostavke zahtjeva",
      paragraphs: ["Zahtjev treba sadržavati:"],
      list: [
        "tijelo koje traži, broj predmeta i kontaktne podatke osobe koja postupa na službenom memorandumu;",
        "pravnu osnovu prema nacionalnom pravu ili pravu Unije;",
        "točnu oznaku pogođene osobe ili pogođenog računa — adresu e-pošte, broj rezervacije ili URL oglasa;",
        "točno označene podatke i razdoblje;",
        "prema potrebi sudski nalog, ako ga mjerodavno pravo zahtijeva;",
        "napomenu ako bi obavještavanje pogođene osobe ugrozilo istragu, uz navođenje pravne osnove.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Nalozi prema Uredbi (EU) 2022/2065",
      paragraphs: [
        "Nalozi za postupanje protiv protupravnog sadržaja (članak 9.) i nalozi za pružanje informacija (članak 10.) moraju sadržavati ondje navedene podatke, osobito pravnu osnovu, točnu elektroničku lokaciju, obrazloženje, pravna sredstva i jezik.",
        "Primitak potvrđujemo i tijelu koje je nalog izdalo priopćavamo koje smo mjere poduzeli i kada.",
        "O nalogu obavještavamo pogođenu osobu najkasnije u trenutku provedbe, osim ako tijelo uz navođenje pravne osnove naloži odgodu.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Hitni slučajevi",
      paragraphs: [
        "Postoji li neposredna opasnost za život ili tjelesnu cjelovitost, podatke potrebne za njezino otklanjanje izdajemo i bez prethodnog formalnog naloga. Takav zahtjev izričito označite kao hitan i opišite opasnost.",
        "Postoje li naznake kaznenog djela koje predstavlja opasnost za život ili sigurnost osobe, nadležna tijela obavještavamo na vlastitu inicijativu (članak 18. Uredbe (EU) 2022/2065).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Koje podatke držimo",
      paragraphs: [
        "Koje kategorije podataka obrađujemo i koliko ih dugo pohranjujemo navedeno je u [Politici privatnosti](https://mybestdays.dk/rechtliches/datenschutz). Izvan ondje navedenih rokova podatke ne držimo.",
        "Pohrana podataka izvan potrebe ne provodi se. Poziv na privremeno osiguranje podataka za postupak u tijeku provodimo u pravno dopuštenom okviru.",
        "Potpunim podacima o plaćanju ne raspolažemo; treba ih zatražiti od pružatelja platnih usluga.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Obavještavanje pogođene osobe",
      paragraphs: [
        "Pogođene korisnike obavještavamo o zahtjevu koji se odnosi na njihove podatke, osim ako to zabranjuje pravni propis ili obrazloženi nalog tijela ili postoji neposredna opasnost za život ili tjelesnu cjelovitost.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Kamo uputiti zahtjeve",
      paragraphs: [
        "Zahtjeve uputite na jedinstvenu kontaktnu točku za tijela navedenu u dijelu [Akt o digitalnim uslugama](https://mybestdays.dk/rechtliches/dsa). Obrađujemo ih na njemačkom i engleskom jeziku.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Transparentnost",
      paragraphs: [
        "Broj i vrstu naloga tijela iskazujemo u svom godišnjem izvješću o transparentnosti; vidi [Akt o digitalnim uslugama](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
