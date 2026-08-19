import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Konto ja tellimus",
  description: "Põhiandmed, tariif, turvalisus ja 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Konto",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Ettevõtte põhiandmed",
          excerpt: "Hallake tsentraalselt oma ettevõtte nime, aadressi ja kontaktandmeid.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "/konto all koondab myNextDays kõik ettevõtte ja konto funktsioonid jaotistena ühele lehele — Te ei pea liikuma paljude alamlehtede vahel. Ettevõtte põhiandmed moodustavad aluse: ettevõtte nimi, õiguslik vorm, aadress ja kontaktandmed, mida kasutatakse arvete, portaalide ja külalistega suhtlemise jaoks.",
            },
            { type: "h2", text: "Põhiandmete avamine ja muutmine" },
            {
              type: "steps",
              items: [
                "Avage /konto.",
                "Liikuge jaotisse „Ettevõtte põhiandmed“.",
                "Kontrollige ettevõtte nime, aadressi, telefoninumbrit ja e-posti aadressi tagasiküsimuste jaoks.",
                "Tehke oma muudatused.",
                "Salvestage jaotis.",
              ],
            },
            { type: "h2", text: "Miks need andmed on olulised" },
            {
              type: "p",
              text: "Ettevõtte põhiandmed lähevad arvetesse, ühendatud portaalide registreerimisse ja õiguslikult kohustuslikesse andmetesse, nagu impressum. Puudulik või vananenud aadress võib põhjustada valesid arveid või ühenduste viivitusi portaalidega.",
            },
            {
              type: "ul",
              items: [
                "Ettevõtte nimi ja õiguslik vorm kuvatakse kõikidel väljastatud arvetel.",
                "Aadress on vajalik portaalide juures registreerimiseks.",
                "Kontaktandmed toimivad tagavaraviisina, kui süsteemi teavitused ei jõua kohale.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kui muudate oma arve aadressi, kontrollige seejärel juba väljastatud arveid artiklis [Arveldamine ja tariifikalkulaator](/hilfe/konto-abo/abrechnung-tarifrechner) — olemasolevaid dokumente tagasiulatuvalt ei kohandata.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Tellimus ja tariif",
          excerpt: "Teie tariif määrab objektide kvoodi — broneeritud objektide arvu näete alati konto all.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Teie myNextDays tellimus sisaldab objektide kvooti: maksimaalset arvu objekte (toad või puhkemajutused), mida saate korraga aktiivselt hallata. Praegu broneeritud objektide arv kuvatakse jaotises „Tellimus ja tariif“ /konto all, koos alles jäänud kvoodiga.",
            },
            { type: "h2", text: "Kvoodi silmas pidamine" },
            {
              type: "p",
              text: "Kvoot jõustatakse serveripoolselt: kui jõuate oma tariifi ülempiirini, ei saa uut objekti luua enne, kui deaktiveerite olemasoleva objekti või laiendate oma tariifi. See kehtib sõltumata sellest, kas uus objekt on tuba või puhkemajutus — mõlemad loetakse kvoodis võrdselt.",
            },
            {
              type: "steps",
              items: [
                "Avage /konto ja jaotis „Tellimus ja tariif“.",
                "Kontrollige broneeritud objektide arvu suhestatuna Teie tariifi kvoodiga.",
                "Valige vajadusel suurem tariif, et luua rohkem objekte.",
                "Kinnitage tariifi vahetus.",
              ],
            },
            {
              type: "ul",
              items: [
                "Iga objekt loetakse kvoodis eraldi, sõltumata objekti tüübist.",
                "Tariifi vahetus mõjutab kohe saadaolevat kvooti.",
                "Madalamale tariifile üleminek on võimalik ainult siis, kui aktiivsete objektide arv sobib uue kvoodiga.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Madalamale tariifile üleminek väiksema kvoodiga lükatakse tagasi, kuni rohkem objekte on aktiivsed, kui uus tariif lubab. Deaktiveerige esmalt ülemäärased objektid.",
            },
            {
              type: "note",
              variant: "info",
              text: "Üksikasjad arvete ja tariifi arvutamise kohta leiate artiklist [Arveldamine ja tariifikalkulaator](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Arveldamine ja tariifikalkulaator",
          excerpt: "Arve aadress, varasemad arved ja tariifikalkulaator Teie objektide kvoodi jaoks.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Jaotis „Arveldamine ja tariifikalkulaator“ /konto all koondab kõik arvete koostamisega seotu: Teie arve aadressi, varasemate arvete nimekirja allalaadimiseks ning tariifikalkulaatori, millega saate arvutada Teie praeguse või suurema objektide kvoodi kulud.",
            },
            { type: "h2", text: "Arve aadress ja arved" },
            {
              type: "p",
              text: "Arve aadress võib erineda Teie ettevõtte aadressist, näiteks kui dokumendid saadetakse maksukonsultatsiooniettevõttele. Juba väljastatud arved leiate kronoloogiliselt sorteerituna; iga arve saab alla laadida PDF-ina.",
            },
            { type: "h2", text: "Tariifikalkulaatori kasutamine" },
            {
              type: "steps",
              items: [
                "Avage /konto ja jaotis „Arveldamine ja tariifikalkulaator“.",
                "Sisestage tariifikalkulaatoris soovitud objektide arv.",
                "Võrrelge tulemuseks olevaid kulusid tariifiastmete kaupa.",
                "Vajadusel vahetage kalkulaatorist otse sobivale tariifile.",
              ],
            },
            {
              type: "ul",
              items: [
                "Tariifikalkulaator näitab kulusid Teie konto jaoks sisestatud valuutas.",
                "Arved on püsivalt allalaadimiseks saadaval.",
                "Arve aadressi saab hallata sõltumatult ettevõtte põhiandmetest.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Võrrelge tariifikalkulaatoriga regulaarselt, kas Teie objektide kvoot sobib veel tegelikult broneeritud objektide arvuga — vt [Tellimus ja tariif](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Parooli ja e-posti muutmine",
          excerpt: "Turvakriitilised muudatused nõuavad uut autentimist ja kinnitussammu.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Parool ja e-posti aadress kuuluvad Teie konto kõige turvakriitilisemate andmete hulka. myNextDays nõuab seetõttu mõlema muutmisel uut autentimist — kinnitate muudatuse oma praeguse parooliga, isegi kui olete juba sisse logitud.",
            },
            { type: "h2", text: "Parooli muutmine" },
            {
              type: "steps",
              items: [
                "Avage /konto ja jaotis „Parooli ja e-posti muutmine“.",
                "Sisestage kinnitamiseks oma praegune parool.",
                "Määrake uus parool ja korrake seda.",
                "Salvestage muudatus.",
              ],
            },
            { type: "h2", text: "E-posti aadressi muutmine" },
            {
              type: "p",
              text: "E-posti aadressi vahetus toimub topelt-nõusolekuna: pärast praeguse parooli kinnitamist saate kinnituslingi UUELE aadressile. Alles selle lingi peale klõpsates jõustub muudatus — vana aadress jääb kuni selle ajani aktiivseks, et juurdepääs Teie kontole kunagi katkema ei läheks.",
            },
            {
              type: "ul",
              items: [
                "Ilma praeguse paroolita ei saa ei parooli ega e-posti muuta.",
                "Uue e-posti aadressi kinnituslink kehtib piiratud aja.",
                "Kuni kinnitamiseni jääb senine e-posti aadress sisselogimiseks ja teavitusteks aktiivseks.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Kontrollige pärast e-posti muutmist ka kaheastmelist autentimist — vt [Kaheastmeline autentimine](/hilfe/konto-abo/zwei-faktor) — juhul kui taastekoodid olid seotud vana aadressiga.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Kaheastmeline autentimine",
          excerpt: "Täiendav sisselogimissamm kaitseb Teie kontot volitamata juurdepääsu eest.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Kaheastmeline autentimine (2FA) täiendab Teie parooli teise teguriga autentimisrakenduse kaudu. Nii ei piisa varastatud paroolist enam üksi, et myNextDays kontosse sisse logida.",
            },
            { type: "h2", text: "2FA seadistamine" },
            {
              type: "steps",
              items: [
                "Avage /konto ja jaotis „Kaheastmeline autentimine“.",
                "Kinnitage oma praegune parool uue autentimise jaoks.",
                "Skaneerige kuvatud QR-kood autentimisrakendusega.",
                "Sisestage genereeritud kood kinnitamiseks.",
                "Salvestage kuvatud taastekoodid turvalisse kohta.",
              ],
            },
            { type: "h2", text: "2FA deaktiveerimine" },
            {
              type: "p",
              text: "Ka kaheastmelise autentimise deaktiveerimine nõuab uut autentimist Teie praeguse parooliga. Nii takistab myNextDays, et keegi juba avatud seansiga saaks Teie kaitse lihtsalt välja lülitada.",
            },
            {
              type: "ul",
              items: [
                "Taastekoodid võimaldavad juurdepääsu, kui autentimisrakendus läheb kaduma.",
                "Iga taastekood on kasutatav ainult üks kord.",
                "2FA sisse- ja väljalülitamine on mõlemad seotud parooli kinnitamisega.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Hoidke oma taastekoode eraldi seadmest, kus on autentimisrakendus, näiteks paroolihalduris.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Seadmete ajalugu",
          excerpt: "Jälgige, milliste seadmete kaudu Teie konto on sisse logitud.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Seadmete ajalugu /konto all näitab Teile, millistesse seadmetesse Teie konto praegu sisse on logitud — koos seadme tüübi, ligikaudse asukoha ja viimase aktiivsuse ajaga. Nii tuvastate kiiresti, kas sisselogimine tuli tegelikult Teilt.",
            },
            { type: "h2", text: "Seadmete ajaloo kontrollimine" },
            {
              type: "steps",
              items: [
                "Avage /konto ja jaotis „Seadmete ajalugu“.",
                "Vaadake läbi sisse logitud seadmete nimekiri.",
                "Kui tuvastate tundmatu seadme, logige see välja.",
                "Muutke seejärel kindluse mõttes oma parooli.",
              ],
            },
            { type: "h2", text: "Millal on pilk mõistlik" },
            {
              type: "p",
              text: "Kontrollige seadmete ajalugu eriti pärast parooli või e-posti muutmist ning pärast võõra või avaliku seadme kasutamist. Tundmatu kanne on selge hoiatussignaal volitamata juurdepääsust.",
            },
            {
              type: "ul",
              items: [
                "Iga kanne näitab seadme tüüpi, ligikaudset asukohta ja viimast aktiivsust.",
                "Üksikuid seadmeid saab sihipäraselt välja logida, teisi mõjutamata.",
                "Tundmatu seade on põhjus koheseks paroolivahetuseks.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Kui Te seadet ei tunne ära, logige see kohe välja ja muutke seejärel oma parooli artiklis [Parooli ja e-posti muutmine](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Andmekaitse",
          excerpt: "Juhtige otsingumootorite indekseerimist objekti kaupa ja eksportige oma andmeid.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Jaotises „Andmekaitse“ /konto all juhite kaht asja: kas Teie objektilehti tohivad otsingumootorid indekseerida, ja kuidas eksportida oma myNextDays'is salvestatud andmeid.",
            },
            { type: "h2", text: "Otsingumootorite indekseerimine objekti kaupa" },
            {
              type: "p",
              text: "Vaikimisi on otsingumootorite indekseerimine uute objektide jaoks deaktiveeritud. Alles siis, kui lülitate selle teadlikult objekti kaupa sisse, tohivad otsingumootorid nagu Google võtta avaliku objektilehe oma indeksisse. Nii säilib Teil kontroll selle üle, millised objektid on leitavad väljaspool portaale ja oma platvormi.",
            },
            {
              type: "steps",
              items: [
                "Avage /konto ja jaotis „Andmekaitse“.",
                "Valige nimekirjast soovitud objekt.",
                "Lülitage otsingumootorite indekseerimine sisse või välja.",
                "Kasutage mitme objekti puhul koondlülitit, et seada kõik objektid ühtselt.",
              ],
            },
            { type: "h2", text: "Andmete eksportimine" },
            {
              type: "p",
              text: "Andmete ekspordi funktsiooni kaudu taotlete täieliku koopia oma kontos salvestatud andmetest. Eksport koostatakse ja seejärel tehakse Teile allalaadimiseks kättesaadavaks.",
            },
            {
              type: "ul",
              items: [
                "Indekseerimist saab juhtida objekti kaupa eraldi, koondlülitiga kõikide objektide jaoks.",
                "Uued objektid alustavad põhimõtteliselt ilma otsingumootori indekseerimiseta.",
                "Andmete eksport sisaldab Teie konto- ja objektiandmeid struktureeritud kujul.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Otsingumootorite indekseerimine on sõltumatu nähtavusest portaalidel ja oma turuplatsil — see puudutab ainult avalikku objektilehte otsingumootorites.",
            },
          ],
        },
      ],
    },
  ],
};
