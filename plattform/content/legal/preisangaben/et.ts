import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Hinnad, järjestus ja soovitused",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "Käesolev leht selgitab, kuidas myBestDays-is hindu kuvatakse, millest sõltub otsingutulemuste järjekord ja kuidas tekivad soovitused. See täidab läbipaistvuskohustused, mis tulenevad direktiivi 2005/29/EÜ artiklist 6a, määruse (EL) 2019/1150 artiklist 5 ja määruse (EL) 2022/2065 artiklist 27.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Kuidas hindu kuvatakse",
      paragraphs: [
        "Niipea kui periood ja reisijate arv on teada, kuvame kogumaksumuse kogu viibimise eest, sealhulgas maksud ja kõik Platvormi kaudu arvestatavad tasud.",
        "Kuni periood ei ole valitud, kuvame orientiiriks hinna öö kohta ja märgime selle sellisena.",
        "Kulud, mis tekivad alles kohapeal, toome enne broneeringu lõpetamist eraldi välja. Need ei ole kogumaksumuse osa, kuid on enne broneerimist nähtavad.",
        "Kui kuvame läbi kriipsutatud võrdlushinna, on see madalaim hind, mida pakkuja on sama teenuse eest küsinud viimase 30 päeva jooksul enne allahindlust (direktiivi 98/6/EÜ artikkel 6a).",
        "Hinnad on kõigile külalistele ühesugused. Me ei kohanda hinda Teie isiku, Teie seadme ega Teie senise otsingukäitumise järgi.",
      ],
    },
    {
      id: "ranking",
      heading: "2. Millest sõltub otsingutulemuste järjekord",
      paragraphs: [
        "Vaikimisi sortimises määravad järjekorra järgmised tunnused, tähtsuse kahanevas järjekorras:",
      ],
      list: [
        "vastavus Teie otsingule – saadavus otsitaval perioodil, mahutavus reisijate arvule, asukoht otsitavas piirkonnas ja seatud filtrid;",
        "kuulutuse täielikkus ja kvaliteet – kirjeldus, fotod, hooldatud sisustusandmed;",
        "arvustused – koondhinne ja arvustuste arv;",
        "pakkuja usaldusväärsus – vastamiskäitumine, nõustumismäär ja pakkuja tühistamised;",
        "hindade ja saadavuse ajakohasus;",
        "hinna ja kvaliteedi suhe võrreldes sarnaste kuulutustega samas piirkonnas.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Tasuline paigutus",
      paragraphs: [
        "Pakkuja ei saa endale vaikimisi sortimises paremat kohta osta. Teenustasu suurus järjekorda ei mõjuta.",
        "Kui pakuksime edaspidi tasulisi paigutusi, märgistame need üheselt reklaamina ja eraldame nähtavalt ülejäänud tulemustest.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Sortimise muutmine",
      paragraphs: [
        "Sortimist võite igal ajal muuta, näiteks hinna või arvustuse järgi. Milline sortimine on aktiivne, kuvatakse tulemuste loendi kohal.",
        "Teile on saadaval vähemalt üks sortimine, mis ei põhine profiilianalüüsil määruse (EL) 2016/679 artikli 4 punkti 4 tähenduses.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Soovitused",
      paragraphs: [
        "Kui kuvame Teile soovitusi („võiks Teile meeldida“, „sarnased majutuskohad“), põhinevad need praegusel otsingul, varem vaadatud kuulutustel ja sarnaste majutuskohtade tunnustel.",
        "Isikupärastatud soovitused saate oma kontol välja lülitada. Seejärel näete soovitusi, mis põhinevad üksnes praegusel otsingul.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Arvustused järjestuses",
      paragraphs: [
        "Kuidas arvustused tekivad ja kuidas neid kontrollitakse, on kirjas [Arvustuste poliitikas](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Arvustused mõjutavad järjekorda, kuid me ei kaalu üksikuid arvustusi kõrgemalt ega suru negatiivseid maha.",
      ],
    },
  ],
};
