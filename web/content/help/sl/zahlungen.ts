import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Plačila in računi",
  description: "Ponudniki plačil, pravila plačila in računi.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Plačila",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Povezovanje ponudnika plačil",
          excerpt:
            "Tako povežete Stripe ali PayPal z myNextDays, da samodejno obdelujete plačila.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Razpoložljivi ponudniki" },
            {
              type: "p",
              text: "myNextDays plačila obdeluje prek povezanih ponudnikov plačil. Trenutno sta podprta Stripe in PayPal — povežete lahko enega ali oba ponudnika hkrati in ju uporabljate glede na objekt ali željo gosta.",
            },
            {
              type: "steps",
              items: [
                "Odprite Konto in preklopite v razdelek „Plačila“.",
                "Izberite želenega ponudnika — Stripe ali PayPal.",
                "Sledite pogovornemu oknu za povezavo in se prijavite pri ponudniku ali ustvarite nov račun.",
                "Potrdite povezavo — status se spremeni v „povezano“.",
              ],
            },
            { type: "h2", text: "Kaj se zgodi nato" },
            {
              type: "p",
              text: "Takoj ko je ponudnik povezan, lahko pošiljate povezave za plačilo, pobirate akontacije in sprožite vračila neposredno iz rezervacije. Vsi zneski se obdelajo v valuti, nastavljeni za zadevni objekt.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Brez povezanega ponudnika lahko plačila samo ročno označite kot prejeta — samodejna bremenitev takrat ni mogoča.",
            },
            { type: "h2", text: "Več objektov, en ponudnik" },
            {
              type: "p",
              text: "Enkrat vzpostavljena povezava velja na ravni celotnega računa za vse vaše objekte. Kako natančno poteka bremenitev, določite prek [Pravila plačila](/hilfe/zahlungen/zahlungsregeln). Izplačila vam nato potekajo prek zadevnega ponudnika, glejte [Izplačila](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe je primeren za plačila s kartico in mnoge lokalne načine plačila",
                "PayPal gostom ponuja znano alternativo",
                "Oba ponudnika je mogoče neodvisno drug od drugega ločiti in znova povezati",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Pravila plačila",
          excerpt: "Določite, kdaj zapadeta akontacija in doplačilo rezervacije.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Akontacija in doplačilo" },
            {
              type: "p",
              text: "Pravila plačila določajo, kako se rezervacija finančno obdela — na primer akontacija ob rezervaciji in doplačilo pred prihodom ali celotno plačilo takoj. Pravila veljajo po posameznem objektu in jih je mogoče kadar koli prilagoditi.",
            },
            {
              type: "steps",
              items: [
                "Odprite objekt in preklopite v razdelek „Pravila plačila“.",
                "Izberite, ali se pobira akontacija, in določite delež.",
                "Določite, kdaj zapade doplačilo, na primer določeno število dni pred prihodom.",
                "Shranite nastavitve.",
              ],
            },
            { type: "h2", text: "Samodejna bremenitev" },
            {
              type: "p",
              text: "Če je povezan ponudnik plačil, myNextDays samodejno pobere akontacijo in doplačilo ob nastavljenem trenutku ter gosta o tem vnaprej obvesti s sporočilom.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pravila plačila veljajo le pri rezervacijah s povezanim ponudnikom plačil. Brez ponudnika plačila v rezervaciji označite ročno.",
            },
            { type: "h2", text: "Razlike po kanalu" },
            {
              type: "p",
              text: "Na portalih lahko odstopajoče velja njihova lastna obdelava plačil — v tem primeru preverite pogoje zadevnega portala. Za rezervacije prek lastne platforme ali spletne strani vedno veljajo tukaj nastavljena pravila. Podrobnosti o povezavi ponudnika najdete pod [Povezovanje ponudnika plačil](/hilfe/zahlungen/zahlungsanbieter-verbinden), o izstavljanju računov pod [Ustvarjanje računov](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Akontacija je mogoča kot fiksni znesek ali odstotek",
                "Rok doplačila je prosto izbirljiv",
                "Spremembe veljajo šele za nove rezervacije, ne retroaktivno",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Ustvarjanje računov",
          excerpt: "Tako za rezervacijo ustvarite račun s pravilnim naslovom za izstavitev.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Ustvarjanje računa" },
            {
              type: "p",
              text: "Za vsako rezervacijo je mogoče ustvariti račun — za samega gosta ali za drugačno podjetje, če je rezervacija poslovna.",
            },
            {
              type: "steps",
              items: [
                "Odprite rezervacijo v Rezervacijah.",
                "Izberite „Ustvari račun“.",
                "Preverite ali dopolnite naslov za izstavitev računa.",
                "Preverite navedene postavke — nočitev, dodatke, pristojbine.",
                "Ustvarite račun in ga pošljite gostu.",
              ],
            },
            { type: "h2", text: "Urejanje naslova za izstavitev računa" },
            {
              type: "p",
              text: "Naslov za izstavitev računa lahko navedete neposredno v rezervaciji ali ga naknadno pridobite od gosta prek potrditve rezervacije. Brez popolnega naslova v določenih državah ni mogoče izdati pravno veljavnega računa.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Pri poslovnih strankah še posebej preverite ime podjetja in naslov — naknadni popravki zahtevajo korekcijski račun.",
            },
            { type: "h2", text: "Zneski in valuta" },
            {
              type: "p",
              text: "Vse postavke se izkazujejo v valuti, nastavljeni za objekt. Že izvedena plačila se na računu navedejo kot prejeto plačilo. Kako nastaneta akontacija in doplačilo, preberite pod [Pravila plačila](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Račune je mogoče prenesti kot PDF",
                "Korekcijski računi so pri spremembah kadar koli mogoči",
                "Dodatki se prikažejo kot lastna postavka",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Vračila",
          excerpt:
            "Tako v celoti ali delno vrnete plačilo, kadar je rezervacija odpovedana ali spremenjena.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Kdaj je vračilo potrebno" },
            {
              type: "p",
              text: "Vračilo je tipično potrebno ob odpovedi, lahko pa je potrebno tudi ob naknadni prilagoditvi cene ali odpovedanem dodatku.",
            },
            {
              type: "steps",
              items: [
                "Odprite zadevno rezervacijo v Rezervacijah.",
                "Izberite „Vračilo“ v razdelku plačil rezervacije.",
                "Vnesite znesek za vračilo — v celoti ali delno.",
                "Potrdite vračilo.",
              ],
            },
            { type: "h2", text: "Potek prek ponudnika plačil" },
            {
              type: "p",
              text: "Vračilo se izvede prek ponudnika, uporabljenega pri plačilu — Stripe ali PayPal — in se nakaže neposredno na prvotno plačilno sredstvo gosta. Postopek se samodejno zabeleži v časovnici rezervacije.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Brez povezanega ponudnika plačil vračila ni mogoče samodejno sprožiti — v tem primeru vračilo uredite neposredno z gostom.",
            },
            { type: "h2", text: "Vpliv na provizije" },
            {
              type: "p",
              text: "Že obračunane provizije tržnice ali portala se ob vračilu sorazmerno prilagodijo. Več o tem pod [Razumevanje provizij](/hilfe/zahlungen/provisionen-verstehen). Podrobnosti o sami odpovedi najdete pod [Odpoved in vračilo](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Delna vračila so mogoča za posamezne postavke",
                "Status obdelave je v rezervaciji kadar koli viden",
                "Vračila potekajo izključno prek prvotno uporabljenega ponudnika",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Izplačila",
          excerpt:
            "Tako od povezanih ponudnikov plačil prejmete izplačane prihodke svojih rezervacij.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Kako delujejo izplačila" },
            {
              type: "p",
              text: "Prejeta plačila se najprej zbirajo pri povezanem ponudniku plačil. Od tam poteka izplačilo na vaš nastavljen bančni račun po običajnem ritmu zadevnega ponudnika.",
            },
            {
              type: "steps",
              items: [
                "Odprite Konto in preklopite v razdelek „Plačila“.",
                "Pod „Izplačila“ preverite status zadevnega ponudnika.",
                "Po potrebi odprite podroben pogled ponudnika za popolno zgodovino izplačil.",
              ],
            },
            { type: "h2", text: "Kaj se odšteje pred izplačilom" },
            {
              type: "p",
              text: "Pred izplačilom se upoštevajo nastale provizije tržnice in portala ter pristojbine ponudnika. Izplačan znesek zato ne ustreza nujno prvotni vsoti rezervacije.",
            },
            {
              type: "note",
              variant: "info",
              text: "Natančno zgradbo odbitkov pojasnjuje [Razumevanje provizij](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Več objektov in lastnikov" },
            {
              type: "p",
              text: "Če upravljate objekte za različne lastnike, se izplačila dodelijo v skladu z nastavljenimi obračuni za lastnike. Ob neskladjih najprej preverite status osnovnih rezervacij v Rezervacijah.",
            },
            {
              type: "ul",
              items: [
                "Ritem in način izplačila določa zadevni ponudnik",
                "Zadržani zneski, na primer pri tekočih vračilih, so označeni",
                "Popolna zgodovina je na voljo za vpogled neposredno pri ponudniku",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Razumevanje provizij",
          excerpt:
            "Pregled, kako sestavljene so provizije tržnice in portala ter kje se obračunajo.",
          updated: "Posodobljeno: julij 2026",
          body: [
            { type: "h2", text: "Dve vrsti provizij" },
            {
              type: "p",
              text: "Pri rezervacijah prek myNextDays lahko nastaneta dve različni proviziji: provizija tržnice za rezervacije prek lastne platforme ter provizije portalov za rezervacije, ki prispejo prek povezanih portalov, kot sta Booking ali Airbnb. Obe sta neodvisni druga od druge in se lahko glede na prodajno pot rezervacije razlikujeta.",
            },
            {
              type: "ul",
              items: [
                "Provizija tržnice: nastane pri rezervacijah prek platforme myNextDays",
                "Provizija portala: izračuna jo zadevni portal po svojih lastnih pogojih",
                "Neposredne rezervacije prek vaše lastne spletne strani je treba obravnavati neodvisno od tega",
              ],
            },
            { type: "h2", text: "Kje so provizije vidne" },
            {
              type: "steps",
              items: [
                "Odprite Konto in preklopite v razdelek „Obračun“.",
                "Izberite želeni mesec.",
                "Preverite pregled po rezervaciji s pripadajočo provizijo.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Prek katerega kanala je rezervacija prispela, vidite neposredno pri sami rezervaciji — to pojasni, katera provizija je bila uporabljena.",
            },
            { type: "h2", text: "Povezava z izplačili" },
            {
              type: "p",
              text: "Provizije se pred izplačilom odštejejo od vsote rezervacije. Podrobnosti o postopku izplačila najdete pod [Izplačila](/hilfe/zahlungen/auszahlungen). Pri vračilu se pripadajoča provizija sorazmerno popravi — celoten potek rezervacije prikazuje [Časovnica rezervacije](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
