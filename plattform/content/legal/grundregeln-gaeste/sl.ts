import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Osnovna pravila za goste",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Ta osnovna pravila veljajo za vsako bivanje, rezervirano prek myBestDays. Dopolnjujejo hišni red posameznega ponudnika — ob strožjem hišnem redu ta velja dodatno.",
    "Kdor krši osnovna pravila, mora računati z ukrepi do blokade računa in ponudniku odgovarja za nastalo škodo.",
  ],
  sections: [
    {
      id: "belegung",
      heading: "1. Zasedenost",
      paragraphs: [
        "V nastanitvi prenočijo le osebe, ki so bile navedene ob rezervaciji, in največ toliko, kot dopušča najvišja zasedenost.",
        "Obisk brez prenočitve je dopusten, kolikor hišni red ne določa drugače.",
        "Nastanitve ni dovoljeno oddajati v podnajem ali jo prepustiti drugim.",
      ],
    },
    {
      id: "ruhe",
      heading: "2. Obzirnost in čas počitka",
      paragraphs: [
        "Bodite obzirni do sosedov. Upoštevajte čase počitka, navedene v hišnem redu; če navedbe ni, velja krajevno običajni nočni mir.",
        "Zabave in prireditve brez izrecnega dovoljenja ponudnika niso dovoljene. To velja tudi, če je najvišja zasedenost upoštevana.",
        "Poslovna uporaba nastanitve — na primer fotografske ali filmske produkcije, prodajne prireditve — zahteva predhodno soglasje ponudnika.",
      ],
    },
    {
      id: "umgang",
      heading: "3. Ravnanje z nastanitvijo",
      paragraphs: [
        "Z nastanitvijo in njeno opremo ravnajte skrbno in jo zapustite v urejenem stanju.",
        "Škodo in okvare ponudniku javite nemudoma — ne šele po odhodu. Le tako jih lahko odpravi in vi ohranite svoje zahtevke.",
        "Odgovarjate za škodo, ki jo povzročite vi ali vaši sopotniki. Če je dogovorjena varščina, jo je za to mogoče uporabiti.",
      ],
    },
    {
      id: "sicherheit",
      heading: "4. Varnost",
      paragraphs: [
        "Javljalnike dima, gasilnike in evakuacijske poti ohranjajte proste in delujoče. Javljalnikov dima ni dovoljeno prelepiti ali odstraniti.",
        "Kajenje je dovoljeno le, če hišni red to izrecno dopušča, in le na za to določenih mestih.",
        "Pri bazenu, savni, kaminu, žaru ali masažni kadi sledite navodilom ponudnika. Otroci smejo takšne naprave uporabljati le pod nadzorom.",
      ],
    },
    {
      id: "tiere",
      heading: "5. Živali",
      paragraphs: [
        "Živali smete pripeljati le, če oglas to dopušča in ste jih navedli ob rezervaciji.",
        "Službeni in vodniški psi so vedno dovoljeni, tudi če oglas živali izključuje. Prosimo, napovejte jih vnaprej, da bo ponudnik pripravljen.",
      ],
    },
    {
      id: "anreise",
      heading: "6. Prihod in odhod",
      paragraphs: [
        "Upoštevajte čase prihoda in odhoda, navedene v oglasu. Če potrebujete drugačne čase, jih vnaprej uskladite s ponudnikom.",
        "Podatke, ki jih ponudnik potrebuje za prijavo (prijavnica, podatki iz osebnega dokumenta, turistična taksa), zagotovite pravočasno.",
        "Dostopnih podatkov, kod ključavnic in ključev ne posredujte tretjim osebam.",
      ],
    },
    {
      id: "kommunikation",
      heading: "7. Komunikacija",
      paragraphs: [
        "Rezervacijo, plačilo in dogovore izvedite prek Platforme. Le tako so dokumentirani in ob sporu lahko pomagamo.",
        "Do ponudnika in naše ekipe ostanite stvarni. Žalitve in grožnje neposredno vodijo do ukrepov zoper račun.",
      ],
    },
  ],
};
