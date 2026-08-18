import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Akt o digitalnim uslugama",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "myBestDays je posrednička usluga i internetska platforma u smislu Uredbe (EU) 2022/2065 o jedinstvenom tržištu digitalnih usluga (akt o digitalnim uslugama, DSA). Ova stranica objedinjuje podatke i postupke koje ta uredba zahtijeva.",
    "myBestDays nije vrlo velika internetska platforma u smislu članka 33. uredbe. Dodatne obveze koje iz toga proizlaze — utvrđivanje sistemskih rizika, neovisna revizija, arhiv oglasa i objava mjesečnog broja korisnika prema ondje predviđenom postupku — stoga nas ne pogađaju.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Kontaktne točke (članci 11. i 12.)",
      paragraphs: [
        `Jedinstvena kontaktna točka za tijela država članica, Komisiju i Europski odbor za digitalne usluge: ${ANBIETER.email}, poštom ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danska.`,
        `Jedinstvena kontaktna točka za korisnike: ${ANBIETER.email}. Ondje nas dosežete neposredno i bez automatiziranog međukoraka.`,
        "S obje se kontaktne točke može komunicirati na njemačkom, danskom i engleskom jeziku.",
        "Pravnog zastupnika u Uniji prema članku 13. nije potrebno imenovati: operator ima poslovni nastan u Danskoj i time u Uniji.",
        `Nadležni koordinator digitalnih usluga prema članku 49.: ${DSA_KOORDINATOR.name}, Danska ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Prijava protupravnog sadržaja (članak 16.)",
      paragraphs: [
        "Svatko nam može prijaviti sadržaj koji smatra protupravnim. Koristite za to funkciju prijave dostupnu uz svaki oglas, svaku recenziju i svaku poruku, ili kontaktnu točku za korisnike.",
        "Kako bismo prijavu mogli ocijeniti bez dubinske pravne provjere, treba sadržavati:",
      ],
      list: [
        "dovoljno obrazloženo objašnjenje zašto je sadržaj protupravan;",
        "točnu elektroničku lokaciju, osobito URL adresu;",
        "ime i adresu e-pošte podnositelja prijave — osim kod prijava kaznenih djela protiv spolne slobode djece, gdje je taj podatak dobrovoljan;",
        "izjavu da su podaci prema najboljem saznanju točni i potpuni.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Kako obrađujemo prijave",
      paragraphs: [
        "Primitak bez odgode potvrđujemo i odlučujemo pravodobno, pažljivo, bez proizvoljnosti i objektivno.",
        "Sadrži li prijava podatke iz odjeljka 2., ona zasniva naše saznanje u smislu članka 6. uredbe.",
        "O svojoj odluci obavještavamo podnositelja prijave i upućujemo ga na pravna sredstva.",
        "Kod automatizirane obrade to priopćavamo.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Obrazloženje mjera (članak 17.)",
      paragraphs: [
        "Ograničimo li vidljivost sadržaja, uklonimo ga, blokiramo pristup njemu, obustavimo plaćanja, pružanje usluge ili račun, pogođena osoba dobiva jasno i konkretno obrazloženje.",
        "Obrazloženje navodi vrstu i opseg mjere, njezino teritorijalno i vremensko važenje, činjenice i okolnosti odluke, je li bila uključena automatizirana obrada, pravnu osnovu ili povrijeđenu ugovornu odredbu te dostupna pravna sredstva.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Sumnja na kazneno djelo (članak 18.)",
      paragraphs: [
        "Postoje li naznake kaznenog djela koje predstavlja opasnost za život ili sigurnost osobe, bez odgode obavještavamo nadležna tijela kaznenog progona ili pravosudna tijela.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Interni pritužbeni postupak (članak 20.)",
      paragraphs: [
        "Protiv svake mjere iz odjeljka 4. i protiv odbijanja prijave može se u roku od šest mjeseci besplatno podnijeti pritužba.",
        "Pritužbe obrađujemo pravodobno, nediskriminirajuće i pažljivo — pod nadzorom kvalificiranih osoba, a ne isključivo automatiziranim sredstvima.",
        "Pokaže li se pritužba osnovanom, mjeru povlačimo. Put opisuje dio [Pritužbe i rješavanje sporova](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Izvansudsko rješavanje sporova (članak 21.)",
      paragraphs: [
        "Za sporove o mjerama iz odjeljka 4. korisnici se mogu obratiti tijelu za izvansudsko rješavanje sporova certificiranom od nadležnog koordinatora digitalnih usluga. Popis certificiranih tijela vodi Europska komisija.",
        "Odluke tih tijela za nas nisu obvezujuće; na sudjelovanje u postupcima neovisnih pružatelja nismo obvezani. Put do sudova ostaje nedirnut.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Pouzdani prijavitelji (članak 22.)",
      paragraphs: [
        "Prijave koje podnese subjekt priznat kao pouzdani prijavitelj u svom području stručnosti obrađujemo prioritetno.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Mjere protiv zlouporabe (članak 23.)",
      paragraphs: [
        "Račune putem kojih se često pruža očito protupravan sadržaj nakon prethodnog upozorenja blokiramo na primjereno razdoblje.",
        "Obradu prijava i pritužbi obustavljamo za osobe koje često podnose očito neosnovane prijave ili pritužbe — također nakon prethodnog upozorenja.",
        "Pritom uvijek ocjenjujemo pojedinačni slučaj: broj, udio i težinu dotičnih postupanja te namjeru.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Izvješća o transparentnosti (članci 15. i 24.)",
      paragraphs: [
        "Godišnje objavljujemo izvješće o moderiranju sadržaja: broj naloga tijela, broj i vrstu prijava, poduzete mjere, broj pritužbi i njihov ishod, podatke o primjeni automatiziranih postupaka te broj sporova pred izvansudskim tijelima.",
        `Mikropoduzeća i mala poduzeća prema članku 19. uredbe oslobođena su dijela tih obveza. Dok oslobođenje traje, podatke na zahtjev stavljamo na raspolaganje na adresi ${ANBIETER.email}; čim prvo izvješće bude objavljeno, ovdje će biti povezano.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Sljedivost trgovaca (članci 30. do 32.)",
      paragraphs: [
        "Pružatelji koji na Platformi nastupaju u okviru svoje poslovne djelatnosti smiju nuditi tek nakon što su nam dostavili ime, adresu, broj telefona, adresu e-pošte, podatke iz registra, PDV identifikacijski broj i platni račun te su njihovi podaci vjerodostojni.",
        "Te podatke prikazujemo u oglasu, u mjeri u kojoj to uredba predviđa.",
        "Saznamo li da se oglas odnosio na protupravan proizvod ili protupravnu uslugu, obavještavamo pogođene goste, ako raspolažemo njihovim kontaktnim podacima.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Sustavi preporučivanja (članak 27.)",
      paragraphs: [
        "Glavni parametri redoslijeda rezultata pretrage i preporuka te mogućnost utjecaja na njih opisani su u dijelu [Cijene, rangiranje i preporuke](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Oglašavanje (članak 26.)",
      paragraphs: [
        "Trenutačno ne prikazujemo plaćeno oglašavanje trećih strana ni plaćena pozicioniranja u rezultatima pretrage.",
        "Uvedemo li oglašavanje, jasno ćemo ga označiti, navesti oglašivača i glavne parametre prikazivanja. Oglašavanje na temelju posebnih kategorija osobnih podataka prema članku 9. Uredbe (EU) 2016/679 i oglašavanje maloljetnicima na temelju izrade profila isključujemo.",
      ],
    },
  ],
};
