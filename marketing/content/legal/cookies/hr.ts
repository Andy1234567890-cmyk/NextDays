// Kroatische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Pravila o kolačićima",
  metaDescription:
    "Koje kolačiće myNextDays postavlja: tehnički nužne kolačiće te — samo uz vaš pristanak — funkcionalne, analitičke i marketinške kolačiće. Svaka kategorija može se pojedinačno uključiti i isključiti.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Ova pravila objašnjavaju koje kolačiće i slične tehnike pohrane tvrtka ${ANBIETER.firma} koristi na ovoj internetskoj stranici i na platformi myNextDays.`,
    "Ukratko: Nužni su samo kolačići bez kojih web stranica ne funkcionira kako je zatraženo. Sve ostalo zahtijeva vaš pristanak i ne učitava se bez njega — zaštita od neželjene pošte našeg obrasca za kontakt, mjerenje dosega i marketinški kolačići kojima mjerimo uspjeh našeg oglašavanja. Svaku od ovih kategorija možete pojedinačno dopustiti ili odbiti i svoju odluku opozvati u bilo kojem trenutku.",
  ],
  sections: [
    {
      heading: "Što su kolačići",
      paragraphs: [
        "Kolačići su male tekstualne datoteke koje internetska stranica pohranjuje u preglednik. Omogućuju prepoznavanje sesije — primjerice kako biste nakon prijave ostali prijavljeni. Osim kolačića, preglednici koriste i drugu pohranu, poput Local Storagea, koja tehnički funkcionira slično.",
      ],
    },
    {
      heading: "Za što nam je potrebna vaša suglasnost",
      paragraphs: [
        "Suglasnost je prema § 9 danske uredbe o kolačićima (Cookie-bekendtgørelsen) (kojom se prenosi čl. 5. st. 3. Direktive 2002/58/EZ) potrebna samo ako pristup vašem uređaju ne služi isključivo prijenosu poruke ili nije nužno potreban za uslugu koju ste izričito zatražili.",
        "Svi kolačići koje postavljamo nužni su za prijavu, sigurnost sesije ili postavku koju ste sami odabrali — za to ništa ne pitamo, a obrnuto, ne postavljamo ni ništa za što bi bila potrebna suglasnost.",
        "Morate pristati na tri kategorije koje se sve ne učitavaju bez vašeg dopuštenja: zaštita od neželjene pošte našeg obrasca za kontakt (reCAPTCHA tvrtke Google), mjerenje dosega ove web stranice (Google Analytics 4) i marketinški kolačići (Meta, LinkedIn, Google Ads). Za to se prikazuje prozor s popisom kategorija — pri prvom posjetu, bez predizbora, svaka kategorija s vlastitim prekidačem. Dok ne donesete odluku, vrijedi „nije dopušteno“ i neće se vršiti procjena niti oglašavanje.",
        "Vaša odluka pohranjena je u memoriji vašeg preglednika (Local Storage, vrijednost „nd_consent”); sadrži samo kategoriju, vrijeme i broj verzije, bez ikakve identifikacije vaše osobe. Putem ikone kolačića u donjem lijevom kutu svake stranice možete je u bilo kojem trenutku promijeniti ili opozvati. Nakon šest mjeseci ponovno ćemo pitati — privola ne treba vrijediti neograničeno.",
      ],
    },
    {
      heading: "Ova internetska stranica",
      paragraphs: [
        "Ova web stranica sama po sebi ne postavlja kolačiće. Fontovi i simboli nalaze se na našem vlastitom poslužitelju — za to se ne poziva usluga simbola ili fontova treće strane. Dodaju se samo usluge koje dopustite: zaštita od neželjene pošte obrasca za kontakt, mjerenje dosega i marketinške usluge. Koji se kolačići pritom postavljaju, s kojim trajanjem i na kojem hostu, navedeno je u odjeljku „Kolačići trećih strana“ u nastavku. Opoziv putem ikone kolačića u donjem lijevom kutu — dotična usluga odmah prestaje i njezini se kolačići brišu. Detalji su navedeni u [Izjavi o zaštiti podataka](/datenschutz).",
      ],
    },
    {
      heading: "Kolačići platforme",
      paragraphs: [
        "Čim se prijavite na nadzornu ploču, tržnicu ili mobilni prikaz, postavljaju se sljedeći kolačići:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — prijava (tehnički nužno)",
          list: [
            "Svrha: identificira vašu prijavljenu sesiju prema poslužitelju.",
            "Sadržaj: kratkotrajni pristupni token; čitljiv samo poslužitelju (HttpOnly), prenosi se isključivo putem HTTPS-a.",
            "Trajanje: trajanje sesije odnosno do isteka tokena.",
          ],
        },
        {
          titel: "nd_refresh — produljenje sesije (tehnički nužno)",
          list: [
            "Svrha: obnavlja pristupni token kako se ne biste morali stalno iznova prijavljivati.",
            "Sadržaj: token za obnovu; HttpOnly, isključivo putem HTTPS-a.",
            "Trajanje: do odjave ili isteka.",
          ],
        },
        {
          titel: "nd_locale — odabir jezika (funkcionalno)",
          list: [
            "Svrha: pamti jezik koji ste odabrali.",
            "Sadržaj: kratica jezika, npr. „de” ili „en”.",
            "Trajanje: do promjene ili brisanja.",
          ],
        },
        {
          titel: "sidebar_state — bočna traka (funkcionalno)",
          list: [
            "Svrha: pamti je li navigacijska traka proširena ili sažeta.",
            "Sadržaj: „true” ili „false”.",
            "Trajanje: do promjene ili brisanja.",
          ],
        },
        {
          titel:
            "sb-… — prijava putem Googlea (tehnički nužno, samo pri korištenju)",
          list: [
            "Svrha: održava sesiju kada se prijavite putem Googlea.",
            "Sadržaj: token sesije usluge za prijavu.",
            "Trajanje: trajanje sesije odnosno do isteka tokena. Postavlja se samo ako odaberete prijavu putem Googlea.",
          ],
        },
      ],
    },
    {
      heading: "Local Storage",
      unterpunkte: [
        {
          titel: "nd_consent",
          paragraphs: [
            "Bilježi Vašu odluku o uslugama koje zahtijevaju pristanak (zaštita od spama obrasca za kontakt i mjerenje dosega).",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Postavlja se samo ako sami otvorite chat na ovoj internetskoj stranici i pošaljete poruku. On je ključ vašeg vlastitog razgovora — bez njega ne biste nakon promjene stranice pronašli naš odgovor. Ne sadrži nikakve podatke o vama i koristi se isključivo u tu svrhu.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Pohranjuje u pregledniku jeste li pristali na korištenje glasovnog unosa, kako se ta suglasnost ne bi ponovno tražila pri svakom posjetu. Vrijednost ne napušta vaš uređaj.",
          ],
        },
      ],
    },
    {
      heading: "Kolačići mobilne aplikacije",
      paragraphs: [
        "Mobilna aplikacija ne radi s kolačićima. Pristupni tokeni i tokeni za obnovu pohranjuju se u sigurnoj pohrani ključeva uređaja (iOS Keychain, Android Keystore) i brišu se prilikom odjave.",
      ],
    },
    {
      heading: "Kolačići trećih strana",
      paragraphs: [
        "Ako izvršite plaćanje, pružatelj usluga plaćanja (Stripe ili PayPal) može na svojoj stranici postaviti kolačiće koji su nužni za obradu i sprječavanje prijevara. Za to vrijede odredbe dotičnog pružatelja usluga.",
        "Na internetskim stranicama koje objekti izrađuju našim alatom za izradu stranica, o dodatnim kolačićima odlučuje dotični objekt, koji je odgovoran i za tamošnje obavijesti.",
        "Samo uz Vašu suglasnost, Google usluge na ovoj web stranici postavljaju sljedeće kolačiće — dva za mjerenje dosega, jedan za zaštitu od neželjene pošte. Bez Vaše suglasnosti, odgovarajuća skripta neće biti učitana i nijedan od ovih kolačića neće biti postavljen; u slučaju povlačenja, izbrisat ćemo ih.",
      ],
      unterpunkte: [
        {
          titel: "_fbp — Mjerenje uspješnosti oglasa (potreban pristanak)",
          list: [
            "Svrha: Povezuje vaš posjet s oglasom kako bismo mogli mjeriti uspješnost naših kampanja.",
            "Sadržaj: Slučajno generirani identifikator; ne sadrži podatke o imenu, e-pošti ili računu s naše strane.",
            "Davatelj: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Irska.",
            "Host: mynextdays.com (kolačić prve strane, postavljen putem Metinog skripta). Trajanje: otprilike tri mjeseca.",
          ],
        },
        {
          titel:
            "_gcl_au — Mjerenje uspješnosti Google Ads (potreban pristanak)",
          list: [
            "Svrha: Povezuje vaš posjet s Google oglasom kako bismo mogli mjeriti uspješnost naših kampanja.",
            "Sadržaj: Slučajno generirani identifikator bez veze s vašom osobom.",
            "Davatelj: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irska.",
            "Host: mynextdays.com (kolačić prve strane). Trajanje: otprilike tri mjeseca.",
          ],
        },
        {
          titel: "li_gc i bcookie — LinkedIn oglašavanje (potreban pristanak)",
          list: [
            "Svrha: Identificira vaš preglednik za LinkedIn kako bi se oglasi i njihov uspjeh mogli pratiti; li_gc dodatno pohranjuje vaš pristanak tamo.",
            "Sadržaj: Identifikator preglednika i status pristanka; ne sadrži podatke s vašeg računa kod nas.",
            "Davatelj: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Irska.",
            "Host: linkedin.com (kolačići treće strane). Trajanje: otprilike šest mjeseci odnosno godinu dana.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — Zaštita kontakt obrasca od neželjene pošte (potreban pristanak)",
          list: [
            "Domaćin: www.google.com (kolačić treće strane).",
            "Svrha: Omogućuje Googleu procjenu rizika, koja razlikuje automatizirane masovne poruke od stvarnih upita.",
            "Sadržaj: Google generirani identifikator za ovu procjenu; nema podataka o imenu, e-pošti ili računu od nas.",
            "Davatelj: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irska.",
            "Trajanje: Određuje Google, do šest mjeseci. Postavlja se tek kada ste dopustili zaštitu od neželjene pošte i otvorili obrazac za kontakt.",
          ],
        },
        {
          titel: "_ga — Mjerenje dosega (potreban pristanak)",
          list: [
            "Domaćin: mynextdays.com (kolačić prve strane, postavljen Google skriptom).",
            "Svrha: razlikuje posjetitelje kako se ponovljeni posjeti ne bi dvostruko brojali.",
            "Sadržaj: nasumično generiran identifikator bez veze s Vašom osobom; nema podataka o imenu, e-pošti ili računu.",
            "Davatelj: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irska.",
            "Trajanje: do dvije godine.",
          ],
        },
        {
          titel: "_ga_<ID> — Status sesije mjerenja (potreban pristanak)",
          list: [
            "Domaćin: mynextdays.com (kolačić prve strane, postavljen Google skriptom).",
            "Svrha: bilježi kada je započeo Vaš trenutni posjet, tako da pregledi stranica pripadaju jednoj sesiji.",
            "Sadržaj: vremenska oznaka i brojač sesije; identifikator u nazivu označava naše vlasništvo, a ne Vas.",
            "Davatelj: Google Ireland Limited.",
            "Trajanje: do dvije godine.",
          ],
        },
      ],
    },
    {
      heading: "Brisanje i upravljanje kolačićima",
      paragraphs: [
        "Kolačiće možete u bilo kojem trenutku izbrisati ili blokirati u postavkama svog preglednika. Ako blokirate nužne kolačiće, prijava na platformu tehnički neće biti moguća — javna internetska stranica i tržnica ostaju upotrebljivi bez prijave.",
        "Prilikom odjave sami uklanjamo kolačiće za prijavu.",
      ],
    },
    {
      heading: "Izmjene ovih pravila",
      paragraphs: [
        "Ako se dodaju funkcije za koje su potrebni dodatni kolačići, ažurirat ćemo ovaj popis. Uvijek vrijedi ovdje objavljena verzija; datum naveden gore pokazuje trenutno stanje.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
