import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Ülesanded ja koristus",
  description: "Koristuskavade ja meeskonna ülesannete korraldamine.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Ettevõte",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Ülesannete loomine",
          excerpt: "Kuidas luua uus ülesanne objekti või perioodi jaoks.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Ülesanded koondavad kõik, mida objekti ümber tuleb teha — koristusest pärast väljaregistreerimist kuni hooldustööde või külaliste päringuteni. Iga ülesanne on seotud täpselt ühe objektiga ja selle saab määrata meeskonnaliikmele.",
            },
            { type: "h2", text: "Uue ülesande loomine" },
            {
              type: "steps",
              items: [
                "Avage peamenüüst jaotis „Ülesanded“.",
                "Klõpsake „Uus ülesanne“.",
                "Valige puudutatud objekt.",
                "Andke pealkiri ja valikuliselt kirjeldus.",
                "Määrake tähtaeg ja kellaaeg.",
                "Salvestage ülesanne.",
              ],
            },
            { type: "h2", text: "Ülesannete liigid" },
            {
              type: "p",
              text: "Lisaks vabalt loodud ülesannetele on olemas süsteemi genereeritud ülesanded, näiteks automaatselt planeeritud koristused pärast väljaregistreerimist. Need on juba seotud objekti ja sobiva ajaaknaga ning tuleb ainult meeskonnaliikmele määrata.",
            },
            {
              type: "ul",
              items: [
                "Käsitsi ülesanne: vabalt sisestatud, nt hooldus või erisoov.",
                "Automaatne koristusülesanne: tuletatud väljaregistreerimise kuupäevast.",
                "Korduv ülesanne: regulaarsete kontrollide või ülevaatuste jaoks.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Üksikasjad automaatse ajaplaneerimise kohta leiate artiklist [Koristuskavad](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Andke täpsed pealkirjad — meeskonnaliikmed näevad mobiilivaates sageli ühe pilguga ainult pealkirja ja objekti.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Koristuskavad",
          excerpt: "Laske koristused pärast väljaregistreerimist automaatselt planeerida.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Koristuskava tagab, et pärast iga väljaregistreerimist tekib automaatselt puudutatud objekti koristusülesanne — ilma et Te peaksite iga broneeringut eraldi jälgima. See vähendab unustatud üleandmisi ja tagab usaldusväärse käigu kahe viibimise vahel.",
            },
            { type: "h2", text: "Automaatse planeerimise aktiveerimine" },
            {
              type: "steps",
              items: [
                "Avage objekt ja liikuge vahekaardile „Koristus“.",
                "Aktiveerige „Planeeri koristus automaatselt pärast väljaregistreerimist“.",
                "Määrake, kui palju aega pärast väljaregistreerimist koristuseks planeeritakse.",
                "Määrake valikuliselt standardmeeskond või standardkoristaja.",
                "Salvestage seade.",
              ],
            },
            { type: "h2", text: "Koostoime kalendriga" },
            {
              type: "p",
              text: "Niipea kui broneering tühistatakse või lükatakse edasi, kohandub vastav koristusülesanne automaatselt uue väljaregistreerimise kuupäevaga. Nii jääb koristuskava alati tegeliku täituvusega sünkroonis.",
            },
            {
              type: "ul",
              items: [
                "Koristus tekib automaatselt iga väljaregistreerimise korral, kui kava on aktiivne.",
                "Kui broneering nihkub, nihkub koristusülesanne kaasa.",
                "Kui külaline tühistab viibimise, eemaldatakse koristusülesanne.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilma aktiveeritud koristuskavata automaatseid ülesandeid ei teki — looge koristused sel juhul käsitsi artiklis [Ülesannete loomine](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Ülesannete määramine",
          excerpt: "Määrake ülesanded sihipäraselt koristajatele või meeskonnaliikmetele.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Selleks et ülesanne saaks täidetud, määrate selle konkreetsele meeskonnaliikmele — näiteks koristajale või hoolduse eest vastutavale töötajale. Vaikimisi näeb ülesannet oma ülevaates ainult määratud isik.",
            },
            { type: "h2", text: "Ülesande käsitsi määramine" },
            {
              type: "steps",
              items: [
                "Avage ülesanne nimekirjas „Ülesanded“.",
                "Klõpsake „Määra“.",
                "Valige nimekirjast vastutav meeskonnaliige.",
                "Kinnitage määramine.",
              ],
            },
            { type: "h2", text: "Määramine objekti järgi" },
            {
              type: "p",
              text: "Kui koristajale on juba objekt püsivalt seostatud, saate lasta selle objekti ülesanded automaatselt sellele isikule määrata. See säästab korduvate koristuste puhul klõpse ja vähendab tagasiküsimisi.",
            },
            {
              type: "ul",
              items: [
                "Käsitsi määramine: valite isiku igal ülesandel ise.",
                "Püsiv objekti seos: selle objekti uued ülesanded lähevad automaatselt sisestatud isikule.",
                "Ülesandel on alati täpselt üks vastutav isik.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Koristajad ja töötajad näevad ainult oma määratud ülesandeid, mitte objekti finants- ega müügiandmeid.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Ülesande oleku jälgimine",
          excerpt: "Jälgige ülesannete töötlemise seisu reaalajas.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Iga ülesanne läbib selge oleku — avatud, töös, lõpetatud. Nii näete alati, kas koristus või hooldus saab järgmise sisseregistreerimise eel õigeaegselt valmis.",
            },
            { type: "h2", text: "Olekute ülevaade" },
            {
              type: "ul",
              items: [
                "Avatud: ülesanne on loodud, kuid veel alustamata.",
                "Töös: määratud isik on ülesande alustanud.",
                "Lõpetatud: ülesanne on tehtud ja kinnitatud.",
              ],
            },
            { type: "h2", text: "Oleku uuendamine" },
            {
              type: "steps",
              items: [
                "Avage ülesanne nimekirjast „Ülesanded“.",
                "Valige sobiv olek, nt „Töös“ või „Lõpetatud“.",
                "Lisage vajadusel lühike märkus, näiteks objektis märgatud eripärade kohta.",
                "Salvestage muudatus.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Oleku muudatused ilmuvad kohe jagatud ülesannete nimekirjas — käsitsi uuesti laadimine ei ole vajalik.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Kui koristus on vahetult enne järgmist sisseregistreerimist veel avatud, kontrollige esmalt määramist, enne kui võtate ühendust külalisega.",
            },
          ],
        },
      ],
    },
  ],
};
