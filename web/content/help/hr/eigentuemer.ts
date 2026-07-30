import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Vlasnici i obračuni",
  description: "Računi vlasnika, obračuni i provizije.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Vlasnici",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Izrada vlasnika",
          excerpt: "Kako izraditi novi račun vlasnika u myNextDays.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Vlasnici su zasebni računi u myNextDays preko kojih upravljate objektima koji pripadaju određenoj osobi ili tvrtki. Račun vlasnika dobiva ograničen uvid samo za čitanje u vlastite objekte, bez mogućnosti da sam mijenja poslovanje.",
            },
            { type: "h2", text: "Izrada novog računa vlasnika" },
            {
              type: "steps",
              items: [
                "Otvorite područje „Vlasnici” u glavnom izborniku.",
                "Kliknite „Izradi novog vlasnika”.",
                "Unesite ime, e-adresu i kontaktne podatke.",
                "Po potrebi unesite adresu za fakturiranje za obračune.",
                "Spremite račun.",
              ],
            },
            { type: "h2", text: "Postavljanje pristupa" },
            {
              type: "p",
              text: "Nakon izrade vlasniku možete poslati poziv za vlastiti pristup. Vlasnik se zatim prijavljuje vlastitim podacima i vidi isključivo objekte koji su mu pridruženi.",
            },
            {
              type: "ul",
              items: [
                "Račun vlasnika može obuhvaćati više objekata.",
                "Svaki objekt pripada točno jednom vlasniku.",
                "Kontaktni podaci i adresa za fakturiranje mogu se naknadno u svakom trenutku prilagoditi.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kako pridružiti postojeći objekt vlasniku, pročitajte pod [Pridruživanje objekta vlasniku](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Pridruživanje objekta vlasniku",
          excerpt: "Svaki objekt pripada točno jednom vlasniku — ovako postavljate pridruživanje.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "U myNextDays svaki objekt pripada točno jednom vlasniku. Višestruko pridruživanje nije predviđeno — ako objekt treba pripadati drugom vlasniku, najprije uklonite postojeće pridruživanje prije nego što postavite novo.",
            },
            { type: "h2", text: "Provedba pridruživanja" },
            {
              type: "steps",
              items: [
                "Otvorite objekt pod „Objekti”.",
                "Prijeđite na karticu „Vlasnik”.",
                "Odaberite nadležnog vlasnika s popisa.",
                "Potvrdite pridruživanje.",
                "Spremite promjenu na objektu.",
              ],
            },
            { type: "h2", text: "Promjena vlasnika" },
            {
              type: "p",
              text: "Ako se vlasnik objekta promijeni, primjerice zbog prodaje, zamijenite postojeće pridruživanje novim. Već izrađeni obračuni za protekla razdoblja pritom ostaju pridruženi izvornom vlasniku.",
            },
            {
              type: "ul",
              items: [
                "Objekt u svakom trenutku može biti pridružen samo jednom vlasniku.",
                "Bez pridruživanja objekt se ne pojavljuje ni u jednom pristupu vlasnika.",
                "Prošli obračuni ostaju sačuvani kod izvornog vlasnika.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Višestruko pridruživanje objekta više vlasnika isključeno je — sustav ne dopušta drugo istovremeno pridruživanje.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Obračun vlasnika (izvještaj)",
          excerpt: "Kako izraditi izvještaj s prihodima umanjenima za proviziju za vlasnika.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Obračun vlasnika, nazvan i izvještaj, za odabrano razdoblje objedinjuje sve prihode pridruženih objekata i odbija vašu dogovorenu proviziju. Rezultat je iznos koji isplaćujete vlasniku.",
            },
            { type: "h2", text: "Izrada izvještaja" },
            {
              type: "steps",
              items: [
                "Otvorite područje „Vlasnici” i odaberite željenog vlasnika.",
                "Prijeđite na karticu „Obračun”.",
                "Odaberite obračunsko razdoblje.",
                "Provjerite navedene rezervacije i prihode po objektu.",
                "Izradite izvještaj s odbijenom provizijom.",
              ],
            },
            { type: "h2", text: "Struktura izvještaja" },
            {
              type: "p",
              text: "Izvještaj po objektu prikazuje bruto prihode od rezervacija, od njih odbijenu proviziju i iznos isplate koji iz toga proizlazi. Dodatni troškovi poput čišćenja ili naknada mogu se, ovisno o dogovoru, posebno iskazati.",
            },
            {
              type: "ul",
              items: [
                "Bruto prihodi: zbroj svih rezervacija u razdoblju po objektu.",
                "Provizija: vaš dogovoreni udio, odbija se od prihoda.",
                "Iznos isplate: prihodi umanjeni za proviziju i eventualne druge stavke.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Iznosi u izvještaju uvijek se iskazuju u valuti objekta — ne postoji paušalna zamjenska valuta.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Izrađujte izvještaje redovito na isti datum kako bi vlasnici imali pouzdan ritam za svoje isplate.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Pristup vlasnika",
          excerpt: "Što vlasnici mogu vidjeti u svom pristupu samo za čitanje.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Pristup vlasnika zasebna je prijava u myNextDays, samo za čitanje. Vlasnici u njoj vide isključivo njima pridružene objekte te pripadajuću popunjenost i obračune — bez mogućnosti da sami mijenjaju postavke.",
            },
            { type: "h2", text: "Što vlasnici vide" },
            {
              type: "ul",
              items: [
                "Kalendar popunjenosti svojih vlastitih objekata.",
                "Izrađene izvještaje s prihodima i odbijenom provizijom.",
                "Osnovne podatke svojih objekata, primjerice opremu i opis.",
              ],
            },
            { type: "h2", text: "Aktivacija pristupa" },
            {
              type: "steps",
              items: [
                "Otvorite vlasnika pod „Vlasnici”.",
                "Kliknite „Pozovi na pristup”.",
                "Vlasnik dobiva e-poruku za postavljanje vlastite lozinke.",
                "Nakon prijave vlasnik automatski vidi samo njemu pridružene objekte.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Pristup vlasnika strogo je samo za čitanje: cijene, dostupnosti ili podatke objekta može mijenjati samo vaše poslovanje, ne sam vlasnik.",
            },
            {
              type: "note",
              variant: "info",
              text: "Više o pridruživanju objekata pronaći ćete pod [Pridruživanje objekta vlasniku](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
