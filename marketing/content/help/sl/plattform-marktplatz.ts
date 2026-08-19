import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Platforma (tržnica)",
  description: "Prodaja na tržnici myBestDays.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Tržnica",
      articles: [
        {
          slug: "der-marktplatz",
          title: "Tržnica myBestDays",
          excerpt: "Globalna tržnica myBestDays je lasten rezervacijski kanal poleg portalov in spletne strani.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Tržnica myBestDays (/plattform) je globalni rezervacijski kanal samega myBestDays — primerljiv z Booking ali Airbnb, vendar del iste platforme. Gostje tam brskajo po objektih vseh povezanih obratov in rezervirajo neposredno.",
            },
            { type: "h2", text: "Ne „neposredno“, temveč enakovreden kanal" },
            {
              type: "p",
              text: "Tržnica ne nadomešča neposredne rezervacije prek vaše lastne spletne strani. Je samostojna, tretja prodajna pot z lastno osjo vidnosti, lastnim naborom gostov in lastno provizijo — povsem tako kot portal, le da jo upravlja sam myBestDays.",
            },
            { type: "h2", text: "Kako objekti pridejo na tržnico" },
            {
              type: "ul",
              items: [
                "Objekt mora biti aktiven (status objekta dovoljuje prodajo).",
                "Vidnost na tržnici mora biti vklopljena — ločeno od portalov in spletne strani.",
                "Za želeno obdobje mora obstajati razpoložljivost v koledarju.",
              ],
            },
            { type: "h2", text: "Rezervacije s tržnice" },
            {
              type: "p",
              text: "Rezervacija s tržnice takoj zapre ustrezne noči na vseh drugih kanalih — enako kot rezervacija s portala ali spletne strani. Prikaže se v vašem koledarju in med rezervacijami kot vsaka druga rezervacija, označena s kanalom „Platforma“.",
            },
            {
              type: "note",
              variant: "info",
              text: "Stop-Sell in neaktiven status objekta delujeta kanalsko presegajoče in zaprejo tudi tržnico — ne glede na stikalo za vidnost tržnice.",
            },
            {
              type: "p",
              text: "Kako odprete objekt za tržnico, preberite pod [Uvrstitev objekta na tržnico](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Uvrstitev objekta na tržnico",
          excerpt: "Vidnost na tržnici je lastno stikalo, ločeno od portalov in spletne strani.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Vidnost na tržnici upravljate prek lastnega stikala pri objektu — neodvisno od tega, ali je isti objekt viden tudi na portalih ali vaši spletni strani.",
            },
            { type: "h2", text: "Tako uvrstite objekt" },
            {
              type: "steps",
              items: [
                "Odprite objekt pod Objekti.",
                "Preklopite na zavihek Vidnost.",
                "Aktivirajte stikalo Tržnica platforme.",
                "Preverite, da je status objekta aktiven in da obstaja razpoložljivost v koledarju.",
              ],
            },
            { type: "h2", text: "Pogoj: popoln profil" },
            {
              type: "p",
              text: "Tržnica prikazuje samo objekte s popolnimi podatki — naslovna fotografija, opis, oprema in osnovna cena morajo biti navedeni. Če manjkajo obvezni podatki, objekt kljub aktiviranemu stikalu ostane neviden.",
            },
            {
              type: "ul",
              items: [
                "Vsaj ena naslovna fotografija in opis",
                "Lastnosti opreme s seznama kategorij",
                "Zasedenost in osnovna cena v navedeni valuti objekta",
                "Razpoložljivost v koledarju za želeno obdobje",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "S klikom na Objavi myNextDays običajno hkrati odpre tržnico, portale in spletno stran — stikalo tržnice lahko nato kadar koli posamično znova izklopite.",
            },
            { type: "h2", text: "Ponovna odstranitev vidnosti" },
            {
              type: "p",
              text: "Če deaktivirate stikalo Tržnica platforme, objekt izgine iz iskanja na tržnici. Že potrjene rezervacije s tem niso prizadete in potekajo naprej kot običajno, glejte [Provizija tržnice](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Provizija tržnice",
          excerpt: "Za vsako rezervacijo, posredovano prek tržnice, se obračuna provizija, navedena v tarifi.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Tako kot pri vsakem rezervacijskem portalu se tudi za rezervacije, sklenjene prek tržnice myBestDays, obračuna provizija. Izračuna se za vsako rezervacijo posebej in je neodvisna od morebitnih provizij za portale.",
            },
            { type: "h2", text: "Kako se izračuna provizija" },
            {
              type: "p",
              text: "Višina se ravna po proviziji, navedeni v tarifi vašega obrata. Trenutno stopnjo najdete kadar koli pod Konto v razdelku Obračun — tam se ne uporabi pavšalna vrednost, temveč se prikaže stopnja, ki dejansko velja za vašo tarifo.",
            },
            { type: "h2", text: "Kje si ogledate provizijo" },
            {
              type: "steps",
              items: [
                "V meniju odprite Konto.",
                "Preklopite v razdelek Obračun.",
                "Odprite rezervacijo s tržnice, da si podrobno ogledate promet in provizijo.",
                "Preverite pregled provizij za tekoče obračunsko obdobje.",
              ],
            },
            { type: "h2", text: "Razmejitev od provizij portalov" },
            {
              type: "ul",
              items: [
                "Provizija tržnice velja izključno za rezervacije prek tržnice myBestDays.",
                "Rezervacije s portalov (Booking, Airbnb in drugi) so podvržene pogojem posameznega portala.",
                "Rezervacije prek spletne strani so podvržene pogojem, navedenim v vaši tarifi, brez provizije tržnice.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Provizija se samodejno določi iz vaše tarife. Manjkajoča ali nejasna tarifa vodi do jasnega sporočila o napaki namesto ocenjene vrednosti.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Profil gosta in ocene",
          excerpt: "Gostje s tržnice imajo profil z zgodovino rezervacij in lahko puščajo ocene.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Gostje, ki rezervirajo prek tržnice myBestDays, ustvarijo svoj profil gosta. V njem se zbirajo njihove rezervacije, sporočila z obrati in oddane ocene — podobno kot pri portalskem računu gosta.",
            },
            { type: "h2", text: "Kaj vidite kot obrat" },
            {
              type: "p",
              text: "V podrobnostih rezervacije s tržnice najdete profil gosta s preteklimi bivanji pri vašem obratu in, če jih je gost izrecno odprl, javno vidnimi ocenami drugih nastanitev.",
            },
            { type: "h2", text: "Ocene po bivanju" },
            {
              type: "steps",
              items: [
                "Po odjavi gost prejme poziv k oceni.",
                "Ocena se po kratkem pregledu prikaže na strani objekta na tržnici.",
                "Kot obrat lahko javno odgovorite na vsako oceno.",
                "Neprimerne ali zlorabljene ocene lahko prek funkcije Prijavi predložite v pregled.",
              ],
            },
            {
              type: "ul",
              items: [
                "Ocene so vezane na dejansko rezervacijo — brez bivanja ni ocene.",
                "Gost ocenjuje čistočo, komunikacijo, lokacijo in razmerje med ceno in kakovostjo.",
                "Vaš odgovor je viden vsem obiskovalcem tržnice.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Dobre ocene neposredno vplivajo na uvrstitev vašega objekta v iskanju na tržnici — na kritiko odzovite pravočasno in stvarno.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Blokirane osebe",
          excerpt: "Obrat lahko zapre gosta, tako da so onemogočena sporočila in rezervacije.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Če pride z gostom do težav, ga lahko kot obrat blokirate. Blokirana oseba vam ne more več pošiljati sporočil in pri vašem obratu ne more več ustvariti nove rezervacije.",
            },
            { type: "h2", text: "Blokiranje osebe" },
            {
              type: "steps",
              items: [
                "Odprite zgodovino sporočil ali rezervacijo z zadevnim gostom.",
                "Kliknite Blokiraj gosta.",
                "Potrdite pogovorno okno — zapora velja takoj.",
                "Blokirana oseba se nato prikaže v Konto pod Blokirane osebe.",
              ],
            },
            { type: "h2", text: "Kaj zapora povzroči" },
            {
              type: "ul",
              items: [
                "Gost vašemu obratu ne more več pošiljati novih sporočil.",
                "Gost pri vašem obratu ne more ustvariti nove rezervacije.",
                "Tekoča rezervacija z že potrjenim prihodom v naslednjih dveh tednih zaporo ostane nedotaknjena, da se lahko bivanje urejeno izvede.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Zapora velja izključno za vaš obrat. Drugi obrati na tržnici zapore ne vidijo in nanje ne vpliva.",
            },
            { type: "h2", text: "Ponovna odprava zapore" },
            {
              type: "p",
              text: "Odprite Konto in tam Blokirane osebe. Izberite vnos in kliknite Odpravi zaporo — gost lahko nato spet pošilja sporočila in rezervira.",
            },
          ],
        },
      ],
    },
  ],
};
