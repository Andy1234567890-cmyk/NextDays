import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Kalender ja saadavus",
  description: "Täituvusplaan, müügipeatus ja minimaalne peatumisaeg.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kalender",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Täituvusplaani lugemine",
          excerpt: "Kuidas lugeda täituvusplaanis õigesti broneeringuid, saadavust ja hindu.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Täituvusplaan näitab Teile ühe pilguga, millised ööd on broneeritud, saadaval või suletud. Puhkemajutuste puhul näete ühte rida objekti kohta, hotellide puhul kihilist vaadet, kus on rida iga toakategooria ja hinnaplaani kohta.",
            },
            { type: "h2", text: "Vaate ülesehitus" },
            {
              type: "steps",
              items: [
                "Avage kalender menüüpunktist „Täituvusplaan“.",
                "Valige ülal periood, mida soovite vaadata.",
                "Filtreerige vajadusel üksikute objektide või toakategooriate järgi.",
                "Klõpsake päeval, et avada hinna ja saadavuse detailid.",
                "Klõpsake broneeritud perioodil, et avada vastav broneering.",
              ],
            },
            { type: "h2", text: "Värvid ja sümbolid" },
            {
              type: "ul",
              items: [
                "Broneeritud: periood on broneeringuga reserveeritud.",
                "Saadaval: päev on broneeritav kõikidel aktiivsetel kanalitel.",
                "Suletud: päev ei ole broneeritav müügipeatuse või käsitsi blokeerimise tõttu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Iga rida täituvusplaanis kujutab täpselt ühte broneeritavat üksust — üht tuba või puhkemajutust. Ei ole olemas konteinerrida mitme toa jaoks korraga.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Rohkem üksikute päevade sihipärase avamise ja sulgemise kohta leiate artiklist [Saadavuse seadmine](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Saadavuse seadmine",
          excerpt: "Avage ja sulgege üksikuid päevi või perioode sihipäraselt.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Saadavus määrab, kas objekt on kindlal päeval broneeritav. Saate avada või sulgeda üksikuid päevi või terveid perioode otse täituvusplaanis.",
            },
            { type: "h2", text: "Perioodi muutmine" },
            {
              type: "steps",
              items: [
                "Avage soovitud objekti täituvusplaan.",
                "Märgistage soovitud periood klõpsates ja lohistades.",
                "Valige tegevusmenüüst „Muuda saadavust“.",
                "Kinnitage, kas periood tuleks avada või sulgeda.",
                "Salvestage muudatus.",
              ],
            },
            { type: "h2", text: "Mõju kanalitele" },
            {
              type: "p",
              text: "Saadavuse muutus mõjutab kõiki müügikanaleid, kus objekt on nähtav: portaale nagu Booking, Airbnb & Co., oma platvormi ning rakendust. Portaalidele edastamine toimub automaatselt taustal.",
            },
            {
              type: "ul",
              items: [
                "Avamine: päev muutub broneeritavaks kõikidel aktiivsetel kanalitel.",
                "Sulgemine: päev kaob broneeritavusest, kuid jääb kalendris nähtavaks.",
                "Olemasolevaid broneeringuid saadavuse muutus ei mõjuta.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ärge sulgege perioodi kavatsusega blokeerida see täielikult ja püsivalt müügist — selleks on õige funktsioon Müügipeatus, vt [Müügipeatus](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Müügipeatus",
          excerpt: "Müügipeatus blokeerib päeva kohe korraga kõikidel müügikanalitel.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Müügipeatus on kiireim viis võtta üksik päev täielikult müügist välja. Erinevalt lihtsast saadavuse muutmisest toimib müügipeatus kohe ja karmilt kõikidel kanalitel korraga — portaalidel, oma platvormil ja rakenduses.",
            },
            { type: "h2", text: "Müügipeatuse seadmine" },
            {
              type: "steps",
              items: [
                "Avage puudutatud objekti täituvusplaan.",
                "Valige soovitud päev või periood.",
                "Klõpsake tegevusmenüüs „Aktiveeri müügipeatus“.",
                "Kinnitage blokeerimine.",
              ],
            },
            { type: "h2", text: "Millal müügipeatus on mõistlik" },
            {
              type: "ul",
              items: [
                "Lühiajalised hooldustööd või tehnilised probleemid objektis.",
                "Erijuhtum, kus soovite kohe ja erandita mitte ühtegi uut broneeringut.",
                "Kiire, kogu platvormi hõlmav hädablokeering, ilma iga kanalit eraldi töötlemata.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Müügipeatusel ei ole kanalipõhist erandit: kui päev on suletud, ei saa ükski külaline broneerida ühegi kanali kaudu, ka mitte vastuvõtu ega otsepäringu kaudu.",
            },
            {
              type: "note",
              variant: "info",
              text: "Püsiva omakasutuse või planeeritud hoolduse jaoks sobib selle asemel [Käsitsi blokeerimine](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Minimaalne ja maksimaalne peatumisaeg",
          excerpt: "Kui kaua tohivad külalised minimaalselt või maksimaalselt broneerida.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Minimaalse ja maksimaalse peatumisajaga määrate, mitu ööd tohib külaline saabumispäeva jaoks minimaalselt või maksimaalselt broneerida. See aitab vältida lühikesi lünkbroneeringuid või positsioneerida Teie objekti sihipäraselt pikemate viibimiste jaoks.",
            },
            { type: "h2", text: "Reegli seadistamine" },
            {
              type: "steps",
              items: [
                "Avage objektis täituvusplaan või vahekaart „Hinnad“.",
                "Valige puudutatud periood.",
                "Sisestage „Minimaalne peatumisaeg“ all minimaalne ööde arv.",
                "Sisestage valikuliselt „Maksimaalne peatumisaeg“ all maksimaalne ööde arv.",
                "Salvestage reegel.",
              ],
            },
            { type: "h2", text: "Tüüpilised kasutusjuhud" },
            {
              type: "ul",
              items: [
                "Kõrghooaeg: kõrgem minimaalne peatumisaeg, et koondada vahetuspäevad.",
                "Madalhooaeg: madalam minimaalne peatumisaeg, et võimaldada rohkem broneeringuid.",
                "Maksimaalne peatumisaeg: mõistlik, kui objekt peab pärast seda olema vaba hoolduseks või muuks kasutuseks.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reegel kehtib saabumispäeva kohta: külaline ei saa saabuda kolme öö minimaalse peatumisajaga päeval ainult kaheks ööks, isegi kui üksikud päevad on saadaval.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombineerige pikemaid minimaalseid peatumisaegu funktsiooniga [Peatumisallahindlused](/hilfe/preise-raten/aufenthaltsrabatte), et suurendada külaliste jaoks stiimulit.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Käsitsi blokeerimine",
          excerpt: "Reserveerige perioode sihipäraselt omakasutuseks või hoolduseks.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Käsitsi blokeerimine reserveerib kalendris perioodi ilma tegeliku külalise broneeringuta — näiteks omakasutuseks, planeeritud hooldustöödeks või renoveerimiseks. Periood kuvatakse täituvusplaanis nagu broneering, kuid on selgelt äratuntav blokeeringuna.",
            },
            { type: "h2", text: "Blokeeringu loomine" },
            {
              type: "steps",
              items: [
                "Avage puudutatud objekti täituvusplaan.",
                "Märgistage soovitud periood.",
                "Valige tegevusmenüüst „Blokeeri käsitsi“.",
                "Sisestage põhjus, nt „Omakasutus“ või „Hooldus“.",
                "Salvestage blokeering.",
              ],
            },
            { type: "h2", text: "Erinevus müügipeatusest" },
            {
              type: "p",
              text: "Käsitsi blokeerimine reserveerib konkreetselt perioodi kindlaks, dokumenteeritud eesmärgiks ja selle saab hiljem uuesti vabastada. Kohese, kogu platvormi hõlmava hädablokeeringu jaoks ilma dokumenteeritud perioodita on aga mõeldud müügipeatus.",
            },
            {
              type: "ul",
              items: [
                "Käsitsi blokeerimine: planeeritud, põhjusega, omakasutuseks või hoolduseks.",
                "Vabastamine on igal ajal võimalik, kui periood pole enam vajalik.",
                "Blokeeritud ööd ei loeta külalise broneeringuks ega kuvata käibeülevaates.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Kustutage käsitsi blokeering niipea, kui põhjus kaob — vastasel juhul jääb objekt kõikidel kanalitel ilma vajaduseta suletuks.",
            },
            {
              type: "note",
              variant: "info",
              text: "Kohese blokeeringu jaoks ilma planeeritud perioodita kasutage [Müügipeatus](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
