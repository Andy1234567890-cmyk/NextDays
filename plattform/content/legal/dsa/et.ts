import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Digiteenuste õigusakt",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "myBestDays on vahendusteenus ja veebiplatvorm määruse (EL) 2022/2065 (digiteenuste ühtse turu kohta, digiteenuste õigusakt, DSA) tähenduses. Käesolev leht koondab andmed ja menetlused, mida see määrus nõuab.",
    "myBestDays ei ole väga suur veebiplatvorm määruse artikli 33 tähenduses. Sellest tulenevad täiendavad kohustused – süsteemsete riskide hindamine, sõltumatu audit, reklaamiarhiiv ja kuu keskmise kasutajate arvu avaldamine seal ette nähtud korras – meile seega ei kohaldu.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Kontaktpunktid (artiklid 11 ja 12)",
      paragraphs: [
        `Ühtne kontaktpunkt liikmesriikide ametiasutustele, komisjonile ja Euroopa digiteenuste nõukojale: ${ANBIETER.email}, posti teel ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Taani.`,
        `Ühtne kontaktpunkt kasutajatele: ${ANBIETER.email}. Sealt jõuate meieni vahetult ja ilma automatiseeritud vahesammuta.`,
        "Mõlema kontaktpunktiga saab suhelda saksa, taani ja inglise keeles.",
        "Liidus asuvat õigusesindajat artikli 13 kohaselt ei ole vaja määrata: käitaja on asutatud Taanis ja seega liidus.",
        `Pädev digiteenuste koordinaator artikli 49 kohaselt: ${DSA_KOORDINATOR.name}, Taani ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Õigusvastasest sisust teatamine (artikkel 16)",
      paragraphs: [
        "Igaüks võib meile teatada sisust, mida ta peab õigusvastaseks. Kasutage selleks teatamisfunktsiooni, mis on saadaval iga kuulutuse, iga arvustuse ja iga sõnumi juures, või kasutajate kontaktpunkti.",
        "Selleks et saaksime teadet hinnata ilma põhjaliku õigusliku analüüsita, peaks see sisaldama:",
      ],
      list: [
        "piisavalt põhjendatud selgitust, miks sisu on õigusvastane;",
        "täpset elektroonilist asukohta, eelkõige URL-aadressi;",
        "teataja nime ja e-posti aadressi – välja arvatud teated laste seksuaalse enesemääramise vastu suunatud kuritegude kohta, kus see märge on vabatahtlik;",
        "kinnitust, et andmed on parima teadmise kohaselt õiged ja täielikud.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Kuidas menetleme teateid",
      paragraphs: [
        "Kinnitame kättesaamist viivitamata ja otsustame õigeaegselt, hoolikalt, meelevaldsuseta ja objektiivselt.",
        "Kui teade sisaldab punktis 2 nimetatud andmeid, tekitab see meie teadmise määruse artikli 6 tähenduses.",
        "Oma otsusest teavitame teatajat ja juhime tähelepanu õiguskaitsevahenditele.",
        "Automatiseeritud menetlemise korral teatame sellest.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Meetmete põhjendamine (artikkel 17)",
      paragraphs: [
        "Kui piirame sisu nähtavust, eemaldame selle, blokeerime sellele juurdepääsu, peatame maksed, teenuse osutamise või konto, saab asjaomane isik selge ja konkreetse põhjenduse.",
        "Põhjenduses on nimetatud meetme laad ja ulatus, selle territoriaalne ja ajaline kehtivus, otsuse aluseks olevad faktid ja asjaolud, kas osales automatiseeritud töötlus, õiguslik alus või rikutud lepingutingimus ning kättesaadavad õiguskaitsevahendid.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Kuriteokahtlus (artikkel 18)",
      paragraphs: [
        "Kui on viiteid kuriteole, mis kujutab ohtu isiku elule või turvalisusele, teavitame viivitamata pädevaid õiguskaitse- või õigusasutusi.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Sisemine kaebemenetlus (artikkel 20)",
      paragraphs: [
        "Iga punktis 4 nimetatud meetme ja teate tagasilükkamise peale saab kuue kuu jooksul esitada tasuta kaebuse.",
        "Kaebusi menetleme õigeaegselt, mittediskrimineerivalt ja hoolikalt – kvalifitseeritud isikute järelevalve all ja mitte üksnes automatiseeritud vahenditega.",
        "Kui kaebus osutub põhjendatuks, võtame meetme tagasi. Teed kirjeldab jaotis [Kaebused ja vaidluste lahendamine](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Kohtuväline vaidluste lahendamine (artikkel 21)",
      paragraphs: [
        "Punktis 4 nimetatud meetmeid puudutavates vaidlustes võivad kasutajad pöörduda pädeva digiteenuste koordinaatori sertifitseeritud kohtuvälise vaidluste lahendamise organi poole. Sertifitseeritud organite nimekirja peab Euroopa Komisjon.",
        "Nende organite otsused ei ole meile siduvad; sõltumatute pakkujate menetlustes osalema me kohustatud ei ole. Tee kohtutesse jääb puutumata.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Usaldusväärsed teavitajad (artikkel 22)",
      paragraphs: [
        "Teateid, mille esitab oma pädevusvaldkonnas usaldusväärseks teavitajaks tunnistatud üksus, menetleme eelisjärjekorras.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Meetmed kuritarvitamise vastu (artikkel 23)",
      paragraphs: [
        "Kontod, mille kaudu esitatakse sageli ilmselgelt õigusvastast sisu, blokeerime pärast eelnevat hoiatust mõistlikuks ajaks.",
        "Teadete ja kaebuste menetlemise peatame isikute suhtes, kes esitavad sageli ilmselgelt põhjendamatuid teateid või kaebusi – samuti pärast eelnevat hoiatust.",
        "Hindame seejuures alati üksikjuhtumit: asjaomaste toimingute arvu, osakaalu ja raskust ning kavatsust.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Läbipaistvusaruanded (artiklid 15 ja 24)",
      paragraphs: [
        "Avaldame igal aastal aruande sisu modereerimise kohta: ametiasutuste korralduste arv, teadete arv ja liik, võetud meetmed, kaebuste arv ja nende tulemus, andmed automatiseeritud menetluste kasutamise kohta ning vaidluste arv kohtuvälistes organites.",
        `Mikro- ja väikeettevõtjad on määruse artikli 19 kohaselt osast nendest kohustustest vabastatud. Kuni vabastus kehtib, esitame andmed taotluse korral aadressil ${ANBIETER.email}; niipea kui esimene aruanne on avaldatud, lisatakse siia link.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Kauplejate jälgitavus (artiklid 30–32)",
      paragraphs: [
        "Pakkujad, kes tegutsevad Platvormil ärilistel eesmärkidel, tohivad pakkuda alles pärast seda, kui on meile edastanud nime, aadressi, telefoninumbri, e-posti aadressi, registriandmed, käibemaksukohustuslasena registreerimise numbri ja maksekonto ning nende andmed on usutavad.",
        "Neid andmeid kuvame kuulutuses niivõrd, kuivõrd määrus seda ette näeb.",
        "Kui saame teada, et kuulutus puudutas õigusvastast toodet või õigusvastast teenust, teavitame asjaomaseid külalisi, kui meil on nende kontaktandmed.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Soovitussüsteemid (artikkel 27)",
      paragraphs: [
        "Otsingutulemuste järjekorra ja soovituste peamised parameetrid ning võimalus neid mõjutada on kirjeldatud jaotises [Hinnad, järjestus ja soovitused](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Reklaam (artikkel 26)",
      paragraphs: [
        "Praegu ei kuva me kolmandate isikute tasulist reklaami ega tasulisi paigutusi otsingutulemustes.",
        "Kui võtame reklaami kasutusele, märgistame selle selgelt, nimetame reklaamija ja peamised näitamise parameetrid. Reklaami, mis põhineb määruse (EL) 2016/679 artiklis 9 nimetatud isikuandmete eriliikidel, ja alaealistele suunatud profiilianalüüsil põhinevat reklaami me välistame.",
      ],
    },
  ],
};
