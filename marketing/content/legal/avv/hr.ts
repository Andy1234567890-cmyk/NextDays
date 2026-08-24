// Kroatische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen und die Liste der Unterauftragsverarbeiter).
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Ugovor o obradi osobnih podataka",
  metaDescription:
    "Obrada osobnih podataka u skladu s člankom 28. GDPR-a između myNextDays ApS i objekata koji koriste platformu: predmet, upute, sigurnost, podizvršitelji obrade.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Ovaj ugovor (u daljnjem tekstu „ugovor o obradi“) primjenjuje se između objekta koji koristi platformu myNextDays (u daljnjem tekstu „voditelj obrade“) i društva ${ANBIETER.firma} (u daljnjem tekstu „izvršitelj obrade“ ili „mi“) i konkretizira obveze iz članka 28. Uredbe (EU) 2016/679 (GDPR).`,
    `Uključuje se putem [općih uvjeta poslovanja](${AGB_URL}) i primjenjuje se cijelo vrijeme korištenja platforme. Ima prednost pred općim uvjetima poslovanja u onoj mjeri u kojoj je riječ o obradi osobnih podataka za voditelja obrade.`,
    "Dodatno se na podatke koje obrađujemo kao samostalni voditelj obrade primjenjuje [izjava o zaštiti podataka](/datenschutz) — posebno na podatke računa i poslovnog odnosa.",
  ],
  sections: [
    {
      heading: "Predmet i raspodjela uloga",
      unterpunkte: [
        {
          paragraphs: [
            "Predmet je obrada osobnih podataka koje voditelj obrade unosi u platformu ili prikuplja putem nje, kako bismo mogli pružati ugovorene usluge: upravljanje objektima, rezervacijama i zauzetošću, komunikacija s gostima, obrada plaćanja, računovodstvo i obračun prema vlasnicima, povezivanje s rezervacijskim portalima, alat za izradu web-stranica te upravljanje zadacima i timom.",
          ],
        },
        {
          paragraphs: [
            "Voditelj obrade odlučuje o svrhama i sredstvima te obrade. Podatke obrađujemo isključivo prema njegovoj dokumentiranoj uputi i ne u vlastite svrhe.",
          ],
        },
        {
          paragraphs: [
            "Za podatke računa, obračun naših vlastitih usluga, sigurnost sustava i zakonsko čuvanje voditelj obrade smo mi sami. Ta obrada nije predmet ovog ugovora o obradi.",
          ],
        },
      ],
    },
    {
      heading: "Vrsta, obuhvat i svrha obrade",
      paragraphs: [
        "Obrada se vrši prikupljanjem, pohranom, prikazivanjem, izmjenom, prijenosom primateljima koje odabere voditelj obrade (npr. rezervacijski portali, pružatelji platnih usluga), ograničavanjem i brisanjem — u automatiziranom obliku na platformi.",
        "Mjesto obrade je Europska unija; iznimke su iscrpno navedene u odjeljku 8.",
      ],
    },
    {
      heading: "Kategorije ispitanika",
      list: [
        "Gosti i osobe koje rezerviraju, uključujući suputnike",
        "Zainteresirane osobe koje postavljaju upite ili šalju poruke",
        "Vlasnici objekata kojima se upravlja",
        "Zaposlenici voditelja obrade (tim, čišćenje, usluga, recepcija)",
        "Osobe za kontakt partnera i pružatelja usluga voditelja obrade",
      ],
    },
    {
      heading: "Kategorije osobnih podataka",
      list: [
        "Osnovni podaci: ime, adresa, datum rođenja ako se evidentira, državljanstvo ako se evidentira za obvezu prijave",
        "Podaci za kontakt: adresa e-pošte, telefonski broj",
        "Podaci o rezervaciji: razdoblje, objekt, broj putnika, cijene, dodatne usluge, otkazivanja",
        "Podaci o plaćanju: iznos, valuta, način plaćanja, status plaćanja, reference (potpuni podaci o kartici ne dolaze u naše sustave)",
        "Podaci o komunikaciji: poruke, bilješke, ocjene",
        "Podaci o pristupu i korištenju zaposlenika: uloga, ovlaštenja, vrijeme prijave, uređaj i IP adresa prijave",
        "Posebne kategorije prema članku 9. GDPR-a nisu predmet naloga; voditelj obrade takve podatke ne unosi u polja slobodnog teksta.",
      ],
    },
    {
      heading: "Upute",
      unterpunkte: [
        {
          paragraphs: [
            "Voditelj obrade daje upute korištenjem i konfiguracijom platforme te u tekstualnom obliku na našu adresu za kontakt. Usmene upute potvrđujemo u tekstualnom obliku.",
          ],
        },
        {
          paragraphs: [
            "Ako smatramo da je uputa nezakonita, to bez odgode javljamo i možemo suspendirati njezino izvršenje dok je voditelj obrade ne potvrdi ili izmijeni.",
          ],
        },
        {
          paragraphs: [
            "Ako smo na obradu obvezani zakonom (primjerice prema nadležnim tijelima), voditelja obrade obavještavamo prethodno, u mjeri u kojoj nam je to pravno dopušteno.",
          ],
        },
        {
          titel: "Povezivanje vlastitih usluga voditelja obrade",
          paragraphs: [
            "Voditelj obrade može svoj račun putem sučelja povezati s uslugom koju je sam odabrao i s kojom je sklopio vlastiti ugovor — primjerice s asistentom s umjetnom inteligencijom. Ako odobri takvo povezivanje, to je njegova izričita uputa u smislu članka 28. stavka 3. točke (a) GDPR-a da se oslobođeni podaci predaju toj usluzi. Ona izričito obuhvaća i s time povezani prijenos u treću zemlju ako usluga ima sjedište izvan Europske unije.",
            "Ukratko: o takvom povezivanju odlučuje isključivo voditelj obrade i za povezanu uslugu odgovoran je on sam.",
            "Odobriti ga može samo račun s ovlaštenjem za upravljanje vanjskim povezivanjima. To je ovlaštenje pridržano ulozi „administrator“; računi s ograničenim pravima — i uloga „suadministrator“ — ne mogu odobriti povezivanje. Bilježimo tko ga je, kada i za koju uslugu odobrio, koje su vrste podataka oslobođene i koja su preuzimanja izvršena; ta je evidencija voditelju obrade dostupna u sučelju pod „Račun → Povezivanja“, kako bi mogao ispuniti svoju obvezu pouzdanosti i odgovoriti na zahtjeve za pristup.",
            "Povezana usluga nije naš podizvršitelj obrade: ne dajemo joj nalog, ne odabiremo je i ne dajemo joj upute. Podatke obrađuje na temelju ugovora koji je voditelj obrade sam sklopio s njom. Za tu obradu, za njezinu pravnu osnovu i za jamstva prijenosa u treću zemlju odgovoran je zato voditelj obrade; ona nije predmet ovog ugovora o obradi.",
            "Polja slobodnog teksta — bilješke o rezervaciji i sadržaj poruka gostiju — standardno su izuzeta iz takvog povezivanja. Mogu sadržavati posebne kategorije osobnih podataka prema članku 9. GDPR-a, primjerice podatke o zdravlju. Voditelj obrade mora ih pri odobravanju osloboditi zasebno; bez tog oslobođenja ne prenose se.",
            "Voditelj obrade može odobreno povezivanje u svakom trenutku prekinuti u sučelju. Tokeni za obnovu pri tome se brišu, a pri svakom daljnjem preuzimanju provjerava se postoji li privola još — prekinuta usluga zato više ne može ništa čitati odmah, a ne tek nakon isteka svojeg tokena za pristup.",
          ],
        },
      ],
    },
    {
      heading: "Povjerljivost",
      paragraphs: [
        "Sve osobe koje u skladu s nalogom mogu imati pristup podacima obvezane su na povjerljivost i redovito se poučavaju o zaštiti podataka. Pristup je ograničen na mjeru potrebnu za pojedinu zadaću.",
        "Pristup naših zaposlenika podacima klijenata odvija se samo radi ispravljanja pogrešaka, na zahtjev za podršku ili radi ispunjavanja zakonskih obveza.",
      ],
    },
    {
      heading: "Sigurnost obrade",
      paragraphs: [
        "Provodimo tehničke i organizacijske mjere koje se zahtijevaju člankom 32. GDPR-a. Provedeni su posebice:",
      ],
      list: [
        "Šifriranje prijenosa (TLS) za sve veze, HTTP sigurnosna zaglavlja uključujući strogu Content-Security-Policy",
        "Razdvajanje klijenata neposredno u bazi podataka: pravila pristupa na razini redova (Row Level Security) uz oduzeta prava na tablicama za osjetljive podatke, tako da je pristup izvan vlastitog objekta isključen i neposrednim putem preko baze podataka",
        "Ovlaštenja na temelju uloga s razdvajanjem podataka: osoblje usluge i čišćenja ne dobiva financijske i prodajne podatke, vlasnici samo vlastite objekte; podaci gostiju maskiraju se za uloge koje nisu ovlaštene",
        "Dvofaktorska autentifikacija (TOTP) dostupna za račune; ponovna prijava pri izmjenama kritičnima za sigurnost",
        "Evidencija prijava s uređajem, vremenom i IP adresom, dostupna voditelju obrade",
        "Povezivanja s vanjskim uslugama može odobriti samo račun s ulogom „administrator“; svako preuzimanje putem takvog povezivanja bilježi se (alat, vrijeme, obuhvat — bez samog sadržaja) i dostupno je voditelju obrade. Prekinuto povezivanje odmah gubi pristup: pri svakom preuzimanju provjerava se postoji li privola još",
        "Ograničavanje učestalosti zahtjeva protiv automatiziranih napada, provjera potpisa dolaznih webhook poziva",
        "Šifrirane sigurnosne kopije pohranjene izvan produkcijskog sustava s redovitim testom vraćanja",
        "Odvojena okruženja za razvoj i rad; izmjene u bazi podataka isključivo putem verzioniranih migracija",
      ],
    },
    {
      heading: "Podizvršitelji obrade",
      paragraphs: [
        "Voditelj obrade odobrava korištenje sljedećih podizvršitelja obrade. Sa svakim od njih postoje ugovori prema članku 28. stavku 4. GDPR-a s obvezama koje odgovaraju ovom ugovoru o obradi.",
      ],
      list: [
        "Hetzner Online GmbH, Njemačka (poslužitelji, baza podataka, mediji, poslužitelj e-pošte; podatkovni centar u Helsinkiju, Finska)",
        "Stripe Payments Europe, Limited, Irska (plaćanja, isplate, zakonska provjera identiteta)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luksemburg (plaćanja, ako ih voditelj obrade aktivira)",
        "Channex.io Ltd, Ujedinjena Kraljevina (povezivanje s rezervacijskim portalima, ako je aktivirano)",
        "Meta Platforms Ireland Limited, Irska (WhatsApp poruke, ako su aktivirane)",
        "Google Ireland Limited, Irska (prevođenje sadržaja; prijava putem Googlea, ako se koristi)",
        "Groq, Inc., SAD (predloženi odgovori u ulaznoj pošti, ako su aktivirani)",
        "Cloudflare, Inc., SAD (upravljanje DNS zapisima za vlastite domene, ako se koristi)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "O promjeni ili dopuni obavještavamo najmanje 30 dana unaprijed. Voditelj obrade može u tom roku podnijeti protivljenje iz važnog razloga povezanog sa zaštitom podataka; ako se protivljenje ne otkloni, može otkazati zahvaćeni dio usluge ili ugovor.",
          ],
        },
        {
          paragraphs: [
            "Usluge koje voditelj obrade sam ugovori s trećom stranom nisu podobrada, nego prijenos koji je on sam prouzročio. To vrijedi za rezervacijski portal s kojim ima vlastiti ugovor, kao i za asistenta s umjetnom inteligencijom ili drugi program koji putem sučelja poveže sa svojim računom (vidjeti odjeljak „Upute“).",
            "Pri tome nije odlučujuće preko čijih sustava podaci teku, nego tko uslugu uključuje: podobrada nastaje kada MI angažiramo dodatnog pružatelja usluga kako bismo pružili svoju uslugu. Ako voditelj obrade sam odabere uslugu i s njom sklopi ugovor, ta usluga obrađuje za voditelja obrade — ne za nas. To razgraničenje odgovara ugovornoj praksi usporedivih pružatelja za usluge trećih strana koje povezuje klijent.",
          ],
        },
      ],
    },
    {
      heading: "Prijenos u treće zemlje",
      paragraphs: [
        "Prijenosi primateljima izvan EU-a ograničeni su na gore navedene usluge sa sjedištem u SAD-u odnosno Ujedinjenoj Kraljevini. Osnova su standardne klauzule o zaštiti podataka Europske komisije prema članku 46. stavku 2. točki (c) GDPR-a ili važeća odluka o primjerenosti; primjenjuju se dodatne zaštitne mjere (šifriranje, smanjenje količine podataka).",
      ],
    },
    {
      heading: "Pomoć voditelju obrade",
      unterpunkte: [
        {
          paragraphs: [
            "Pomažemo voditelju obrade pri odgovaranju na zahtjeve ispitanika (članci 15. do 22. GDPR-a). Platforma za to nudi pristup, ispravak, izvoz i brisanje podataka neposredno u sučelju. Ako se ispitanici obrate izravno nama, upućujemo ih na voditelja obrade i njega obavještavamo.",
          ],
        },
        {
          paragraphs: [
            "Pomažemo nadalje pri procjenama učinka na zaštitu podataka, pri poštivanju obveza iz članaka 32. do 36. GDPR-a i pri upitima nadzornih tijela.",
          ],
        },
      ],
    },
    {
      heading: "Povrede osobnih podataka",
      paragraphs: [
        "Ako doznamo za povredu osobnih podataka koja se odnosi na podatke voditelja obrade, obavještavamo ga bez odgode, najkasnije u roku od 48 sati od saznanja, u tekstualnom obliku.",
        "Obavijest sadrži, u mjeri u kojoj je poznato, vrstu i vrijeme incidenta, zahvaćene kategorije podataka i skupine osoba, vjerojatne posljedice te poduzete i predložene mjere. Pomažemo voditelju obrade pri njegovim obvezama prijave i obavještavanja prema člancima 33. i 34. GDPR-a.",
      ],
    },
    {
      heading: "Dokazi i kontrole",
      unterpunkte: [
        {
          paragraphs: [
            "Poštivanje ovog ugovora o obradi dokazujemo na zahtjev, posebice informacijom o poduzetim mjerama i o angažiranim podizvršiteljima obrade.",
          ],
        },
        {
          paragraphs: [
            "Voditelj obrade može provoditi kontrole u potrebnom obuhvatu ili ih dati provesti neovisnom revizoru koji nam nije konkurent. Kontrole se provode nakon obavijesti s primjerenim rokom, tijekom uobičajenog radnog vremena i bez narušavanja poslovanja. Troškove provjere koja nadilazi davanje informacija nosi voditelj obrade, osim ako je provjera uzrokovana incidentom koji smo mi prouzročili.",
          ],
        },
      ],
    },
    {
      heading: "Brisanje i vraćanje",
      paragraphs: [
        "Nakon završetka ugovora podatke voditelja obrade na zahtjev stavljamo na raspolaganje za izvoz u roku od 30 dana u uobičajenom, strojno čitljivom formatu. Nakon toga podatke brišemo, uključujući kopije.",
        "Izuzeti su podaci za koje postoji zakonska obveza čuvanja (posebice podaci o računima i računovodstvu); oni se blokiraju i brišu nakon isteka roka. Sigurnosne kopije prepisuju se u redovnom ciklusu rotacije.",
      ],
    },
    {
      heading: "Odgovornost i redoslijed prvenstva",
      paragraphs: [
        "Primjenjuje se članak 82. GDPR-a. U odnosu među strankama uz to se primjenjuju pravila o odgovornosti iz općih uvjeta poslovanja, u mjeri u kojoj nisu u suprotnosti s GDPR-om.",
        "Ako su opći uvjeti poslovanja i ovaj ugovor o obradi u suprotnosti kod obrade za voditelja obrade, primjenjuje se ovaj ugovor o obradi. Ako neka odredba postane nevažeća, ostali sadržaj ostaje na snazi; stranke je zamjenjuju dopuštenom odredbom iste svrhe.",
      ],
    },
    {
      heading: "Izmjene ovog ugovora",
      paragraphs: [
        "Ovaj ugovor o obradi možemo prilagoditi u mjeri u kojoj je to potrebno zbog izmjena prava, zahtjeva nadzornih tijela, zahtjeva pružatelja platnih usluga ili tehničkog razvoja i pri čemu voditelj obrade nije stavljen u nepovoljniji položaj.",
        "Izmjene najavljujemo najmanje 30 dana prije stupanja na snagu u tekstualnom obliku. Ako voditelj obrade u tom roku ne podnese protivljenje, smatraju se prihvaćenima; na tu se posljedicu upozorava u najavi. U slučaju protivljenja svaka stranka može otkazati ugovor s učinkom od trenutka stupanja na snagu.",
      ],
    },
    {
      heading: "Kontakt",
      paragraphs: [
        `Upite o ovom ugovoru, upute i prijave uputite na [${ANBIETER.email}](mailto:${ANBIETER.email}) ili na ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
