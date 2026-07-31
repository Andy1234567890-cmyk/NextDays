import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portali in upravitelj kanalov",
  description: "Centralno upravljanje Booking, Airbnb, Expedia in drugih.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Povezovanje portalov",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Kaj je upravitelj kanalov?",
          excerpt:
            "Upravitelj kanalov samodejno usklajuje cene, razpoložljivost in rezervacije med myNextDays in portali.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Ena povezava za vse portale" },
            {
              type: "p",
              text: "Upravitelj kanalov je most med myNextDays in velikimi rezervacijskimi portali, kot so Booking, Airbnb in drugi. Namesto da bi cene, razpoložljivost in zasedenost urejali posamično na vsakem portalu, vse vnesete enkrat v myNextDays — upravitelj kanalov to samodejno posreduje vsem povezanim portalom.",
            },
            { type: "h2", text: "Kaj se samodejno usklajuje" },
            {
              type: "ul",
              items: [
                "Razpoložljivost — vsaka rezervacija takoj zapre noč na vseh portalih",
                "Cene in najkrajša bivanja iz vašega cenovnega koledarja",
                "Prihajajoče rezervacije s portalov se samodejno uvozijo v myNextDays",
                "Odpovedi in Stop-Sell delujejo kanalsko presegajoče",
              ],
            },
            { type: "h2", text: "Kaj vam zaradi tega ni več treba delati ročno" },
            {
              type: "p",
              text: "Brez upravitelja kanalov bi morali po vsaki rezervaciji ročno zapreti noč na vsakem portalu — pogost vzrok za dvojne rezervacije. Z aktivnim upraviteljem kanalov myNextDays to uskladitev prevzame v obe smeri, večkrat dnevno in v realnem času ob novih rezervacijah.",
            },
            {
              type: "note",
              variant: "info",
              text: "Povezavo s portalom vzpostavite enkrat na ravni celotnega računa. Za vsak posamezen objekt nato aktivirate le še preslikavo — več o tem pod [Dodelitev objekta portalu](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Nastavitev povezave s portalom",
          excerpt:
            "Povezavo s portali vzpostavite enkrat na ravni celotnega računa — ne znova za vsak objekt.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Enkratno za celoten račun" },
            {
              type: "p",
              text: "Povezava s portali je nastavitev na ravni celotnega računa: svoj račun myNextDays natanko enkrat povežete z upraviteljem kanalov. Vsi objekti, ki jih ustvarite pozneje, samodejno uporabijo to eno povezavo — ne potrebujete je znova vzpostaviti za vsak objekt.",
            },
            { type: "h2", text: "Tako nastavite povezavo" },
            {
              type: "steps",
              items: [
                "Odprite /konto in izberite razdelek „Portali in upravitelj kanalov“",
                "Kliknite „Nastavi povezavo“ in potrdite podatke svojega obrata (naslov, kontakt, pravna oblika)",
                "Preverite samodejno prevzete osnovne podatke — posredujejo se vsem portalom",
                "Zaključite nastavitev; status se spremeni v „Povezano“",
              ],
            },
            { type: "h2", text: "Naslednji korak: dodelitev objektov" },
            {
              type: "p",
              text: "Po enkratni nastavitvi še noben objekt ni viden — za to vsak objekt posamično dodelite portalu (preslikava) in povežete želene portale, kot sta Booking.com ali Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Brez popolnih osnovnih podatkov (naslov, davčni podatki, kontakt) portali povezavo zavrnejo. Te podatke najprej preverite pod /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Dodelitev objekta portalu",
          excerpt:
            "Po povezavi na ravni celotnega računa za vsak objekt aktivirate le še preslikavo k ustreznemu portalu.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Preslikava namesto nove povezave" },
            {
              type: "p",
              text: "Ko je povezava s portalom enkrat vzpostavljena na ravni celotnega računa, vsak objekt povežete le še prek tako imenovane preslikave: določite, kateri objekt myNextDays ustreza kateremu tipu sobe oz. ponudbe na portalu. To je za vsak objekt enkraten korak.",
            },
            { type: "h2", text: "Tako dodelite objekt" },
            {
              type: "steps",
              items: [
                "Odprite objekt pod /objekte in preklopite na zavihek „Portali“",
                "Izberite želeni portal, na primer Booking.com ali Airbnb",
                "Dodelite objekt ustreznemu tipu sobe oz. ponudbe na portalu",
                "Aktivirajte sinhronizacijo — cene in razpoložljivost se od zdaj prenašajo",
              ],
            },
            { type: "h2", text: "En objekt, več portalov" },
            {
              type: "p",
              text: "Posamezen objekt je lahko hkrati dodeljen več portalom. Vsaka dodelitev je neodvisna — objekt lahko na primer naredite vidnega na Booking.com in Airbnb, na Expedii pa ga za zdaj pustite deaktiviranega.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Po preslikavi takoj preverite vidnost — glejte [Vidnost po posameznem portalu](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Povezava z Booking.com",
          excerpt: "Tako za objekt odprete Booking.com kot prodajni kanal.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Pogoj: povezava na ravni celotnega računa" },
            {
              type: "p",
              text: "Preden aktivirate Booking.com za objekt, mora biti vzpostavljena povezava s portalom na ravni celotnega računa (glejte [Nastavitev povezave s portalom](/hilfe/portale-kanalmanager/portal-verbindung)). Nato je Booking.com za vsak nadaljnji objekt le še vprašanje preslikave.",
            },
            { type: "h2", text: "Aktiviranje Booking.com" },
            {
              type: "steps",
              items: [
                "Odprite objekt pod /objekte, zavihek „Portali“",
                "Izberite „Booking.com“ s seznama razpoložljivih portalov",
                "Dodelite ustrezen tip sobe oz. ponudbe in potrdite cenovne načrte",
                "Aktivirajte vidnost — objekt bo po pregledu s strani Booking.com objavljen",
              ],
            },
            { type: "h2", text: "Kaj Booking.com od vas pričakuje" },
            {
              type: "ul",
              items: [
                "Popoln opis objekta, slike in oprema",
                "Vsaj ena tarifa s ceno in pogoji odpovedi",
                "Veljaven način plačila za provizije",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Odobritev s strani Booking.com lahko traja nekaj ur. Status v zavihku objekta „Portali“ pokaže, ali je povezava že aktivna.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Povezava z Airbnb",
          excerpt: "Tako naredite objekt prek upravitelja kanalov rezervljiv na Airbnb.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Airbnb kot dodaten portal" },
            {
              type: "p",
              text: "Airbnb se poveže tako kot vsak drug portal prek povezave na ravni celotnega računa. Ko je ta vzpostavljena, Airbnb aktivirate za posamezen objekt prek preslikave — ne glede na to, ali je objekt že viden na Booking.com ali drugih portalih.",
            },
            { type: "h2", text: "Aktiviranje Airbnb za objekt" },
            {
              type: "steps",
              items: [
                "Odprite objekt pod /objekte, zavihek „Portali“",
                "Izberite „Airbnb“ s seznama razpoložljivih portalov",
                "Potrdite kategorijo objekta in dodeljen tip ponudbe",
                "Preverite fotografije, opremo in hišni red — Airbnb pred odobritvijo zahteva popolne podatke",
                "Aktivirajte vidnost za Airbnb",
              ],
            },
            { type: "h2", text: "Po aktivaciji" },
            {
              type: "p",
              text: "Takoj ko Airbnb odobri objekt, cene in razpoložljivost samodejno potekajo prek upravitelja kanalov. Rezervacije, ki prispejo na Airbnb, se nato samodejno prikažejo v vašem koledarju rezervacij.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Brez navedenih pogojev odpovedi in hišnega reda Airbnb odobritev zavrne. Te podatke najprej dopolnite pri objektu.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Sinhronizacija cen in razpoložljivosti",
          excerpt:
            "Cene in razpoložljivost se samodejno posredujejo vsem povezanim portalom.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "En koledar, vsi portali" },
            {
              type: "p",
              text: "Cene in razpoložljivost urejate izključno v koledarju myNextDays za posamezen objekt. Upravitelj kanalov vsako spremembo samodejno posreduje vsem portalom, na katerih je objekt aktivno preslikan — brez dvojnega vnašanja.",
            },
            { type: "h2", text: "Kaj se prenaša" },
            {
              type: "ul",
              items: [
                "Dnevne cene iz vašega cenovnega koledarja oz. cenovnih načrtov",
                "Razpoložljive noči in zapore",
                "Najkrajše bivanje in omejitve prihoda/odhoda",
                "Dnevi s Stop-Sell — ti se samodejno zaprejo na vseh portalih",
              ],
            },
            { type: "h2", text: "Kako hitro deluje sinhronizacija" },
            {
              type: "p",
              text: "Spremembe cen in razpoložljivosti se portalom posredujejo v nekaj minutah. Nove rezervacije takoj zaprejo zadevne noči, tako da iste noči ni mogoče znova prodati na nobenem drugem kanalu.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Več o kanalsko presegajočem zapiranju posameznih dni najdete pod [Preprečevanje dvojnih rezervacij](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Prejemanje rezervacij s portalov",
          excerpt: "Rezervacije z Booking, Airbnb in drugih portalov se samodejno znajdejo v vašem koledarju.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Samodejni uvoz" },
            {
              type: "p",
              text: "Če gost rezervira prek portala, kot je Booking.com ali Airbnb, upravitelj kanalov rezervacijo samodejno uvozi v myNextDays. Ničesar vam ni treba ročno prenašati — rezervacija se prikaže v koledarju in na seznamu rezervacij zadevnega objekta.",
            },
            { type: "h2", text: "Kaj se zgodi pri rezervaciji s portala" },
            {
              type: "steps",
              items: [
                "Portal upravitelju kanalov sporoči novo rezervacijo",
                "myNextDays ustvari rezervacijo s podatki gosta, obdobjem in ceno",
                "Rezervirane noči se takoj zaprejo na vseh drugih kanalih",
                "Prejmete obvestilo in rezervacijo najdete v koledarju",
              ],
            },
            { type: "h2", text: "Odpovedi in spremembe" },
            {
              type: "p",
              text: "Če gost odpove prek portala ali spremeni obdobje, se to prav tako samodejno prenese v myNextDays, zadevne noči pa se ponovno sprostijo.",
            },
            {
              type: "note",
              variant: "info",
              text: "Rezervacije s portalov so v podrobnostih rezervacije prepoznavne po znački izvora, na primer Booking.com ali Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Preprečevanje dvojnih rezervacij",
          excerpt: "Stop-Sell in samodejne zapore preprečujejo dvojne rezervacije prek več portalov.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Zakaj nastanejo dvojne rezervacije" },
            {
              type: "p",
              text: "Brez centralnega upravljanja se lahko zlahka zgodi, da je ista noč hkrati prodana na dveh portalih — na primer kadar se cene in razpoložljivost ročno urejajo v več sistemih. Upravitelj kanalov to vrzel zapre s tem, da vsaka rezervacija na katerem koli kanalu takoj zapre vse druge kanale.",
            },
            { type: "h2", text: "Vaša orodja proti dvojnim rezervacijam" },
            {
              type: "ul",
              items: [
                "Samodejna zapora: vsaka nova rezervacija — ne glede na kanal — povsod zapre noči",
                "Stop-Sell: ročno zapre dan hkrati na vseh kanalih, na primer za lastno uporabo ali vzdrževanje",
                "Najkrajše bivanje in omejitve prihoda preprečujejo neustrezne kratke rezervacije",
              ],
            },
            { type: "h2", text: "Nastavitev Stop-Sell" },
            {
              type: "steps",
              items: [
                "Odprite koledar zasedenosti objekta",
                "Označite zadevni dan ali obdobje",
                "Izberite „Stop-Sell“ — dan je nato zaprt na vseh portalih ter na spletni strani in platformi",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell brez izjeme velja za vse kanale. Ni mogoče zapreti dneva samo za en portal in ga za druge pustiti odprtega.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Vidnost po posameznem portalu",
          excerpt: "Vsak portal je mogoče vklopiti ali izklopiti neodvisno od spletne strani in tržnice platforme.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Tri neodvisne prodajne poti" },
            {
              type: "p",
              text: "Objekt se lahko hkrati prodaja po več poteh: prek portalov (Booking, Airbnb in drugi), prek tržnice platforme myBestDays in prek vaše lastne spletne strani. Vsaka pot ima lastno stikalo za vidnost — so povsem neodvisna drug od drugega.",
            },
            { type: "h2", text: "Upravljanje vidnosti po portalu" },
            {
              type: "p",
              text: "Znotraj portalov je dodatno mogoče ločeno preklapljati vsak posamezen portal. Objekt je lahko na primer aktiven na Booking.com, na Airbnb pa deaktiviran — obe dodelitvi pri tem ostaneta nedotaknjeni.",
            },
            { type: "h2", text: "Tako spremenite vidnost" },
            {
              type: "steps",
              items: [
                "Odprite objekt pod /objekte, zavihek „Portali“",
                "Posamično vklopite ali izklopite želeni kanal (posamezen portal, spletno stran ali tržnico platforme)",
                "Shranite — sprememba začne veljati v nekaj minutah",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Status objekta (aktiven/neaktiven) in Stop-Sell delujeta nadrejeno na vse kanale. Stikala za vidnost upravljajo le, na katerih dodatnih kanalih se prikaže že aktiven objekt.",
            },
          ],
        },
      ],
    },
  ],
};
