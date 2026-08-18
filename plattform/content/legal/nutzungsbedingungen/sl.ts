import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Pogoji uporabe za goste",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Ti pogoji uporabe urejajo uporabo rezervacijskega portala myBestDays (v nadaljevanju »Platforma«) s strani potnikov in oseb, ki opravljajo rezervacije (v nadaljevanju »Gost« ali »vi«).",
    `Upravljavec Platforme je ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danska, št. CVR ${ANBIETER.cvr} (v nadaljevanju »myBestDays« ali »mi«). myBestDays je blagovna znamka te družbe in ne samostojna pravna oseba. Popolni podatki o ponudniku so navedeni v [Pravnih informacijah](https://mybestdays.dk/rechtliches/impressum).`,
    "Z uporabo Platforme se strinjate s temi pogoji. Prosimo, preberite jih pozorno.",
  ],
  summary: {
    heading: "Povzetek teh pogojev",
    paragraphs: [
      "myBestDays je tržnica. Zagotavljamo Platformo, na kateri ponudniki ponujajo svoje nastanitve — nastanitve same ne zagotavljamo mi. Pogodba o nastanitvi se sklene med vami in ponudnikom, ne z nami.",
      "Kar vidite v oglasu, izhaja od ponudnika: opis, slike, oprema, cena, pogoji odpovedi in hišni red. Oglase preverjamo, vendar ne moremo jamčiti za vsak podatek ponudnika.",
      "Cena, ki jo vidite ob zaključku rezervacije, je skupna cena za rezervirane storitve. Dodatne zneske, ki zapadejo šele na kraju samem (na primer turistična taksa ali varščina), navedemo vnaprej ločeno.",
      "Če gre kaj narobe, se najprej obrnite na nas. Razdelek A15 opisuje, kako vložite pritožbo in katere poti so vam nato na voljo.",
      "Ta povzetek pojasnjuje pogoje, vendar jih ne nadomešča. Merodajno je celotno besedilo.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Vse rezervacije prek myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Opredelitve pojmov",
          paragraphs: [
            "Pojmi, uporabljeni v teh pogojih, so pojasnjeni v slovarju na koncu tega dokumenta. Najpomembnejši so:",
          ],
          list: [
            "»Platforma« — spletno mesto, mobilne aplikacije in vse druge dostopne točke, prek katerih myBestDays prikazuje nastanitve in posreduje rezervacije.",
            "»Ponudnik« — fizična ali pravna oseba, ki nastanitev ponuja prek Platforme (gostitelj, najemodajalec, agencija, hotelski ali nastanitveni obrat).",
            "»Nastanitev« — nastanitvena storitev, ki jo ponuja ponudnik, torej počitniški objekt ali enota določenega tipa sobe oziroma objekta.",
            "»Rezervacija« — prek Platforme sklenjena rezervacija nastanitve za določeno obdobje.",
            "»Skupna cena« — znesek, prikazan ob zaključku rezervacije, vključno z vsemi davki, pristojbinami in doplačili, ki se obračunajo prek Platforme.",
            "»Stroški na kraju samem« — zneski, ki se ne obračunajo prek Platforme, temveč zapadejo v plačilo ponudniku (npr. turistična taksa, varščina, končno čiščenje po izbiri ponudnika).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. O teh pogojih",
          paragraphs: [
            "Ti pogoji veljajo za vsako uporabo Platforme, ne glede na to, ali ustvarite račun in ali pride do rezervacije.",
            "Razdelek A velja za vse rezervacije. Razdelek B vsebuje dopolnilna pravila za nastanitve. Ob nasprotju ima prednost razdelek B.",
            "Za samo nastanitveno storitev dodatno veljajo pogoji posameznega ponudnika (zlasti hišni red in pogoji odpovedi), navedeni v oglasu. Ti pogoji ponudnika se pridružijo našim; od naših pogojev ne morejo odstopati, kar zadeva vaše razmerje z nami.",
            "Ti pogoji so na voljo v vseh 24 uradnih jezikih Evropske unije. Pri odstopanjih med jezikovnimi različicami je merodajna nemška različica, kolikor kogentni predpisi države vašega prebivališča ne določajo drugače.",
            "Kogentne pravice potrošnikov po pravu države vašega prebivališča s temi pogoji niso prizadete.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. O myBestDays",
          paragraphs: [
            "myBestDays je spletna tržnica za počitniške nastanitve in nastanitvene obrate. Upravljamo Platformo, na kateri ponudniki predstavljajo svoje nastanitve, gostje pa jih lahko rezervirajo.",
            "Smo posrednik, ne nastanitveni obrat. Nobene od nastanitev, ponujenih na Platformi, ne posedujemo, ne upravljamo, ne vodimo in ne nadziramo ter nismo pogodbena stranka pogodbe o nastanitvi.",
            "myBestDays je posredniška storitev v smislu Uredbe (EU) 2022/2065 o digitalnih storitvah. Naši podatki in postopki po tej uredbi so navedeni v razdelku [Akt o digitalnih storitvah](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays ni organizator potovanj. Ne sestavljamo paketnih potovanj v smislu Direktive (EU) 2015/2302; glede povezanih potovalnih aranžmajev glej A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Naša Platforma",
          paragraphs: [
            "Vsebina oglasa — opis, fotografije, oprema, omejitve zasedenosti, cene, razpoložljivost, pogoji odpovedi in hišni red — izhaja od posameznega ponudnika. Ponudnik odgovarja za njeno pravilnost in popolnost.",
            "Oglase preverjamo pred objavo in sproti glede očitnih kršitev naših [Pravil o primerni vsebini](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). Obveznost splošnega nadzora vse vsebine ne obstaja in po členu 8 Uredbe (EU) 2022/2065 tudi ne bi bila dopustna.",
            "Kako razvrščamo rezultate iskanja in katere značilnosti določajo vrstni red, pojasnjujemo v [Podatkih o cenah, razvrščanju in priporočilih](https://mybestdays.dk/rechtliches/preisangaben).",
            "Prizadevamo si za stalno razpoložljivo Platformo, vendar ne dolgujemo neprekinjene razpoložljivosti. Vzdrževanje, motnje in prilagoditve so mogoči.",
            "Prevodi vsebin ponudnikov so lahko strojno ustvarjeni. Merodajna je izvirna različica, ki jo je vnesel ponudnik.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Naše vrednote",
          paragraphs: [
            "Od gostov in ponudnikov pričakujemo spoštljiv odnos. Diskriminacija zaradi porekla, barve kože, vere, prepričanja, spola, spolne identitete, spolne usmerjenosti, invalidnosti, starosti ali podobnih značilnosti na Platformi ni dopustna — glej [Protidiskriminacijsko politiko](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Za ravnanje med bivanjem veljajo [Osnovna pravila za goste](https://mybestdays.dk/rechtliches/grundregeln-gaeste), za ponudnike [Kodeks ravnanja ponudnikov](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Vaš račun in uporaba Platforme",
          paragraphs: [
            "Za rezervacijo lahko ustvarite račun. Odgovorni ste za zaupnost svojih dostopnih podatkov in nas nemudoma obvestite, če sumite na nepooblaščeno uporabo.",
            "Platformo smete uporabljati le, če ste poslovno sposobni in lahko veljavno sklepate pogodbe.",
            "Vaši podatki ob registraciji in rezervaciji morajo biti pravilni in popolni — zlasti ime, kontaktni podatki in število potnikov. Ponudnik te podatke potrebuje za zagotovitev nastanitve in izpolnjevanje svojih prijavnih obveznosti.",
            "Zlasti ni dovoljeno:",
          ],
          list: [
            "navidezne rezervacije, goljufiva plačila ali uporaba tujih plačilnih sredstev brez pooblastila;",
            "avtomatizirano zajemanje podatkov s Platforme (scraping, crawler) izven tega, kar dopušča naša datoteka robots.txt;",
            "ukrepi, ki motijo ali preobremenjujejo Platformo ali njeno infrastrukturo ali zaobidejo njihove varnostne ukrepe;",
            "objavljanje protipravne, žaljive ali zavajajoče vsebine v ocenah, sporočilih ali podatkih profila;",
            "poskus izvedbe rezervacije mimo Platforme, potem ko je stik nastal prek nje — glej [Pristojbine izven platforme](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Cene",
          paragraphs: [
            "Vse cene so prikazane kot skupna cena z davki in vsemi pristojbinami, obračunanimi prek Platforme, takoj ko so znani podatki o potovanju (obdobje in število potnikov). Če posamezen sestavni del zapade šele na kraju samem, ga navedemo ločeno pred zaključkom rezervacije.",
            "Cene so prikazane v valuti oglasa. Če se vam znesek prikaže tudi v drugi valuti, gre za nezavezujočo preračunavo v informativne namene; obračun poteka v valuti oglasa, razen če je pri plačilu navedeno drugače.",
            "Cene se lahko do zaključka rezervacije spremenijo, na primer ker jih ponudnik prilagodi ali se spremeni razpoložljivost. Merodajna je cena, ki se vam prikaže neposredno pred zavezujočo rezervacijo in je navedena v potrdilu rezervacije.",
            "Očitne napake v ceni (npr. znesek, napačen za velikostne rede) ne zavezujejo ne nas ne ponudnika. Če tako napako zaznamo, vas nemudoma obvestimo; rezervacijo lahko takrat brezplačno odpoveste.",
            "Kako se sestavljajo storitvene pristojbine, je navedeno v [Podatkih o storitvenih pristojbinah](https://mybestdays.dk/rechtliches/servicegebuehren). Glede davkov in dajatev glej [Davčno politiko](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Plačilo",
          paragraphs: [
            "Plačila prek Platforme obdeluje ponudnik plačilnih storitev Stripe. Plačilne podatke (npr. podatke o kartici) zbira in obdeluje neposredno Stripe; myBestDays ne shranjuje popolnih podatkov o karticah.",
            "Kdaj zapade posamezen znesek — predplačilo, doplačilo ali plačilo na kraju samem — je odvisno od oglasa in je navedeno pred zaključkom rezervacije. Podrobnosti urejajo [Plačilni pogoji](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Če oglas predvideva varščino, je ta lahko predhodno avtorizirana ali zaračunana in ob škodi v celoti ali delno zadržana; merodajni so podatki v oglasu.",
            "Če plačilo ne uspe ali je stornirano, se rezervacija lahko odpove. Ponudnik lahko še naprej zahteva zneske, nastale po njegovih pogojih odpovedi.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Politike",
          paragraphs: [
            "Poleg teh pogojev veljajo naslednje politike, ki so sestavni del pogodbe med vami in nami:",
          ],
          list: [
            "[Pravila o primerni vsebini](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Politika ocen](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Protidiskriminacijska politika](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Osnovna pravila za goste](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Pogoji odpovedi](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Politika prerezervacije in vračila](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Politika ob hudih motnjah](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Politika avtorskih pravic](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Varstvo podatkov in piškotki",
          paragraphs: [
            "Kako obdelujemo osebne podatke, je navedeno v [Politiki zasebnosti](https://mybestdays.dk/rechtliches/datenschutz). Katere piškotke in podobne tehnologije uporabljamo, je navedeno v [Politiki piškotkov](https://mybestdays.dk/rechtliches/cookies).",
            "Za rezervacijo ponudniku posredujemo podatke, ki jih potrebuje za izvedbo nastanitvene storitve. Ponudnik je zanje samostojni upravljavec; zanj veljajo [Standardi varstva podatkov za gostitelje](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Dostopnost",
          paragraphs: [
            "Stanje dostopnosti Platforme in način prijave ovir opisuje [Izjava o dostopnosti](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Podatki o dostopnosti nastanitve izhajajo od ponudnika. Če ste odvisni od določenih lastnosti, jih pred rezervacijo razjasnite s ponudnikom prek funkcije sporočil.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Ocene in uporabniška vsebina",
          paragraphs: [
            "Po bivanju lahko oddate oceno. Oceno sme oddati le, kdor je rezerviral prek Platforme in je bivanje nastopil ali bi ga lahko nastopil — s tem zagotavljamo, da objavljene ocene izhajajo od dejanskih gostov.",
            "Za ocene ne plačujemo, njihove vsebine ne spreminjamo in ocene ne zatiramo le zato, ker je negativna. Podrobnosti in razlogi, zaradi katerih oceno odstranimo, so navedeni v [Politiki ocen](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Za vsebino, ki jo objavite — ocene, fotografije, sporočila, podatke profila — ostajate odgovorni. Podeljujete nam neizključno, krajevno in časovno neomejeno, brezplačno pravico, da to vsebino v okviru delovanja in promocije Platforme reproduciramo, predelamo (npr. obrez, prevod) in dajemo na voljo javnosti. Svojo vsebino lahko izbrišete; že opravljene uporabe v že objavljenih zbirkah s tem niso prizadete.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Sporočila in komunikacija s ponudnikom",
          paragraphs: [
            "Sporočila med vami in ponudnikom potekajo prek Platforme. Zagotavljamo funkcijo sporočil, nismo pa pošiljatelj ali prejemnik vsebine.",
            "Sporočila smemo avtomatizirano preverjati glede kršitev teh pogojev (npr. kontaktni podatki za obhod Platforme, vzorci goljufij, protipravna vsebina) in zadevna sporočila zadržati ali odstraniti. O odstranitvi vas obvestimo z obrazložitvijo po A17.",
            "Sporočila o vaši rezervaciji (potrdilo, spremembe, informacije o prihodu) pošiljamo na navedeni e-naslov. Ta sporočila so pogodbena komunikacija in jih ni mogoče odjaviti, dokler rezervacija traja. Oglasna sporočila prejemate le, kolikor ste privolili ali to pravo dopušča brez privolitve; kadar koli lahko ugovarjate.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Pravice intelektualne lastnine",
          paragraphs: [
            "Platforma, njena zasnova, programska oprema, podatkovne zbirke, besedila in znamke so zaščiteni. Prejmete neizključno, neprenosljivo pravico do uporabe Platforme za iskanje in rezervacijo nastanitev — nič več.",
            "Uporabo naših znamk in logotipov urejajo [Pravila o znamkah](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Če menite, da vsebina na Platformi krši vašo avtorsko pravico, sledite [Politiki avtorskih pravic](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Kaj storiti, če gre kaj narobe",
          paragraphs: [
            "Če se težava nanaša na samo nastanitev, se najprej obrnite na ponudnika — prek funkcije sporočil ali na kraju samem. Mnoge težave se tako rešijo najhitreje.",
            "Če s ponudnikom ne napredujete ali se težava nanaša na Platformo, plačilo ali izvedbo rezervacije, se obrnite na nas. Kako nas dosežete in kako obravnavamo pritožbe, je navedeno v razdelku [Pritožbe in reševanje sporov](https://mybestdays.dk/rechtliches/beschwerden).",
            "Pripravite si: številko rezervacije, e-naslov rezervacije, kratek opis težave z željo, kako naj pomagamo, in pripadajoča dokazila (fotografije, sporočila, potrdila).",
            "Če nastanitev ob prihodu ni na voljo ali bistveno odstopa od oglasa, se uporabi [Politika prerezervacije in vračila](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Platforma Evropske komisije za spletno reševanje sporov je bila razveljavljena z Uredbo (EU) 2024/3228 in je prenehala delovati; kot pot ni več na voljo. Kateri organi jo nadomeščajo, je navedeno v razdelku [Pritožbe in reševanje sporov](https://mybestdays.dk/rechtliches/beschwerden).",
            "Če smo sprejeli ukrep zoper vašo vsebino ali račun, se poleg našega internega pritožbenega postopka lahko obrnete tudi na organ za izvensodno reševanje sporov, certificiran po členu 21 Uredbe (EU) 2022/2065. Njegove odločitve za nas niso zavezujoče.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Ukrepi zoper neprimerno ravnanje",
          paragraphs: [
            "Če kršite te pogoje ali katero od politik, navedenih v A9, lahko — stopnjevano glede na težo, pogostost in učinek kršitve — odstranimo vsebino ali omejimo njeno vidnost, blokiramo funkcije, odpovemo rezervacije ali začasno oziroma trajno blokiramo vaš račun.",
            "Pred ukrepom preučimo posamezen primer. Pri očitno protipravni vsebini, ob nevarnosti za osebe ali pri goljufiji lahko ukrepamo takoj.",
            "Vsak ukrep vam obrazložimo in vas napotimo na pritožbeno pot — glej A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Prijava protipravne vsebine in obrazložitev ukrepov",
          paragraphs: [
            "Vsakdo nam lahko prijavi vsebino, za katero meni, da je protipravna. Postopek prijave po členu 16 Uredbe (EU) 2022/2065, naše kontaktne točke in obravnava prijav so opisani v razdelku [Akt o digitalnih storitvah](https://mybestdays.dk/rechtliches/dsa).",
            "Če sprejmemo ukrep zoper vsebino, ki ste jo objavili, ali zoper vaš račun, prejmete obrazložitev z navedbo razloga, dejanske podlage, pravne podlage ali kršenega pogodbenega določila ter možnosti pritožbe.",
            "Zoper vsak ukrep lahko v šestih mesecih brezplačno vložite pritožbo. Pritožbe obravnavajo ljudje, ne izključno avtomatizirani postopki.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Omejitev odgovornosti",
          paragraphs: [
            "Neomejeno odgovarjamo za naklep in hudo malomarnost, za škodo iz posega v življenje, telo ali zdravje ter v obsegu prevzete garancije. Zahtevki po pravu odgovornosti za proizvode niso prizadeti.",
            "Sicer je naša odgovornost omejena na predvidljivo škodo, ki tipično izhaja iz kršitve obveznosti, na izpolnitev katerih se smete zanašati — in le, kolikor pravo, ki se uporablja, takšno omejitev dopušča.",
            "Ne odgovarjamo za samo izvedbo nastanitvene storitve niti za ravnanje ponudnikov ali drugih gostov. Pogodbeni partner nastanitvene storitve je ponudnik.",
            "Ne odgovarjamo za pravilnost podatkov, ki so jih vnesli ponudniki, kolikor jih nismo poznali in jih tudi nismo bili dolžni poznati. Takoj ko izvemo za protipraven podatek, ukrepamo nemudoma.",
            "Nadaljnja odgovornost je izključena. Kogentni zakonski zahtevki, zlasti pravice potrošnikov, niso prizadeti.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Pravo, ki se uporablja, in pristojnost sodišč",
          paragraphs: [
            "Uporablja se dansko pravo — sedež upravljavca je na Danskem — z izključitvijo Konvencije ZN o pogodbah o mednarodni prodaji blaga. Kogentni predpisi o varstvu potrošnikov države, v kateri imate običajno prebivališče, po členu 6 Uredbe (ES) št. 593/2008 (Rim I) niso prizadeti.",
            "Kot potrošnik nas lahko tožite pri sodišču svojega prebivališča ali na našem sedežu na Danskem; mi vas lahko tožimo le pri sodišču vašega prebivališča (členi 17 do 19 Uredbe (EU) št. 1215/2012).",
            "Za pogodbo o nastanitvi se praviloma uporablja pravo države, v kateri je nastanitev; za tožbe iz najema nepremičnine so izključno pristojna njena sodišča.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Povezani potovalni aranžmaji",
          paragraphs: [
            "myBestDays posreduje izključno nastanitvene storitve. Ne ponujamo letov, najema vozil, prevoznih storitev, izletov ali znamenitosti in ne sestavljamo paketnih potovanj v smislu Direktive (EU) 2015/2302.",
            "Če bomo v prihodnje posredovali tudi druge potovalne storitve, vas bomo pred rezervacijo z zakonsko predpisanim standardnim obrazcem obvestili o tem, ali nastaja paketno potovanje ali povezan potovalni aranžma in katere pravice vam iz tega pripadajo.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Trajanje, blokada in odpoved",
          paragraphs: [
            "Pogodba o uporabi Platforme je sklenjena za nedoločen čas. Svoj račun lahko kadar koli brez navedbe razlogov izbrišete; obstoječe rezervacije s tem niso prizadete in se izvedejo po pogojih posameznega ponudnika.",
            "Pogodbo o uporabi lahko odpovemo s 14-dnevnim odpovednim rokom. Ob hudi kršitvi teh pogojev lahko odpovemo brez odpovednega roka in blokiramo račun.",
            "Po prenehanju vaše podatke izbrišemo, kolikor temu ne nasprotuje zakonska obveznost hrambe ali upravičen interes za hrambo; podrobnosti ureja [Politika zasebnosti](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Klavzula o spremembah",
          paragraphs: [
            "Te pogoje lahko spremenimo, če za to obstaja stvaren razlog — na primer spremenjeno pravno stanje, sodna praksa najvišjih sodišč, nove ali odpadle funkcije Platforme ali odprava vrzeli v ureditvi.",
            "Spremembe napovemo v besedilni obliki najmanj 30 dni pred začetkom veljavnosti. Če do začetka veljavnosti ne ugovarjate, se spremenjeni pogoji štejejo za sprejete; na ta učinek vas v napovedi posebej opozorimo. Če ugovarjate, lahko pogodbo o uporabi odpovemo na dan začetka veljavnosti.",
            "Za že sklenjene rezervacije veljajo pogoji v različici, ki je veljala ob rezervaciji.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Nastanitve",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Obseg tega razdelka",
          paragraphs: [
            "Ta razdelek velja za rezervacijo nastanitev prek Platforme — počitniških objektov kakor tudi sob in enot nastanitvenih obratov.",
            "Dopolnjuje razdelek A. Ob nasprotjih ima prednost ta razdelek B.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Pogodbeno razmerje",
          paragraphs: [
            "Pogodba o nastanitvi se sklene izključno med vami in ponudnikom. myBestDays ni pogodbena stranka.",
            "Predstavitev nastanitve na Platformi je vabilo, da oddate rezervacijsko ponudbo. S klikom na gumb za rezervacijo z obveznostjo plačila oddate zavezujočo ponudbo.",
            "Pogodba je sklenjena, ko je rezervacija potrjena. Potrdilo rezervacije pošljemo na vaš navedeni e-naslov; navaja ponudnika, rezervirano storitev, obdobje, skupno ceno in pogoje odpovedi.",
            "Pri nastanitvah z rezervacijo na poizvedbo je pogodba sklenjena šele s sprejemom s strani ponudnika. Do tedaj je vaše plačilno sredstvo lahko predhodno avtorizirano, ne pa obremenjeno.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Kaj počnemo mi",
          paragraphs: [
            "Zagotavljamo Platformo, prikazujemo oglase ponudnikov, sprejmemo vašo rezervacijo, jo posredujemo ponudniku in vam pošljemo potrdilo rezervacije.",
            "Izvedemo plačilo, kolikor oglas predvideva plačilo prek Platforme, in zagotavljamo funkcijo sporočil med vami in ponudnikom.",
            "Nastanitve ne zagotavljamo, je ne upravljamo in ne jamčimo za njeno stanje. Nismo vaš organizator potovanja.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Kaj morate storiti vi",
          paragraphs: [
            "Pred rezervacijo v celoti preglejte oglas: opremo, omejitev zasedenosti, čase prihoda in odhoda, hišni red, pogoje odpovedi in stroške, ki nastanejo šele na kraju samem.",
            "Upoštevajte najvišjo zasedenost, navedeno v oglasu. Če pripotuje več oseb, kot je bilo rezerviranih, lahko ponudnik zavrne sprejem ali zahteva doplačilo.",
            "Upoštevajte hišni red ponudnika in [Osnovna pravila za goste](https://mybestdays.dk/rechtliches/grundregeln-gaeste). Z nastanitvijo ravnate skrbno in odgovarjate za škodo, ki jo povzročite vi ali vaši sopotniki.",
            "Če ponudnik ali organ potrebuje podatke za prijavo (npr. prijavnico, podatke iz osebnega dokumenta, izjavo o turistični taksi), jih pravočasno posredujete.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Cene in plačilo",
          paragraphs: [
            "Skupna cena obsega ceno prenočitve za rezervirano obdobje ter doplačila in pristojbine, navedene v oglasu, ki se obračunajo prek Platforme.",
            "Na kraju samem lahko nastanejo dodatni zneski — zlasti turistična taksa ali krajevne dajatve, varščina ter dodatne storitve, ki jih naročite šele na kraju samem. Te pred zaključkom rezervacije navedemo kot stroške na kraju samem, kolikor jih je ponudnik navedel.",
            "Če oglas predvideva predplačilo, preostanek zapade v plačilo ob času, navedenem v oglasu. Če doplačilo izostane, lahko ponudnik po svojih pogojih odpovedi odstopi od pogodbe.",
            "Plačil ponudniku izven Platforme ne sprejemamo in jih ne moremo spremljati; ne spadajo v naše izvajanje plačil — glej [Pristojbine izven platforme](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Spremembe, odpovedi in vračila",
          paragraphs: [
            "Ali in pod katerimi pogoji je rezervacijo mogoče brezplačno odpovedati ali spremeniti, je odvisno od pogojev odpovedi ponudnika, navedenih v oglasu. Pogoje, ki jih ponudnikom ponujamo v izbiro, opisujejo [Pogoji odpovedi](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "Pri nastanitvenih storitvah, rezerviranih za določeno obdobje, praviloma ne obstaja zakonska pravica do odstopa po členu 16(l) Direktive 2011/83/EU oziroma ustreznih nacionalnih predpisih. Kogentne zakonske pravice niso prizadete.",
            "Če odpove ponudnik, v celoti vrnemo znesek, plačan prek Platforme. Dodatno se uporabi [Politika prerezervacije in vračila](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Če dogodek izven nadzora obeh strani prepreči potovanje ali bivanje, velja [Politika ob hudih motnjah](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Vračila se izvedejo na plačilno sredstvo, uporabljeno za plačilo, razen če je dogovorjeno drugače.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Kaj morate še vedeti",
          paragraphs: [
            "Ponudniki so lahko zasebni gostitelji ali podjetniki. Ali ponudnik nastopa kot podjetnik, navedemo v oglasu. Če ne gre za podjetnika, se predpisi Unije o varstvu potrošnikov za pogodbo o nastanitvi ne uporabljajo — na to okoliščino vas v oglasu opozorimo.",
            "Podatki o legi, okolici, razdaljah in ocene tretjih oseb služijo za orientacijo. Zavezujoči so podatki o sami rezervirani storitvi.",
            "Na območjih z obveznostjo registracije za kratkoročno oddajanje v oglasu navedemo registrsko številko, ki jo je podal ponudnik; glej [Kratkoročno oddajanje](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Pri več enakih enotah tipa objekta ali sobe rezervirate eno enoto tega tipa. Katero konkretno enoto prejmete, določi ponudnik.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Slovar",
      paragraphs: [
        "Naslednji pojmi imajo v teh pogojih tukaj navedeni pomen.",
      ],
      definitions: [
        {
          term: "Ponudnik",
          description:
            "Fizična ali pravna oseba, ki nastanitev ponuja prek Platforme in postane pogodbena stranka pogodbe o nastanitvi.",
        },
        {
          term: "Rezervacija na poizvedbo",
          description:
            "Rezervacija, ki je sklenjena šele po izrecnem sprejemu s strani ponudnika, za razliko od takojšnje rezervacije.",
        },
        {
          term: "Potrdilo rezervacije",
          description:
            "Sporočilo, s katerim vam potrdimo sklenitev pogodbe o nastanitvi; vsebuje ponudnika, storitev, obdobje, skupno ceno in pogoje odpovedi.",
        },
        {
          term: "Enota",
          description:
            "Konkretni rezervabilni objekt pod tipom objekta ali sobe. Prodaja se enota, opisuje in vrednoti pa se tip.",
        },
        {
          term: "Skupna cena",
          description:
            "Znesek, prikazan ob zaključku rezervacije, vključno z vsemi davki in vsemi pristojbinami, obračunanimi prek Platforme.",
        },
        {
          term: "Najvišja zasedenost",
          description:
            "V oglasu navedeno največje dovoljeno število oseb, ki lahko prenočijo v nastanitvi.",
        },
        {
          term: "Varščina",
          description:
            "Znesek, ki ga ponudnik zahteva kot zavarovanje za škodo in ki se predhodno avtorizira ali zaračuna ter po bivanju sprosti ali pobota.",
        },
        {
          term: "Turistična taksa",
          description:
            "Krajevna dajatev za prenočitve, ki se glede na občino pobira na kraju samem ali prek ponudnika; ni storitev myBestDays.",
        },
        {
          term: "Platforma",
          description:
            "Spletno mesto, mobilne aplikacije in vse druge dostopne točke, prek katerih myBestDays prikazuje nastanitve in posreduje rezervacije.",
        },
        {
          term: "Storitvena pristojbina",
          description:
            "Plačilo za posredniško storitev myBestDays. Kdo jo nosi in kako je prikazana, je navedeno v podatkih o storitvenih pristojbinah.",
        },
        {
          term: "Pogoji odpovedi",
          description:
            "Pravila, ki jih izbere ponudnik, o tem, do kdaj in po kakšnih stroških je mogoče rezervacijo odpovedati ali spremeniti.",
        },
        {
          term: "Nastanitev",
          description:
            "Nastanitvena storitev, ki jo ponuja ponudnik — počitniški objekt ali enota tipa sobe oziroma objekta.",
        },
        {
          term: "Stroški na kraju samem",
          description:
            "Zneski, ki se ne obračunajo prek Platforme, temveč zapadejo v plačilo ponudniku, na primer turistična taksa, varščina ali na kraju samem naročene dodatne storitve.",
        },
      ],
    },
  ],
};
