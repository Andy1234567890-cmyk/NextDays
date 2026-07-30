import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Hinnad ja hinnaplaanid",
  description: "Hinnaplaanid, hooajahinnad ja dünaamilised hinnad.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Hinnakujundus",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Põhihind ja valuuta",
          excerpt: "Kuidas määrata põhihind ja seada objektile õige valuuta.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Iga objekt myNextDays'is on täpselt üks broneeritav üksus — üks tuba või puhkemajutus. Selle üksuse jaoks sisestate põhihinna ning keskse valuuta, mis kehtib kogu objekti kohta.",
            },
            { type: "h2", text: "Valuuta tsentraalne määramine" },
            {
              type: "p",
              text: "Objekti valuuta määratakse üks kord objekti kohta ja kehtib automaatselt kõikidele hinnaplaanidele, mille selle objekti jaoks loote. Eraldi valuuta-varuväärtust ei ole — kui valuuta puudub, ei saa hindu salvestada.",
            },
            {
              type: "steps",
              items: [
                "Avage oma objekt „Objektid“ all.",
                "Liikuge vahekaardile „Hinnad“.",
                "Valige „Objekti valuuta“ all sobiv valuuta.",
                "Sisestage standardtäituvuse põhihind.",
                "Salvestage muudatused.",
              ],
            },
            { type: "h2", text: "Mis juhtub valuuta muutmisel" },
            {
              type: "p",
              text: "Kui muudate objekti valuutat hiljem, mõjutab see kõiki selle objekti olemasolevaid hinnaplaane, kuna need on alati väljendatud objekti valuutas. Kontrollige seejärel oma hindu, enne kui edastate need uuesti portaalidele.",
            },
            {
              type: "ul",
              items: [
                "Objektil on täpselt üks valuuta — mitte mitu hinnaplaani kohta.",
                "Põhihind on lähtepunkt tuletatud hindadele.",
                "Summad kuvatakse alati sisestatud objekti valuutas.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilma sisestatud valuutata ei saa ühtegi hinda salvestada ega hinnaplaani portaalidele edastada. Kontrollige seda esimesena, kui hinnamuudatus ebaõnnestub.",
            },
            {
              type: "note",
              variant: "info",
              text: "Rohkem tuletatud hindadest leiate artiklist [Tuletatud hinnaplaanid](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Hinnaplaanide loomine",
          excerpt: "Hinnaplaanid koondavad hinna, tühistamistingimused ja toitlustuse ühe objekti kohta.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Hinnaplaan määrab, millistel tingimustel objekti saab broneerida: hind, tühistamisreeglid, toitlustus ja minimaalne peatumisaeg. Üks objekt saab pakkuda mitut hinnaplaani korraga, näiteks paindliku ja tühistamatu plaani.",
            },
            { type: "h2", text: "Uue hinnaplaani loomine" },
            {
              type: "steps",
              items: [
                "Avage objekt ja liikuge vahekaardile „Hinnad“.",
                "Klõpsake „Loo uus hinnaplaan“.",
                "Andke plaanile kõnekas nimi, nt „Paindlik“ või „Tühistamatu“.",
                "Määrake, kas plaan on põhihind või tuletatud hind.",
                "Sisestage tühistamistingimused ja toitlustus.",
                "Salvestage ja aktiveerige hinnaplaan.",
              ],
            },
            { type: "h2", text: "Põhihind vs. täiendavad hinnaplaanid" },
            {
              type: "p",
              text: "Looge esmalt oma põhihind (tihti nimetatud „BAR“ehk Best Available Rate). Kõik täiendavad hinnaplaanid saab kas hallata iseseisvalt või tuletada sellest põhihinnast.",
            },
            {
              type: "ul",
              items: [
                "Põhihind: käsitsi hallatud baashind öö kohta.",
                "Täiendavad hinnaplaanid: iseseisvad või juurdehindlus/allahindlus põhihinnast.",
                "Iga hinnaplaani saab eraldi edastada portaalidele.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Hoidke hinnaplaanide arv objekti kohta ülevaatlikuna — liiga palju variante raskendab külalistel võrdlemist ja suurendab haldamiskoormust.",
            },
            {
              type: "note",
              variant: "info",
              text: "Üksikasjad juurdehindluste ja allahindluste kohta leiate artiklist [Tuletatud hinnaplaanid](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Tuletatud hinnaplaanid",
          excerpt: "Tuletatud hinnaplaanid arvutatakse automaatselt põhihinnast.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Tuletatud hind on hinnaplaan, mille hinda ei hallata käsitsi, vaid see arvutatakse automaatselt põhihinnast — fikseeritud juurdehindluse, allahindluse või protsendina. See säästab haldamiskoormust, kuna hinnamuudatus põhihinnas uuendab automaatselt kõiki tuletatud plaane.",
            },
            { type: "h2", text: "Tüüpiline näide" },
            {
              type: "p",
              text: "Levinud muster on hommikusöögiga plaan, mis tuletatakse toitlustuseta põhihinnast: hommikusöögi hind määratakse juurdehindlusena öö ja inimese kohta põhihinnale. Kui muudate põhihinda, kohandub hommikusöögi hind automaatselt.",
            },
            { type: "h2", text: "Tuletatud hinna seadistamine" },
            {
              type: "steps",
              items: [
                "Avage soovitud hinnaplaan vahekaardil „Hinnad“.",
                "Valige hinnaallikaks „Tuletatud allikast …“ ja vastav põhihind.",
                "Määrake, kas erinevus kehtib fikseeritud summana või protsendina.",
                "Määrake, kas tegemist on juurdehindluse või allahindlusega.",
                "Salvestage seos.",
              ],
            },
            {
              type: "ul",
              items: [
                "Juurdehindlus: nt toitlustus, hilisem tühistamisõigus.",
                "Allahindlus: nt tühistamatu plaan hinnaeelisega.",
                "Põhihind jääb ainsaks käsitsi hallatavaks allikaks.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Tuletatud hinda ei saa samaaegselt käsitsi üle kirjutada. Kui soovite üksikhinda erinevalt seada, lahutage kõigepealt tuletamise seos.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Hooaja- ja nädalavahetuse hinnad",
          excerpt: "Kohandage hindu hooajaperioodide ja nädalavahetuste jaoks sihipäraselt.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Nõudlus kõigub aasta jooksul ja nädala sees. Hooaja- ja nädalavahetuse hindadega kohandate põhihinda kindlate ajavahemike või nädalapäevade jaoks, ilma et peaksite iga päeva jaoks kalendrisse eraldi minema.",
            },
            { type: "h2", text: "Hooajaperioodi loomine" },
            {
              type: "steps",
              items: [
                "Avage objektis vahekaart „Hinnad“ ja jaotis „Hooajahinnad“.",
                "Looge uus periood alguse ja lõpu kuupäevaga.",
                "Sisestage selle perioodi hind või protsentuaalne kõrvalekalle põhihinnast.",
                "Salvestage hooajaperiood.",
              ],
            },
            { type: "h2", text: "Nädalavahetuse hinnad" },
            {
              type: "p",
              text: "Lisaks saate määrata üksikutele nädalapäevadele, näiteks reedele ja laupäevale, oma juurdehindluse. See juurdehindlus kehtib lisaks kehtivale hooaja- või põhihinnale.",
            },
            {
              type: "ul",
              items: [
                "Hooajahinnad kehtivad kokkukuuluvate ajaperioodide jaoks.",
                "Nädalavahetuse hinnad kehtivad nädalapäeva kaupa, sõltumata hooajast.",
                "Mõlemat reeglit saab kombineerida.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kui mitu hooajaperioodi kattuvad, kehtib viimasena loodud ehk kõige spetsiifilisem reegel. Kontrollige kalendrit pärast salvestamist.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Automaatsete, nõudlusel põhinevate kohanduste jaoks sobib lisaks [Dünaamilised hinnad](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Dünaamilised hinnad",
          excerpt: "Kohandage hindu automaatselt nõudluse, etteteatamisaja ja täituvuse järgi.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Dünaamilised hinnad kohandavad põhihinda automaatselt selliste tegurite alusel nagu broneeringu etteteatamisaeg, hetke täituvus ja nõudlus — sarnaselt sellele, kuidas suured portaalid teevad oma hinnasoovitusi. Nii reageerite turumuutustele ilma iga päev käsitsi kohandamata.",
            },
            { type: "h2", text: "Dünaamiliste hindade aktiveerimine" },
            {
              type: "steps",
              items: [
                "Avage objektis vahekaart „Hinnad“ ja jaotis „Dünaamilised hinnad“.",
                "Aktiveerige funktsioon objekti põhihinna jaoks.",
                "Määrake hinna alampiir ja ülempiir.",
                "Määrake, kui palju täituvus tohib hinda mõjutada.",
                "Salvestage seaded.",
              ],
            },
            { type: "h2", text: "Piirid ja turvalisus" },
            {
              type: "p",
              text: "Hinna alampiir ja ülempiir takistavad automaatsel algoritmil seada hindu, mis pole Teie ettevõtte jaoks talutavad. Tuletatud hinnaplaanid järgivad automaatselt dünaamiliselt arvutatud põhihinda.",
            },
            {
              type: "ul",
              items: [
                "Hinna alampiir kaitseb liiga madalate hindade eest nõrga nõudluse korral.",
                "Hinna ülempiir kaitseb ülepaisutatud hindade eest suure nõudluse korral.",
                "Tuletatud hinnad võtavad automaatselt üle uue põhihinna.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dünaamilised hinnad mõjutavad ainult põhihinda. Käsitsi fikseeritud hinnaplaanid ilma tuletamiseta ei muutu automaatselt kaasa.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Peatumisallahindlused",
          excerpt: "Seadistage allahindlused pikemate viibimiste ja varajaste broneeringute jaoks.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Peatumisallahindlused premeerivad külalisi pikemate broneeringute või varajase broneerimise eest. Neid rakendatakse protsendina viibimise kogusummast ja neid saab seadistada iga objekti jaoks eraldi.",
            },
            { type: "h2", text: "Allahindluse liigid" },
            {
              type: "ul",
              items: [
                "Pikaajaline allahindlus: alates teatud öödearvust, nt alates 7 või 28 ööst.",
                "Varajase broneerimise allahindlus: piisavalt ette broneerimise korral.",
                "Viimase hetke allahindlus: lühiajalise broneeringu korral saabumiskuupäevale lähedal.",
              ],
            },
            { type: "h2", text: "Allahindluse seadistamine" },
            {
              type: "steps",
              items: [
                "Avage objektis vahekaart „Hinnad“ ja jaotis „Allahindlused“.",
                "Valige soovitud allahindluse liik.",
                "Määrake lävi, nt minimaalne ööde arv või etteteatamisaeg.",
                "Sisestage allahindlus protsentides.",
                "Salvestage reegel.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Allahindlused kehtivad vastava hinnaplaani kogusummale ja neid kuvatakse külalisele juba hinnaülevaates.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombineerige pikaajalisi allahindlusi funktsiooniga [Minimaalne ja maksimaalne peatumisaeg](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt), et sihipäraselt soodustada pikemaid broneeringuid.",
            },
          ],
        },
      ],
    },
  ],
};
