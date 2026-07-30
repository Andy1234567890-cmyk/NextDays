import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Reservationer och bokningar",
  description: "Hantera, flytta och avboka bokningar.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Bokningar",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Registrera bokning manuellt",
          excerpt:
            "Så registrerar du en bokning som kommit in per telefon eller e-post direkt i myNextDays.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "När du registrerar manuellt" },
            {
              type: "p",
              text: "Inte varje bokning kommer in via en portal eller din egen plattform — förfrågningar per telefon, e-post eller på plats måste du själv registrera, så att objektet blockeras korrekt i myNextDays och ingen dubbelbeläggning uppstår.",
            },
            {
              type: "steps",
              items: [
                "Öppna Reservationer och klicka på ”Ny bokning”.",
                "Välj objektet — varje objekt i myNextDays är en enskild bokningsbar enhet, det vill säga ett bestämt rum eller semesterboende.",
                "Fastställ ankomst och avresa samt antalet gäster.",
                "Ange gästuppgifterna (namn, kontakt, ev. adress för fakturan).",
                "Kontrollera det föreslagna priset och justera det vid behov.",
                "Spara bokningen — nätterna spärras omedelbart i kalendern.",
              ],
            },
            { type: "h2", text: "Betalning och bekräftelse" },
            {
              type: "p",
              text: "Efter sparandet gäller samma betalningsregler som för onlinebokningar. Är en betalningsleverantör kopplad kan du skicka en betalningslänk direkt till gästen eller markera betalningen manuellt som mottagen.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Ange särskilda önskemål (tidig ankomst, extrasängar) direkt i anteckningarna — teamet ser dem i bokningens tidslinje.",
            },
            { type: "h2", text: "Efter registreringen" },
            {
              type: "p",
              text: "Den nya bokningen visas omedelbart i [Bokningens tidslinje](/hilfe/reservierungen/buchungs-zeitleiste) med alla nästa steg som meddelanden, uppgifter och betalningar på ett ställe.",
            },
            {
              type: "ul",
              items: [
                "Kalender och portaler synkroniseras automatiskt så snart du sparar.",
                "Gästen får vid behov ett automatiskt bekräftelsemeddelande.",
                "Ändringar av datum registrerar du via ”Flytta bokning”.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "Bokningens tidslinje",
          excerpt:
            "Bokningens tidslinje samlar hela förloppet för en reservation på ett ställe.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Vad tidslinjen visar" },
            {
              type: "p",
              text: "Varje reservation har en egen tidslinje som avbildar hela förloppet kronologiskt — från bokningsförfrågan eller portalimport till utcheckning. Så ser du på en blick vad som redan har hänt och vad som är nästa steg.",
            },
            {
              type: "ul",
              items: [
                "Meddelanden med gästen",
                "Uppgifter, till exempel städning eller förberedelse",
                "Betalningar och fakturor",
                "Bokade tillägg och extratjänster",
                "Flyttningar (move) och avbokningar",
              ],
            },
            { type: "h2", text: "Använda tidslinjen i vardagen" },
            {
              type: "steps",
              items: [
                "Öppna Reservationer och välj önskad bokning.",
                "Byt till fliken ”Tidslinje”.",
                "Skrolla kronologiskt genom alla händelser.",
                "Använd snabbåtgärderna för att skicka ett meddelande direkt eller skapa en uppgift.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Flyttas eller avbokas en bokning visas även detta steg i tidslinjen — inklusive de nätter som frigjorts i kalendern.",
            },
            { type: "h2", text: "Varför det är viktigt" },
            {
              type: "p",
              text: "Eftersom team, ägare och support ser samma tidslinje uppstår inga informationsluckor mellan meddelanden, uppgifter och betalningar. Detaljer om återbetalningar hittar du under [Återbetalningar](/hilfe/zahlungen/rueckerstattungen), om extratjänster under [Tillägg och extratjänster](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Flytta bokning",
          excerpt:
            "Så flyttar du en befintlig bokning till en ny period utan att röra till kalendern.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Kontrollera innan du flyttar" },
            {
              type: "p",
              text: "Innan du flyttar en bokning kontrollerar du tillgängligheten för den nya perioden för det bokade objektet. myNextDays frigör de ursprungligen reserverade nätterna först när den nya perioden är bekräftad — så uppstår ingen lucka där objektet felaktigt anses ledigt eller dubbelbelagt.",
            },
            {
              type: "steps",
              items: [
                "Öppna bokningen i Reservationer.",
                "Välj ”Flytta” och ange den nya perioden.",
                "Kontrollera den visade tillgängligheten för de nya datumen.",
                "Bekräfta flytten.",
                "Kontrollera om priset ändras på grund av det nya antalet nätter, och justera vid behov.",
              ],
            },
            { type: "h2", text: "Vad som händer automatiskt" },
            {
              type: "p",
              text: "Efter bekräftelsen frigörs de gamla nätterna korrekt i kalendern och de nya nätterna spärras, anslutna portaler uppdateras. Förloppet loggas i bokningens tidslinje.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Togs bokningen emot via en portal kan en flytt lyda under portalens egna regler där — kontrollera portalens riktlinjer innan du gör större ändringar.",
            },
            { type: "h2", text: "Betalningsskillnader" },
            {
              type: "p",
              text: "Ändras priset på grund av flytten justerar du betalningsreglerna i enlighet med det — se [Betalningsregler](/hilfe/zahlungen/zahlungsregeln). Mer om hela bokningsförloppet hittar du under [Bokningens tidslinje](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Avbokning och återbetalning",
          excerpt:
            "Så avbokar du en bokning korrekt och utlöser vid behov en återbetalning.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Avboka bokning" },
            {
              type: "p",
              text: "En avbokning frigör omedelbart objektet för den bokade perioden igen — både i din kalender och på alla anslutna portaler. Kontrollera innan avbokningen vilka avbokningsvillkor som gäller för denna bokning.",
            },
            {
              type: "steps",
              items: [
                "Öppna bokningen i Reservationer.",
                "Välj ”Avboka” och ange en anledning.",
                "Kontrollera det föreslagna återbetalningsbeloppet.",
                "Bekräfta avbokningen.",
              ],
            },
            { type: "h2", text: "Utlösa återbetalning" },
            {
              type: "p",
              text: "Hanterades betalningen via en ansluten betalningsleverantör kan du utlösa återbetalningen direkt från bokningen. Beloppet anges i den valuta som angetts för objektet. Detaljer om förloppet hittar du under [Återbetalningar](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Full eller delvis återbetalning möjlig",
                "Förloppet visas i bokningens tidslinje",
                "Vid portalbokningar gäller dessutom respektive portals regler",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "En avbokning går inte att göra ogjord. Kontrollera period och gäst noggrant innan du bekräftar.",
            },
            { type: "h2", text: "Efter avbokningen" },
            {
              type: "p",
              text: "Objektet går omedelbart att boka igen, öppna uppgifter kopplade till bokningen — till exempel förberedelsen — markeras automatiskt som inte längre nödvändiga. Hela förloppet förblir spårbart i [Bokningens tidslinje](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Incheckning och utcheckning",
          excerpt: "Så dokumenterar du en gästs ankomst och avresa i myNextDays.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Registrera incheckning" },
            {
              type: "p",
              text: "Incheckningen markerar vistelsens början och är särskilt användbar vid självincheckning eller nyckelöverlämning genom teamet, för att hålla statusen för varje bokning aktuell.",
            },
            {
              type: "steps",
              items: [
                "Öppna bokningen i Reservationer.",
                "Välj ”Incheckning” på ankomstdagen.",
                "Ange vid behov en anteckning, till exempel tidpunkt eller särskilda omständigheter.",
              ],
            },
            { type: "h2", text: "Utcheckning och överlämning" },
            {
              type: "p",
              text: "Vid utcheckningen markerar du vistelsen som avslutad. Detta utlöser i många fall automatiskt en städuppgift för objektet, så att det förbereds för nästa bokning.",
            },
            {
              type: "ul",
              items: [
                "Incheckning och utcheckning ingår i bokningens tidslinje",
                "Tider kan definieras per objekt i objektinställningarna",
                "Vid mobil åtkomst kan teamet registrera in- och utcheckning direkt på plats",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "En missad utcheckning blockerar inte automatiskt efterföljande uppgifter — kontrollera försenade statusar regelbundet i Reservationer.",
            },
            { type: "h2", text: "Samband med uppgifter" },
            {
              type: "p",
              text: "Incheckning och utcheckning är nära kopplade till uppgifter och tidslinjen. Mer om hela förloppet läser du under [Bokningens tidslinje](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Tillägg och extratjänster",
          excerpt:
            "Så erbjuder du gäster bokningsbara extratjänster som frukost eller transfer och registrerar dessa i reservationen.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Vad tillägg är" },
            {
              type: "p",
              text: "Tillägg är valfria extratjänster till en bokning — till exempel frukost, tidig ankomst, transfer eller sen utcheckning. De anges per objekt och kan läggas till bokningen av gästen själv eller av ditt team.",
            },
            {
              type: "steps",
              items: [
                "Öppna objektet och skapa önskade extratjänster med pris under ”Tillägg”.",
                "Öppna en befintlig bokning i Reservationer.",
                "Välj ”Lägg till tillägg” och välj önskad tjänst.",
                "Bekräfta mängd och tidpunkt för tjänsten.",
              ],
            },
            { type: "h2", text: "Fakturering" },
            {
              type: "p",
              text: "Tillägg faktureras i respektive objekts valuta och visas som en egen post på fakturan. Redan betalda tillägg kan återbetalas proportionellt vid en avbokning.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Ange populära tillägg en gång centralt på objektet — så kan de läggas till med några få klick vid varje ny bokning.",
            },
            { type: "h2", text: "Synlighet för gästen" },
            {
              type: "p",
              text: "Är plattformen eller den egna webbplatsen aktiv kan gäster ofta redan under bokningen själva välja passande tillägg. Varje tillägg visas därefter i [Bokningens tidslinje](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Tillägg kan namnges och prissättas individuellt per objekt",
                "Att lägga till i efterhand är möjligt när som helst via bokningen",
                "Avbokade tillägg återbetalas proportionellt",
              ],
            },
          ],
        },
      ],
    },
  ],
};
