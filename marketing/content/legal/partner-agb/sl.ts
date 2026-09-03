// Partner-AGB — Slowenisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Pogoji sodelovanja v partnerskem programu myNextDays: atribucija, osnova za provizijo, stopnja, skupinska provizija, prepovedi, označevanje, izplačilo.",
  numbered: false,
  toc: true,
  title: "Pogoji sodelovanja v partnerskem programu (Splošni pogoji za partnerje) — Osnutek",
  standIso: "2026-09-02",
  intro: [
    "OSNUTEK — Ti pogoji so delovna različica myNextDays in še niso bili pravno pregledani. Do objave pregledane različice veljajo kot opis programa in ne kot dokončno besedilo pogodbe. Pregledana različica bo objavljena na tem naslovu z novo številko različice; partnerji bodo ob naslednji prijavi pozvani k ponovni potrditvi.",
    `Ti pogoji sodelovanja urejajo sodelovanje v partnerskem programu (affiliate programu) podjetja ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-št. ${ANBIETER.cvr} (v nadaljevanju »myNextDays« ali »mi«) s strani partnerjev (v nadaljevanju »partner«).`,
    "Partnerski program je namenjen posameznikom in podjetjem s sedežem v EU, Švici ali Združenem kraljestvu, ki priporočajo podjetja (najemodajalce, agencije, hotele) na myNextDays.",
  ],
  sections: [
    {
      heading: "§ 1 Sodelovanje in odobritev",
      paragraphs: [
        "Sodelovanje zahteva prijavo preko partnerske nadzorne plošče. Obvezni podatki so ime oz. firma, pravna oblika, država, vsaj en račun na družbenih medijih z naslovom, uporabniškim imenom in dosegom ter za podjetja identifikacijska številka za DDV.",
        "myNextDays osebno pregleda vsako prijavo in se svobodno odloči o odobritvi. Pravice do sprejema ni. Sodelovanje je brezplačno; naročnina na myNextDays ni pogoj.",
        "Partner posodablja svoje podatke, zlasti kanale, pravno obliko, davčne in izplačilne podatke.",
        "Navedeni doseg je sprva samoocena. Partner lahko prostovoljno poveže svoje račune na YouTubu, Instagramu, Facebooku in TikToku; takrat se sledilci in ogledi preberejo s platforme in se prikažejo kot preverjeni. Nepreverjeni doseg se pri odobritvi in kasnejših pregledih manj upošteva. Povezavo je mogoče kadar koli prekiniti na nadzorni plošči; podrobnosti o obdelavi so navedene v izjavi o varovanju podatkov.",
      ],
    },
    {
      heading: "§ 2 Dodelitev podjetij (atribucija)",
      paragraphs: [
        "Podjetje se dodeli partnerju, če se registrira z referenčno kodo partnerja. Koda je podjetju vidno prikazana ob registraciji in potrjena s pošiljanjem. Sledilni piškotki se ne nastavljajo.",
        "Podjetje je dodeljeno natančno enemu partnerju; odločilna je koda, potrjena ob registraciji. Kasnejša prerazporeditev se izvede samo s strani myNextDays v primeru dokazane napake.",
        "Ne dodelijo se podjetja samega partnerja, njegovih delničarjev, zaposlenih ali sorodnikov ter podjetja, ki so že ali so bila stranke myNextDays.",
      ],
    },
    {
      heading: "§ 3 Provizija za lastne stranke",
      paragraphs: [
        "Osnova za provizijo je neto prihodek od naročnin dodeljenega podjetja (osnovna tarifa in moduli) iz plačanih računov — brez DDV, brez portalnih provizij, dodatnih storitev, naknadnih izračunov in drugih prehodnih postavk.",
        "Stopnja provizije je odvisna od ranga partnerja v trenutku plačila. Rangi in stopnje so objavljeni na strani programa. Rang se določi glede na število plačljivih strank v strukturi partnerja: njegove lastne plačljive stranke in plačljive stranke njegovih timskih partnerjev (§ 4), vsaka stranka enkrat. Rang se določi mesečno na referenčni datum; napredovanje velja takoj, nazadovanje pa šele, ko je število na dva zaporedna referenčna datuma pod pragom.",
        "Če partner prvič doseže rang od »Aufsteiger« naprej, prejme enkratni bonus za napredovanje, ki je naveden na strani programa za ta rang (trenutno 50,00 EUR za vsak rang, za vse partnerje v evrih). Vsak rang se izplača samo enkrat, tudi po nazadovanju in ponovnem napredovanju. Bonus je predmet okna za vračilo po § 7.",
        "Provizija nastane za vsako podjetje za dvanajst mesecev od prvega plačljivega računa za naročnino; brezplačno testno obdobje, posredovano prek partnerja, in brezplačni mesec se ne štejejo. Če se naročnina prej konča, se provizija konča z zadnjim plačanim računom.",
        "Od ranga »Elite-Partner« naprej partner prejme dodatno superprovizijo v višini, navedeni na strani programa (trenutno 2,5 %), od neto prihodkov od naročnin vseh strank v njegovi strukturi – lastnih strank in strank njegovih timskih partnerjev – brez omejitve dvanajstih mesecev, dokler ima zadevna stranka plačljivo naročnino in ima partner rang v trenutku plačila. Nastane poleg provizije po drugem stavku in § 4.",
        "Od ranga »Elite-Partner« naprej partner za vsako rezervacijo podjetja, ki je dodeljeno njemu ali enemu od njegovih timskih partnerjev in je prejeta in plačana prek myBestDays, prejme delež rezervacije v višini, navedeni na strani programa (trenutno 0,5 %), od zneska rezervacije, ki ga je plačal gost v valuti rezervacije, brez časovne omejitve, dokler dodelitev obstaja in ima partner rang v trenutku plačila rezervacije. Varščine niso znesek rezervacije. Vračila gostu sorazmerno zmanjšajo delež (§ 7).",
      ],
    },
    {
      heading: "§ 4 Timsko nadomestilo",
      paragraphs: [
        "Od ranga »Aufsteiger« naprej sme partner voditi timske partnerje. Če se drug partner prijavi prek timske povezave partnerja in v svoji prijavi vidno potrdi njegovo kodo, bo po odobritvi dodeljen timu partnerja (v nadaljevanju »sponzor«). Če sponzor v trenutku prijave nima ranga, prijava ostane veljavna, vendar ne pride do dodelitve timu.",
        "Sponzor prejme timsko provizijo od neto prihodkov od naročnin strank svojih timskih partnerjev v višini razlike med lastno stopnjo provizije in stopnjo provizije timskega partnerja, vsakokrat glede na rang v trenutku plačila. Če sta oba v istem rangu ali je timski partner višje, ne nastane timska provizija. Provizija timskega partnerja in timska provizija sponzorja skupaj nikoli ne presegata najvišje stopnje lestvice (trenutno 30 %).",
        "Provizija ekipe je natančno eno raven globoko: partnerji ekipe ne prejmejo provizije ekipe za partnerje, ki jih sami pridobijo. Za pridobitev partnerja se ne plača nadomestilo; prispevek za udeležbo se ne zaračuna. Provizija ekipe izhaja izključno iz plačanega prihodka od naročnin.",
        "Provizija ekipe za vsako stranko ekipe traja dvanajst mesecev od njenega prvega plačanega računa, je predmet istega okna za vračilo in se sorazmerno odšteje v primeru vračila ali bremenitve (§ 7). Nastane le, dokler sta sponzor in partner ekipe odobrena; v nasprotnem primeru se zadrži do pojasnitve.",
        "Dodelitev ekipi je enkratna. Sprememba se izvede le s strani myNextDays z dokumentiranim razlogom.",
      ],
    },
    {
      heading: "§ 5 Obveznosti partnerja in označevanje",
      paragraphs: [
        "Partner vsako priporočilo označi s svojo povezavo ali kodo kot oglas – na začetku objave, v jeziku objave, v skladu z zahtevami svoje države (v Nemčiji med drugim § 5a odst. 4 UWG, na Danskem markedsføringsloven § 6 odst. 4). Besedila za posamezne države myNextDays zagotavlja v partnerski nadzorni plošči.",
        "Partner o myNextDays posreduje le informacije, ki ustrezajo objavljenim opisom storitev, in ne daje nobenih obljub v imenu myNextDays. Prepovedane so zlasti obljube o uspehu in garancije (npr. „zagotovljena polna zasedenost v treh dneh“) ter izjave o prihodkih, ki ne izhajajo iz objavljenih opisov storitev.",
        "Vsak video in vsaka objava, ki omenja myNextDays ali vsebuje povezavo partnerja, se pred objavo predloži v pregled kot datoteka v partnerski nadzorni plošči. Povezava partnerja nastane šele po pisni odobritvi s strani myNextDays; objava brez odobritve je prepovedana. myNextDays lahko prekliče odobritev; že nastale provizije ostanejo nespremenjene.",
        "Za logotipe, posnetke zaslona, B-Roll, prekrivne elemente in posnetke zaslona partner uporablja izključno promocijski material, ki ga zagotovi myNextDays. Lastni, nepreverjeni posnetki programske opreme niso dovoljeni.",
      ],
    },
    {
      heading: "§ 6 Prepovedane prakse",
      paragraphs: ["Zlasti so prepovedane:"],
      list: [
        "Brand-Bidding: plačljivi oglasi za blagovno znamko „myNextDays“, različice pisanja in kombinacije (npr. „myNextDays cene“) v iskalnikih in omrežjih;",
        "Cookie-Dropping, prikrite preusmeritve, iFrames, avtomatizirano klicanje partnerske povezave ali druge tehnične manipulacije dodelitve;",
        "Samopromocija: registracija lastnih podjetij, družbenikov, zaposlenih ali sorodnikov prek lastne kode ali kode partnerja ekipe;",
        "kupljen doseg (kupljeni sledilci, klik-farme, bot-promet) ter spodbude za podjetja za registracijo (povračila, darila, nagradne igre);",
        "Obljube o zaposlovanju: pridobivanje partnerjev z obljubami o zaslužku, ki ne izvirajo iz plačanega prihodka od naročnin, ali predstavljanje programa kot vira dohodka z pridobivanjem dodatnih partnerjev;",
        "Neželena pošta, nedovoljeno neposredno trženje in uporaba blagovnih znamk ali vsebin tretjih oseb brez pooblastila.",
      ],
    },
    {
      heading: "§ 7 Obdobje za vračila, preklic, zadržanje",
      paragraphs: [
        "Vsaka vrstica provizije je odprta 30 dni po njenem nastanku (obdobje za vračila) in je nato izplačljiva. Če je osnovni račun v celoti ali delno povrnjen ali storniran (Chargeback), se provizija – vključno z morebitno ekipno provizijo, ki temelji na njej – sorazmerno prekliče, tudi po izplačilu, z obračunom z bodočimi provizijami.",
        "V primeru suma kršitve § 2, § 5 ali § 6 lahko myNextDays zadrži dodelitve in provizije do razjasnitve. Če se kršitev potrdi, zadevne provizije zapadejo.",
      ],
    },
    {
      heading: "§ 8 Izplačilo in dobropis",
      paragraphs: [
        "Izplačljive provizije se mesečno združijo po valuti in izplačajo, takoj ko dosežejo minimalni znesek zadevne valute, naveden na strani programa ali v nadzorni plošči. Pretvorba med valutami ne poteka.",
        "Obračun se izvaja po postopku dobropisa (samofakturiranje, momsloven § 52a): myNextDays izda dobropis za vsako izplačilo; partner ne izda računa. Partner se strinja s postopkom dobropisa.",
        "Podjetniki prejmejo dobropis z opozorilom o davčni obveznosti prejemnika storitve (obratna davčna obveznost); pogoj je veljavna, potrjena identifikacijska številka za DDV. Zasebne osebe prejmejo dobropis brez DDV in provizijo obdavčijo same.",
        "Izplačilo se izvede z bančnim nakazilom SEPA, Wise ali PayPal na podatke, ki jih je partner vnesel v nadzorno ploščo.",
      ],
    },
    {
      heading: "§ 9 Podatki in vpogled",
      paragraphs: [
        "Partner vidi dodeljena podjetja psevdonimno (številka, država, status, zneski). Imena, e-poštni naslovi ali podatki o rezervacijah podjetij niso razkriti. Sponsor vidi od svojih ekipnih partnerjev ime oz. podjetje, rang, število plačljivih strank in iz tega izhajajočo ekipno provizijo, ne pa podrobnosti o strankah.",
        "Za povezane račune in ustvarjene objave myNextDays vidi sledilce, oglede, interakcije ter klike in stranke za vsako objavo. Nenavadnosti (na primer skok števila sledilcev brez ustreznih ogledov ali znatno odstopanje med samooceno in preverjeno vrednostjo) so indikacije za osebno preverjanje v skladu s § 6 in § 10, ne pa avtomatična blokada.",
        "Obdelava osebnih podatkov v partnerskem programu je opisana v izjavi o varovanju podatkov.",
      ],
    },
    {
      heading: "§ 10 Trajanje, blokada in odpoved",
      paragraphs: [
        "Sodelovanje je neomejeno in ga lahko obe strani kadar koli prekinejo v tekstovni obliki. Že nastale, izplačljive provizije se izplačajo v skladu s § 8; po prekinitvi ne nastanejo nove provizije.",
        "myNextDays lahko partnerja blokira v primeru kršitev teh pogojev. Med blokado se provizije zadržijo; v primeru potrjene kršitve zapadejo.",
      ],
    },
    {
      heading: "§ 11 Spremembe",
      paragraphs: [
        "myNextDays lahko te pogoje in lestvico spremeni z učinkom za prihodnost. Spremembe bodo objavljene na partnerski nadzorni plošči in na tej strani z oznako različice; v primeru bistvenih sprememb bo partner ponovno pozvan k soglasju. Že nastale provizije ostanejo nespremenjene.",
      ],
    },
    {
      heading: "§ 12 Veljavno pravo",
      paragraphs: [
        "Uporablja se dansko pravo z izključitvijo kolizijskih pravil. Obvezne določbe o varstvu potrošnikov države, v kateri ima zasebni partner običajno prebivališče, ostanejo nespremenjene.",
      ],
    },
  ],
};
