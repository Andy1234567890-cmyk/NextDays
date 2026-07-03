import type { LegalDoc } from "../types";

// Slowenische Fassung der Gast-AGB. Quelle ist content/legal/agb/de.ts —
// Änderungen immer zuerst dort.
export const agb: LegalDoc = {
  title: "Pogoji uporabe za goste (Splošni pogoji)",
  stand: "Zadnja posodobitev: 3. julij 2026",
  intro: [
    "Ti pogoji uporabe urejajo uporabo rezervacijskega portala myNextDays (v nadaljevanju „Platforma“) s strani potnikov in oseb, ki opravijo rezervacijo (v nadaljevanju „Gost“).",
    "Upravljavec Platforme je [polna firma, pravna oblika, naslov in registrski podatki upravljavca — dopolniti pred objavo] (v nadaljevanju „myNextDays“ ali „mi“).",
  ],
  sections: [
    {
      heading: "§ 1 Področje uporabe",
      paragraphs: [
        "Ti pogoji veljajo za uporabo Platforme, zlasti za iskanje nastanitev in rezervacijo nastanitvenih storitev prek Platforme.",
        "Za samo nastanitveno storitev dodatno veljajo pogoji posameznega ponudnika (npr. hišni red, pogoji odpovedi), navedeni v ponudbi.",
      ],
    },
    {
      heading: "§ 2 Vloga myNextDays; sklenitev pogodbe",
      paragraphs: [
        "myNextDays posreduje nastanitvene storitve, ki jih ponujajo posamezni ponudniki (agencije, najemodajalci ali lastniki, v nadaljevanju „Ponudnik“). Pogodba o nastanitvi se sklene izključno med Gostom in posameznim Ponudnikom. myNextDays ne postane pogodbena stranka pogodbe o nastanitvi.",
        "Posamezni Ponudnik je naveden v ponudbi in v potrditvi rezervacije.",
      ],
    },
    {
      heading: "§ 3 Rezervacija in potrditev rezervacije",
      paragraphs: [
        "Predstavitev nastanitev na Platformi pomeni vabilo k oddaji ponudbe za rezervacijo. Z zaključkom postopka rezervacije (s klikom na rezervacijski gumb, ki zavezuje k plačilu) Gost odda zavezujočo ponudbo za sklenitev pogodbe o nastanitvi s Ponudnikom.",
        "Pogodba je sklenjena, ko je rezervacija potrjena. Potrditev rezervacije se Gostu pošlje na navedeni e-poštni naslov.",
        "Gost je dolžan pri rezervaciji navesti točne in popolne podatke (zlasti ime, kontaktne podatke in število potnikov).",
      ],
    },
    {
      heading: "§ 4 Cene in plačilo",
      paragraphs: [
        "Veljajo cene, navedene v ponudbi ob rezervaciji, vključno s tam navedenimi davki, pristojbinami in dodatnimi stroški. Cene so prikazane v valuti, navedeni v ponudbi. Na kraju samem lahko nastanejo dodatne lokalne dajatve (npr. turistična taksa), če je to navedeno v ponudbi.",
        "Plačilo se izvede prek ponudnika plačilnih storitev Stripe. Plačilne podatke (npr. podatke o kartici) zbira in obdeluje neposredno Stripe; myNextDays ne shranjuje popolnih podatkov o karticah. Stripe obdeluje osebne podatke v skladu s [politiko zasebnosti družbe Stripe](https://stripe.com/privacy).",
        "Če je v ponudbi navedena varščina, se ta lahko ob rezervaciji ali ob prihodu predavtorizira in v primeru škode v celoti ali delno zadrži; merodajne so navedbe v ponudbi.",
      ],
    },
    {
      heading: "§ 5 Odpoved, sprememba rezervacije in odstop od pogodbe",
      paragraphs: [
        "Ali in pod katerimi pogoji je mogoče rezervacijo brezplačno odpovedati ali spremeniti, določajo pogoji odpovedi Ponudnika, navedeni v ponudbi.",
        "Pri nastanitvenih storitvah, rezerviranih za določeno obdobje, v skladu s členom 16, točka (l), Direktive EU o pravicah potrošnikov oziroma ustreznimi nacionalnimi predpisi praviloma ne obstaja zakonska pravica do odstopa od pogodbe. Prisilne zakonske pravice Gosta ostajajo nespremenjene.",
      ],
    },
    {
      heading: "§ 6 Obveznosti Gosta",
      paragraphs: [
        "Gost uporablja nastanitev v skladu s pogodbo, upošteva največjo dovoljeno zasedenost, navedeno v ponudbi, in spoštuje hišni red Ponudnika.",
        "Platforme ni dovoljeno zlorabljati, zlasti ne za navidezne rezervacije, goljufiva plačila ali objavljanje nezakonitih vsebin (npr. v ocenah ali sporočilih).",
      ],
    },
    {
      heading: "§ 7 Odgovornost myNextDays",
      paragraphs: [
        "Za izvedbo nastanitvene storitve je odgovoren izključno Ponudnik. myNextDays ne odgovarja za točnost vsebin ponudb, ki jih objavijo Ponudniki, vendar posredovanje in obdelavo plačil opravlja s skrbnostjo dobrega gospodarstvenika.",
        "myNextDays odgovarja neomejeno za naklep in hudo malomarnost ter za škodo, nastalo zaradi posega v življenje, telo ali zdravje. Pri lahki malomarnosti myNextDays odgovarja le za kršitev bistvenih pogodbenih obveznosti (kardinalnih obveznosti), in sicer omejeno na predvidljivo škodo, tipično za to vrsto pogodbe. Prisilna zakonska pravila o odgovornosti ostajajo nespremenjena.",
      ],
    },
    {
      heading: "§ 8 Varstvo podatkov",
      paragraphs: [
        "myNextDays obdeluje osebne podatke Gosta za izvedbo posredovanja in rezervacije. Podatki o rezervaciji se posredujejo posameznemu Ponudniku, kolikor je to potrebno za izvedbo pogodbe o nastanitvi. Za obdelavo plačil velja § 4.",
        "Podrobnosti izhajajo iz informacij o varstvu podatkov na Platformi.",
      ],
    },
    {
      heading: "§ 9 Pritožbe in reševanje sporov",
      paragraphs: [
        "Reklamacije glede nastanitve Gost najprej naslovi na Ponudnika; pri vprašanjih glede rezervacije ali plačila pomaga podpora myNextDays prek kontaktnih poti, navedenih na Platformi.",
        "myNextDays ni zavezana niti pripravljena sodelovati v postopkih reševanja sporov pred izvajalcem izvensodnega reševanja potrošniških sporov, razen če obstaja zakonska obveznost.",
      ],
    },
    {
      heading: "§ 10 Spremembe teh pogojev",
      paragraphs: [
        "myNextDays lahko te pogoje spremeni z učinkom za naprej, če je to potrebno iz utemeljenih razlogov (zlasti zaradi sprememb zakonodaje ali sodne prakse) in Gost s tem ni nesorazmerno prikrajšan. Za že sklenjene rezervacije velja različica, veljavna ob rezervaciji.",
      ],
    },
    {
      heading: "§ 11 Končne določbe",
      paragraphs: [
        "Uporablja se pravo države, v kateri ima upravljavec sedež, z izključitvijo Konvencije ZN o pogodbah o mednarodni prodaji blaga. Če je Gost potrošnik, ostajajo prisilni predpisi o varstvu potrošnikov države, v kateri ima običajno prebivališče, nespremenjeni.",
        "Če bi bile ali postale posamezne določbe teh pogojev neveljavne, to ne vpliva na veljavnost preostalih določb.",
      ],
    },
  ],
};
