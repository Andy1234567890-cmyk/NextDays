import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Reserveeringud ja kalender",
  description: "Hoidke reserveeringud ja kalender kontrolli all.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Reserveeringud ja kalender",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Topeltbroneeringute usaldusväärne vältimine",
          excerpt: "Kuidas tagada, et objekti kunagi topelt ei broneerita.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord",
            },
            {
              type: "p",
              text: "Objekti müüakse korraga mitme kanali kaudu — portaalid nagu Booking, Airbnb & Co., oma platvorm ning rakendus. Topeltbroneering tekib siis, kui saadavus ei blokeeru ühel kanalil õigeaegselt pärast seda, kui teisel kanalil broneeriti.",
            },
            {
              type: "steps",
              items: [
                "Kontrollige täituvusplaanis, et iga objekt on täpselt üks rida ühe broneeritava üksusega — mitte mitme toa jagatud mahutavus.",
                "Laske uued broneeringud luua ainult täituvusplaani või ühendatud kanalite kaudu, mitte kunagi üksikute päevade käsitsi kirjeldamisega.",
                "Kontrollige pärast iga broneeringut, et broneeritud ööd ilmuvad kalendris kohe hõivatuna.",
                "Kasutage tehniliste probleemide või hoolduse korral kohe müügipeatust, selle asemel et jätta päev avatuks.",
                "Ebaselguse korral kontrollige puudutatud reserveeringu broneeringu ajajoont, et jälgida ajalist kulgu.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ärge kunagi muutke öid ega blokeeringuid käsitsi väljaspool täituvusplaani — ainult nii jääb tagatud, et kõik kanalid näevad sama saadavuse seisu ja topeltbroneeringu jaoks lünka ei teki.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Broneeringu viimine teise objekti",
          excerpt: "Kuidas nihutada olemasolev reserveering korrektselt teisele objektile.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord",
            },
            {
              type: "p",
              text: "Mõnikord peab külaline kolima ühest objektist teise, näiteks tehnilise rikke tõttu või külalise soovil. Kolimisel vabastatakse senised kalendriööd automaatselt ja hõivatakse uuesti sihtobjektis.",
            },
            {
              type: "steps",
              items: [
                "Avage puudutatud broneering broneeringu ajajoonel.",
                "Valige tegevusmenüüst „Vaheta objekti“ ehk „Kolimine“.",
                "Valige sihtobjekt ja kontrollige selle saadavust valitud perioodil.",
                "Kinnitage kolimine.",
                "Kontrollige seejärel täituvusplaanis, et vanad ööd kuvatakse algses objektis uuesti saadavana.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vanade ööde vabastamise võtab süsteem automaatselt üle — Te ei pea algset perioodi ise käsitsi avama. Teavitage külalist objekti vahetusest, eriti kui varustus või juurdepääs erineb.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Pikaajalise broneeringu loomine",
          excerpt: "Kuidas luua pikema perioodi reserveering korrektselt.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord",
            },
            {
              type: "p",
              text: "Pikaajaliste külaliste jaoks — näiteks mitu nädalat või kuud — loote reserveeringu tavapäraselt, kuid pöörate lisaks tähelepanu minimaalsele peatumisajale, maksereeglitele ja objekti kanali nähtavusele kogu perioodi jooksul.",
            },
            {
              type: "steps",
              items: [
                "Avage soovitud objekti täituvusplaan ja märgistage kogu periood.",
                "Looge broneering külalise andmete ning kavandatud saabumis- ja lahkumiskuupäevaga.",
                "Seadistage vajadusel maksereegel ettemaksu ja lõppmaksega, selle asemel et nõuda kogu summat kohe.",
                "Kontrollige, et ükski minimaalse või maksimaalse peatumisaja reegel pikale perioodile vastu ei räägi.",
                "Salvestage broneering ja kontrollige, et kogu periood kuvatakse kalendris korrektselt hõivatuna.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Väga pikkade viibimiste puhul on soovitatav lõppmakse jagada mitmeks osamakseks ühe suure tähtaja asemel — nii jääb maksterisk hallatavaks. Üksikasjad artiklis [Lõppmakse automatiseerimine](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
