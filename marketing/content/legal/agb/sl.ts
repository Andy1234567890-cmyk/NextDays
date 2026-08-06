// KOPIE aus web/content/legal/agb/sl.ts — bewusst dupliziert, weil die
// Apps isoliert gebaut werden (ADR-0016): der Docker-Kontext dieser App
// enthält web/ nicht. Inhaltliche Änderungen IMMER in beiden Dateien.
// Zusätzlich zur web-Fassung: slug/metaDescription/numbered/toc für den
// Renderer dieser App.
import type { LegalDoc } from "../types";

// Slowenische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. § 5 folgt Stripes offiziellem Empfehlungstext (Stripe Connected
// Account Agreement) — Wortlaut und URLs nicht verändern.
export const agb: LegalDoc = {
  slug: "agb",
  metaDescription:
    "Splošni pogoji uporabe platforme myNextDays za agencije in najemodajalce.",
  numbered: false,
  toc: true,
  title: "Splošni pogoji poslovanja za agencije in najemodajalce",
  stand: "Zadnja posodobitev: 30. julij 2026",
  intro: [
    "Ti splošni pogoji poslovanja (v nadaljevanju „Splošni pogoji“) urejajo uporabo programske platforme myNextDays (v nadaljevanju „Platforma“) s strani agencij, najemodajalcev, upravnikov nepremičnin in drugih poslovnih uporabnikov (v nadaljevanju „Uporabnik“).",
    "Ponudnik Platforme je myNextDays ApS, družba z omejeno odgovornostjo (anpartsselskab) po danskem pravu, Hirtshalsvej 21, 9881 Bindslev, Danska, vpisana v danski Centralni poslovni register (CVR) pod št. CVR 46615182 (v nadaljevanju „myNextDays“ ali „mi“).",
    "Platforma je namenjena izključno podjetnikom v smislu člena 14 nemškega civilnega zakonika (BGB) oziroma ustreznih predpisov posamezne države članice EU. Ni namenjena potrošnikom.",
  ],
  sections: [
    {
      heading: "§ 1 Področje uporabe",
      paragraphs: [
        "Ti Splošni pogoji veljajo za vse pogodbe o uporabi Platforme med myNextDays in Uporabnikom ter za vse storitve in module, ki se zagotavljajo prek nje.",
        "Drugačni, nasprotujoči ali dopolnilni poslovni pogoji Uporabnika postanejo sestavni del pogodbe le, če je myNextDays z njihovo veljavnostjo izrecno soglašala v besedilni obliki.",
      ],
    },
    {
      heading: "§ 2 Predmet pogodbe in storitve",
      paragraphs: [
        "myNextDays Uporabniku zagotavlja programsko opremo v oblaku za upravljanje počitniških nastanitev in nastanitvenih obratov. Obseg funkcij izhaja iz vsakokrat veljavnega opisa storitev in obsega zlasti:",
      ],
      list: [
        "upravljanje objektov, koledarjev zasedenosti in rezervacij (sistem za upravljanje nastanitev — property management system),",
        "povezavo z rezervacijskimi kanali tretjih ponudnikov (npr. Booking.com, Airbnb) prek upravitelja kanalov (channel manager),",
        "objavo ponudb prek lastnega rezervacijskega kanala Platforme myNextDays,",
        "izdelavo lastnih spletnih strani prek integriranega urejevalnika spletnih strani,",
        "računovodske, obračunske in analitične funkcije, vključno z obračuni za lastnike,",
        "komunikacijo z gosti ter sprejemanje plačil prek integrirane obdelave plačil (§ 5).",
      ],
    },
    {
      heading: "§ 3 Registracija, račun in podatki Uporabnika",
      paragraphs: [
        "Uporaba Platforme je pogojena z registracijo računa. Uporabnik je dolžan ob registraciji in ves čas trajanja pogodbe navajati resnične, aktualne in popolne podatke o sebi in svojem podjetju ter jih ob spremembah nemudoma posodobiti.",
        "Dostopne podatke je treba hraniti v tajnosti in jih varovati pred dostopom tretjih oseb. Uporabnik mora myNextDays nemudoma obvestiti, če obstajajo znaki zlorabe njegovega računa.",
        "Račun ni prenosljiv. Uporabnik zagotavlja, da vse osebe, ki račun uporabljajo v njegovem imenu, spoštujejo te Splošne pogoje.",
      ],
    },
    {
      heading: "§ 4 Vloga myNextDays pri rezervacijah",
      paragraphs: [
        "Pogodbe o nastanitvi za nastanitve, ponujene na Platformi, prek povezanih kanalov tretjih ponudnikov ali prek lastne spletne strani Uporabnika, se sklenejo izključno med Uporabnikom (oziroma lastnikom, ki ga ta zastopa) in posameznim gostom. myNextDays ne postane pogodbena stranka pogodbe o nastanitvi.",
        "Za točnost in zakonitost vsebine ponudb (opisi, fotografije, cene, razpoložljivost, davki in dajatve) je odgovoren izključno Uporabnik.",
      ],
    },
    {
      heading: "§ 5 Obdelava plačil prek družbe Stripe",
      paragraphs: [
        "Storitve obdelave plačil za agencije in najemodajalce na myNextDays zagotavlja Stripe in zanje velja pogodba [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), ki vključuje pogoje uporabe storitev Stripe (skupaj „Okvirna pogodba Stripe“). S soglasjem k tem Splošnim pogojem ali z nadaljnjim delovanjem kot agencija ali najemodajalec na myNextDays se Uporabnik strinja, da ga zavezuje Okvirna pogodba Stripe, ki jo Stripe lahko občasno spremeni.",
        "Pogoj za to, da myNextDays omogoča storitve obdelave plačil prek družbe Stripe, je, da Uporabnik družbi myNextDays posreduje točne in popolne informacije o sebi in svojem podjetju. Uporabnik pooblašča myNextDays, da te informacije ter podatke o transakcijah, povezane z uporabo storitev obdelave plačil, ki jih zagotavlja Stripe, posreduje družbi Stripe.",
        "Za pravno razmerje z družbo Stripe je merodajno povezano angleško pogodbeno besedilo v vsakokrat veljavni različici. Pogodbeni partner za uporabnike v Evropskem gospodarskem prostoru je družba Stripe, navedena v Okvirni pogodbi Stripe (trenutno Stripe Payments Europe, Limited, Irska). Stripe obdeluje osebne podatke v skladu s [politiko zasebnosti družbe Stripe](https://stripe.com/privacy).",
        "Za izpolnitev zakonskih obveznosti identifikacije in preverjanja (med drugim za preprečevanje pranja denarja in zahteve „poznaj svojo stranko“) lahko myNextDays in Stripe kadar koli zahtevata dodatne podatke in dokazila, zlasti osebne dokumente, podatke o dejanskih lastnikih in bančnem računu. Če zahtevani podatki ali dokazila niso predloženi v postavljenem roku, se lahko sprejemanje plačil ali izplačila v celoti ali delno začasno ustavijo, dokler podatki niso popolni.",
      ],
    },
    {
      heading: "§ 6 Izplačila, povratne bremenitve in negativna stanja",
      paragraphs: [
        "Pot plačila je odvisna od rezervacijskega kanala. Pri rezervacijah, opravljenih prek Uporabnikovega lastnega rezervacijskega sistema, in pri rezervacijah prek povezanih distribucijskih portalov se plačila gostov prejmejo neposredno na plačilni račun Uporabnika; v teh primerih je Uporabnik v razmerju do gosta prejemnik plačila in pogodbena stranka nastanitvene storitve (§ 4), myNextDays pa v nobenem trenutku ne postane imetnik teh sredstev. Za takšne rezervacije myNextDays ne zaračunava odstotne rezervacijske provizije; provizija za rezervacije prek povezanih distribucijskih portalov je izkazana ločeno in zaračunana naknadno.",
        "Pri rezervacijah, sklenjenih prek rezervacijskega portala myNextDays, se plačilo obdela prek myNextDays. myNextDays pri tem zadrži posredniško provizijo, navedeno v vsakokrat veljavnem ceniku, vključno s stroški obdelave plačila, preostali znesek pa nakaže Uporabniku v skladu s spodnjimi odstavki. Plačilo za uporabo programske opreme (§ 7) s tem ni prizadeto.",
        "Izplačila se izvajajo na bančni račun, ki ga je navedel Uporabnik. myNextDays lahko iz razlogov obvladovanja tveganj prilagodi časovni razpored izplačil, zlasti pri novih računih, neobičajnih vzorcih transakcij ali potekajočih preverjanjih.",
        "Vračila gostom nosi ekonomsko Uporabnik. Povratne bremenitve in iz njih izhajajoče stroške nosi Uporabnik pri rezervacijah, opravljenih prek njegovega lastnega rezervacijskega sistema in prek povezanih distribucijskih portalov, saj je Uporabnik v teh primerih prejemnik plačila; pri rezervacijah, sklenjenih prek rezervacijskega portala myNextDays, tveganje povratne bremenitve nosi myNextDays, razen če ta izhaja iz kršitve obveznosti Uporabnika (zlasti neizvedbe ali bistvenega odstopanja nastanitvene storitve). myNextDays je upravičena pobotati zneske v breme Uporabnika s prihodnjimi izplačili.",
        "Če na plačilnem računu Uporabnika nastane negativno stanje, ga mora Uporabnik nemudoma poravnati. Uporabnik pooblašča myNextDays in Stripe, da negativna stanja poravnata z bremenitvijo navedenega bančnega računa, kolikor je to pravno dopustno.",
      ],
    },
    {
      heading: "§ 7 Nadomestila in obračun",
      paragraphs: [
        "Nadomestila za uporabo Platforme izhajajo iz cenika, dogovorjenega ob sklenitvi pogodbe, oziroma iz individualne ponudbe. Vse cene so navedene brez vsakokrat veljavnih zakonsko predpisanih davkov in v valuti, določeni v pogodbi.",
        "Nadomestila, vezana na transakcije (npr. provizije za plačila ali kanale), se lahko zadržijo ali pobotajo neposredno ob obdelavi posamezne transakcije.",
        "Če Uporabnik zamuja s plačili, lahko myNextDays po predhodni napovedi blokira dostop do Platforme, dokler odprte terjatve niso poravnane.",
      ],
    },
    {
      heading: "§ 8 Obveznosti Uporabnika; lastna pravna besedila",
      paragraphs: [
        "Uporabnik zagotavlja, da so njegove ponudbe, vsebine in poslovne prakse skladne z vsakokrat veljavno zakonodajo, zlasti s predpisi o nastanitveni dejavnosti, prijavi gostov, davkih in varstvu potrošnikov v kraju nastanitve. Potrebna dovoljenja, registracije in licence Uporabnik pridobi in vzdržuje na lastno odgovornost.",
        "Za spletne strani, ki jih Uporabnik upravlja prek urejevalnika spletnih strani, ter za svoje ponudbe na Platformi je Uporabnik odgovoren sam; to vključuje zlasti lastne splošne pogoje za goste, lasten kolofon (pravno obvestilo) in lastne informacije o varstvu podatkov.",
        "Prepovedani so zlasti: objavljanje netočnih ali zavajajočih ponudb, izvajanje navideznih poslov ali goljufivih transakcij, obhajanje obdelave plačil po § 5 pri rezervacijah, sklenjenih prek Platforme, ter vsaka uporaba, ki ogroža varnost ali razpoložljivost Platforme.",
      ],
    },
    {
      heading: "§ 9 Rezervacijski kanali tretjih ponudnikov",
      paragraphs: [
        "Pri povezovanju kanalov tretjih ponudnikov (npr. Booking.com, Airbnb) dodatno veljajo pogoji posameznega upravljavca kanala. Pogodbe, potrebne za to, Uporabnik sklene neposredno z upravljavcem kanala.",
        "myNextDays izvaja tehnično sinhronizacijo razpoložljivosti, cen in podatkov o rezervacijah, vendar nima vpliva na vsebine, provizije ali odločitve upravljavcev kanalov in ne odgovarja za njihovo razpoložljivost.",
      ],
    },
    {
      heading: "§ 10 Razpoložljivost in nadaljnji razvoj",
      paragraphs: [
        "myNextDays opravlja storitve s skrbnostjo dobrega gospodarstvenika in si prizadeva za visoko razpoložljivost Platforme. Vzdrževalna okna, nadaljnji razvoj in okoliščine zunaj vpliva myNextDays (npr. motnje pri tretjih ponudnikih) lahko razpoložljivost začasno omejijo.",
        "myNextDays sme Platformo nadalje razvijati in spreminjati funkcije, če s tem ni ogrožen namen pogodbe in je sprememba za Uporabnika sprejemljiva.",
      ],
    },
    {
      heading: "§ 11 Podatki in varstvo podatkov",
      paragraphs: [
        "Kolikor myNextDays pri zagotavljanju Platforme obdeluje osebne podatke v imenu Uporabnika (zlasti podatke gostov), pogodbeni stranki skleneta pogodbo o obdelavi podatkov v skladu s členom 28 Splošne uredbe o varstvu podatkov (GDPR).",
        "Uporabnik ostaja odgovoren za dopustnost zbiranja in obdelave podatkov, ki jih vnese, z vidika predpisov o varstvu podatkov. Podrobnosti o obdelavi podatkov s strani myNextDays izhajajo iz informacij o varstvu podatkov na Platformi; za obdelavo podatkov s strani družbe Stripe velja § 5.",
      ],
    },
    {
      heading: "§ 12 Intelektualna lastnina",
      paragraphs: [
        "Vse pravice na Platformi, njeni programski opremi in njenih vsebinah (razen vsebin, ki jih vnese Uporabnik) pripadajo myNextDays oziroma njenim dajalcem licenc. Uporabnik za čas trajanja pogodbe pridobi neizključno in neprenosljivo pravico do uporabe Platforme v pogodbeno dogovorjenem obsegu.",
        "Na vsebinah, ki jih vnese, Uporabnik družbi myNextDays podeli neizključne pravice uporabe, potrebne za delovanje Platforme (zlasti za shranjevanje, razmnoževanje, prikazovanje in posredovanje povezanim kanalom).",
      ],
    },
    {
      heading: "§ 13 Odgovornost",
      paragraphs: [
        "myNextDays odgovarja neomejeno za naklep in hudo malomarnost ter za škodo, nastalo zaradi posega v življenje, telo ali zdravje.",
        "Pri lahki malomarnosti myNextDays odgovarja le za kršitev bistvenih pogodbenih obveznosti (kardinalnih obveznosti), in sicer omejeno na predvidljivo škodo, tipično za to vrsto pogodbe. Odgovornost po predpisih o odgovornosti za proizvode in iz prevzetih garancij ostaja nespremenjena.",
        "Za izgubo podatkov myNextDays odgovarja le v obsegu, v katerem bi škoda nastala tudi ob pravilnem in rednem varnostnem kopiranju podatkov s strani Uporabnika, razen če je varnostno kopiranje podatkov po pogodbi obveznost myNextDays.",
      ],
    },
    {
      heading: "§ 14 Trajanje pogodbe, odpoved in blokada",
      paragraphs: [
        "Trajanje pogodbe in odpovedni roki izhajajo iz posamezne pogodbe. Pravica do izredne odpovedi iz utemeljenega razloga ostaja nespremenjena.",
        "myNextDays lahko dostop do Platforme ali posamezne funkcije (vključno s sprejemanjem plačil in izplačili) začasno blokira, če obstajajo konkretni znaki kršitve teh Splošnih pogojev, goljufije ali zlorabe ali če je myNextDays k temu zavezana z zakonom ali odredbo ponudnika plačilnih storitev. Uporabnik je o blokadi obveščen, kolikor je to pravno dopustno.",
        "Po prenehanju pogodbe myNextDays Uporabniku na zahtevo v 30 dneh da na voljo njegove podatke za izvoz v običajnem formatu; nato se podatki izbrišejo, razen če temu nasprotujejo zakonske obveznosti hrambe.",
      ],
    },
    {
      heading: "§ 15 Spremembe teh Splošnih pogojev",
      paragraphs: [
        "myNextDays lahko te Splošne pogoje spremeni z učinkom za naprej, če je to potrebno iz utemeljenih razlogov (zlasti zaradi sprememb zakonodaje, sodne prakse ali zahtev ponudnikov plačilnih storitev) in Uporabnik s tem ni nesorazmerno prikrajšan.",
        "Spremembe se Uporabniku napovejo v besedilni obliki najmanj šest tednov pred začetkom veljavnosti. Če Uporabnik v roku napovedi ne ugovarja ali Platformo po začetku veljavnosti še naprej uporablja, se šteje, da so spremenjeni Splošni pogoji sprejeti; na to posledico je v napovedi posebej opozorjen.",
      ],
    },
    {
      heading: "§ 16 Končne določbe",
      paragraphs: [
        "Uporablja se pravo države, v kateri ima ponudnik sedež, z izključitvijo Konvencije ZN o pogodbah o mednarodni prodaji blaga. Prisilni predpisi države, v kateri ima Uporabnik sedež, ostajajo nespremenjeni.",
        "Izključno pristojno za vse spore, ki izhajajo iz te pogodbe ali so z njo povezani, je — kolikor je to pravno dopustno — sodišče v kraju sedeža ponudnika.",
        "Če bi bile ali postale posamezne določbe teh Splošnih pogojev neveljavne, to ne vpliva na veljavnost preostalih določb.",
      ],
    },
  ],
};
