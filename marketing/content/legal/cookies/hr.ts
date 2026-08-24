// Kroatische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Pravila o kolačićima",
  metaDescription:
    "Koje kolačiće myNextDays koristi: isključivo tehnički nužne i funkcionalne kolačiće, bez kolačića za praćenje ili oglašavanje.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Ova pravila objašnjavaju koje kolačiće i slične tehnike pohrane tvrtka ${ANBIETER.firma} koristi na ovoj internetskoj stranici i na platformi myNextDays.`,
    "Ukratko: koristimo isključivo tehnički nužne i funkcionalne kolačiće. Ne postoje analitički, oglašivački ni kolačići za praćenje, niti se podaci o korištenju prosljeđuju oglašivačkim mrežama.",
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
        "Suglasnost morate dati za točno jednu stvar: zaštitu od neželjene pošte na našem kontaktnom obrascu. Ona dolazi od tvrtke Google (reCAPTCHA Enterprise), dakle riječ je o vanjskoj usluzi, koja se učitava isključivo ako ste je dopustili. Za to pri prvom posjetu pita traka pri dnu zaslona, s ravnopravnim gumbima „Odbij” i „Prihvati”, bez unaprijed odabrane opcije. Dok se ne odlučite, vrijedi „nije dopušteno”.",
        "Vaša odluka pohranjena je u memoriji vašeg preglednika (Local Storage, vrijednost „nd_consent”); sadrži samo kategoriju, vrijeme i broj verzije, bez ikakve identifikacije vaše osobe. Na dnu ove stranice možete je u bilo kojem trenutku promijeniti ili opozvati.",
      ],
    },
    {
      heading: "Ova internetska stranica",
      paragraphs: [
        "Marketinška internetska stranica ne postavlja kolačiće. Fontovi i ikone nalaze se na našem vlastitom poslužitelju — za to se ne poziva nikakva usluga ikona ili fontova trećih strana. Jedina vanjska usluga na ovoj stranici jest zaštita od neželjene pošte na kontaktnom obrascu, a ona se učitava samo uz vašu suglasnost. Pojedinosti se nalaze u [Politici privatnosti](/datenschutz).",
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
          titel: "sb-… — prijava putem Googlea (tehnički nužno, samo pri korištenju)",
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
            "Bilježi vašu odluku o zaštiti od neželjene pošte na kontaktnom obrascu, kako traka za suglasnost ne bi pri svakom posjetu ponovno pitala. Pohranjuju se samo kategorija, vrijeme i broj verzije. Vrijednost ne napušta vaš uređaj i ne prenosi se na naš poslužitelj; vrijedi za ovaj preglednik. Ako je izbrišete, traka će vas ponovno pitati pri sljedećem posjetu.",
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
