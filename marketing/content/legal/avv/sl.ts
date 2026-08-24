// Slowenische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `./de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen und die Liste der Unterauftragsverarbeiter) und werden von da
// in alle Sprachfassungen übernommen.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Pogodba o obdelavi osebnih podatkov",
  metaDescription:
    "Obdelava osebnih podatkov po členu 28 Splošne uredbe o varstvu podatkov med družbo myNextDays ApS in obrati, ki uporabljajo platformo: predmet, navodila, varnost, podobdelovalci.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Ta pogodba (v nadaljevanju „Pogodba o obdelavi“) velja med obratom, ki uporablja platformo myNextDays (v nadaljevanju „upravljavec“), in družbo ${ANBIETER.firma} (v nadaljevanju „obdelovalec“ ali „mi“) ter konkretizira obveznosti iz člena 28 Uredbe (EU) 2016/679 (Splošna uredba o varstvu podatkov).`,
    `Vključena je s [Splošnimi pogoji poslovanja](${AGB_URL}) in velja za celotno obdobje uporabe platforme. Prevlada nad Splošnimi pogoji poslovanja, kolikor gre za obdelavo osebnih podatkov po naročilu.`,
    "Dopolnilno velja [politika zasebnosti](/datenschutz) za podatke, ki jih obdelujemo kot samostojni upravljavec — zlasti za podatke računa in poslovnega razmerja.",
  ],
  sections: [
    {
      heading: "Predmet in razdelitev vlog",
      unterpunkte: [
        {
          paragraphs: [
            "Predmet je obdelava osebnih podatkov, ki jih upravljavec vnese v platformo ali jih zbere prek nje, da lahko opravljamo pogodbeno dogovorjene storitve: upravljanje objektov, rezervacij in zasedenosti, komunikacijo z gosti, obdelavo plačil, računovodstvo in obračune za lastnike, povezavo z rezervacijskimi portali, urejevalnik spletnih strani ter upravljanje nalog in ekipe.",
          ],
        },
        {
          paragraphs: [
            "O namenih in sredstvih te obdelave odloča upravljavec. Podatke obdelujemo izključno po njegovih dokumentiranih navodilih in ne za lastne namene.",
          ],
        },
        {
          paragraphs: [
            "Za podatke računa, obračuna naših lastnih storitev, sistemske varnosti in zakonske hrambe smo upravljavec sami. Ta obdelava ni predmet te Pogodbe o obdelavi.",
          ],
        },
      ],
    },
    {
      heading: "Vrsta, obseg in namen obdelave",
      paragraphs: [
        "Obdelava poteka z zbiranjem, shranjevanjem, prikazovanjem, spreminjanjem, posredovanjem prejemnikom, ki jih izbere upravljavec (npr. rezervacijskim portalom, ponudnikom plačilnih storitev), omejevanjem in izbrisom — v avtomatizirani obliki na platformi.",
        "Kraj obdelave je Evropska unija; izjeme so izčrpno navedene v razdelku 8.",
      ],
    },
    {
      heading: "Kategorije posameznikov, na katere se nanašajo osebni podatki",
      list: [
        "gostje in osebe, ki opravijo rezervacijo, vključno s sopotniki",
        "zainteresirane osebe, ki pošiljajo poizvedbe ali sporočila",
        "lastniki upravljanih objektov",
        "zaposleni pri upravljavcu (ekipa, čiščenje, servis, recepcija)",
        "kontaktne osebe partnerjev in ponudnikov storitev upravljavca",
      ],
    },
    {
      heading: "Kategorije osebnih podatkov",
      list: [
        "osnovni podatki: ime, naslov, datum rojstva, če je zajet, državljanstvo, če je zajeto zaradi obveznosti prijave gostov",
        "kontaktni podatki: e-poštni naslov, telefonska številka",
        "podatki o rezervaciji: obdobje, objekt, število potnikov, cene, dodatne storitve, odpovedi",
        "podatki o plačilu: znesek, valuta, način plačila, status plačila, sklici (celotni podatki o kartici ne pridejo v naše sisteme)",
        "podatki o komunikaciji: sporočila, opombe, ocene",
        "podatki o dostopu in uporabi zaposlenih: vloga, dovoljenja, čas prijave, naprava in naslov IP prijave",
        "posebne vrste osebnih podatkov po členu 9 Splošne uredbe o varstvu podatkov niso predmet naročila; upravljavec takih podatkov ne vnaša v polja s prostim besedilom.",
      ],
    },
    {
      heading: "Navodila",
      unterpunkte: [
        {
          paragraphs: [
            "Navodila upravljavec daje z uporabo in konfiguracijo platforme ter v besedilni obliki na naš kontaktni naslov. Ustna navodila potrdimo v besedilni obliki.",
          ],
        },
        {
          paragraphs: [
            "Če menimo, da je navodilo nezakonito, to nemudoma sporočimo in smemo izvedbo zadržati, dokler ga upravljavec ne potrdi ali spremeni.",
          ],
        },
        {
          paragraphs: [
            "Če smo k obdelavi zavezani z zakonom (na primer v razmerju do organov), upravljavca o tem obvestimo vnaprej, kolikor nam je to pravno dovoljeno.",
          ],
        },
        {
          titel: "Povezava lastnih storitev upravljavca",
          paragraphs: [
            "Upravljavec lahko svoj račun prek vmesnika poveže s storitvijo, ki jo je izbral sam in z katero je sklenil lastno pogodbo — na primer s pomočnikom z umetno inteligenco. Če takšno povezavo odobri, je to njegovo izrecno navodilo po členu 28(3), točka (a), Splošne uredbe o varstvu podatkov, da odobrene podatke izročimo tej storitvi. Izrecno zajema tudi s tem povezan prenos v tretjo državo, če ima storitev sedež zunaj Evropske unije.",
            "Na kratko: o takšni povezavi odloča izključno upravljavec, za povezano storitev pa je odgovoren sam.",
            "Odobri jo lahko le račun z dovoljenjem za upravljanje zunanjih povezav. To dovoljenje je pridržano vlogi „Skrbnik“; računi z omejenimi pravicami — tudi vloga „Sokrbnik“ — povezave ne morejo odobriti. Zabeležimo, kdo jo je kdaj in za katero storitev odobril, katere vrste podatkov so bile odobrene in kateri priklici so bili opravljeni; ta zapis je upravljavcu na voljo v vmesniku pod „Račun → Povezave“, da lahko izpolni svojo obveznost odgovornosti in odgovori na zahteve za dostop.",
            "Povezana storitev ni naš podobdelovalec: ne naročamo ji, ne izbiramo je in ji ne dajemo navodil. Podatke obdeluje na podlagi pogodbe, ki jo je upravljavec sklenil z njo sam. Za to obdelavo, za njeno pravno podlago in za jamstva pri prenosu v tretjo državo je zato odgovoren upravljavec; ta obdelava ni predmet te Pogodbe o obdelavi.",
            "Polja s prostim besedilom — opombe k rezervaciji in vsebina sporočil gostov — so iz takšne povezave privzeto izvzeta. Lahko vsebujejo posebne vrste osebnih podatkov po členu 9 Splošne uredbe o varstvu podatkov, na primer podatke o zdravju. Upravljavec jih mora ob odobritvi posebej odobriti; brez te odobritve se ne posredujejo.",
            "Upravljavec lahko odobreno povezavo v vmesniku kadar koli prekine. Žetoni za obnovitev se pri tem izbrišejo, pri vsakem nadaljnjem priklicu pa se preveri, ali privolitev še obstaja — prekinjena storitev zato ne more prebrati ničesar več takoj, ne šele po izteku svojega dostopnega žetona.",
          ],
        },
      ],
    },
    {
      heading: "Zaupnost",
      paragraphs: [
        "Vse osebe, ki lahko v skladu z naročilom dostopajo do podatkov, so zavezane k zaupnosti in so redno poučene o varstvu podatkov. Dostop je omejen na obseg, ki je potreben za posamezno nalogo.",
        "Dostopi naših zaposlenih do podatkov strank se izvajajo le za odpravo napak, na zahtevo podpore ali za izpolnitev zakonskih obveznosti.",
      ],
    },
    {
      heading: "Varnost obdelave",
      paragraphs: [
        "Izvajamo tehnične in organizacijske ukrepe, ki jih zahteva člen 32 Splošne uredbe o varstvu podatkov. Uvedeni so zlasti:",
      ],
      list: [
        "šifriranje prenosa (TLS) za vse povezave, varnostne glave HTTP, vključno s strogo Content-Security-Policy",
        "ločevanje najemnikov neposredno v podatkovni bazi: pravila dostopa na ravni vrstic (Row Level Security) in odvzete pravice na tabelah za občutljive podatke, tako da je dostop zunaj lastnega obrata izključen tudi po neposredni poti do podatkovne baze",
        "dovoljenja na podlagi vlog z ločevanjem podatkov: servisno in čistilno osebje ne dobi finančnih in prodajnih podatkov, lastniki le svoje objekte; podatki gostov so za vloge brez pooblastila maskirani",
        "dvofaktorsko preverjanje pristnosti (TOTP) je na voljo za račune; ponovna prijava pri varnostno občutljivih spremembah",
        "dnevnik prijav z napravo, časom in naslovom IP, ki je na vpogled upravljavcu",
        "povezave z zunanjimi storitvami lahko odobri le račun z vlogo „Skrbnik“; vsak priklic prek takšne povezave se zabeleži (orodje, čas, obseg — brez samih vsebin) in je na vpogled upravljavcu. Prekinjena povezava izgubi dostop takoj: pri vsakem priklicu se preveri, ali privolitev še obstaja",
        "omejevanje pogostosti zahtev proti avtomatiziranim napadom, preverjanje podpisov dohodnih klicev webhook",
        "šifrirane varnostne kopije, hranjene zunaj produkcijskega sistema, z rednim preverjanjem obnovitve",
        "ločeni okolji za razvoj in obratovanje; spremembe podatkovne baze izključno prek verzioniranih migracij",
      ],
    },
    {
      heading: "Podobdelovalci",
      paragraphs: [
        "Upravljavec odobrava uporabo naslednjih podobdelovalcev. Z vsakim od njih so sklenjene pogodbe po členu 28(4) Splošne uredbe o varstvu podatkov z obveznostmi, ki ustrezajo tej Pogodbi o obdelavi.",
      ],
      list: [
        "Hetzner Online GmbH, Nemčija (strežnik, podatkovna baza, mediji, poštni strežnik; podatkovni center Helsinki, Finska)",
        "Stripe Payments Europe, Limited, Irska (plačila, izplačila, zakonsko preverjanje identitete)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luksemburg (plačila, če jih upravljavec aktivira)",
        "Channex.io Ltd, Združeno kraljestvo (povezava z rezervacijskimi portali, če je aktivirana)",
        "Meta Platforms Ireland Limited, Irska (sporočila WhatsApp, če so aktivirana)",
        "Google Ireland Limited, Irska (prevajanje vsebin; prijava z Googlom, če se uporablja)",
        "Groq, Inc., ZDA (predlogi odgovorov v prejeti pošti, če so aktivirani)",
        "Cloudflare, Inc., ZDA (upravljanje zapisov DNS za lastne domene, če se uporablja)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "O zamenjavi ali dopolnitvi obvestimo najmanj 30 dni vnaprej. Upravljavec lahko v tem roku ugovarja iz utemeljenega razloga, povezanega z varstvom podatkov; če ugovor ni odpravljen, lahko odpove prizadeti del storitve ali pogodbo.",
          ],
        },
        {
          paragraphs: [
            "Storitve, ki jih upravljavec sam dogovori s tretjo osebo, niso podobdelava, temveč prenos, ki ga je naročil sam. To velja za rezervacijski portal, s katerim ima lastno pogodbo, prav tako pa za pomočnika z umetno inteligenco ali drug program, ki ga prek vmesnika poveže s svojim računom (glej razdelek „Navodila“).",
            "Pri tem ni odločilno, prek čigavih sistemov tečejo podatki, temveč kdo storitev pritegne: podobdelava nastane, kadar MI naročimo dodatnega ponudnika storitev, da opravimo svojo storitev. Če upravljavec storitev izbere sam in z njo sklene pogodbo, ta storitev obdeluje za upravljavca — ne za nas. Ta razmejitev ustreza pogodbeni praksi primerljivih ponudnikov za storitve tretjih oseb, ki jih poveže stranka.",
          ],
        },
      ],
    },
    {
      heading: "Prenos v tretje države",
      paragraphs: [
        "Prenosi prejemnikom zunaj EU so omejeni na zgoraj navedene storitve s sedežem v ZDA oziroma Združenem kraljestvu. Podlaga so standardna določila o varstvu podatkov Evropske komisije po členu 46(2)(c) Splošne uredbe o varstvu podatkov ali veljaven sklep o ustreznosti; uporabljajo se dopolnilni zaščitni ukrepi (šifriranje, najmanjši obseg podatkov).",
      ],
    },
    {
      heading: "Podpora upravljavcu",
      unterpunkte: [
        {
          paragraphs: [
            "Upravljavca podpiramo pri odgovarjanju na zahteve posameznikov, na katere se nanašajo osebni podatki (členi 15 do 22 Splošne uredbe o varstvu podatkov). Platforma za to omogoča dostop do podatkov, popravek, izvoz in izbris neposredno v vmesniku. Če se posamezniki, na katere se nanašajo osebni podatki, obrnejo neposredno na nas, jih napotimo na upravljavca in ga o tem obvestimo.",
          ],
        },
        {
          paragraphs: [
            "Podpiramo tudi pri ocenah učinka v zvezi z varstvom podatkov, pri izpolnjevanju obveznosti iz členov 32 do 36 Splošne uredbe o varstvu podatkov in pri zahtevah nadzornih organov.",
          ],
        },
      ],
    },
    {
      heading: "Kršitve varstva osebnih podatkov",
      paragraphs: [
        "Če izvemo o kršitvi varstva osebnih podatkov, ki zadeva podatke upravljavca, ga o tem nemudoma, najpozneje v 48 urah po seznanitvi, obvestimo v besedilni obliki.",
        "Obvestilo vsebuje, kolikor je znano, vrsto in čas dogodka, prizadete kategorije podatkov in skupine oseb, verjetne posledice ter sprejete in predlagane ukrepe. Upravljavca podpiramo pri njegovih obveznostih uradnega obveščanja in sporočanja po členih 33 in 34 Splošne uredbe o varstvu podatkov.",
      ],
    },
    {
      heading: "Dokazila in nadzor",
      unterpunkte: [
        {
          paragraphs: [
            "Skladnost s to Pogodbo o obdelavi na zahtevo izkažemo, zlasti z informacijami o sprejetih ukrepih in o uporabljenih podobdelovalcih.",
          ],
        },
        {
          paragraphs: [
            "Upravljavec lahko nadzor izvaja v potrebnem obsegu ali ga da izvesti neodvisnemu revizorju, ki z nami ni v konkurenčnem razmerju. Nadzor se izvaja po napovedi v primernem roku, med običajnim delovnim časom in brez motenja obratovanja. Stroške preverjanja, ki presega posredovanje informacij, nosi upravljavec, razen če je preverjanje povzročil dogodek, ki smo ga povzročili mi.",
          ],
        },
      ],
    },
    {
      heading: "Izbris in vračilo",
      paragraphs: [
        "Po prenehanju pogodbe podatke upravljavca na zahtevo v 30 dneh damo na voljo za izvoz v običajnem, strojno berljivem formatu. Nato podatke skupaj s kopijami izbrišemo.",
        "Izvzeti so podatki, za katere velja zakonska obveznost hrambe (zlasti podatki o računih in računovodski podatki); ti se blokirajo in po izteku roka izbrišejo. Varnostne kopije se prepišejo z rednim ciklom rotacije.",
      ],
    },
    {
      heading: "Odgovornost in vrstni red veljavnosti",
      paragraphs: [
        "Uporablja se člen 82 Splošne uredbe o varstvu podatkov. V razmerju med pogodbenima strankama poleg tega veljajo pravila o odgovornosti iz Splošnih pogojev poslovanja, kolikor niso v nasprotju s Splošno uredbo o varstvu podatkov.",
        "Če si Splošni pogoji poslovanja in ta Pogodba o obdelavi pri obdelavi po naročilu nasprotujejo, velja ta Pogodba o obdelavi. Če posamezna določba postane neveljavna, preostala vsebina ostane veljavna; pogodbeni stranki jo nadomestita z dopustno ureditvijo z enakim namenom.",
      ],
    },
    {
      heading: "Spremembe te pogodbe",
      paragraphs: [
        "To Pogodbo o obdelavi smemo prilagoditi, kolikor je to potrebno zaradi sprememb zakonodaje, zahtev nadzornih organov, zahtev ponudnikov plačilnih storitev ali tehničnega razvoja in upravljavec s tem ni v slabšem položaju.",
        "Spremembe napovemo v besedilni obliki najmanj 30 dni pred začetkom veljavnosti. Če upravljavec v tem roku ne ugovarja, se šteje, da so sprejete; na to posledico je v napovedi opozorjen. Ob ugovoru lahko vsaka stranka odpove pogodbo z dnem začetka veljavnosti sprememb.",
      ],
    },
    {
      heading: "Kontakt",
      paragraphs: [
        `Poizvedbe o tej pogodbi, navodila in obvestila naslovite na [${ANBIETER.email}](mailto:${ANBIETER.email}) ali na ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
