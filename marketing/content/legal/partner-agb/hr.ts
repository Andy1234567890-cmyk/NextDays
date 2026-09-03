// Partner-AGB — Kroatisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Uvjeti sudjelovanja u partnerskom programu myNextDays: atribucija, osnova provizije, razine, provizija tima, zabrane, označavanje, isplata.",
  numbered: false,
  toc: true,
  title: "Uvjeti sudjelovanja u partnerskom programu (Opći uvjeti poslovanja za partnere) — Nacrt",
  standIso: "2026-09-02",
  intro: [
    "NACRT — Ovi uvjeti su radna verzija myNextDays i još nisu pravno provjereni. Do objave provjerene verzije, smatraju se opisom programa, a ne konačnim ugovornim tekstom. Provjerena verzija bit će objavljena na ovoj adresi s novim brojem verzije; partneri će biti zamoljeni da ponovno pristanu pri sljedećoj prijavi.",
    `Ovi uvjeti sudjelovanja reguliraju sudjelovanje u partnerskom programu (affiliate programu) tvrtke ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (dalje u tekstu „myNextDays“ ili „mi“) od strane partnera (dalje u tekstu „Partner“).`,
    "Partnerski program namijenjen je osobama i tvrtkama sa sjedištem u EU, Švicarskoj ili Ujedinjenom Kraljevstvu koje preporučuju objekte (iznajmljivače, agencije, hotele) na myNextDays.",
  ],
  sections: [
    {
      heading: "§ 1 Sudjelovanje i odobrenje",
      paragraphs: [
        "Sudjelovanje zahtijeva prijavu putem partnerske nadzorne ploče. Obvezni podaci su ime odnosno naziv tvrtke, pravni oblik, država, najmanje jedan račun na društvenim mrežama s adresom, korisničkim imenom i dosegom, te za tvrtke, identifikacijski broj za PDV.",
        "myNextDays osobno provjerava svaku prijavu i slobodno odlučuje o odobrenju. Ne postoji pravo na prihvaćanje. Sudjelovanje je besplatno; pretplata na myNextDays nije uvjet.",
        "Partner održava svoje podatke ažurnima, posebno kanale, pravni oblik, porezne podatke i podatke za isplatu.",
        "Navedeni doseg je u početku samoprocjena. Partner može dobrovoljno povezati svoje račune na YouTubeu, Instagramu, Facebooku i TikToku; tada će se pratitelji i pregledi čitati s platforme i prikazivati kao verificirani. Neverificirani doseg imat će manju težinu pri odobrenju i kasnijim provjerama. Veza se može prekinuti u bilo kojem trenutku na nadzornoj ploči; detalji o obradi nalaze se u izjavi o zaštiti podataka.",
      ],
    },
    {
      heading: "§ 2 Dodjela objekata (Atribucija)",
      paragraphs: [
        "Objekt se dodjeljuje Partneru ako se registrira s preporučenim kodom Partnera. Kod se objektu vidljivo prikazuje prilikom registracije i potvrđuje slanjem. Kolačići za praćenje se ne postavljaju.",
        "Objekt se dodjeljuje točno jednom Partneru; mjerodavan je kod potvrđen prilikom registracije. Kasnija preraspodjela vrši se samo od strane myNextDays u slučaju dokazane pogreške.",
        "Ne dodjeljuju se objekti samog Partnera, njegovih dioničara, zaposlenika ili članova obitelji, kao ni objekti koji su već bili ili jesu klijenti myNextDays.",
      ],
    },
    {
      heading: "§ 3 Provizija na vlastite klijente",
      paragraphs: [
        "Osnova provizije je neto prihod od pretplate dodijeljenog objekta (osnovna tarifa i moduli) iz plaćenih računa — bez PDV-a, bez provizija portala, dodatnih usluga, naknadnih obračuna i ostalih prolaznih stavki.",
        "Stopa provizije ovisi o rangu partnera u trenutku plaćanja. Rangovi i stope objavljeni su na stranici programa. Rang se određuje prema broju kupaca koji plaćaju u strukturi partnera: njegovi vlastiti kupci koji plaćaju i kupci koji plaćaju njegovih timskih partnera (§ 4), svaki kupac jednom. Rang se utvrđuje mjesečno na referentni datum; napredovanje stupa na snagu odmah, a degradacija tek ako je broj bio ispod praga na dva uzastopna referentna datuma.",
        "Ako partner prvi put postigne rang od „Aufsteiger“ (Naprednik), jednokratno će dobiti bonus za napredovanje naveden za taj rang na stranici programa (trenutno 50,00 EUR po rangu, za sve partnere u eurima). Svaki rang se isplaćuje samo jednom, čak i nakon degradacije i ponovnog napredovanja. Bonus podliježe roku za povrat novca prema § 7.",
        "Provizija nastaje po poslovanju za dvanaest mjeseci od prve pretplatničke fakture koja podliježe plaćanju; besplatno probno razdoblje i besplatni mjesec posredovani putem partnera se ne uračunavaju. Ako pretplata završi prije, provizija završava s posljednjom plaćenom fakturom.",
        "Od ranga „Elite-Partner“ (Elitni partner), partner dodatno prima superproviziju u iznosu navedenom na stranici programa (trenutno 2,5 %) na neto prihod od pretplate svih kupaca njegove strukture — vlastitih kupaca i kupaca njegovih timskih partnera — bez ograničenja od dvanaest mjeseci, sve dok dotični kupac ima pretplatu koja se plaća i partner ima rang u trenutku plaćanja. Ona nastaje pored provizije prema stavku 2 i § 4.",
        "Od ranga „Elite-Partner“ (Elitni partner), partner za svaku rezervaciju koja je primljena i plaćena putem myBestDays za poslovanje koje je dodijeljeno njemu ili jednom od njegovih timskih partnera prima udio u rezervaciji u iznosu navedenom na stranici programa (trenutno 0,5 %) od iznosa rezervacije koji je platio gost u valuti rezervacije, bez vremenskog ograničenja, sve dok dodjela postoji i partner ima rang u trenutku plaćanja rezervacije. Depoziti nisu iznos rezervacije. Povrati gostu proporcionalno smanjuju udio (§ 7).",
      ],
    },
    {
      heading: "§ 4 Tim provizija",
      paragraphs: [
        "Od ranga „Aufsteiger“ (Naprednik), partner smije voditi timske partnere. Ako se drugi partner prijavi putem timskog linka partnera i vidljivo potvrdi njegov kod u svojoj prijavi, bit će dodijeljen timu partnera (u daljnjem tekstu „Sponzor“) nakon odobrenja. Ako sponzor nema rang u trenutku prijave, prijava ostaje valjana, ali ne nastaje dodjela timu.",
        "Sponzor prima timsku proviziju na neto prihod od pretplate kupaca svojih timskih partnera u visini razlike između vlastite stope provizije i stope provizije timskog partnera, svaka prema rangu u trenutku plaćanja. Ako su oboje u istom rangu ili je timski partner viši, ne nastaje timska provizija. Provizija timskog partnera i timska provizija sponzora zajedno nikada ne prelaze najvišu stopu ljestvice (trenutno 30 %).",
        "Provizija tima sastoji se točno jedne razine dubine: partneri tima ne primaju proviziju tima za partnere koje sami regrutiraju. Za regrutiranje partnera ne isplaćuje se naknada; ne naplaćuje se naknada za sudjelovanje. Provizija tima proizlazi isključivo iz plaćenog prihoda od pretplate.",
        "Provizija tima traje dvanaest mjeseci od prve plaćene fakture svakog klijenta tima, podliježe istom roku za povrat sredstava i proporcionalno se smanjuje u slučaju povrata ili terećenja (§ 7). Nastaje samo dok su sponzor i partner tima odobreni; u suprotnom se zadržava do razjašnjenja.",
        "Dodjela timu je jednokratna. Promjena se vrši samo od strane myNextDays s dokumentiranim razlogom.",
      ],
    },
    {
      heading: "§ 5 Obveze partnera i označavanje",
      paragraphs: [
        "Partner svaku preporuku označava svojim linkom ili kodom kao reklamu — na početku objave, na jeziku objave, u skladu s propisima svoje zemlje (u Njemačkoj, između ostalog, § 5a st. 4 UWG, u Danskoj markedsføringsloven § 6 st. 4). myNextDays pruža formulacije za svaku zemlju na partnerskoj nadzornoj ploči.",
        "Partner daje myNextDays samo informacije koje odgovaraju objavljenim opisima usluga i ne daje nikakva obećanja u ime myNextDays. Posebno su zabranjena obećanja o uspjehu i jamstvima (npr. „zajamčena puna popunjenost u tri dana“) kao i izjave o prihodima koje ne proizlaze iz objavljenih opisa usluga.",
        "Svaki video i svaka objava koja spominje myNextDays ili sadrži link partnera, prije objave se dostavlja kao datoteka na partnerskoj nadzornoj ploči na provjeru. Link partnera nastaje tek nakon pismenog odobrenja od strane myNextDays; objavljivanje bez odobrenja je zabranjeno. myNextDays može povući odobrenje; već nastale provizije ostaju netaknute.",
        "Za logotipe, snimke zaslona, B-Roll, prekrivanja i snimke zaslona partner koristi isključivo promotivni materijal koji pruža myNextDays. Vlastite, neprovjerene softverske snimke nisu dopuštene.",
      ],
    },
    {
      heading: "§ 6 Zabranjene prakse",
      paragraphs: ["Posebno su zabranjene:"],
      list: [
        "Brand-Bidding: plaćeni oglasi za marku „myNextDays“, varijante pisanja i kombinacije (npr. „myNextDays cijene“) u tražilicama i mrežama;",
        "Cookie-Dropping, prikrivena preusmjeravanja, iFrames, automatizirano pozivanje partnerskog linka ili druge tehničke manipulacije dodjelom;",
        "Samopromocija: registracija vlastitih poduzeća, dioničara, zaposlenika ili rodbine putem vlastitog koda ili koda partnera tima;",
        "kupljeni doseg (kupljeni pratitelji, klik-farme, bot-promet) kao i poticaji poduzećima za registraciju (povrati, darovi, nagradne igre);",
        "Obećanja o regrutiranju: regrutiranje partnera s obećanjima o zaradi koja ne potječu od plaćenog prihoda od pretplate, ili prikazivanje programa kao izvora prihoda regrutiranjem dodatnih partnera;",
        "Neželjena pošta, nedopušteno izravno oglašavanje i korištenje tuđih robnih marki ili sadržaja bez prava.",
      ],
    },
    {
      heading: "§ 7 Razdoblje povrata, povrat, zadržavanje",
      paragraphs: [
        "Svaka stavka provizije otvorena je 30 dana nakon nastanka (razdoblje povrata) i nakon toga se može isplatiti. Ako se temeljni račun u cijelosti ili djelomično vrati ili stornira (chargeback), provizija – uključujući i timsku proviziju koja se na njoj temelji – proporcionalno će se povući, čak i nakon isplate, prijebojem s budućim provizijama.",
        "U slučaju sumnje na kršenje § 2, § 5 ili § 6, myNextDays može zadržati dodjele i provizije do razjašnjenja. Ako se kršenje potvrdi, dotične provizije se poništavaju.",
      ],
    },
    {
      heading: "§ 8 Isplata i kreditiranje",
      paragraphs: [
        "Provizije koje se mogu isplatiti grupiraju se mjesečno po valuti i isplaćuju se čim dosegnu minimalni iznos dotične valute naveden na stranici programa ili u nadzornoj ploči. Konverzija između valuta se ne provodi.",
        "Obračun se provodi postupkom kreditiranja (samofakturiranje, momsloven § 52a): myNextDays izdaje kreditnu notu za svaku isplatu; partner ne izdaje račun. Partner pristaje na postupak kreditiranja.",
        "Poduzetnici primaju kreditnu notu s naznakom porezne obveze primatelja usluge (obrnuto oporezivanje); preduvjet je važeći, potvrđeni PDV identifikacijski broj. Privatne osobe primaju kreditnu notu bez PDV-a i same oporezuju proviziju.",
        "Isplata se vrši putem SEPA prijenosa, Wisea ili PayPala na podatke koje je partner pohranio u nadzornoj ploči.",
      ],
    },
    {
      heading: "§ 9 Podaci i uvid",
      paragraphs: [
        "Partner vidi dodijeljene objekte pseudonimno (broj, zemlja, status, iznosi). Imena, e-mail adrese ili podaci o rezervacijama objekata se ne otkrivaju. Sponsor vidi ime ili tvrtku, rang, broj kupaca koji plaćaju i timsku proviziju koja iz toga proizlazi od svojih timskih partnera, ali ne i detalje o kupcima.",
        "Za povezane račune i kreirane objave, myNextDays vidi pratitelje, preglede, interakcije te klikove i kupce po objavi. Nepravilnosti (npr. skok pratitelja bez odgovarajućih pregleda ili značajno odstupanje između samoprocjene i verificirane vrijednosti) su indikacije za osobnu provjeru prema § 6 i § 10, a ne automatska blokada.",
        "Obrada osobnih podataka u partnerskom programu opisana je u izjavi o zaštiti podataka.",
      ],
    },
    {
      heading: "§ 10 Trajanje, blokada i otkazivanje",
      paragraphs: [
        "Sudjelovanje je neograničeno i može ga bilo koja strana u bilo kojem trenutku prekinuti u tekstualnom obliku. Već nastale, isplative provizije isplaćuju se prema § 8; nakon prestanka ne nastaju nove provizije.",
        "myNextDays može blokirati partnera u slučaju kršenja ovih uvjeta. Tijekom blokade provizije se zadržavaju; u slučaju potvrđenog kršenja, one se poništavaju.",
      ],
    },
    {
      heading: "§ 11 Izmjene",
      paragraphs: [
        "myNextDays može promijeniti ove uvjete i razine s učinkom za budućnost. Promjene će biti objavljene na partnerskoj nadzornoj ploči i na ovoj stranici s brojem verzije; u slučaju značajnih promjena, od partnera će se tražiti ponovna suglasnost. Već nastale provizije ostaju nepromijenjene.",
      ],
    },
    {
      heading: "Članak 12. Mjerodavno pravo",
      paragraphs: [
        "Primjenjuje se dansko pravo uz isključenje kolizijskih normi. Obvezne odredbe o zaštiti potrošača države u kojoj privatni partner ima uobičajeno boravište ostaju nepromijenjene.",
      ],
    },
  ],
};
