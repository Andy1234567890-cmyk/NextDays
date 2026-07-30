import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Konto in naročnina",
  description: "Osnovni podatki, tarifa, varnost in dvofaktorska avtentikacija.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Konto",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Osnovni podatki obrata",
          excerpt: "Centralno urejanje imena podjetja, naslova in kontaktnih podatkov vašega obrata.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Pod /konto myNextDays vse funkcije obrata in računa združi kot razdelke na eni strani — med številnimi podstranmi vam ni treba preklapljati. Osnovni podatki obrata pri tem tvorijo temelj: ime podjetja, pravna oblika, naslov in kontaktni podatki, ki se uporabljajo za račune, portale in komunikacijo z gosti.",
            },
            { type: "h2", text: "Odpiranje in urejanje osnovnih podatkov" },
            {
              type: "steps",
              items: [
                "Odprite /konto.",
                "Preklopite na razdelek „Osnovni podatki obrata“.",
                "Preverite ime podjetja, naslov, telefonsko številko in e-poštni naslov za povratna vprašanja.",
                "Naredite svoje spremembe.",
                "Shranite razdelek.",
              ],
            },
            { type: "h2", text: "Zakaj so ti podatki pomembni" },
            {
              type: "p",
              text: "Osnovni podatki obrata se prenesejo v račune, v registracijo pri povezanih portalih in v pravno obvezne podatke, kot je impresum. Nepopoln ali zastarel naslov lahko povzroči, da so računi izdani napačno ali da se povezave s portali zamudijo.",
            },
            {
              type: "ul",
              items: [
                "Ime podjetja in pravna oblika se prikažeta na vseh izdanih računih.",
                "Naslov je potreben za registracijo pri portalih.",
                "Kontaktni podatki služijo kot rezervna pot, če sistemska obvestila ne prispejo.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Če spremenite naslov za izstavitev računov, nato preverite že izdane račune pod [Obračun in kalkulator tarif](/hilfe/konto-abo/abrechnung-tarifrechner) — obstoječi dokumenti se retroaktivno ne prilagodijo.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Naročnina in tarifa",
          excerpt: "Vaša tarifa določa kontingent objektov — trenutno zakupljeno število objektov vidite kadar koli v računu.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Vaša naročnina myNextDays vključuje kontingent objektov: največje število objektov (sob ali počitniških objektov), ki jih lahko hkrati aktivno upravljate. Trenutno zakupljeno število objektov je prikazano v razdelku „Naročnina in tarifa“ pod /konto, skupaj s preostalim kontingentom.",
            },
            { type: "h2", text: "Spremljanje kontingenta" },
            {
              type: "p",
              text: "Kontingent se uveljavlja na strani strežnika: ko dosežete zgornjo mejo svoje tarife, ni mogoče ustvariti nobenega dodatnega objekta, dokler ne deaktivirate obstoječega objekta ali razširite svoje tarife. To velja ne glede na to, ali je novi objekt soba ali počitniški objekt — oboje enako šteje h kontingentu.",
            },
            {
              type: "steps",
              items: [
                "Odprite /konto in razdelek „Naročnina in tarifa“.",
                "Preverite zakupljeno število objektov v razmerju s kontingentom svoje tarife.",
                "Po potrebi izberite večjo tarifo, da ustvarite več objektov.",
                "Potrdite zamenjavo tarife.",
              ],
            },
            {
              type: "ul",
              items: [
                "Vsak objekt šteje posamično h kontingentu, ne glede na tip objekta.",
                "Zamenjava tarife takoj vpliva na razpoložljivi kontingent.",
                "Znižanje tarife je mogoče le, če aktivno število objektov ustreza novemu kontingentu.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Znižanje na tarifo z manjšim kontingentom je zavrnjeno, dokler je aktivnih več objektov, kot dovoljuje nova tarifa. Najprej deaktivirajte presežne objekte.",
            },
            {
              type: "note",
              variant: "info",
              text: "Podrobnosti o računih in izračunu tarife najdete pod [Obračun in kalkulator tarif](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Obračun in kalkulator tarif",
          excerpt: "Naslov za izstavitev računov, pretekli računi in kalkulator tarif za vaš kontingent objektov.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Razdelek „Obračun in kalkulator tarif“ pod /konto združuje vse v zvezi z izstavljanjem računov: vaš naslov za izstavitev računov, seznam preteklih računov za prenos ter kalkulator tarif, s katerim lahko preverite stroške za svoj trenutni ali večji kontingent objektov.",
            },
            { type: "h2", text: "Naslov za izstavitev računov in računi" },
            {
              type: "p",
              text: "Naslov za izstavitev računov se lahko razlikuje od naslova vašega obrata, na primer kadar dokumente prejema davčna pisarna. Že izdani računi so razvrščeni kronološko; vsakega je mogoče prenesti kot PDF.",
            },
            { type: "h2", text: "Uporaba kalkulatorja tarif" },
            {
              type: "steps",
              items: [
                "Odprite /konto in razdelek „Obračun in kalkulator tarif“.",
                "V kalkulatorju tarif vnesite želeno število objektov.",
                "Primerjajte nastale stroške po posamezni ravni tarife.",
                "Po potrebi iz kalkulatorja neposredno preklopite na ustrezno tarifo.",
              ],
            },
            {
              type: "ul",
              items: [
                "Kalkulator tarif prikazuje stroške v valuti, nastavljeni za vaš račun.",
                "Računi so trajno na voljo za prenos.",
                "Naslov za izstavitev računov je mogoče urejati neodvisno od osnovnih podatkov obrata.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "S kalkulatorjem tarif redno preverjajte, ali vaš kontingent objektov še vedno ustreza dejansko zakupljenemu številu objektov — glejte [Naročnina in tarifa](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Sprememba gesla in e-pošte",
          excerpt: "Varnostno kritične spremembe zahtevajo ponovno prijavo in korak potrditve.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Geslo in e-poštni naslov spadata med najbolj varnostno kritične podatke vašega računa. myNextDays zato pri obeh spremembah zahteva ponovno avtentikacijo — spremembo potrdite s trenutnim geslom, tudi če ste že prijavljeni.",
            },
            { type: "h2", text: "Sprememba gesla" },
            {
              type: "steps",
              items: [
                "Odprite /konto in razdelek „Sprememba gesla in e-pošte“.",
                "Vnesite trenutno geslo za potrditev.",
                "Določite novo geslo in ga ponovite.",
                "Shranite spremembo.",
              ],
            },
            { type: "h2", text: "Sprememba e-poštnega naslova" },
            {
              type: "p",
              text: "Zamenjava e-poštnega naslova poteka kot dvojna potrditev: po potrditvi trenutnega gesla prejmete potrditveno povezavo na NOV naslov. Šele s klikom na to povezavo sprememba začne veljati — stari naslov do takrat ostane aktiven, da dostop do vašega računa nikoli ni prekinjen.",
            },
            {
              type: "ul",
              items: [
                "Brez trenutnega gesla ni mogoče spremeniti ne gesla ne e-pošte.",
                "Potrditvena povezava za nov e-poštni naslov velja časovno omejeno.",
                "Do potrditve dosedanji e-poštni naslov ostane aktiven za prijavo in obvestila.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Po spremembi e-pošte preverite tudi dvofaktorsko avtentikacijo — glejte [Dvofaktorska avtentikacija](/hilfe/konto-abo/zwei-faktor) — če so bile obnovitvene kode vezane na stari naslov.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Dvofaktorska avtentikacija",
          excerpt: "Dodaten korak prijave ščiti vaš račun pred nepooblaščenim dostopom.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Dvofaktorska avtentikacija (2FA) dopolni vaše geslo z drugim faktorjem prek aplikacije za avtentikacijo. Tako ukradeno geslo samo po sebi ne zadostuje za prijavo v vaš račun myNextDays.",
            },
            { type: "h2", text: "Nastavitev 2FA" },
            {
              type: "steps",
              items: [
                "Odprite /konto in razdelek „Dvofaktorska avtentikacija“.",
                "Potrdite svoje trenutno geslo za ponovno avtentikacijo.",
                "Skenirajte prikazano kodo QR z aplikacijo za avtentikacijo.",
                "Za potrditev vnesite generirano kodo.",
                "Prikazane obnovitvene kode shranite na varnem mestu.",
              ],
            },
            { type: "h2", text: "Deaktivacija 2FA" },
            {
              type: "p",
              text: "Tudi deaktivacija dvofaktorske avtentikacije zahteva ponovno avtentikacijo s trenutnim geslom. Tako myNextDays prepreči, da bi nekdo z že odprto sejo preprosto izklopil vašo zaščito.",
            },
            {
              type: "ul",
              items: [
                "Obnovitvene kode omogočajo dostop, če izgubite aplikacijo za avtentikacijo.",
                "Vsaka obnovitvena koda je uporabna samo enkrat.",
                "Vklop in izklop 2FA sta enako vezana na potrditev gesla.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Obnovitvene kode hranite ločeno od naprave z aplikacijo za avtentikacijo, na primer v upravitelju gesel.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Zgodovina naprav",
          excerpt: "Spremljajte, s katerih naprav je vaš račun prijavljen.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Zgodovina naprav pod /konto vam pokaže, na katerih napravah je vaš račun trenutno prijavljen — s tipom naprave, približno lokacijo in časom zadnje dejavnosti. Tako hitro prepoznate, ali prijava dejansko izvira od vas.",
            },
            { type: "h2", text: "Preverjanje zgodovine naprav" },
            {
              type: "steps",
              items: [
                "Odprite /konto in razdelek „Zgodovina naprav“.",
                "Preglejte seznam prijavljenih naprav.",
                "Če prepoznate neznano napravo, jo odjavite.",
                "Nato zaradi varnosti spremenite svoje geslo.",
              ],
            },
            { type: "h2", text: "Kdaj je pregled smiseln" },
            {
              type: "p",
              text: "Zgodovino naprav preverite zlasti po spremembi gesla ali e-pošte ter po uporabi tuje ali javne naprave. Neznan vnos je jasen opozorilni znak za nepooblaščen dostop.",
            },
            {
              type: "ul",
              items: [
                "Vsak vnos prikazuje tip naprave, približno lokacijo in zadnjo dejavnost.",
                "Posamezne naprave je mogoče ciljno odjaviti, ne da bi to vplivalo na druge.",
                "Neprepoznana naprava je razlog za takojšnjo zamenjavo gesla.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Če naprave ne prepoznate, jo takoj odjavite in nato spremenite svoje geslo pod [Sprememba gesla in e-pošte](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Zasebnost",
          excerpt: "Upravljanje indeksiranja iskalnikov po objektu in izvoz vaših podatkov.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "V razdelku „Zasebnost“ pod /konto upravljate dve stvari: ali smejo iskalniki indeksirati strani vaših objektov in kako lahko izvozite podatke, shranjene pri myNextDays.",
            },
            { type: "h2", text: "Indeksiranje iskalnikov po objektu" },
            {
              type: "p",
              text: "Privzeto je indeksiranje iskalnikov za nove objekte izklopljeno. Šele ko ga zavestno vklopite za posamezen objekt, lahko iskalniki, kot je Google, javno stran objekta uvrstijo v svoj indeks. Tako obdržite nadzor nad tem, kateri objekti so najdljivi zunaj portalov in lastne platforme.",
            },
            {
              type: "steps",
              items: [
                "Odprite /konto in razdelek „Zasebnost“.",
                "S seznama izberite želeni objekt.",
                "Vklopite ali izklopite indeksiranje iskalnikov.",
                "Pri več objektih uporabite skupno stikalo za enotno nastavitev vseh objektov.",
              ],
            },
            { type: "h2", text: "Izvoz podatkov" },
            {
              type: "p",
              text: "Prek funkcije izvoza podatkov zahtevate popolno kopijo svojih podatkov, shranjenih v računu. Izvoz se sestavi in nato ponudi za prenos.",
            },
            {
              type: "ul",
              items: [
                "Indeksiranje je mogoče upravljati posamično po objektu, s skupnim stikalom za vse objekte.",
                "Novi objekti se privzeto začnejo brez indeksiranja iskalnikov.",
                "Izvoz podatkov vsebuje podatke vašega računa in objektov v strukturirani obliki.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Indeksiranje iskalnikov je neodvisno od vidnosti na portalih in v lastni tržnici — nanaša se izključno na javno stran objekta v iskalnikih.",
            },
          ],
        },
      ],
    },
  ],
};
