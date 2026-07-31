import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Objekti i oprema",
  description: "Izrada i uređivanje soba i objekata za odmor.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Upravljanje objektima",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Objekt = jedna jedinica za rezervaciju",
          excerpt: "Zašto je svaki objekt u myNextDays točno jedna jedinica koja se može rezervirati.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "U myNextDays objekt je uvijek točno jedna jedinica koja se može rezervirati — pojedinačna soba u hotelu ili cijeli objekt za odmor. To vrijedi neovisno o tome vodite li kuću za odmor, apartman za odmor ili hotel, i temelj je za dostupnost, cijene i rezervacije.",
            },
            { type: "h2", text: "Nema zgrade sa sobama ispod nje" },
            {
              type: "p",
              text: "Česta zabluda je prikazati hotelsku zgradu kao jedan objekt s više soba ispod njega. To u myNextDays nije predviđeno. Ako, primjerice, vodite hotel s osam dvokrevetnih i četiri jednokrevetne sobe, izradite dvanaest zasebnih objekata — ne jedan objekt s brojem soba.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Polje poput „broj soba” na razini objekta namjerno ne postoji. Svaka soba treba vlastiti objekt s vlastitim kalendarom i vlastitim cijenama.",
            },
            { type: "h2", text: "Objekti za odmor" },
            {
              type: "p",
              text: "Kod kuće ili apartmana za odmor cijeli objekt odgovara jedinici koja se rezervira. Ovdje nema daljnje podjele — objekt za odmor uvijek je samostalan objekt s vlastitim kalendarom.",
            },
            { type: "h2", text: "Zašto je to važno" },
            {
              type: "ul",
              items: [
                "Svaki objekt ima vlastiti kalendar dostupnosti — dvostruke rezervacije sprječavaju se po pojedinom objektu.",
                "Cijene, oprema i fotografije vrijede po objektu, ne po zgradi.",
                "Objekt uvijek pripada točno jednom vlasniku — nema višestrukog pridruživanja.",
                "Vidljivost kanala (web-stranica, tržište platforme, portali) upravlja se po objektu.",
              ],
            },
            {
              type: "p",
              text: "Kako odabrati odgovarajući tip objekta za svoju sobu ili objekt za odmor, pročitajte pod [Određivanje tipa objekta](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Određivanje tipa objekta",
          excerpt: "Ispravno pridružite kategoriju, tip nekretnine i vrstu ponude.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Tip objekta određuje kako se vaš objekt razvrstava i filtrira na portalima i tržištu platforme. Sastoji se od tri polja odabira koja se nadovezuju jedno na drugo, a prolazite kroz njih prilikom izrade ili uređivanja objekta.",
            },
            { type: "h2", text: "Tri razine odabira" },
            {
              type: "steps",
              items: [
                "Najprije odaberite kategoriju — primjerice smještaj za odmor ili hotel.",
                "Na temelju toga odaberite tip nekretnine — primjerice apartman za odmor, kuću za odmor, dvokrevetnu ili jednokrevetnu sobu.",
                "Odaberite vrstu ponude — primjerice cijeli objekt ili privatnu sobu.",
                "Dopunite dodatna polja koja se prikažu ovisno o odabiru, primjerice tip kreveta ili kat.",
              ],
            },
            { type: "h2", text: "Zašto je redoslijed važan" },
            {
              type: "p",
              text: "Ta tri padajuća izbornika međusobno su ovisna: odabir kategorije ograničava dostupne tipove nekretnina, a odabir tipa nekretnine dalje ograničava vrste ponude. Tako nastaju samo smislene kombinacije, kakve se koriste i na velikim portalima.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ako naknadno promijenite kategoriju, myNextDays provjerava odgovaraju li tip nekretnine i vrsta ponude i dalje te vas prema potrebi poziva na ponovni odabir.",
            },
            { type: "h2", text: "Uređivanje tipa objekta" },
            {
              type: "p",
              text: "Otvorite željeni objekt pod Objekti i prijeđite na karticu Osnovni podaci. Tamo se pod Tip objekta nalaze tri padajuća izbornika. Kad spremite promjenu, novo razvrstavanje prosljeđuje se svim aktivnim kanalima.",
            },
            {
              type: "ul",
              items: [
                "Kategorija: nadređeno razvrstavanje (npr. smještaj za odmor, hotel)",
                "Tip nekretnine: konkretan tip objekta (npr. apartman za odmor, dvokrevetna soba)",
                "Vrsta ponude: što se točno rezervira (npr. cijeli objekt, privatna soba)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Održavanje opreme",
          excerpt: "Odabir obilježja opreme i njihovo ažuriranje.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Oprema objekta znatno utječe na to koliko se dobro objekt pronalazi i filtrira na portalima. Gosti ciljano filtriraju prema obilježjima poput WiFi-ja, kuhinje ili parkirnog mjesta — nedostajući podaci mogu isključiti objekt iz rezultata pretraživanja.",
            },
            { type: "h2", text: "Odabir opreme" },
            {
              type: "steps",
              items: [
                "Otvorite objekt i prijeđite na karticu Oprema.",
                "Odaberite sva obilježja koja se odnose na objekt s ponuđenog popisa.",
                "Po potrebi dopunite detalje poput broja parkirnih mjesta ili vrste kuhinje.",
                "Spremite promjene — automatski se prenose svim aktivnim portalima.",
              ],
            },
            { type: "h2", text: "Odakle dolaze obilježja" },
            {
              type: "p",
              text: "Popis opreme prati katalog obilježja velikih portala, kako bi se vaši podaci tamo mogli ispravno razvrstati. Vlastita, izmišljena obilježja nisu predviđena jer se ne bi mogla ispravno prenijeti portalima.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Provjerite opremu nakon svake građevinske promjene — primjerice nove klima-uređaje ili dodatnu kupaonicu — kako bi podaci ostali ažurni na svim kanalima.",
            },
            { type: "h2", text: "Česte skupine obilježja" },
            {
              type: "ul",
              items: [
                "Osnovna oprema: WiFi, grijanje, klima-uređaj",
                "Kuhinja i prehrana: potpuno opremljena kuhinja, perilica posuđa, aparat za kavu",
                "Kupaonica i rublje: vlastita kupaonica, perilica rublja, ručnici",
                "Vanjski prostor: balkon, terasa, vrt, parkirno mjesto",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Fotografije i opis",
          excerpt: "Uvjerljive slike i tekstovi za više rezervacija.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Fotografije i opis gostima su najvažnija osnova za odlučivanje. Objekt se može objaviti tek kad su unesene barem jedna naslovna fotografija i opis.",
            },
            { type: "h2", text: "Prijenos fotografija" },
            {
              type: "steps",
              items: [
                "Otvorite objekt i prijeđite na karticu Fotografije.",
                "Povucite slikovne datoteke u područje za prijenos ili ih odaberite putem dijaloga za odabir datoteka.",
                "Odredite naslovnu fotografiju — ona se prikazuje u rezultatima pretraživanja i pločicama.",
                "Povlačenjem poredajte ostale fotografije u smislen redoslijed.",
              ],
            },
            { type: "h2", text: "Pisanje opisa" },
            {
              type: "p",
              text: "Prijeđite na karticu Opis i unesite naslov te tekst. Konkretno opišite lokaciju, posebnosti i ciljanu skupinu objekta — općenite fraze na portalima djeluju manje uvjerljivo od opipljivih detalja.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Fotografije drugih objekata ili s interneta ne smiju se koristiti — portali to provjeravaju i mogu blokirati objekte kod kršenja pravila.",
            },
            { type: "h2", text: "Preporuke za dobre fotografije" },
            {
              type: "ul",
              items: [
                "Barem pet fotografija, idealno po jedna za svaku prostoriju",
                "Vodoravni format, dobra osvijetljenost, bez vodenih žigova",
                "Naslovna fotografija prikazuje objekt što privlačnije i jasnije",
                "Redovito ažurirajte, posebno nakon renovacija",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Popunjenost i kapacitet",
          excerpt: "Ispravno unesite najveći broj gostiju i raspodjelu kreveta.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Popunjenost određuje koliko gostiju objekt može primiti i provjerava se pri svakoj pretrazi i rezervaciji. Netočni podaci dovode ili do odbijenih upita ili do prenapučenosti — oboje biste trebali izbjegavati.",
            },
            { type: "h2", text: "Unos popunjenosti" },
            {
              type: "steps",
              items: [
                "Otvorite objekt i prijeđite na karticu Popunjenost.",
                "Unesite najveći broj odraslih.",
                "Unesite najveći broj djece, ako su dopuštena.",
                "Unesite raspodjelu kreveta po prostoriji, primjerice jedan bračni i dva odvojena kreveta.",
              ],
            },
            { type: "h2", text: "Granice popunjenosti" },
            {
              type: "p",
              text: "Kod upita za rezervaciju myNextDays automatski provjerava nalazi li se traženi broj gostiju unutar unesene popunjenosti. Upiti koji premašuju najveći kapacitet odbijaju se, odnosno uopće se ne prikazuju kao dostupni za rezervaciju.",
            },
            {
              type: "note",
              variant: "info",
              text: "Dodatni krevet ili dječji krevetić povećava stvarni kapacitet samo ako ga izričito unesete u raspodjelu kreveta — inače najveći broj gostiju ostaje nepromijenjen.",
            },
            { type: "h2", text: "Tipični izvori pogrešaka" },
            {
              type: "ul",
              items: [
                "Prevelik najveći broj gostiju u odnosu na stvarno dostupan broj kreveta",
                "Zaboravljen broj djece, iako je objekt namijenjen obiteljima",
                "Raspodjela kreveta nije ažurirana nakon renovacije",
              ],
            },
            {
              type: "p",
              text: "Ako popunjenost i oprema nisu usklađene, dodatno provjerite karticu [Oprema](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Status objekta i vidljivost",
          excerpt: "Razlika između aktivan/neaktivan i triju osi kanala.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "myNextDays razlikuje dvije različite stvari koje se često miješaju: status objekta (aktivan ili neaktivan) i vidljivost na pojedinim prodajnim kanalima. Njima upravljate zasebno.",
            },
            { type: "h2", text: "Status objekta" },
            {
              type: "p",
              text: "Status active znači da je objekt u načelu spreman za prodaju. Status inactive potpuno stavlja objekt izvan pogona — primjerice tijekom dugotrajne renovacije. Neaktivan objekt nije dostupan za rezervaciju ni na jednom kanalu, neovisno o prekidačima kanala.",
            },
            { type: "h2", text: "Tri osi kanala" },
            {
              type: "p",
              text: "Ako je objekt aktivan, tri neovisna prekidača odlučuju gdje je točno vidljiv:",
            },
            {
              type: "ul",
              items: [
                "Web-stranica — vidljivost na vašoj vlastitoj myNextDays web-stranici",
                "Tržište platforme — vidljivost na globalnom myBestDays tržištu",
                "Portali — vidljivost na Bookingu, Airbnb-u i drugima",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ove tri osi potpuno su neovisne o statusu objekta i jedna o drugoj. Aktivan objekt može npr. biti vidljiv samo na web-stranici, a ne na portalima.",
            },
            { type: "h2", text: "Promjena statusa" },
            {
              type: "steps",
              items: [
                "Otvorite objekt i prijeđite na karticu Pregled.",
                "Postavite status na aktivan ili neaktivan.",
                "Po potrebi dodatno prilagodite tri prekidača kanala na kartici Vidljivost.",
                "Spremite promjenu — odmah se primjenjuje na sve zahvaćene kanale.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Za kratkoročno blokiranje pojedinih dana umjesto toga upotrijebite stop-sell u kalendaru — time se ciljano blokiraju dani na svim kanalima, bez deaktiviranja cijelog objekta.",
            },
          ],
        },
      ],
    },
  ],
};
