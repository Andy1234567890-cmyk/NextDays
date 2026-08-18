import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika privatnosti",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "Ova politika opisuje koje osobne podatke myBestDays obrađuje, u koje svrhe, na kojoj pravnoj osnovi i koja prava imate. Vrijedi za internetsku stranicu, mobilne aplikacije i sve druge pristupe Platformi.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Voditelj obrade i službenik za zaštitu podataka",
      paragraphs: [
        `Voditelj obrade u smislu Uredbe (EU) 2016/679 (OUZP) je ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danska, CVR br. ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Potpuni podaci o pružatelju navedeni su u [Pravnim informacijama](https://mybestdays.dk/rechtliches/impressum).`,
        "Službenik za zaštitu podataka nije imenovan; uvjeti članka 37. OUZP-a nisu ispunjeni. Pitanja o zaštiti podataka uputite na gore navedenu adresu e-pošte.",
        "Pružatelji kod kojih rezervirate samostalni su voditelji obrade za podatke koje od nas prime. Za njih vrijede [Standardi zaštite podataka za domaćine](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Koje podatke obrađujemo",
      paragraphs: ["Ovisno o tome kako koristite Platformu, obrađujemo:"],
      list: [
        "osnovne podatke — ime, adresu e-pošte, broj telefona, jezik i valutu, lozinku u šifriranom obliku;",
        "podatke o rezervaciji — rezervirani smještaj, razdoblje, broj i imena putnika, posebne želje, status rezervacije;",
        "podatke o plaćanju — iznos, valutu, status plaćanja, posljednje znamenke sredstva plaćanja i identifikator transakcije našeg pružatelja platnih usluga. Potpuni podaci o karticama do nas ne dolaze;",
        "komunikacijske podatke — poruke između Vas i pružatelja, upite našoj službi za korisnike, pritužbe;",
        "sadržajne podatke — recenzije, fotografije, popise želja;",
        "podatke o korištenju — posjećene stranice, upite pretraživanja, vrijeme pristupa;",
        "tehničke podatke — IP adresu, identifikatore preglednika i uređaja, operativni sustav, stranicu upućivanja.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Svrhe i pravne osnove",
      paragraphs: [
        "Osiguravanje Platforme, račun, pretraživanje, rezervacija, obrada plaćanja i komunikacija s pružateljem — članak 6. stavak 1. točka (b) OUZP-a (ugovor ili predugovorne radnje).",
        "Služba za korisnike, obrada pritužbi i rješavanje sporova — članak 6. stavak 1. točke (b) i (f) OUZP-a.",
        "Otkrivanje i sprječavanje prijevara, zlouporaba i sigurnosnih incidenata, provedba naših uvjeta — članak 6. stavak 1. točka (f) OUZP-a (legitiman interes za sigurno tržište).",
        "Recenzije i njihova objava — članak 6. stavak 1. točke (b) i (f) OUZP-a.",
        "Ispunjavanje pravnih obveza, osobito trgovačkih i poreznih obveza čuvanja, obveza prijave prema Direktivi (EU) 2021/514 (DAC7) i obveza prema Uredbi (EU) 2022/2065 — članak 6. stavak 1. točka (c) OUZP-a.",
        "Poboljšavanje Platforme analizom agregiranih podataka o korištenju — članak 6. stavak 1. točka (f) OUZP-a.",
        "Promidžbene e-poruke i kolačići koji nisu nužni — članak 6. stavak 1. točka (a) OUZP-a (privola) koju možete u svakom trenutku opozvati s učinkom za ubuduće.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Primatelji",
      paragraphs: [
        "Pružatelji primaju podatke koji su im potrebni za provedbu Vaše rezervacije i za ispunjavanje njihovih pravnih obveza — osobito ime, kontaktne podatke, razdoblje, broj putnika i Vaše poruke njima.",
        "Naš pružatelj platnih usluga Stripe obrađuje podatke o plaćanju kao samostalni voditelj obrade; dodatno vrijedi [Politika privatnosti Stripea](https://stripe.com/privacy).",
        "Pružatelji usluga koji za nas obavljaju hosting, rad baza podataka, slanje e-pošte, dijagnostiku pogrešaka i alate službe za korisnike obrađuju podatke isključivo prema našim uputama na temelju ugovora prema članku 28. OUZP-a.",
        "Tijela i sudovi primaju podatke samo u mjeri u kojoj smo na to obvezani; vidi [Politiku za zahtjeve tijela i tijela kaznenog progona](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Porezna tijela primaju podatke o pružateljima koji se prijavljuju prema DAC7.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Prijenos u treće zemlje",
      paragraphs: [
        "Naši poslužitelji i poslužitelji naših izvršitelja obrade nalaze se u Europskoj uniji.",
        "Dođe li u pojedinim slučajevima do obrade izvan Europskoga gospodarskog prostora, to se događa samo na temelju odluke Europske komisije o primjerenosti ili standardnih ugovornih klauzula prema članku 46. stavku 2. točki (c) OUZP-a zajedno s dopunskim jamstvima.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Rokovi čuvanja",
      paragraphs: [
        "Podatke računa čuvamo dok Vaš račun postoji, a zatim ih brišemo, ako tome ne stoji na putu obveza čuvanja.",
        "Za podatke o rezervaciji i plaćanju vrijede trgovački i porezni rokovi čuvanja; prema danskom računovodstvenom pravu to je u pravilu pet godina od kraja poslovne godine na koju se podaci odnose.",
        "Poruke uz rezervaciju čuvamo do tri godine nakon završetka boravka kako bi se sporovi mogli razjasniti.",
        "Recenzije nakon brisanja Vašeg računa ostaju u anonimiziranom obliku jer čine dio ocjenske osnove smještaja.",
        "Podatke o slučajevima prijevare i zlouporabe čuvamo onoliko dugo koliko je potrebno za sprječavanje daljnjih povreda, ali najdulje tri godine od posljednjeg slučaja.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Vaša prava",
      paragraphs: ["Prema OUZP-u imate sljedeća prava:"],
      list: [
        "pristup podacima pohranjenima o Vama (članak 15.);",
        "ispravak netočnih podataka (članak 16.);",
        "brisanje (članak 17.), ako tome ne stoji na putu obveza čuvanja;",
        "ograničenje obrade (članak 18.);",
        "prenosivost podataka (članak 20.);",
        "prigovor na obradu koja se temelji na legitimnim interesima (članak 21.), osobito na izravni marketing;",
        "opoziv dane privole s učinkom za ubuduće (članak 7. stavak 3.);",
        `pritužbu nadzornom tijelu (članak 77.) — nadležno je tijelo Vašeg prebivališta, radnog mjesta ili mjesta navodne povrede. U sjedištu voditelja obrade to je ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danska, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Kako ostvarujete svoja prava",
      paragraphs: [
        `Mnoge podatke možete prikazati, izmijeniti ili izbrisati izravno u svom računu. Za sve ostalo obratite se na ${ANBIETER.email}.`,
        "Odgovaramo bez odgode, najkasnije u roku od mjesec dana. Ne možemo li rok ispuniti, priopćavamo Vam to uz obrazloženje.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Automatizirane odluke",
      paragraphs: [
        "Koristimo automatizirane postupke za otkrivanje prijevara, zlouporaba i protupravnog sadržaja. Dovede li takav postupak do mjere protiv Vašeg računa ili sadržaja, obrazlažemo je, a Vi možete zatražiti preispitivanje od strane čovjeka.",
        "Odluku koja se temelji isključivo na automatiziranoj obradi s pravnim učincima u smislu članka 22. OUZP-a ne donosimo.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Obveza dostave podataka",
      paragraphs: [
        "Podatke potrebne za rezervaciju morate dostaviti; bez njih se ugovor ne može sklopiti niti se smještaj može osigurati. Svi ostali podaci su dobrovoljni.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Izmjene ove politike",
      paragraphs: [
        "Ovu politiku prilagođavamo kada se promijeni obrada ili pravno stanje. Trenutačno važeća inačica dostupna je ovdje; datum ažuriranja naveden je gore.",
      ],
    },
  ],
};
