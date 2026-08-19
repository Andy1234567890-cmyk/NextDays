import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Account & abonnement",
  description: "Basisgegevens, tarief, beveiliging en 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Account",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Bedrijfsgegevens",
          excerpt: "Bedrijfsnaam, adres en contactgegevens van uw bedrijf centraal beheren.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Onder /konto bundelt myNextDays alle bedrijfs- en accountfuncties als secties op één pagina — u hoeft niet tussen veel subpagina's te wisselen. De bedrijfsgegevens vormen daarbij de basis: bedrijfsnaam, rechtsvorm, adres en contactgegevens, die worden gebruikt voor facturen, portalen en de communicatie met gasten.",
            },
            { type: "h2", text: "Basisgegevens openen en bewerken" },
            {
              type: "steps",
              items: [
                "Open /konto.",
                "Ga naar de sectie “Bedrijfsgegevens”.",
                "Controleer bedrijfsnaam, adres, telefoonnummer en e-mailadres voor eventuele vragen.",
                "Voer uw wijzigingen door.",
                "Sla de sectie op.",
              ],
            },
            { type: "h2", text: "Waarom deze gegevens belangrijk zijn" },
            {
              type: "p",
              text: "De bedrijfsgegevens worden gebruikt in facturen, bij de registratie bij aangesloten portalen en in wettelijk verplichte gegevens zoals het impressum. Een onvolledig of verouderd adres kan ertoe leiden dat facturen onjuist worden opgesteld of dat portaalkoppelingen vertraging oplopen.",
            },
            {
              type: "ul",
              items: [
                "Bedrijfsnaam en rechtsvorm verschijnen op alle uitgegeven facturen.",
                "Het adres is nodig voor de registratie bij portalen.",
                "Contactgegevens dienen als terugvalmogelijkheid als systeemmeldingen niet aankomen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Als u uw factuuradres wijzigt, controleer dan aansluitend de reeds uitgegeven facturen onder [Facturering & tariefcalculator](/hilfe/konto-abo/abrechnung-tarifrechner) — bestaande facturen worden niet met terugwerkende kracht aangepast.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Abonnement & tarief",
          excerpt: "Uw tarief bepaalt het objectcontingent — het geboekte aantal objecten ziet u altijd in het account.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Uw myNextDays-abonnement omvat een objectcontingent: het maximale aantal objecten (kamers of vakantieobjecten) dat u tegelijk actief kunt beheren. Het huidige geboekte aantal objecten wordt weergegeven in de sectie “Abonnement & tarief” onder /konto, samen met het resterende contingent.",
            },
            { type: "h2", text: "Het contingent in de gaten houden" },
            {
              type: "p",
              text: "Het contingent wordt aan de serverkant afgedwongen: als u de bovengrens van uw tarief bereikt, kunt u geen nieuw object meer aanmaken totdat u een bestaand object deactiveert of uw tarief uitbreidt. Dit geldt ongeacht of het nieuwe object een kamer of een vakantieobject is — beide tellen gelijk mee voor het contingent.",
            },
            {
              type: "steps",
              items: [
                "Open /konto en de sectie “Abonnement & tarief”.",
                "Controleer het geboekte aantal objecten ten opzichte van het contingent van uw tarief.",
                "Kies indien nodig een groter tarief om meer objecten aan te maken.",
                "Bevestig de tariefwijziging.",
              ],
            },
            {
              type: "ul",
              items: [
                "Elk object telt afzonderlijk mee voor het contingent, ongeacht het objecttype.",
                "Een tariefwijziging heeft direct invloed op het beschikbare contingent.",
                "Een downgrade is alleen mogelijk als het aantal actieve objecten binnen het nieuwe contingent past.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Een downgrade naar een tarief met een kleiner contingent wordt geweigerd zolang er meer objecten actief zijn dan het nieuwe tarief toestaat. Deactiveer eerst de overtollige objecten.",
            },
            {
              type: "note",
              variant: "info",
              text: "Details over facturen en de tariefberekening vindt u onder [Facturering & tariefcalculator](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Facturering & tariefcalculator",
          excerpt: "Factuuradres, eerdere facturen en de tariefcalculator voor uw objectcontingent.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "De sectie “Facturering & tariefcalculator” onder /konto bundelt alles rond de facturering: uw factuuradres, de lijst met eerdere facturen om te downloaden, en een tariefcalculator waarmee u de kosten voor uw huidige of een groter objectcontingent kunt nagaan.",
            },
            { type: "h2", text: "Factuuradres en facturen" },
            {
              type: "p",
              text: "Het factuuradres kan afwijken van uw bedrijfsadres, bijvoorbeeld als een belastingkantoor de facturen ontvangt. Reeds uitgegeven facturen vindt u chronologisch gesorteerd; elke factuur kan als PDF worden gedownload.",
            },
            { type: "h2", text: "De tariefcalculator gebruiken" },
            {
              type: "steps",
              items: [
                "Open /konto en de sectie “Facturering & tariefcalculator”.",
                "Voer in de tariefcalculator het gewenste aantal objecten in.",
                "Vergelijk de resulterende kosten per tariefniveau.",
                "Wissel indien nodig direct vanuit de calculator naar het passende tarief.",
              ],
            },
            {
              type: "ul",
              items: [
                "De tariefcalculator toont de kosten in de valuta die voor uw account is ingesteld.",
                "Facturen blijven permanent beschikbaar om te downloaden.",
                "Het factuuradres kan onafhankelijk van de bedrijfsgegevens worden beheerd.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Vergelijk regelmatig met de tariefcalculator of uw objectcontingent nog past bij het daadwerkelijk geboekte aantal objecten — zie [Abonnement & tarief](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Wachtwoord & e-mail wijzigen",
          excerpt: "Beveiligingskritieke wijzigingen vereisen een nieuwe aanmelding en een bevestigingsstap.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Wachtwoord en e-mailadres behoren tot de meest beveiligingskritieke gegevens van uw account. myNextDays vereist daarom bij beide wijzigingen een nieuwe authenticatie — u bevestigt de wijziging met uw huidige wachtwoord, ook als u al bent aangemeld.",
            },
            { type: "h2", text: "Wachtwoord wijzigen" },
            {
              type: "steps",
              items: [
                "Open /konto en de sectie “Wachtwoord & e-mail wijzigen”.",
                "Voer ter bevestiging uw huidige wachtwoord in.",
                "Stel het nieuwe wachtwoord in en herhaal het.",
                "Sla de wijziging op.",
              ],
            },
            { type: "h2", text: "E-mailadres wijzigen" },
            {
              type: "p",
              text: "Het wijzigen van het e-mailadres verloopt via dubbele opt-in: na bevestiging van uw huidige wachtwoord ontvangt u een bevestigingslink op het NIEUWE adres. Pas door op deze link te klikken wordt de wijziging van kracht — het oude adres blijft tot die tijd actief, zodat de toegang tot uw account nooit wordt onderbroken.",
            },
            {
              type: "ul",
              items: [
                "Zonder huidig wachtwoord kunt u noch het wachtwoord noch het e-mailadres wijzigen.",
                "De bevestigingslink voor het nieuwe e-mailadres is een beperkte tijd geldig.",
                "Tot aan de bevestiging blijft het bestaande e-mailadres actief voor aanmelding en meldingen.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Controleer na een e-mailwijziging ook de tweefactorauthenticatie — zie [Tweefactorauthenticatie](/hilfe/konto-abo/zwei-faktor) — als herstelcodes aan het oude adres gekoppeld waren.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Tweefactorauthenticatie",
          excerpt: "Een extra aanmeldstap beschermt uw account tegen ongeautoriseerde toegang.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Tweefactorauthenticatie (2FA) vult uw wachtwoord aan met een tweede factor via een authenticator-app. Daardoor is een gestolen wachtwoord alleen niet meer voldoende om in te loggen op uw myNextDays-account.",
            },
            { type: "h2", text: "2FA instellen" },
            {
              type: "steps",
              items: [
                "Open /konto en de sectie “Tweefactorauthenticatie”.",
                "Bevestig uw huidige wachtwoord voor de hernieuwde authenticatie.",
                "Scan de weergegeven QR-code met een authenticator-app.",
                "Voer ter bevestiging de gegenereerde code in.",
                "Bewaar de weergegeven herstelcodes op een veilige plek.",
              ],
            },
            { type: "h2", text: "2FA uitschakelen" },
            {
              type: "p",
              text: "Ook het uitschakelen van tweefactorauthenticatie vereist een hernieuwde authenticatie met uw huidige wachtwoord. Zo voorkomt myNextDays dat iemand met een reeds geopende sessie uw beveiliging zomaar uitschakelt.",
            },
            {
              type: "ul",
              items: [
                "Herstelcodes bieden toegang als de authenticator-app verloren gaat.",
                "Elke herstelcode is slechts eenmaal bruikbaar.",
                "Zowel het in- als uitschakelen van 2FA is gebonden aan een wachtwoordbevestiging.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Bewaar uw herstelcodes gescheiden van het apparaat met de authenticator-app, bijvoorbeeld in een wachtwoordmanager.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Apparaatgeschiedenis",
          excerpt: "Houd in de gaten vanaf welke apparaten uw account is aangemeld.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "De apparaatgeschiedenis onder /konto laat zien op welke apparaten uw account momenteel is aangemeld — met apparaattype, geschatte locatie en tijdstip van de laatste activiteit. Zo ziet u snel of een aanmelding daadwerkelijk van u afkomstig is.",
            },
            { type: "h2", text: "Apparaatgeschiedenis controleren" },
            {
              type: "steps",
              items: [
                "Open /konto en de sectie “Apparaatgeschiedenis”.",
                "Bekijk de lijst met aangemelde apparaten.",
                "Herkent u een onbekend apparaat, meld het dan af.",
                "Wijzig vervolgens voor de zekerheid uw wachtwoord.",
              ],
            },
            { type: "h2", text: "Wanneer een blik zinvol is" },
            {
              type: "p",
              text: "Controleer de apparaatgeschiedenis vooral na een wachtwoord- of e-mailwijziging en na het gebruik van een vreemd of openbaar apparaat. Een onbekende vermelding is een duidelijk waarschuwingssignaal voor ongeautoriseerde toegang.",
            },
            {
              type: "ul",
              items: [
                "Elke vermelding toont apparaattype, geschatte locatie en laatste activiteit.",
                "Individuele apparaten kunnen gericht worden afgemeld, zonder de andere te beïnvloeden.",
                "Een onherkend apparaat is aanleiding voor een onmiddellijke wachtwoordwijziging.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Herkent u een apparaat niet, meld het dan onmiddellijk af en wijzig daarna uw wachtwoord onder [Wachtwoord & e-mail wijzigen](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Privacy",
          excerpt: "Zoekmachine-indexering per object beheren en uw gegevens exporteren.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "In de sectie “Privacy” onder /konto regelt u twee dingen: of uw objectpagina's door zoekmachines mogen worden geïndexeerd, en hoe u uw bij myNextDays opgeslagen gegevens kunt exporteren.",
            },
            { type: "h2", text: "Zoekmachine-indexering per object" },
            {
              type: "p",
              text: "Standaard is de zoekmachine-indexering voor nieuwe objecten uitgeschakeld. Pas wanneer u deze bewust per object inschakelt, mogen zoekmachines zoals Google de openbare objectpagina in hun index opnemen. Zo houdt u de controle over welke objecten buiten portalen en het eigen platform vindbaar zijn.",
            },
            {
              type: "steps",
              items: [
                "Open /konto en de sectie “Privacy”.",
                "Selecteer het gewenste object uit de lijst.",
                "Schakel de zoekmachine-indexering in of uit.",
                "Gebruik bij meerdere objecten de verzamelschakelaar om alle objecten gelijk in te stellen.",
              ],
            },
            { type: "h2", text: "Gegevens exporteren" },
            {
              type: "p",
              text: "Via de gegevensexportfunctie vraagt u een volledige kopie aan van uw in het account opgeslagen gegevens. De export wordt samengesteld en vervolgens voor u klaargezet om te downloaden.",
            },
            {
              type: "ul",
              items: [
                "De indexering is per object afzonderlijk instelbaar, met een verzamelschakelaar voor alle objecten.",
                "Nieuwe objecten starten in principe zonder zoekmachine-indexering.",
                "De gegevensexport bevat uw account- en objectgegevens in gestructureerde vorm.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "De zoekmachine-indexering staat los van de zichtbaarheid op portalen en op het eigen marktplaats-platform — ze betreft uitsluitend de openbare objectpagina in zoekmachines.",
            },
          ],
        },
      ],
    },
  ],
};
