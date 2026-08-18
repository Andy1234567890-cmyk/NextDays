import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Uvjeti korištenja za goste",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "Ovi uvjeti korištenja uređuju korištenje rezervacijskog portala myBestDays (u daljnjem tekstu „Platforma“) od strane putnika i osoba koje rezerviraju (u daljnjem tekstu „Gost“ ili „Vi“).",
    `Operator Platforme je ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danska, CVR br. ${ANBIETER.cvr} (u daljnjem tekstu „myBestDays“ ili „mi“). myBestDays je žig ovog društva, a ne zasebna pravna osoba. Potpuni podaci o pružatelju nalaze se u [Pravnim informacijama](https://mybestdays.dk/rechtliches/impressum).`,
    "Korištenjem Platforme prihvaćate ove uvjete. Molimo, pročitajte ih pozorno.",
  ],
  summary: {
    heading: "Sažetak ovih uvjeta",
    paragraphs: [
      "myBestDays je tržište. Osiguravamo Platformu na kojoj pružatelji nude svoje smještaje — sam smještaj ne pružamo mi. Ugovor o smještaju sklapa se između Vas i pružatelja, a ne s nama.",
      "Ono što vidite u oglasu potječe od pružatelja: opis, slike, oprema, cijena, uvjeti otkazivanja i kućni red. Oglase provjeravamo, no ne možemo jamčiti za svaki podatak pružatelja.",
      "Cijena koju vidite pri završetku rezervacije ukupna je cijena za rezervirane usluge. Dodatne iznose koji dospijevaju tek na licu mjesta (primjerice boravišnu pristojbu ili polog) navodimo unaprijed zasebno.",
      "Ako nešto pođe po zlu, obratite se najprije nama. Odjeljak A15 opisuje kako podnijeti pritužbu i koji su Vam putovi zatim otvoreni.",
      "Ovaj sažetak objašnjava uvjete, ali ih ne zamjenjuje. Mjerodavan je cjeloviti tekst.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Sve rezervacije putem myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Definicije",
          paragraphs: [
            "Pojmovi korišteni u ovim uvjetima objašnjeni su u rječniku na kraju dokumenta. Najvažniji su:",
          ],
          list: [
            "„Platforma“ — internetska stranica, mobilne aplikacije i sve druge pristupne točke putem kojih myBestDays prikazuje smještaje i posreduje rezervacije.",
            "„Pružatelj“ — fizička ili pravna osoba koja nudi smještaj putem Platforme (domaćin, najmodavac, agencija, hotelski ili smještajni objekt).",
            "„Smještaj“ — usluga smještaja koju nudi pružatelj, dakle objekt za odmor ili jedinica određenog tipa sobe odnosno objekta.",
            "„Rezervacija“ — putem Platforme sklopljena rezervacija smještaja za određeno razdoblje.",
            "„Ukupna cijena“ — iznos prikazan pri završetku rezervacije, uključujući sve poreze, naknade i doplate koji se obračunavaju putem Platforme.",
            "„Troškovi na licu mjesta“ — iznosi koji se ne obračunavaju putem Platforme, nego dospijevaju prema pružatelju (npr. boravišna pristojba, polog, završno čišćenje po izboru pružatelja).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. O ovim uvjetima",
          paragraphs: [
            "Ovi uvjeti vrijede za svako korištenje Platforme, neovisno o tome otvarate li račun i dolazi li do rezervacije.",
            "Odjeljak A vrijedi za sve rezervacije. Odjeljak B sadrži dopunska pravila za smještaje. U slučaju proturječja prednost ima odjeljak B.",
            "Za samu uslugu smještaja dopunski vrijede uvjeti pojedinog pružatelja (osobito kućni red i uvjeti otkazivanja) navedeni u oglasu. Ti uvjeti pružatelja pridružuju se našima; od naših uvjeta ne mogu odstupati u pogledu Vašeg odnosa s nama.",
            "Ovi uvjeti dostupni su na svih 24 službena jezika Europske unije. Kod odstupanja među jezičnim inačicama mjerodavna je njemačka inačica, ako prisilni propisi države Vašeg prebivališta ne određuju drukčije.",
            "Prisilna prava potrošača prema pravu države Vašeg prebivališta ovim uvjetima nisu dirnuta.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. O myBestDays",
          paragraphs: [
            "myBestDays je internetsko tržište za smještaje za odmor i smještajne objekte. Upravljamo Platformom na kojoj pružatelji predstavljaju svoje smještaje, a gosti ih mogu rezervirati.",
            "Mi smo posrednik, a ne pružatelj usluge smještaja. Nijedan od smještaja ponuđenih na Platformi ne posjedujemo, ne upravljamo njime, ne vodimo ga i ne nadziremo te nismo ugovorna strana ugovora o smještaju.",
            "myBestDays je posrednička usluga u smislu Uredbe (EU) 2022/2065 o digitalnim uslugama. Naši podaci i postupci prema toj uredbi nalaze se u dijelu [Akt o digitalnim uslugama](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays nije organizator putovanja. Ne sastavljamo paket-aranžmane u smislu Direktive (EU) 2015/2302; o povezanim putnim aranžmanima vidi A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Naša Platforma",
          paragraphs: [
            "Sadržaj oglasa — opis, fotografije, oprema, ograničenja popunjenosti, cijene, raspoloživost, uvjeti otkazivanja i kućni red — potječe od pojedinog pružatelja. Pružatelj odgovara za njegovu točnost i potpunost.",
            "Oglase provjeravamo prije objave i kontinuirano radi očitih povreda naših [Pravila o primjerenom sadržaju](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). Obveza općeg nadzora cjelokupnog sadržaja ne postoji i prema članku 8. Uredbe (EU) 2022/2065 ne bi ni bila dopuštena.",
            "Kako slažemo rezultate pretrage i koja obilježja određuju redoslijed objašnjavamo u [Podacima o cijenama, rangiranju i preporukama](https://mybestdays.dk/rechtliches/preisangaben).",
            "Nastojimo osigurati stalno dostupnu Platformu, ali ne dugujemo neprekinutu dostupnost. Održavanje, smetnje i prilagodbe su mogući.",
            "Prijevodi sadržaja pružatelja mogu biti strojno izrađeni. Mjerodavna je izvorna inačica koju je unio pružatelj.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Naše vrijednosti",
          paragraphs: [
            "Od gostiju i pružatelja očekujemo obziran odnos. Diskriminacija zbog podrijetla, boje kože, vjere, svjetonazora, spola, rodnog identiteta, spolne orijentacije, invaliditeta, dobi ili sličnih obilježja na Platformi se ne tolerira — vidi [Antidiskriminacijsku politiku](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Za ponašanje tijekom boravka vrijede [Osnovna pravila za goste](https://mybestdays.dk/rechtliches/grundregeln-gaeste), a za pružatelje [Kodeks ponašanja pružatelja](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Vaš račun i korištenje Platforme",
          paragraphs: [
            "Za rezervaciju možete otvoriti račun. Odgovorni ste za povjerljivost svojih pristupnih podataka i bez odgode nas obavještavate ako sumnjate na neovlašteno korištenje.",
            "Platformu smijete koristiti samo ako ste poslovno sposobni i možete valjano sklapati ugovore.",
            "Vaši podaci pri registraciji i rezervaciji moraju biti točni i potpuni — osobito ime, kontaktni podaci i broj putnika. Pružatelj te podatke treba za pružanje smještaja i ispunjavanje svojih prijavnih obveza.",
            "Osobito nije dopušteno:",
          ],
          list: [
            "prividne rezervacije, prijevarna plaćanja ili korištenje tuđih sredstava plaćanja bez ovlaštenja;",
            "automatizirano prikupljanje podataka s Platforme (scraping, crawler) izvan onoga što dopušta naša datoteka robots.txt;",
            "mjere koje ometaju ili preopterećuju Platformu ili njezinu infrastrukturu ili zaobilaze njihove sigurnosne mjere;",
            "objavljivanje protupravnog, uvredljivog ili obmanjujućeg sadržaja u recenzijama, porukama ili podacima profila;",
            "pokušaj provedbe rezervacije mimo Platforme nakon što je kontakt nastao putem nje — vidi [Naknade izvan platforme](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Cijene",
          paragraphs: [
            "Sve cijene prikazuju se kao ukupna cijena s porezima i svim naknadama obračunatima putem Platforme, čim su poznati podaci o putovanju (razdoblje i broj putnika). Ako neki sastavni dio dospijeva tek na licu mjesta, navodimo ga zasebno prije završetka rezervacije.",
            "Cijene se prikazuju u valuti oglasa. Ako Vam se iznos prikaže i u drugoj valuti, riječ je o neobvezujućem preračunu radi orijentacije; obračun se vrši u valuti oglasa, osim ako je pri plaćanju navedeno drukčije.",
            "Cijene se mogu mijenjati do završetka rezervacije, primjerice jer ih pružatelj prilagodi ili se promijeni raspoloživost. Mjerodavna je cijena koja Vam se prikaže neposredno prije obvezujuće rezervacije i navedena je u potvrdi rezervacije.",
            "Očite pogreške u cijeni (npr. iznos pogrešan za redove veličine) ne obvezuju ni nas ni pružatelja. Ako uočimo takvu pogrešku, bez odgode Vas obavještavamo; rezervaciju tada možete besplatno otkazati.",
            "Kako se sastavljaju naknade za uslugu navedeno je u [Podacima o naknadama za uslugu](https://mybestdays.dk/rechtliches/servicegebuehren). O porezima i davanjima vidi [Poreznu politiku](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Plaćanje",
          paragraphs: [
            "Plaćanja putem Platforme obrađuje pružatelj platnih usluga Stripe. Podatke o plaćanju (npr. podatke o kartici) prikuplja i obrađuje izravno Stripe; myBestDays ne pohranjuje potpune podatke o karticama.",
            "Kada koji iznos dospijeva — predujam, doplata ili plaćanje na licu mjesta — ovisi o oglasu i navedeno je prije završetka rezervacije. Pojedinosti uređuju [Uvjeti plaćanja](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Ako oglas predviđa polog, on može biti prethodno autoriziran ili naplaćen te u slučaju štete u cijelosti ili djelomično zadržan; mjerodavni su podaci u oglasu.",
            "Ako plaćanje ne uspije ili bude stornirano, rezervacija se može otkazati. Pružatelj i dalje može potraživati iznose nastale prema njegovim uvjetima otkazivanja.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Politike",
          paragraphs: [
            "Uz ove uvjete vrijede sljedeće politike koje su sastavni dio ugovora između Vas i nas:",
          ],
          list: [
            "[Pravila o primjerenom sadržaju](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Politika recenzija](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Antidiskriminacijska politika](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Osnovna pravila za goste](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Uvjeti otkazivanja](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Politika prerezervacije i povrata](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Politika kod teških smetnji](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Politika autorskih prava](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Zaštita podataka i kolačići",
          paragraphs: [
            "Kako obrađujemo osobne podatke navedeno je u [Politici privatnosti](https://mybestdays.dk/rechtliches/datenschutz). Koje kolačiće i slične tehnologije koristimo navedeno je u [Politici kolačića](https://mybestdays.dk/rechtliches/cookies).",
            "Za rezervaciju pružatelju prosljeđujemo podatke koje treba za pružanje usluge smještaja. Pružatelj je za njih samostalni voditelj obrade; za njega vrijede [Standardi zaštite podataka za domaćine](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Pristupačnost",
          paragraphs: [
            "Stanje pristupačnosti Platforme i način prijave prepreka opisuje [Izjava o pristupačnosti](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Podaci o pristupačnosti smještaja potječu od pružatelja. Ako ovisite o određenim značajkama, razjasnite ih prije rezervacije s pružateljem putem funkcije poruka.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Recenzije i korisnički sadržaj",
          paragraphs: [
            "Nakon boravka možete ostaviti recenziju. Recenziju smije ostaviti samo tko je rezervirao putem Platforme i boravak započeo ili ga je mogao započeti — time osiguravamo da objavljene recenzije potječu od stvarnih gostiju.",
            "Za recenzije ne plaćamo, njihov sadržaj ne mijenjamo i recenziju ne potiskujemo samo zato što je negativna. Pojedinosti i razlozi zbog kojih recenziju uklanjamo navedeni su u [Politici recenzija](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Za sadržaj koji objavite — recenzije, fotografije, poruke, podatke profila — ostajete odgovorni. Dajete nam neisključivo, prostorno i vremenski neograničeno, besplatno pravo taj sadržaj u okviru rada i promidžbe Platforme umnožavati, prerađivati (npr. rezanje, prijevod) i činiti dostupnim javnosti. Svoj sadržaj možete izbrisati; već izvršena korištenja u već objavljenim zbirkama time nisu dirnuta.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Poruke i komunikacija s pružateljem",
          paragraphs: [
            "Poruke između Vas i pružatelja odvijaju se putem Platforme. Osiguravamo funkciju poruka, ali nismo pošiljatelj ni primatelj sadržaja.",
            "Poruke smijemo automatizirano provjeravati radi povreda ovih uvjeta (npr. kontaktni podaci za zaobilaženje Platforme, obrasci prijevare, protupravni sadržaj) te dotične poruke zadržati ili ukloniti. O uklanjanju Vas obavještavamo uz obrazloženje prema A17.",
            "Poruke o Vašoj rezervaciji (potvrda, izmjene, informacije o dolasku) šaljemo na navedenu adresu e-pošte. Te su poruke ugovorna komunikacija i ne mogu se otkazati dok rezervacija traje. Promidžbene poruke primate samo ako ste dali privolu ili to pravo dopušta bez privole; možete u svakom trenutku prigovoriti.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Prava intelektualnog vlasništva",
          paragraphs: [
            "Platforma, njezin dizajn, softver, baze podataka, tekstovi i žigovi zaštićeni su. Dobivate neisključivo, neprenosivo pravo korištenja Platforme za pretraživanje i rezervaciju smještaja — ništa više.",
            "Korištenje naših žigova i logotipa uređuju [Pravila o žigovima](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Ako smatrate da sadržaj na Platformi povređuje Vaše autorsko pravo, slijedite [Politiku autorskih prava](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Što učiniti ako nešto pođe po zlu",
          paragraphs: [
            "Ako se problem odnosi na sam smještaj, obratite se najprije pružatelju — putem funkcije poruka ili na licu mjesta. Mnogi se problemi tako rješavaju najbrže.",
            "Ako s pružateljem ne napredujete ili se problem odnosi na Platformu, plaćanje ili provedbu rezervacije, obratite se nama. Kako nas dosežete i kako obrađujemo pritužbe navedeno je u dijelu [Pritužbe i rješavanje sporova](https://mybestdays.dk/rechtliches/beschwerden).",
            "Pripremite: broj rezervacije, adresu e-pošte rezervacije, kratak opis problema sa željom kako da pomognemo i pripadajuće dokaze (fotografije, poruke, račune).",
            "Ako smještaj pri dolasku nije dostupan ili bitno odstupa od oglasa, primjenjuje se [Politika prerezervacije i povrata](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Platforma Europske komisije za internetsko rješavanje sporova stavljena je izvan snage Uredbom (EU) 2024/3228 i prestala je s radom; kao put više nije dostupna. Koja tijela je zamjenjuju navedeno je u dijelu [Pritužbe i rješavanje sporova](https://mybestdays.dk/rechtliches/beschwerden).",
            "Ako smo poduzeli mjeru protiv Vašeg sadržaja ili računa, uz naš interni pritužbeni postupak možete se obratiti i tijelu za izvansudsko rješavanje sporova certificiranom prema članku 21. Uredbe (EU) 2022/2065. Njegove odluke za nas nisu obvezujuće.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Mjere protiv neprimjerenog ponašanja",
          paragraphs: [
            "Ako povrijedite ove uvjete ili neku od politika navedenih u A9, možemo — stupnjevano prema težini, učestalosti i učinku povrede — ukloniti sadržaj ili ograničiti njegovu vidljivost, blokirati funkcije, otkazati rezervacije ili privremeno odnosno trajno blokirati Vaš račun.",
            "Prije mjere razmatramo pojedinačni slučaj. Kod očito protupravnog sadržaja, opasnosti za osobe ili prijevare možemo djelovati odmah.",
            "Svaku mjeru Vam obrazlažemo i upućujemo Vas na pritužbeni put — vidi A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Prijava protupravnog sadržaja i obrazloženje mjera",
          paragraphs: [
            "Svatko nam može prijaviti sadržaj koji smatra protupravnim. Postupak prijave prema članku 16. Uredbe (EU) 2022/2065, naše kontaktne točke i postupanje s prijavama opisani su u dijelu [Akt o digitalnim uslugama](https://mybestdays.dk/rechtliches/dsa).",
            "Ako poduzmemo mjeru protiv sadržaja koji ste objavili ili protiv Vašeg računa, dobivate obrazloženje s navođenjem razloga, činjenične osnove, pravne osnove ili povrijeđene ugovorne odredbe te mogućnosti pritužbe.",
            "Protiv svake mjere možete u roku od šest mjeseci besplatno podnijeti pritužbu. Pritužbe obrađuju ljudi, a ne isključivo automatizirani postupci.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Ograničenje odgovornosti",
          paragraphs: [
            "Neograničeno odgovaramo za namjeru i grubu nepažnju, za štete zbog povrede života, tijela ili zdravlja te u opsegu preuzetog jamstva. Zahtjevi prema pravu odgovornosti za proizvode nisu dirnuti.",
            "Inače je naša odgovornost ograničena na predvidljivu štetu koja tipično proizlazi iz povrede obveza u čije ispunjenje smijete pouzdati — i samo ako mjerodavno pravo takvo ograničenje dopušta.",
            "Ne odgovaramo za samo pružanje usluge smještaja ni za ponašanje pružatelja ili drugih gostiju. Ugovorni partner usluge smještaja je pružatelj.",
            "Ne odgovaramo za točnost podataka koje su unijeli pružatelji, ako ih nismo znali niti smo ih morali znati. Čim saznamo za protupravan podatak, postupamo bez odgode.",
            "Daljnja odgovornost je isključena. Prisilni zakonski zahtjevi, osobito prava potrošača, nisu dirnuti.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Mjerodavno pravo i nadležnost suda",
          paragraphs: [
            "Primjenjuje se dansko pravo — sjedište operatora je u Danskoj — uz isključenje Konvencije UN-a o ugovorima o međunarodnoj prodaji robe. Prisilni propisi o zaštiti potrošača države u kojoj imate uobičajeno boravište nisu dirnuti prema članku 6. Uredbe (EZ) br. 593/2008 (Rim I).",
            "Kao potrošač možete nas tužiti pred sudom svojega prebivališta ili u našem sjedištu u Danskoj; mi Vas možemo tužiti samo pred sudom Vašeg prebivališta (članci 17. do 19. Uredbe (EU) br. 1215/2012).",
            "Za ugovor o smještaju u pravilu vrijedi pravo države u kojoj se smještaj nalazi; za tužbe iz najma nekretnine isključivo su nadležni njezini sudovi.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Povezani putni aranžmani",
          paragraphs: [
            "myBestDays posreduje isključivo usluge smještaja. Ne nudimo letove, najam vozila, prijevozne usluge, izlete ni atrakcije te ne sastavljamo paket-aranžmane u smislu Direktive (EU) 2015/2302.",
            "Budemo li ubuduće posredovali i druge putne usluge, prije rezervacije ćemo Vas zakonom propisanim standardnim obrascem upozoriti na to nastaje li paket-aranžman ili povezani putni aranžman i koja Vam prava iz toga pripadaju.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Trajanje, blokada i raskid",
          paragraphs: [
            "Ugovor o korištenju Platforme sklopljen je na neodređeno vrijeme. Svoj račun možete u svakom trenutku bez navođenja razloga izbrisati; postojeće rezervacije time nisu dirnute i provode se prema uvjetima pojedinog pružatelja.",
            "Ugovor o korištenju možemo raskinuti uz otkazni rok od 14 dana. Kod teške povrede ovih uvjeta možemo raskinuti bez otkaznog roka i blokirati račun.",
            "Nakon prestanka brišemo Vaše podatke, ako tome ne stoji na putu zakonska obveza čuvanja ili opravdani interes za čuvanje; pojedinosti uređuje [Politika privatnosti](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Klauzula o izmjenama",
          paragraphs: [
            "Ove uvjete možemo izmijeniti ako za to postoji objektivan razlog — primjerice izmijenjeno pravno stanje, praksa najviših sudova, nove ili ukinute funkcije Platforme ili uklanjanje pravnih praznina.",
            "Izmjene najavljujemo u tekstualnom obliku najmanje 30 dana prije stupanja na snagu. Ako do stupanja na snagu ne prigovorite, izmijenjeni uvjeti smatraju se prihvaćenima; na taj učinak posebno upozoravamo u najavi. Ako prigovorite, ugovor o korištenju možemo raskinuti s danom stupanja na snagu.",
            "Za već sklopljene rezervacije vrijede uvjeti u inačici koja je vrijedila u trenutku rezervacije.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Smještaji",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Opseg ovog odjeljka",
          paragraphs: [
            "Ovaj odjeljak vrijedi za rezervaciju smještaja putem Platforme — objekata za odmor kao i soba i jedinica smještajnih objekata.",
            "Dopunjuje odjeljak A. Kod proturječja prednost ima ovaj odjeljak B.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Ugovorni odnos",
          paragraphs: [
            "Ugovor o smještaju sklapa se isključivo između Vas i pružatelja. myBestDays nije ugovorna strana.",
            "Prikaz smještaja na Platformi poziv je Vama da date rezervacijsku ponudu. Klikom na gumb za rezervaciju s obvezom plaćanja dajete obvezujuću ponudu.",
            "Ugovor je sklopljen kada je rezervacija potvrđena. Potvrdu rezervacije šaljemo na Vašu navedenu adresu e-pošte; ona navodi pružatelja, rezerviranu uslugu, razdoblje, ukupnu cijenu i uvjete otkazivanja.",
            "Kod smještaja s rezervacijom na upit ugovor je sklopljen tek prihvatom od strane pružatelja. Do tada Vaše sredstvo plaćanja može biti prethodno autorizirano, ali ne i terećeno.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Što radimo mi",
          paragraphs: [
            "Osiguravamo Platformu, prikazujemo oglase pružatelja, zaprimamo Vašu rezervaciju, prosljeđujemo je pružatelju i šaljemo Vam potvrdu rezervacije.",
            "Provodimo plaćanje, ako oglas predviđa plaćanje putem Platforme, i osiguravamo funkciju poruka između Vas i pružatelja.",
            "Smještaj ne osiguravamo, njime ne upravljamo i ne jamčimo za njegovo stanje. Nismo Vaš organizator putovanja.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Što morate učiniti Vi",
          paragraphs: [
            "Prije rezervacije u cijelosti pregledajte oglas: opremu, ograničenje popunjenosti, vrijeme dolaska i odlaska, kućni red, uvjete otkazivanja i troškove koji nastaju tek na licu mjesta.",
            "Poštujte najveću popunjenost navedenu u oglasu. Ako doputuje više osoba nego što je rezervirano, pružatelj može odbiti primanje ili zatražiti doplatu.",
            "Poštujte kućni red pružatelja i [Osnovna pravila za goste](https://mybestdays.dk/rechtliches/grundregeln-gaeste). Sa smještajem postupate pažljivo i odgovarate za štete koje uzrokujete Vi ili Vaši suputnici.",
            "Ako pružatelj ili tijelo treba podatke za prijavu (npr. prijavnicu, podatke iz osobne isprave, izjavu o boravišnoj pristojbi), pravodobno ih dostavljate.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Cijene i plaćanje",
          paragraphs: [
            "Ukupna cijena obuhvaća cijenu noćenja za rezervirano razdoblje te doplate i naknade navedene u oglasu koje se obračunavaju putem Platforme.",
            "Na licu mjesta mogu nastati dodatni iznosi — osobito boravišna pristojba ili mjesna davanja, polog te dodatne usluge koje naručite tek na licu mjesta. Njih prije završetka rezervacije navodimo kao troškove na licu mjesta, ako ih je pružatelj naveo.",
            "Ako oglas predviđa predujam, ostatak dospijeva u trenutku navedenom u oglasu. Ako doplata izostane, pružatelj može prema svojim uvjetima otkazivanja odustati od ugovora.",
            "Plaćanja pružatelju izvan Platforme ne primamo i ne možemo ih pratiti; ne ulaze u našu obradu plaćanja — vidi [Naknade izvan platforme](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Izmjene, otkazivanja i povrati",
          paragraphs: [
            "Može li se i pod kojim uvjetima rezervacija besplatno otkazati ili izmijeniti ovisi o uvjetima otkazivanja pružatelja navedenima u oglasu. Uvjete koje pružateljima nudimo na izbor opisuju [Uvjeti otkazivanja](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "Kod usluga smještaja rezerviranih za određeno razdoblje u pravilu ne postoji zakonsko pravo na odustanak prema članku 16. točki (l) Direktive 2011/83/EU odnosno odgovarajućim nacionalnim propisima. Prisilna zakonska prava nisu dirnuta.",
            "Ako otkaže pružatelj, u cijelosti vraćamo iznos plaćen putem Platforme. Dodatno se primjenjuje [Politika prerezervacije i povrata](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Ako događaj izvan kontrole obiju strana onemogući putovanje ili boravak, vrijedi [Politika kod teških smetnji](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Povrati se izvršavaju na sredstvo plaćanja korišteno za plaćanje, osim ako je dogovoreno drukčije.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Što još morate znati",
          paragraphs: [
            "Pružatelji mogu biti privatni domaćini ili poduzetnici. Nastupa li pružatelj kao poduzetnik navodimo u oglasu. Ako nije riječ o poduzetniku, propisi Unije o zaštiti potrošača ne primjenjuju se na ugovor o smještaju — na tu okolnost upozoravamo Vas u oglasu.",
            "Podaci o položaju, okolici, udaljenostima i ocjene trećih služe za orijentaciju. Obvezujući su podaci o samoj rezerviranoj usluzi.",
            "U područjima s obvezom registracije za kratkoročni najam u oglasu navodimo registarski broj koji je dostavio pružatelj; vidi [Kratkoročni najam](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Kod više istovjetnih jedinica tipa objekta ili sobe rezervirate jednu jedinicu tog tipa. Koju konkretnu jedinicu dobivate određuje pružatelj.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Rječnik",
      paragraphs: [
        "Sljedeći pojmovi imaju u ovim uvjetima ovdje navedeno značenje.",
      ],
      definitions: [
        {
          term: "Pružatelj",
          description:
            "Fizička ili pravna osoba koja nudi smještaj putem Platforme i postaje ugovorna strana ugovora o smještaju.",
        },
        {
          term: "Rezervacija na upit",
          description:
            "Rezervacija koja je sklopljena tek nakon izričitog prihvata od strane pružatelja, za razliku od trenutne rezervacije.",
        },
        {
          term: "Potvrda rezervacije",
          description:
            "Poruka kojom Vam potvrđujemo sklapanje ugovora o smještaju; sadrži pružatelja, uslugu, razdoblje, ukupnu cijenu i uvjete otkazivanja.",
        },
        {
          term: "Jedinica",
          description:
            "Konkretan rezervabilan objekt unutar tipa objekta ili sobe. Prodaje se jedinica, a opisuje se i cijenom vrednuje tip.",
        },
        {
          term: "Ukupna cijena",
          description:
            "Iznos prikazan pri završetku rezervacije, uključujući sve poreze i sve naknade obračunate putem Platforme.",
        },
        {
          term: "Najveća popunjenost",
          description:
            "U oglasu naveden najveći dopušteni broj osoba koje smiju noćiti u smještaju.",
        },
        {
          term: "Polog",
          description:
            "Iznos koji pružatelj traži kao osiguranje za štete i koji se prethodno autorizira ili naplati te nakon boravka oslobodi ili prebije.",
        },
        {
          term: "Boravišna pristojba",
          description:
            "Mjesno davanje za noćenja koje se ovisno o općini naplaćuje na licu mjesta ili putem pružatelja; nije usluga myBestDays.",
        },
        {
          term: "Platforma",
          description:
            "Internetska stranica, mobilne aplikacije i sve druge pristupne točke putem kojih myBestDays prikazuje smještaje i posreduje rezervacije.",
        },
        {
          term: "Naknada za uslugu",
          description:
            "Naknada za posredničku uslugu myBestDays. Tko je snosi i kako se prikazuje navedeno je u podacima o naknadama za uslugu.",
        },
        {
          term: "Uvjeti otkazivanja",
          description:
            "Pravila koja odabire pružatelj o tome do kada i uz koje troškove se rezervacija može otkazati ili izmijeniti.",
        },
        {
          term: "Smještaj",
          description:
            "Usluga smještaja koju nudi pružatelj — objekt za odmor ili jedinica tipa sobe odnosno objekta.",
        },
        {
          term: "Troškovi na licu mjesta",
          description:
            "Iznosi koji se ne obračunavaju putem Platforme, nego dospijevaju prema pružatelju, primjerice boravišna pristojba, polog ili dodatne usluge naručene na licu mjesta.",
        },
      ],
    },
  ],
};
