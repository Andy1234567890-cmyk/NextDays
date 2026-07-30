import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Maksed",
  description: "Töödelge makseid korrektselt.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Maksed",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Ettemaksu seadistamine",
          excerpt: "Kuidas nõuda broneeringul ainult osasummat kogu summa asemel.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord",
            },
            {
              type: "p",
              text: "Selle asemel, et koguda kohe kogu broneeringu summa, saate määrata ettemaksu maksereeglina. Külaline maksab broneerimisel ainult osasumma Stripe või PayPal kaudu, ülejäänu hiljem lõppmakse kaudu.",
            },
            {
              type: "steps",
              items: [
                "Avage objektis jaotis „Maksereeglid“.",
                "Looge uus reegel tüübiga „Ettemaks“.",
                "Määrake ettemaksu summa protsendina või fikseeritud summana kogusummast.",
                "Määrake, millal ettemaks muutub tähtaegseks, tavaliselt kohe broneeringu ajal.",
                "Salvestage reegel ja kontrollige seda testbroneeringul.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ettemaks töödeldakse objekti jaoks sisestatud makseteenuse pakkuja kaudu. Sobiva lõppsumma seadistate artiklis [Lõppmakse automatiseerimine](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Lõppmakse automatiseerimine",
          excerpt: "Kuidas avatud lõppsumma automaatselt enne saabumist sisse nõutakse.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord",
            },
            {
              type: "p",
              text: "Pärast ettemaksu jääb avatuks lõppsumma. Selle käsitsi jälgimise asemel seadistate maksereegli, mis kogub lõppmakse automaatselt kindlaksmääratud ajahetkel enne saabumist Stripe või PayPal kaudu.",
            },
            {
              type: "steps",
              items: [
                "Avage objektis jaotis „Maksereeglid“.",
                "Looge uus reegel tüübiga „Lõppmakse“, eeldusel et ettemaksureegel juba eksisteerib.",
                "Määrake, mitu päeva enne saabumist lõppmakse muutub tähtaegseks.",
                "Aktiveerige automaatne sissenõudmine, et sisestatud makseteenuse pakkuja debiteeriks summa iseseisvalt.",
                "Kontrollige seejärel lõppmakse olekut vastava reserveeringu broneeringu ajajoonel.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Kui automaatne sissenõudmine ebaõnnestub, näiteks aegunud kaardi tõttu, ei tühistata broneeringut automaatselt. Kontrollige ebaõnnestunud lõppmakseid kiiresti ja võtke otse ühendust külalisega.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Tagasimakse tegemine",
          excerpt: "Kuidas maksta külalisele summa tervikuna või osaliselt tagasi.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord",
            },
            {
              type: "p",
              text: "Tühistamise või kaebuse korral saate külalisele makstud summa tervikuna või osaliselt tagasi maksta. Tagasimakse toimub sama makseteenuse pakkuja kaudu, mille kaudu algselt maksti — Stripe või PayPal.",
            },
            {
              type: "steps",
              items: [
                "Avage puudutatud broneering broneeringu ajajoonel.",
                "Valige jaotises „Maksed“ algne makse, mis tuleb tagastada.",
                "Valige täieliku või osalise tagasimakse vahel.",
                "Sisestage osalise tagasimakse korral soovitud summa.",
                "Kinnitage tagasimakse ja kontrollige uuendatud makseolekut ajajoonel.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Tagasimakse ei muuda automaatselt broneeringu olekut ega hõivatud kalendriöid. Kontrollige tühistamise korral lisaks, kas puudutatud ööd tuleb täituvusplaanis uuesti vabastada.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Tagatisraha haldamine",
          excerpt: "Kuidas seadistada tagatisraha ja see pärast viibimist uuesti vabastada.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord",
            },
            {
              type: "p",
              text: "Tagatisraha kaitseb Teid viibimise ajal tekkinud kahjude eest. See sisestatakse oma maksereeglina ja kas autoriseeritakse ette või kogutakse Stripe või PayPal kaudu, olenevalt objekti konfiguratsioonist.",
            },
            {
              type: "steps",
              items: [
                "Avage objektis jaotis „Maksereeglid“ ja looge reegel tüübiga „Tagatisraha“.",
                "Määrake tagatisraha summa ja autoriseerimise ajahetk, tavaliselt vahetult enne saabumist.",
                "Kontrollige pärast väljaregistreerimist objekti seisukorda.",
                "Vabastage tagatisraha täielikult broneeringu kaudu, kui seisukord on laitmatu.",
                "Kahju korral tagastage ainult mittevajalik osa ja dokumenteerige kinnipidamise põhjus.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Autoriseeritud, kuid kogumata tagatisraha aegub olenevalt makseteenuse pakkujast automaatselt kindla tähtaja järel. Vabastage tagatisraha kiiresti pärast väljaregistreerimist või koguge vajalik summa õigeaegselt.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Arve korrigeerimine",
          excerpt: "Kuidas korrigeerida juba väljastatud arvet hiljem.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord",
            },
            {
              type: "p",
              text: "Kui juba väljastatud arves on viga, näiteks arve aadressis või kirjes, korrigeerige seda broneeringu kaudu, selle asemel et algne arve lihtsalt kustutada.",
            },
            {
              type: "steps",
              items: [
                "Avage puudutatud broneering broneeringu ajajoonel ja liikuge jaotisse „Arved“.",
                "Valige vigane arve.",
                "Koostage algsele arvele korrigeeriv ehk kreeditarve.",
                "Looge seejärel uus, korrigeeritud arve õigete andmetega.",
                "Saatke korrigeeritud arve uuesti külalisele või arve aadressile.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Juba saadetud arvet ei tohiks jälgitavuse huvides otse üle kirjutada. Korrigeerimine kreeditarve kaudu säilitab algse dokumendi ja muudab muudatuse jälgitavaks.",
            },
          ],
        },
      ],
    },
  ],
};
