import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Rezervacije i booking",
  description: "Upravljanje, pomicanje i otkazivanje rezervacija.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Rezervacije",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Ručni unos rezervacije",
          excerpt:
            "Kako izravno u myNextDays unijeti rezervaciju primljenu telefonom ili e-poštom.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Kada unosite ručno" },
            {
              type: "p",
              text: "Ne dolazi svaka rezervacija preko portala ili vlastite platforme — upite putem telefona, e-pošte ili na licu mjesta morate sami unijeti, kako bi objekt u myNextDays bio ispravno blokiran i kako ne bi došlo do dvostruke popunjenosti.",
            },
            {
              type: "steps",
              items: [
                "Otvorite Rezervacije i kliknite „Nova rezervacija”.",
                "Odaberite objekt — svaki objekt u myNextDays pojedinačna je jedinica koja se može rezervirati, dakle određena soba ili objekt za odmor.",
                "Odredite datum dolaska i odlaska te broj gostiju.",
                "Unesite podatke o gostu (ime, kontakt, po potrebi adresu za fakturu).",
                "Provjerite predloženu cijenu i po potrebi je prilagodite.",
                "Spremite rezervaciju — noćenja se odmah blokiraju u kalendaru.",
              ],
            },
            { type: "h2", text: "Plaćanje i potvrda" },
            {
              type: "p",
              text: "Nakon spremanja primjenjuju se ista pravila plaćanja kao kod online rezervacija. Ako je povezan pružatelj usluga plaćanja, možete izravno poslati poveznicu za plaćanje gostu ili plaćanje ručno označiti kao primljeno.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Posebne želje (rani dolazak, dodatni kreveti) odmah unesite u bilješke — tim ih vidi u vremenskoj crti rezervacije.",
            },
            { type: "h2", text: "Nakon unosa" },
            {
              type: "p",
              text: "Nova rezervacija odmah se pojavljuje u [Vremenskoj crti rezervacije](/hilfe/reservierungen/buchungs-zeitleiste) sa svim daljnjim koracima poput poruka, zadataka i plaćanja na jednom mjestu.",
            },
            {
              type: "ul",
              items: [
                "Kalendar i portali automatski se sinkroniziraju čim spremite.",
                "Gost po potrebi dobiva automatsku poruku potvrde.",
                "Promjene termina unosite putem „Pomakni rezervaciju”.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "Vremenska crta rezervacije",
          excerpt:
            "Vremenska crta rezervacije objedinjuje cijeli tijek rezervacije na jednom mjestu.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Što vremenska crta prikazuje" },
            {
              type: "p",
              text: "Svaka rezervacija ima vlastitu vremensku crtu koja kronološki prikazuje cijeli tijek — od upita za rezervaciju ili uvoza s portala do odlaska gosta. Tako na jedan pogled vidite što se već dogodilo i što slijedi.",
            },
            {
              type: "ul",
              items: [
                "Poruke s gostom",
                "Zadaci, primjerice čišćenje ili priprema",
                "Plaćanja i fakture",
                "Rezervirane dodatne usluge",
                "Pomicanja (Move) i otkazivanja",
              ],
            },
            { type: "h2", text: "Korištenje vremenske crte u svakodnevnom radu" },
            {
              type: "steps",
              items: [
                "Otvorite Rezervacije i odaberite željenu rezervaciju.",
                "Prijeđite na karticu „Vremenska crta”.",
                "Kronološki pregledajte sve događaje pomicanjem prema dolje.",
                "Koristite brze radnje kako biste izravno poslali poruku ili izradili zadatak.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ako se rezervacija pomakne ili otkaže, i taj se korak pojavljuje u vremenskoj crti — uključujući noćenja oslobođena u kalendaru.",
            },
            { type: "h2", text: "Zašto je to važno" },
            {
              type: "p",
              text: "Budući da tim, vlasnik i podrška vide istu vremensku crtu, ne nastaju informacijske praznine između poruka, zadataka i plaćanja. Detalje o povratima novca pronaći ćete pod [Povrati novca](/hilfe/zahlungen/rueckerstattungen), a o dodatnim uslugama pod [Dodatne usluge](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Pomicanje rezervacije",
          excerpt:
            "Kako pomaknuti postojeću rezervaciju na novo razdoblje bez zbrke u kalendaru.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Provjera prije pomicanja" },
            {
              type: "p",
              text: "Prije pomicanja rezervacije provjerite dostupnost objekta u novom razdoblju. myNextDays oslobađa izvorno rezervirana noćenja tek kad je novo razdoblje potvrđeno — tako ne nastaje praznina u kojoj bi se objekt pogrešno smatrao slobodnim ili dvostruko zauzetim.",
            },
            {
              type: "steps",
              items: [
                "Otvorite rezervaciju u Rezervacijama.",
                "Odaberite „Pomakni” i unesite novo razdoblje.",
                "Provjerite prikazanu dostupnost za nove datume.",
                "Potvrdite pomicanje.",
                "Provjerite mijenja li se cijena zbog novog broja noćenja i po potrebi je prilagodite.",
              ],
            },
            { type: "h2", text: "Što se automatski događa" },
            {
              type: "p",
              text: "Nakon potvrde stara se noćenja u kalendaru ispravno oslobađaju, a nova se blokiraju, dok se povezani portali ažuriraju. Postupak se bilježi u vremenskoj crti rezervacije.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ako je rezervacija primljena preko portala, pomicanje ondje može podlijegati vlastitim pravilima — provjerite pravila portala prije nego što izvršite veće promjene.",
            },
            { type: "h2", text: "Razlike u plaćanju" },
            {
              type: "p",
              text: "Ako se cijena mijenja zbog pomicanja, prilagodite pravila plaćanja u skladu s tim — vidi [Pravila plaćanja](/hilfe/zahlungen/zahlungsregeln). Više o cijelom tijeku rezervacije pronaći ćete pod [Vremenska crta rezervacije](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Otkazivanje i povrat novca",
          excerpt:
            "Kako ispravno otkazati rezervaciju i po potrebi pokrenuti povrat novca.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Otkazivanje rezervacije" },
            {
              type: "p",
              text: "Otkazivanje odmah ponovno oslobađa objekt za rezervirano razdoblje — u vašem kalendaru jednako kao i na svim povezanim portalima. Prije otkazivanja provjerite koji uvjeti otkazivanja vrijede za tu rezervaciju.",
            },
            {
              type: "steps",
              items: [
                "Otvorite rezervaciju u Rezervacijama.",
                "Odaberite „Otkaži” i navedite razlog.",
                "Provjerite predloženi iznos povrata.",
                "Potvrdite otkazivanje.",
              ],
            },
            { type: "h2", text: "Pokretanje povrata novca" },
            {
              type: "p",
              text: "Ako je plaćanje obavljeno preko povezanog pružatelja usluga plaćanja, povrat možete pokrenuti izravno iz rezervacije. Iznos se prikazuje u valuti pohranjenoj za taj objekt. Detalje o postupku pronaći ćete pod [Povrati novca](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Moguć je potpuni ili djelomični povrat novca",
                "Postupak se pojavljuje u vremenskoj crti rezervacije",
                "Kod rezervacija preko portala dodatno vrijede pravila dotičnog portala",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Otkazivanje se ne može poništiti. Prije potvrde pažljivo provjerite razdoblje i gosta.",
            },
            { type: "h2", text: "Nakon otkazivanja" },
            {
              type: "p",
              text: "Objekt je odmah ponovno dostupan za rezervaciju, a otvoreni zadaci vezani uz rezervaciju — primjerice priprema — automatski se označavaju kao nepotrebni. Cijeli postupak ostaje sljediv u [Vremenskoj crti rezervacije](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Prijava i odjava",
          excerpt: "Kako u myNextDays dokumentirati dolazak i odlazak gosta.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Bilježenje prijave" },
            {
              type: "p",
              text: "Prijava označava početak boravka i posebno je korisna kod samostalne prijave ili primopredaje ključeva preko tima, kako bi status svake rezervacije ostao ažuran.",
            },
            {
              type: "steps",
              items: [
                "Otvorite rezervaciju u Rezervacijama.",
                "Na dan dolaska odaberite „Prijava”.",
                "Po potrebi unesite bilješku, primjerice vrijeme ili posebnosti.",
              ],
            },
            { type: "h2", text: "Odjava i primopredaja" },
            {
              type: "p",
              text: "Kod odjave označavate boravak kao dovršen. To u mnogim slučajevima automatski pokreće zadatak čišćenja za objekt, kako bi bio pripremljen za sljedeću rezervaciju.",
            },
            {
              type: "ul",
              items: [
                "Prijava i odjava dio su vremenske crte rezervacije",
                "Vremena se mogu definirati po objektu u postavkama objekta",
                "Kod pristupa preko mobitela tim može prijavu i odjavu evidentirati izravno na licu mjesta",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Propuštena odjava automatski ne blokira naknadne zadatke — redovito provjeravajte zakašnjele statuse u Rezervacijama.",
            },
            { type: "h2", text: "Povezanost sa zadacima" },
            {
              type: "p",
              text: "Prijava i odjava usko su povezane sa zadacima i vremenskom crtom. Više o cijelom tijeku pročitajte pod [Vremenska crta rezervacije](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Dodatne usluge",
          excerpt:
            "Kako gostima ponuditi dodatne usluge poput doručka ili prijevoza koje se mogu rezervirati te ih unijeti u rezervaciju.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Što su dodatne usluge" },
            {
              type: "p",
              text: "Dodatne usluge neobavezne su usluge uz rezervaciju — primjerice doručak, rani dolazak, prijevoz ili kasna odjava. Unose se po objektu, a gost ih sam ili vaš tim može dodati rezervaciji.",
            },
            {
              type: "steps",
              items: [
                "Otvorite objekt i pod „Dodatne usluge” unesite željene usluge s cijenom.",
                "Otvorite postojeću rezervaciju u Rezervacijama.",
                "Odaberite „Dodaj dodatnu uslugu” i odaberite željenu uslugu.",
                "Potvrdite količinu i vrijeme usluge.",
              ],
            },
            { type: "h2", text: "Obračun" },
            {
              type: "p",
              text: "Dodatne usluge obračunavaju se u valuti dotičnog objekta i pojavljuju se kao zasebna stavka na fakturi. Već plaćene dodatne usluge mogu se razmjerno vratiti kod otkazivanja.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Popularne dodatne usluge jednom unesite središnje na objektu — tako ih možete dodati svakoj novoj rezervaciji u nekoliko klikova.",
            },
            { type: "h2", text: "Vidljivost za gosta" },
            {
              type: "p",
              text: "Ako je platforma ili vlastita web-stranica aktivna, gosti često već tijekom rezervacije mogu sami odabrati odgovarajuće dodatne usluge. Svaka se dopuna zatim pojavljuje u [Vremenskoj crti rezervacije](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Dodatne usluge mogu se pojedinačno nazvati i cjenovno odrediti po objektu",
                "Naknadno dodavanje moguće je u svakom trenutku preko rezervacije",
                "Otkazane dodatne usluge razmjerno se vraćaju",
              ],
            },
          ],
        },
      ],
    },
  ],
};
