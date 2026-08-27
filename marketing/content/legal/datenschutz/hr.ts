// Kroatische Übersetzung von `de.ts`.
//
// Inhaltliche Änderungen gehören ZUERST in `de.ts` und werden von dort in diese
// Fassung nachgezogen — nie umgekehrt. Struktur (Abschnitte, Absätze, Listen)
// muss mit `de.ts` deckungsgleich bleiben.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Izjava o zaštiti osobnih podataka",
  metaDescription:
    "Kako myNextDays obrađuje osobne podatke: svrhe, pravne osnove, primatelji, rokovi čuvanja i vaša prava iz GDPR-a.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Ova izjava opisuje kako društvo ${ANBIETER.firma} obrađuje osobne podatke — pri posjetu ovim internetskim stranicama, pri korištenju platforme myNextDays (nadzorna ploča, tržnica i mobilna aplikacija) te u okviru poslovnog odnosa s našim klijentima.`,
    "Ne prodajemo podatke i ne stvaramo profile koji vas identificiraju kao osobu. Na ovoj web stranici mjerimo — samo uz vaš pristanak — doseg naših stranica i uspjeh našeg oglašavanja; obje kategorije mogu se pojedinačno odabrati (pogledajte odjeljke Mjerenje dosega te Oglašavanje i mjerenje uspjeha). U promotivne svrhe obrađujemo podatke samo tamo gdje ste izričito dali privolu — naime, za naš bilten (pogledajte odjeljak Komunikacija), koji možete otkazati u bilo kojem trenutku jednim klikom.",
  ],
  sections: [
    {
      heading: "Voditelj obrade",
      paragraphs: [
        "Voditelj obrade za postupke obrade opisane u ovoj izjavi jest:",
      ],
      zeilen: [
        {
          label: "Društvo",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Adresa",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "E-pošta",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Područje primjene i uloge",
      unterpunkte: [
        {
          paragraphs: [
            "Za posjet ovim internetskim stranicama, za vaš korisnički račun i za provedbu našeg poslovnog odnosa mi smo voditelj obrade u smislu čl. 4. t. 7. GDPR-a.",
          ],
        },
        {
          paragraphs: [
            "Za podatke koje naši klijenti (iznajmljivači, hoteli, agencije) na Platformi obrađuju o svojim gostima, vlasnicima i zaposlenicima, klijenti su voditelji obrade, a mi izvršitelj obrade u skladu s čl. 28. GDPR-a. Pojedinosti su navedene u [Ugovoru o obradi podataka](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Ako kao gost rezervirate smještaj putem naše tržnice, vaše rezervacijske i kontaktne podatke obrađujemo kako u vlastito ime (vođenje tržnice, obrada plaćanja) tako i za objekt koji vas ugošćuje. Vaš ugovor o smještaju sklapa se isključivo s tim objektom; uz ovu izjavu primjenjuju se i njegove obavijesti o zaštiti podataka.",
          ],
        },
      ],
    },
    {
      heading: "Posjet ovim internetskim stranicama",
      unterpunkte: [
        {
          titel: "Zapisi poslužitelja (log datoteke)",
          paragraphs: [
            "Pri svakom pozivu vaš pregljednik prenosi tehnički nužne podatke koje naš web-poslužitelj bilježi: IP-adresu, datum i vrijeme, pozvanu adresu, količinu prenesenih podataka, statusni kod, referrer i oznaku pregljednika. Svrha je pružanje stranice te prepoznavanje i sprječavanje napada i smetnji. Pravna osnova je čl. 6. st. 1. t. (f) GDPR-a; naš legitimni interes leži u sigurnom i stabilnom radu. Zapisi se čuvaju samo onoliko dugo koliko je to potrebno za rad i sigurnost i ne spajaju se s drugim podacima.",
          ],
        },
        {
          titel: "Fontovi",
          paragraphs: [
            "Korišteni fontovi ugrađeni su lokalno na našem poslužitelju. Ne dolazi do povezivanja s uslugom Google Fonts ni s bilo kojom drugom uslugom fontova.",
          ],
        },
        {
          titel: "Ikone",
          paragraphs: [
            "Ikone ovih internetskih stranica nalaze se, kao i fontovi, kod nas: ugrađuju se u stranicu na našem poslužitelju i ne dohvaćaju se dodatno od neke usluge ikona. Pri tome ne dolazi do povezivanja s trećom stranom i vaša se IP-adresa nikome ne prenosi.",
          ],
        },
        {
          titel: "Zaštita kontaktnog obrasca od neželjene pošte (reCAPTCHA)",
          paragraphs: [
            "Naš kontaktni obrazac zaštićen je od automatiziranih masovnih poruka uslugom reCAPTCHA Enterprise društva Google Ireland Limited. Samo ako na to pristanete, vaš pregljednik pri ispunjavanju obrasca učitava skriptu s www.google.com; pri tome se vaša IP-adresa i podaci o vašoj interakciji s obrascem prenose društvu Google i tamo analiziraju kako bi se razlikovao čovjek od skripte. Pravna osnova je čl. 6. st. 1. t. (a) GDPR-a (privola); dodatno se primjenjuje [Googleova izjava o zaštiti podataka](https://policies.google.com/privacy).",
            "Bez vašeg pristanka, ništa se neće učitati s Googlea i nikakvi podaci neće tamo teći; tada nećemo prihvatiti obrazac, ali nam uvijek možete poslati e-poštu. Ako pristanete, reCAPTCHA postavlja vlastiti kolačić (_GRECAPTCHA, trajanje određuje Google, do šest mjeseci) koji se koristi za procjenu rizika. Svoj pristanak možete promijeniti ili opozvati u bilo kojem trenutku putem ikone kolačića u donjem lijevom kutu svake stranice; kolačić će tada biti izbrisan.",
          ],
        },
        {
          titel: "Mjerenje dosega (Google Analytics)",
          paragraphs: [
            "Na ovoj web stranici koristimo Google Analytics 4 tvrtke Google Ireland Limited za mjerenje načina korištenja naših stranica – koje se stranice posjećuju, odakle posjetitelji dolaze i u kojoj točki odustaju. Svrha je isključivo poboljšanje ponude i pronalazivosti.",
            "Učitavanje se vrši isključivo uz vaš pristanak. Ako ga date, vaš preglednik učitava skriptu s www.googletagmanager.com i pohranjuje dva kolačića („_ga“ i „_ga_<ID>“, trajanje do dvije godine) s nasumično generiranim ID-om; prenose se ovaj ID, posjećene stranice, izvor preporuke, približna lokacija na razini države ili regije, uređaj i preglednik te vaša IP adresa, koju Google skraćuje prije svakog pohranjivanja. Pravna osnova je čl. 6. st. 1. lit. a GDPR-a (pristanak).",
            "Izričito smo ograničili analizu: Google signali i personalizacija oglasa su isključeni. Stoga se ne stvaraju profili među uređajima i ciljne skupine za oglašavanje, a mi ne prosljeđujemo podatke o korištenju oglašivačkim mrežama. Ne dolazi do spajanja s vašim korisničkim računom.",
            "Google obrađuje podatke kao naš obrađivač na temelju ugovora prema čl. 28. GDPR-a (Google Ads Data Processing Terms). Skraćivanje vaše IP adrese odvija se na poslužiteljima u EU prije nego što se podaci prenesu u SAD; stoga se prenosi pseudonimizirani skup podataka. Osnova prijenosa je odluka Europske komisije o primjerenosti za EU-US Data Privacy Framework (čl. 45. GDPR-a), prema kojoj je Google LLC certificiran; dodatno, Google je uključio standardne ugovorne klauzule Europske komisije (čl. 46. GDPR-a). Izričito ističemo da američke vlasti prema odjeljku 702 FISA-e mogu pristupiti podacima certificiranih tvrtki i stoga se preostali rizik ne može u potpunosti isključiti. Dodatno se primjenjuje [Googleova politika privatnosti](https://policies.google.com/privacy).",
            "Trajanje pohrane: Podaci o događajima i korisnicima automatski se brišu iz našeg vlasništva nakon 14 mjeseci; agregirani podaci izvješća bez veze s pojedinačnim posjetiteljima ostaju zadržani. Vaš pristanak istječe nakon šest mjeseci.",
            "Bez vašeg pristanka ništa se ne učitava, ne postavlja se kolačić i ne prenose se podaci Googleu. Svoj pristanak možete povući u bilo kojem trenutku putem ikone kolačića u donjem lijevom kutu svake stranice; mjerenje se tada odmah prekida i navedeni kolačići se brišu. Nakon šest mjeseci ponovno ćemo vas pitati.",
          ],
        },
        {
          titel: "Oglašavanje i mjerenje uspješnosti",
          paragraphs: [
            "Uz vaš pristanak koristimo marketinške kolačiće za mjerenje uspješnosti našeg oglašavanja i prikazivanje relevantnih oglasa na drugim platformama. Uključeni su Meta Platforms Ireland (Meta-Pixel, kolačić _fbp), LinkedIn Ireland (Insight-Tag, kolačići li_gc i bcookie) i Google Ireland Limited (Google Ads, kolačić _gcl_au). Pravna osnova je čl. 6. st. 1. lit. a Opće uredbe o zaštiti podataka. Bez vašeg pristanka nijedna od ovih skripti neće biti učitana i nijedan kolačić neće biti postavljen; u slučaju povlačenja, izbrisat ćemo ih. Detalji o svakom kolačiću nalaze se u [Pravilima o kolačićima](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Korisnički račun i korištenje Platforme",
      paragraphs: [
        "Za registraciju i vođenje računa obrađujemo podatke koje unesete vi ili vaš objekt: ime, naziv društva i pravni oblik, adresu, adresu e-pošte, telefonski broj, ulogu i ovlaštenja, registarske podatke (npr. broj u sudskom registru ili PDV broj), bankovne podatke za isplate te sadržaje koji se u računu kreiraju.",
        "Radi zaštite pristupa dodatno obrađujemo zapise o prijavama (vrijeme, IP-adresa, uređaj i pregljednik prijave) te — ako je aktivirana — podatke dvofaktorske autentifikacije.",
        "Prijava putem Googlea: umjesto adresom e-pošte i zaporkom možete se prijaviti i Google računom. Odaberete li taj put, od društva Google Ireland Limited primamo isključivo vašu adresu e-pošte, vaše ime, vašu profilnu sliku i identifikator vašeg Google računa (opsezi „openid”, „email”, „profile”) — izričito nikakav pristup vašoj e-pošti, kontaktima, datotekama ili kalendaru. Vašu Google zaporku ne doznajemo. Google pri tome postupak prijave obrađuje kao samostalni voditelj obrade; primjenjuje se [Googleova izjava o zaštiti podataka](https://policies.google.com/privacy). Pravna osnova je čl. 6. st. 1. t. (b) GDPR-a, jer prijava služi izvršenju ugovora; odabir tog načina prijave dobrovoljan je i u svakom trenutku zamjenjiv prijavom adresom e-pošte i zaporkom.",
        "Pravna osnova je čl. 6. st. 1. t. (b) GDPR-a (izvršenje ugovora o korištenju, vidjeti [Opće uvjete poslovanja](" +
          AGB_URL +
          ")), za zaštitu pristupa čl. 6. st. 1. t. (f) GDPR-a, a za čuvanje po poreznim i trgovačkim propisima čl. 6. st. 1. t. (c) GDPR-a.",
      ],
    },
    {
      heading: "Rezervacije, podaci o gostima i objektima",
      paragraphs: [
        "Putem Platforme obrađuju se rezervacije, podaci o gostima, poruke, zadaci i obračuni. To osobito uključuje ime i kontaktne podatke gosta, dolazak i odlazak, broj putnika, cijene i status plaćanja, povijest poruka te — ako ih objekt bilježi — prijavne podatke i posebne želje.",
        "Ta se obrada provodi po nalogu i prema uputama pojedinog objekta. Te podatke ne koristimo u vlastite svrhe, ne za oglašavanje i ne za treniranje modela umjetne inteligencije.",
        "Unutar jednog objekta podaci su razdvojeni po ulogama: osoblje za čišćenje i usluge ne vidi financijske i prodajne podatke, vlasnici samo svoje vlastite objekte. Između različitih objekata podaci su tehnički odvojeni (pravila pristupa po zakupcu izravno u bazi podataka).",
      ],
    },
    {
      heading: "Obrada plaćanja",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Plaćanja karticom i isplate provode se putem društva Stripe Payments Europe, Limited, Irska. Pri tome se društvu Stripe prenose podaci potrebni za plaćanje (iznos, valuta, sredstvo plaćanja, ime, adresa e-pošte, referenca rezervacije) te za račune naših klijenata zakonom propisani identifikacijski podaci (nositelj, stvarni vlasnici, podaci iz osobnog dokumenta, bankovni podaci). Cjeloviti podaci o kartici ne dolaze do naših sustava. Pravne osnove su čl. 6. st. 1. t. (b) GDPR-a te, za obveze identifikacije i sprječavanja pranja novca, čl. 6. st. 1. t. (c) GDPR-a. Pojedinosti uređuje [Stripeova izjava o zaštiti podataka](https://stripe.com/privacy).",
            "Poveznice za plaćanje dodatnih usluga: ako objekt svojem gostu dodatnu uslugu (npr. čišćenje ili pranje rublja) naplati putem poveznice za plaćanje, ta poveznica vodi na stranicu za plaćanje kojom upravlja Stripe. Za to društvu Stripe prenosimo naziv usluge, iznos, valutu te internu referencu na rezervaciju i objekt; logotip objekta prenosi se na njegov Stripe račun kako bi stranica prikazivala njegovu marku. Na samoj stranici za plaćanje Stripe prikuplja podatke o plaćanju i uređaju gosta u vlastitoj odgovornosti. Nama se vraćaju samo status plaćanja, iznos, zadržani iznosi i identifikatori plaćanja — nikakvi podaci o kartici.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Ako objekt nudi PayPal kao način plaćanja, podaci o plaćanju prenose se društvu PayPal (Europe) S.à r.l. et Cie, S.C.A., Luksemburg. Primjenjuje se [PayPalova izjava o zaštiti podataka](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Prodajni kanali i portali",
      paragraphs: [
        "Ako objekt svoje smještajne jedinice prodaje putem portala kao što su Booking.com, Airbnb ili Expedia, raspoloživosti, cijene, ograničenja i podaci o rezervacijama razmjenjuju se s dotičnim portalom putem našeg pružatelja usluge povezivanja Channex.io Ltd, Ujedinjena Kraljevina. Iz tog smjera primamo rezervacijske podatke i podatke o gostima s portala.",
        "Za pojedini portal primjenjuju se njegove vlastite odredbe o zaštiti podataka; u tom je dijelu portal samostalno odgovoran. Pravna osnova prijenosa je čl. 6. st. 1. t. (b) GDPR-a u vezi s nalogom objekta.",
      ],
    },
    {
      heading: "Komunikacija",
      unterpunkte: [
        {
          titel: "E-pošta",
          paragraphs: [
            "E-poštu u okviru korištenja (potvrde rezervacija, sustavne obavijesti, podrška, poveznice za potvrdu i pozivnice) šaljemo i primamo putem vlastitog poslužitelja e-pošte kojim sami upravljamo. Za te poruke nije uključena nikakva vanjska usluga otpreme.",
          ],
        },
        {
          titel: "Newsletter i prijava unaprijed",
          paragraphs: [
            "Na našim internetskim stranicama možete se prijaviti za novosti o platformi myNextDays (prijava unaprijed / newsletter). Pri tome se obrađuju vaša adresa e-pošte, jezik i mjesto na kojem ste se prijavili.",
            "Prijava se provodi postupkom dvostruke potvrde (double opt-in): nakon upisa primate e-poštu s poveznicom za potvrdu; prijava je na snazi tek klikom na nju. Radi dokazivanja privole čuvamo vrijeme prijave i potvrde, pri tome korištenu IP-adresu, oznaku pregljednika te tekst s kojim ste se složili. Ti podaci služe isključivo dokazivanju u skladu s čl. 7. st. 1. GDPR-a i ne analiziraju se u promidžbene svrhe.",
            "Pravna osnova je vaša privola u skladu s čl. 6. st. 1. t. (a) GDPR-a; čuvanje dokaza temeljimo na čl. 6. st. 1. t. (c) u vezi s čl. 7. st. 1. GDPR-a. Privolu možete u svakom trenutku povući s učinkom za budućnost — putem poveznice za odjavu u svakoj poruci newslettera ili neformalno e-poštom nama. Povlačenje ne utječe na zakonitost obrade provedene do tog trenutka.",
            "Za upravljanje newsletterom i njegovu otpremu koristimo Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Pariz, Francuska; njemačka podružnica: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin) kao izvršitelja obrade. Prenose se vaša adresa e-pošte i navedeni dodatni podaci (jezik, izvor). Podaci se obrađuju na poslužiteljima unutar Europske unije (Francuska i Njemačka); s društvom Brevo sklopljen je ugovor o obradi podataka u skladu s čl. 28. GDPR-a. Primjenjuje se [Brevoova izjava o zaštiti podataka](https://www.brevo.com/legal/privacypolicy/).",
            "Kada pošaljemo newsletter, Brevo po našem nalogu mjeri je li poruka otvorena i je li kliknuto na poveznice u njoj. To nam mjerenje pomaže prilagoditi sadržaj i učestalost; dio je privole i prestaje s vašom odjavom. Spajanje s drugim izvorima podataka ili izrada profila ne provodi se.",
            "Dok potvrda nije dana, vaša se adresa ne kontaktira i ne prenosi društvu Brevo; nepotvrđen upis istječe nakon sedam dana. Nakon odjave adresu blokiramo za otpremu i čuvamo dokaz o privoli i odjavi onoliko dugo dok se iz njega mogu ostvarivati zahtjevi; na zahtjev ga u cijelosti brišemo.",
          ],
        },
        {
          titel: "Poruke na Platformi",
          paragraphs: [
            "Poruke između gosta i objekta čuvaju se na Platformi kako bi obje strane mogle pregledavati povijest. Ako objekt blokira gosta, kanal za poruke se zatvara; postojeće poruke ostaju sačuvane radi mogućnosti praćenja.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Ako objekt koristi povezivanje s WhatsAppom, sadržaji poruka i telefonski brojevi sudionika prenose se putem platforme WhatsApp Business Platform društva Meta Platforms Ireland Limited. O korištenju te funkcije odlučuje objekt; bez aktivacije prijenosa nema.",
          ],
        },
      ],
    },
    {
      heading: "Automatizirane funkcije i umjetna inteligencija",
      paragraphs: [
        "Za funkcije opisane u ovom odjeljku, uz GDPR, primjenjuje se i Uredba (EU) 2024/1689 (Uredba o umjetnoj inteligenciji, „AI Act”), čije su obveze transparentnosti iz čl. 50. primjenjive od 2. kolovoza 2026.",
      ],
      unterpunkte: [
        {
          titel: "Predlošci odgovora",
          paragraphs: [
            "Za predloške odgovora u ulaznom pretincu poruka koristimo — ako je funkcija aktivirana za objekt — ponudu jezičnih modela društva Groq, Inc., SAD. Pri tome se toj usluzi prenosi kontekst pojedine poruke. Predlošci se ne šalju automatski; o otpremi uvijek odlučuje čovjek. Automatizirano donošenje odluka s pravnim učinkom u smislu čl. 22. GDPR-a ne provodi se.",
            "Time se ne radi o sustavu umjetne inteligencije koji u smislu čl. 50. st. 1. Uredbe o umjetnoj inteligenciji neposredno stupa u interakciju s fizičkim osobama: ta obveza pretpostavlja NEPOSREDNU interakciju u kojoj umjetna inteligencija sama komunicira s osobom, a ne putem ljudskog posrednika. Ovdje funkcija objektu predlaže tekst koji zaposlenik provjerava, može izmijeniti i sam otprema — zaposlenik je taj posrednik, a gost dopisuje s objektom, a ne s chatbotom. Asistent koji automatski odgovara nije u upotrebi. Prema našoj procjeni funkcija ne ispunjava ni jedan od uvjeta za umjetnu inteligenciju visokog rizika iz Priloga III. Uredbe o umjetnoj inteligenciji.",
            "Poruke gostima nadalje nisu „tekst o pitanjima od javnog interesa” u smislu čl. 50. st. 4. Uredbe o umjetnoj inteligenciji: ne objavljuju se, nego se pojedinačno šalju određenoj osobi i odnose se na provedbu jednog odmora. Neovisno od toga, ovdje se primjenjuje ljudska provjera od strane zaposlenika koji otprema poruku.",
            "Ako bi se u budućnosti nudila funkcija koja samostalno — bez ljudskog odobrenja — odgovara gostima, gost će na početku dijaloga biti vidljivo upozoren da dopisuje sa sustavom umjetne inteligencije. Bez te obavijesti takva se funkcija ne pruža.",
          ],
        },
        {
          titel: "Uloge prema Uredbi o umjetnoj inteligenciji",
          paragraphs: [
            "Za funkcije umjetne inteligencije ugrađene u proizvod mi smo subjekt koji uvodi sustav u smislu čl. 3. t. 4. Uredbe o umjetnoj inteligenciji; dobavljači osnovnih jezičnih modela su dotični pružatelji modela. Ako objekt te funkcije koristi u okviru svoje profesionalne djelatnosti, on je s te strane subjekt koji uvodi sustav i na njega se primjenjuje obveza pismenosti u području umjetne inteligencije iz čl. 4. Uredbe o umjetnoj inteligenciji, koja se od 2. veljače 2025. primjenjuje neovisno o veličini poduzeća. Od 27. srpnja 2026. primjenjuje se u tekstu Uredbe (EU) 2026/1744: dobavljači i subjekti koji uvode sustav poduzimaju mjere za podupiranje razvoja pismenosti svojeg osoblja u području umjetne inteligencije; pri tome se izričito ne mora jamčiti određena razina. Mi pružamo podršku obavijestima u aplikaciji i u našem centru za pomoć; osposobljavanje vlastitih zaposlenika ostaje zadatak objekta.",
            "Ako objekt svoj račun poveže s vlastitim asistentom umjetne inteligencije (vidjeti sljedeću točku), i za to je subjekt koji uvodi sustav u smislu Uredbe o umjetnoj inteligenciji — on odlučuje o upotrebi i formulira upite. Sučelje samo po sebi nije sustav umjetne inteligencije: ono čita podatke iz baze podataka i vraća ih, bez izvođenja zaključaka; uvodna izjava 12. Uredbe o umjetnoj inteligenciji takve sustave izričito razgraničuje od umjetne inteligencije.",
          ],
        },
        {
          titel: "Povezivanje s vlastitim asistentom umjetne inteligencije",
          paragraphs: [
            "Objekt može svoj račun putem sučelja povezati s asistentom umjetne inteligencije koji je sam odabrao i s kojim ima vlastiti ugovor — primjerice Claude društva Anthropic PBC, SAD. Ako je takva veza dana, asistent može na upit objekta čitati: zauzetost, raspoloživost i dnevne cijene; rezervacije s imenom gosta, razdobljem boravka, objektom, kanalom rezervacije, statusom te iznosom i valutom, u mjeri u kojoj uloga računa koji postavlja upit smije vidjeti iznose; te pregled razgovora u ulaznom pretincu. Bez dane veze prijenosa nema.",
            "Pri tome se ne prenose adresa e-pošte i telefonski broj gostiju, podaci o kartici, bankovni podaci i dokazi o plaćanju, pristupni kodovi te dosjei objekata. Bilješke o rezervaciji i sadržaj poruka gostiju standardno su izuzeti, jer mogu sadržavati podatke o zdravlju ili druge posebne kategorije podataka iz čl. 9. GDPR-a; objekt ih pri davanju veze mora izričito i odvojeno odobriti.",
            "Vezu može dati samo račun s ulogom „administrator”, a ne svaki račun s pristupom. Svaki se poziv bilježi i objekt ga može pregledati pod „Račun → Veze”; tamo vezu može u svakom trenutku prekinuti, čime pristup odmah prestaje.",
            "Pravno je taj prijenos uputa objekta nama (čl. 28. st. 3. t. (a) GDPR-a). Pružatelj asistenta nije naš podizvršitelj obrade — ne angažiramo ga i ne dajemo mu upute; on podatke obrađuje na temelju ugovora koji je objekt sam s njim sklopio. Za pravnu osnovu te obrade, za informiranje svojih gostiju i za garancije prijenosa u treću zemlju odgovoran je zato objekt.",
          ],
        },
        {
          titel: "Prijevodi",
          paragraphs: [
            "Tekstovi objekata i sadržaja mogu se prevoditi putem usluge Cloud Translation API društva Google Ireland Limited. Pri tome se prenose tekstovi koje treba prevesti; osobni podaci samo u mjeri u kojoj su u tim tekstovima sadržani.",
          ],
        },
        {
          titel: "Preporuke cijena",
          paragraphs: [
            "Za preporuke cijena pristupamo tržišnim, meteorološkim i valutnim podacima iz vanjskih izvora. Ti upiti ne sadrže osobne podatke, nego samo mjesto, razdoblje i obilježja objekta.",
          ],
        },
      ],
    },
    {
      heading: "Internetske stranice i domene naših klijenata",
      paragraphs: [
        "Ako objekt putem alata za izradu stranica izradi vlastite internetske stranice s vlastitom domenom, potrebnim DNS zapisima upravljamo putem društva Cloudflare, Inc. Pri tome se prenose podaci o domeni i konfiguraciji; podatke posjetitelja klijentovih stranica obrađujemo kako je opisano u ovoj izjavi.",
        "Za sadržaje, impressum i obavijesti o zaštiti podataka klijentovih internetskih stranica odgovoran je dotični objekt.",
      ],
    },
    {
      heading: "Hosting i pohrana",
      paragraphs: [
        "Platforma, baza podataka, mediji i poslužitelj e-pošte rade na poslužiteljima društva Hetzner Online GmbH, Njemačka, u podatkovnom centru u Helsinkiju (Finska) — dakle unutar Europske unije. S društvom Hetzner sklopljen je ugovor o obradi podataka.",
        "Sigurnosne kopije izrađuju se šifrirano i šifrirano se čuvaju kod pružatelja usluge pohrane unutar EU-a.",
      ],
    },
    {
      heading: "Pregled primatelja",
      paragraphs: [
        "Osim navedenim pružateljima usluga, osobne podatke dalje prenosimo samo ako smo na to zakonom obvezani (npr. poreznim tijelima, tijelima kaznenog progona) ili ako to zahtijevate vi odnosno odgovorni objekt.",
      ],
      list: [
        "Hetzner Online GmbH (Njemačka/Finska) — hosting, baza podataka, mediji, poslužitelj e-pošte",
        "Stripe Payments Europe, Limited (Irska) — plaćanja, isplate, provjera identiteta",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luksemburg) — plaćanja, ako je aktivirano",
        "Channex.io Ltd (Ujedinjena Kraljevina) — povezivanje s portalima za rezervacije",
        "Meta Platforms Ireland Limited (Irska) — WhatsApp poruke, ako je aktivirano",
        "Sendinblue SAS / Brevo (Francuska, Njemačka) — upravljanje newsletterom i otprema, samo uz privolu",
        "Google Ireland Limited (Irska) — prijevodi; zaštita kontaktnog obrasca od neželjene pošte (reCAPTCHA Enterprise), samo uz privolu; prijava putem Googlea, ako se koristi; Mjerenje dosega (Google Analytics 4), samo uz pristanak",
        "Groq, Inc. (SAD) — predlošci odgovora, ako je aktivirano",
        "Cloudflare, Inc. (SAD) — upravljanje DNS-om za klijentske domene",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Na tom popisu nisu usluge koje objekt sam ugovori s trećom stranom i putem sučelja poveže sa svojim računom — primjerice asistent umjetne inteligencije kao Claude društva Anthropic PBC, SAD. To nisu pružatelji usluga koje smo mi angažirali, nego primatelji po uputi pojedinog objekta; bez njegove veze tamo ne teku nikakvi podaci. Anthropic prema službenom popisu sudionika Ministarstva trgovine SAD-a nije certificiran u okviru EU-US Data Privacy Framework; prijenos se zato temelji na standardnim ugovornim klauzulama o zaštiti podataka, za koje odgovara dotični objekt kao voditelj obrade.",
          ],
        },
      ],
    },
    {
      heading: "Prijenos u treće zemlje",
      paragraphs: [
        "Obrada se u načelu provodi unutar EU-a. Kod gore navedenih usluga sa sjedištem izvan EU-a može doći do prijenosa u treću zemlju.",
        "Za Groq, Inc. i Cloudflare, Inc. (SAD) prijenos temeljimo na standardnim ugovornim klauzulama o zaštiti podataka Europske komisije u skladu s čl. 46. st. 2. t. (c) GDPR-a, ako se primatelj ne može pozvati na odluku o primjerenosti (EU-US Data Privacy Framework).",
        "Ugovorni partner za obradu plaćanja je Stripe Payments Europe, Limited (Irska). U mjeri u kojoj Stripe pri tome koristi društvo Stripe, LLC (SAD), ono je certificirano u okviru EU-US Data Privacy Framework; prijenos se u tom dijelu temelji na odluci o primjerenosti Europske komisije u skladu s čl. 45. GDPR-a. Dodatno se primjenjuju standardne ugovorne klauzule o zaštiti podataka iz [Stripeova ugovora o obradi podataka](https://stripe.com/legal/dpa).",
        "Za Channex.io Ltd (Ujedinjena Kraljevina) primjenjuje se odluka Europske komisije o primjerenosti za Ujedinjenu Kraljevinu; ako ona prestane, primjenjuju se standardne ugovorne klauzule o zaštiti podataka.",
      ],
    },
    {
      heading: "Pristup tijela trećih država (US CLOUD Act)",
      paragraphs: [
        "Pružatelji koji podliježu pravnoj jurisdikciji Sjedinjenih Američkih Država mogu na temelju američkog CLOUD Acta (Clarifying Lawful Overseas Use of Data Act, 2018) biti obvezani predati podatke američkim tijelima — i to i onda kada se ti podaci nalaze na poslužiteljima unutar Europske unije. Takav pristup može biti u suprotnosti s GDPR-om, a pružatelj može biti pravno onemogućen o tome obavijestiti nas ili vas. Ni odluka o primjerenosti za EU-US Data Privacy Framework ni standardne ugovorne klauzule o zaštiti podataka ne isključuju taj rizik.",
        "Taj rizik ograničavamo time što se nosivi sustavi — Platforma, baza podataka, mediji, poslužitelj e-pošte i sigurnosne kopije — vode kod europskih pružatelja unutar EU-a, gdje američka pravna jurisdikcija ne dosiže.",
      ],
      unterpunkte: [
        {
          titel: "Obuhvaćene usluge",
          paragraphs: [
            "Američka pravna jurisdikcija dolazi u pitanje isključivo kod sljedećih, jasno razgraničenih dodatnih usluga:",
          ],
          list: [
            "Groq, Inc. (SAD) — predlošci odgovora u ulaznom pretincu poruka, samo ako objekt aktivira tu funkciju. Prenosi se kontekst pojedine poruke.",
            "Cloudflare, Inc. (SAD) — upravljanje DNS-om za klijentske domene. Prenose se podaci o domeni i konfiguraciji, nikakvi podaci o gostima.",
            "Google LLC (SAD) — prilikom prijave s Googleom, za prijevode i mjerenje dosega (Google Analytics 4, samo uz pristanak); ugovorni partner je Google Ireland Limited, ali pristup američke matične tvrtke nije isključen.",
          ],
        },
        {
          titel: "Mogućnost izbjegavanja",
          paragraphs: [
            "Korištenje Platforme moguće je i bez tih usluga: predlošci odgovora mogu se isključiti, upravljanje DNS-om odnosi se samo na klijente s vlastitom domenom, a prijava putem Googlea dobrovoljna je alternativa prijavi adresom e-pošte i zaporkom.",
          ],
        },
        {
          titel: "Razgraničenje od europskog prava",
          paragraphs: [
            "CLOUD Act je američko pravo, a ne pravo Europske unije. Treba ga razlikovati od EU Data Acta (Uredba (EU) 2023/2854), koji uređuje promjenu pružatelja i prenosivost kod usluga obrade podataka, te od Cloud and AI Development Acta, koji se u trenutku ove izjave nalazi u europskom zakonodavnom postupku.",
          ],
        },
      ],
    },
    {
      heading: "Rok čuvanja",
      list: [
        "Podaci o računu: za trajanje poslovnog odnosa; nakon toga brisanje, ako ne postoji obveza čuvanja.",
        "Podaci o rezervacijama, računima i plaćanjima: prema danskom Zakonu o računovodstvu pet godina nakon završetka poslovne godine kojoj pripadaju; kod klijenata sa sjedištem u Njemačkoj mogu se primjenjivati dulji trgovački i porezni rokovi.",
        "Poruke i podaci o gostima na Platformi: prema uputi odgovornog objekta, najdulje do brisanja od strane njega odnosno do prestanka ugovora.",
        "Newsletter: do povlačenja privole; nepotvrđene prijave istječu nakon sedam dana. Dokaz o privoli i odjavi ostaje sačuvan i nakon toga, onoliko dugo dok je potreban kao dokaz.",
        "Zapisi o prijavama i sigurnosni događaji: kratkotrajno, radi prepoznavanja napada.",
        "Zapisi poslužitelja: samo onoliko dugo koliko je to potrebno za rad i sigurnost.",
        "Sigurnosne kopije: rotirajuće, dok ih ne zamijene novije kopije.",
      ],
    },
    {
      heading: "Vaša prava",
      paragraphs: [
        "Imate pravo na pristup (čl. 15.), ispravak (čl. 16.), brisanje (čl. 17.), ograničenje obrade (čl. 18.), prenosivost podataka (čl. 20.) i prigovor na obrade koje se temelje na legitimnim interesima (čl. 21. GDPR-a). Danu privolu možete u svakom trenutku povući s učinkom za budućnost.",
        `Za to se obratite na [${ANBIETER.email}](mailto:${ANBIETER.email}). Ako se vaši podaci odnose na korištenje Platforme od strane nekog objekta, vaš upit prosljeđujemo odgovornom objektu ili mu pomažemo pri odgovoru.`,
        `Osim toga se možete obratiti nadzornom tijelu za zaštitu podataka s pritužbom — za nas je nadležno ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Možete se obratiti i nadzornom tijelu svojeg mjesta boravišta.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Ein Abschnitt „Ihre Rechte", der die
      // Löschung nur als DSGVO-Artikel erwähnt, genügt der Prüfung nicht.
      heading: "Brisanje računa i podataka iz aplikacije",
      paragraphs: [
        "Brisanje svojeg računa možete u svakom trenutku sami zatražiti — u aplikaciji pod ‚Profil → Račun‘ ili putem našeg obrasca na webu:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "Put putem weba namjerno funkcionira i onda kada aplikaciju više nemate instaliranu ili se više ne možete prijaviti. Radi zaštite od zloupotrebe to se odvija u dva koraka: unesete adresu e-pošte svojeg računa i na točno tu adresu primate poveznicu za potvrdu. Zahtjev postaje valjan tek njezinim pozivom — sam unos adrese ne proizvodi nikakav učinak. Zahtjev obrađujemo u roku od 30 dana i odgovaramo e-poštom.",
        "S računom brišemo vaše pristupne podatke, vaš profil, vaše podatke o objektima i kalendaru te vaše poruke. Ne brišu se dokumenti za koje postoji zakonska obveza čuvanja — osobito računi i rezervacijski dokazi za obračunata razdoblja (računovodstvena obveza prema danskom pravu, u pravilu pet godina). Ti se dokumenti za trajanje roka blokiraju, dakle čuvaju isključivo radi ispunjenja te obveze i nakon toga brišu.",
      ],
    },
    {
      heading: "Sigurnost obrade",
      paragraphs: [
        "Obradu osiguravamo tehničkim i organizacijskim mjerama u skladu s čl. 32. GDPR-a, osobito: dosljednom enkripcijom prijenosa (TLS), pravilima pristupa po zakupcu izravno u bazi podataka, ovlaštenjima po ulogama uz razdvajanje financijskih i uslužnih podataka, opcionalnom dvofaktorskom autentifikacijom, ograničenjem broja pokušaja prijave, šifriranim sigurnosnim kopijama s redovitim testom obnove te bilježenjem sigurnosno relevantnih događaja.",
      ],
    },
    {
      heading: "Obveza davanja podataka",
      paragraphs: [
        "Podaci koji su nam potrebni za sklapanje ugovora, obračun i zakonske obveze nužni su — bez njih Platformu ne možemo pružati. Svi ostali podaci su dobrovoljni.",
      ],
    },
    {
      heading: "Izmjene ove izjave",
      paragraphs: [
        "Ovu izjavu prilagođavamo kada se promijene obrada, angažirani pružatelji usluga ili pravni okvir. Primjenjuje se svaki put ovdje objavljena verzija; datum na vrhu pokazuje stanje.",
      ],
    },
  ],
};

export default datenschutz;
