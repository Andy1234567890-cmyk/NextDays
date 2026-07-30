import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Upravitelj kanalov",
  description: "Obvladovanje portalov in upravitelja kanalov.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Upravitelj kanalov",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Povežite svoj prvi portal",
          excerpt: "Tako prvič odprete portal za objekt.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče: ustvarili ste objekt, vendar portal še ni povezan",
            },
            {
              type: "p",
              text: "Vaš objekt je v myNextDays popolnoma nastavljen, vendar še ni viden na nobenem portalu, kot sta Booking.com ali Airbnb. Preden portal sprejme objekt, vaš račun enkratno potrebuje povezavo s portalom na ravni celotnega računa — nato zadostuje za vsak nadaljnji objekt le še preslikava (mapping).",
            },
            {
              type: "steps",
              items: [
                "Odprite /konto, razdelek „Portali in upravitelj kanalov“, in vzpostavite povezavo na ravni računa s svojimi podatki obrata",
                "Nato odprite objekt pod /objekte in preklopite na zavihek „Portali“",
                "Izberite želeni portal in ga dodelite ustreznemu tipu sobe oz. ponudbe",
                "Preverite fotografije, opremo, cene in pogoje odpovedi — portali zahtevajo popolne podatke",
                "Aktivirajte vidnost; status se po pregledu s strani portala spremeni v „Povezano“",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Povezavo na ravni računa vzpostavite samo enkrat. Podrobnosti pod [Povezava z Booking.com](/hilfe/portale-kanalmanager/booking-verbinden) in [Povezava z Airbnb](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Povezava z Booking.com",
          excerpt: "Tako naredite objekt prek upravitelja kanalov rezervljiv na Booking.com.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče: vaš objekt naj bo dodatno viden na Booking.com",
            },
            {
              type: "p",
              text: "Booking.com je eden od portalov, ki se povežejo prek upravitelja kanalov. Pogoj je povezava s portalom na ravni računa — če je ta že vzpostavljena, potrebujete za Booking.com le še preslikavo za vsak objekt.",
            },
            {
              type: "steps",
              items: [
                "Odprite objekt pod /objekte, zavihek „Portali“",
                "Izberite „Booking.com“ s seznama razpoložljivih portalov",
                "Dodelite ustrezen tip sobe oz. ponudbe in potrdite vsaj eno tarifo s ceno in pogoji odpovedi",
                "Nastavite veljaven način plačila za obračun provizije",
                "Aktivirajte vidnost za Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Odobritev s strani Booking.com lahko traja nekaj ur. Status v zavihku „Portali“ pokaže, ko je povezava aktivna.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Povezava z Airbnb",
          excerpt: "Tako naredite objekt prek upravitelja kanalov rezervljiv na Airbnb.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče: vaš objekt naj bo dodatno viden na Airbnb",
            },
            {
              type: "p",
              text: "Airbnb se poveže tako kot vsak drug portal prek povezave na ravni računa. Ko je ta vzpostavljena, Airbnb aktivirate za posamezen objekt prek preslikave — ne glede na to, ali je objekt že viden na Booking.com ali drugih portalih.",
            },
            {
              type: "steps",
              items: [
                "Odprite objekt pod /objekte, zavihek „Portali“",
                "Izberite „Airbnb“ s seznama razpoložljivih portalov",
                "Potrdite kategorijo objekta in dodeljen tip ponudbe",
                "Dopolnite fotografije, opremo in hišni red — Airbnb pred odobritvijo zahteva popolne podatke",
                "Aktivirajte vidnost za Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Brez navedenih pogojev odpovedi in hišnega reda Airbnb odobritev zavrne. Te podatke najprej dopolnite pri objektu.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Usklajevanje cen na vseh portalih",
          excerpt: "En koledar zadostuje — upravitelj kanalov samodejno posreduje spremembe cen vsem portalom.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče: spreminjate ceno in želite zagotoviti, da je povsod pravilna",
            },
            {
              type: "p",
              text: "Cene urejate izključno v koledarju myNextDays za objekt — nikoli posamično na samih portalih. Upravitelj kanalov vsako spremembo samodejno prenese na vse portale, na katerih je objekt aktivno preslikan.",
            },
            {
              type: "steps",
              items: [
                "Odprite cenovni koledar oz. cenovne načrte objekta",
                "Prilagodite dnevno ceno, minimalno bivanje ali omejitev prihoda/odhoda",
                "Shranite spremembo — najprej velja interno pri objektu",
                "V zavihku „Portali“ preverite, da so vsi želeni portali še naprej aktivno preslikani",
                "Počakajte nekaj minut, da se sprememba prenese na portale",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Cen nikoli ne vnašajte neposredno v portalu — take spremembe se ob naslednji uskladitvi prepišejo s podatki iz koledarja myNextDays.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Uvoz rezervacije s portala",
          excerpt: "Rezervacije s portalov se samodejno znajdejo v koledarju — tukaj preverite, ali je uvoz uspel.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče: gost je rezerviral prek portala, rezervacija naj pride v myNextDays",
            },
            {
              type: "p",
              text: "Če gost rezervira prek Booking.com, Airbnb ali drugega povezanega portala, upravitelj kanalov rezervacijo samodejno uvozi — ničesar vam ni treba ročno prenašati. Ta postopek opisuje, kako preverite in potrdite uvoz.",
            },
            {
              type: "steps",
              items: [
                "Odprite koledar ali seznam rezervacij zadevnega objekta",
                "Poiščite novo rezervacijo — nosi značko izvora portala, na primer Booking.com ali Airbnb",
                "Preverite popolnost podatkov gosta, obdobja in cene",
                "Preverite, da so rezervirane noči na vseh drugih kanalih prikazane kot zaprte",
                "Po potrebi odprite podrobnosti rezervacije za urejanje dodatnih storitev ali sporočil gosta",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Če gost odpove prek portala ali spremeni obdobje, se tudi to samodejno prevzame in noči se ponovno sprostijo.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Reševanje dvojne rezervacije",
          excerpt: "Kako ravnati, kadar je bila ista noč izjemoma prodana na dveh kanalih.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče: dve rezervaciji se prekrivata za isti objekt in iste noči",
            },
            {
              type: "p",
              text: "Upravitelj kanalov običajno takoj zapre rezervirane noči na vseh kanalih. Kljub temu lahko pride do dvojne rezervacije, na primer pri sočasnih rezervacijah na dveh portalih v istem trenutku ali pri ročno ustvarjeni rezervaciji, ki trči z rezervacijo s portala.",
            },
            {
              type: "steps",
              items: [
                "Odprite koledar objekta in poiščite obe prekrivajoči se rezervaciji",
                "Preverite čas rezervacije in značko izvora obeh rezervacij",
                "Kontaktirajte pozneje prispelega gosta in mu ponudite nadomestni objekt ali alternativno obdobje",
                "Odpovejte neizvedljivo rezervacijo na ustreznem portalu, ne samo v myNextDays",
                "Za zadevne noči nato nastavite Stop-Sell, dokler primer ni popolnoma razrešen",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Rezervacijo s portala vedno odpovejte prek samega portala — odpoved samo v myNextDays noč sicer interno sprosti, vendar portala ne obvesti zanesljivo.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Začasna zaustavitev portala",
          excerpt: "Vidnost izklopite posamično za vsak portal, ne da bi izgubili preslikavo.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče: objekt naj na portalu začasno ne bo rezervljiv",
            },
            {
              type: "p",
              text: "Vidnost je preklopna posamično za vsak portal — neodvisno od spletne strani in tržnice platforme. Če želite na primer Airbnb za kratek čas zaustaviti, Booking.com pa naj deluje naprej, deaktivirajte izključno ta en kanal.",
            },
            {
              type: "steps",
              items: [
                "Odprite objekt pod /objekte, zavihek „Portali“",
                "Poiščite vnos portala, ki ga želite zaustaviti",
                "Izklopite vidnost za ta portal",
                "Shranite — sprememba začne veljati v nekaj minutah, objekt izgine iz rezultatov iskanja na tem portalu",
                "Vidnost ponovno vklopite, ko naj bo objekt spet rezervljiv",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Preslikava ob zaustavitvi ostane ohranjena — dodelitve portalu vam pozneje ni treba znova vzpostaviti. Za popolno zaporo vseh kanalov namesto tega uporabite Stop-Sell.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Preverjanje preslikave objekta",
          excerpt: "Tako preverite, ali je vaš objekt še vedno pravilno dodeljen ustreznemu tipu ponudbe na portalu.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče: cene ali razpoložljivost na portalu se ne ujemajo več z myNextDays",
            },
            {
              type: "p",
              text: "Če se prikaz na portalu razlikuje od vašega koledarja myNextDays, je vzrok pogosto napačna ali prekinjena preslikava — povezava med vašim objektom in tipom sobe oz. ponudbe na portalu.",
            },
            {
              type: "steps",
              items: [
                "Odprite objekt pod /objekte, zavihek „Portali“",
                "Preverite status zadevnega portala — prikazovati bi moral „Povezano“, ne „Napaka“ ali „V obdelavi“",
                "Preverite, ali dodeljen tip sobe oz. ponudbe na portalu še vedno ustreza dejanskemu objektu",
                "Ob odstopanju: prekinite preslikavo in jo ponovno vzpostavite, nato znova aktivirajte vidnost",
                "Po popravku počakajte nekaj minut in znova preverite cene ter razpoložljivost na portalu",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Objekt je lahko dodeljen več portalom hkrati — pri neskladjih ciljno preverite en zadevni portal, ne vseh naenkrat.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Različne tarife za posamezen portal",
          excerpt: "Kako portalu dodelite lasten cenovni načrt, ne da bi vplivali na preostale kanale.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče: na portalu želite ponuditi drugačno ceno kot na preostalih kanalih",
            },
            {
              type: "p",
              text: "Cenovne načrte lahko dodelite posamično za vsak portal, na primer nepreklicen cenovni načrt za en portal in prilagodljivega za drugega. Osnovne cene ostajajo centralno urejene pri objektu, preslikava pa določa, kateri cenovni načrt gre na kateri portal.",
            },
            {
              type: "steps",
              items: [
                "Pri objektu ustvarite dodatni cenovni načrt z želenimi pogoji (cena, pogoji odpovedi, minimalno bivanje)",
                "Odprite zavihek „Portali“ in izberite zadevni portal",
                "V preslikavi dodelite temu portalu nov cenovni načrt",
                "Preostale portale pustite nespremenjene pri njihovem dosedanjem cenovnem načrtu",
                "Shranite in po nekaj minutah preverite prikaz cene na zadevnem portalu",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vsak cenovni načrt se prenaša neodvisno — sprememba enega cenovnega načrta ne vpliva na portale, ki so dodeljeni drugemu cenovnemu načrtu.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Odpravljanje pogostih napak portala",
          excerpt: "Tipični vzroki, kadar portal zavrne objekt ali se sinhronizacija zatakne.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče: status portala kaže napako ali objekt ni prevzet",
            },
            {
              type: "p",
              text: "Portali povezavo največkrat zavrnejo zaradi manjkajočih osnovnih podatkov ali nepopolnih podatkov o objektu. Preden se obrnete na podporo, po vrsti preverite najpogostejše vzroke.",
            },
            {
              type: "steps",
              items: [
                "Pod /konto preverite, ali so naslov, davčni podatki in kontaktni podatki popolno navedeni",
                "Pri objektu preverite, ali so opis, fotografije, oprema in vsaj ena tarifa popolni",
                "Preverite, ali je nastavljen veljaven način plačila za provizije",
                "Odprite zavihek „Portali“ in preberite natančno sporočilo o napaki ob zadevnem portalu",
                "Odpravite navedeno pomanjkljivost in znova aktivirajte vidnost",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Napaka portala vedno velja samo za ta en portal — preostali kanali delujejo naprej neodvisno od tega, dokler so izpolnjene njihove lastne zahteve.",
            },
          ],
        },
      ],
    },
  ],
};
