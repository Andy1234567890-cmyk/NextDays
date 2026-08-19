import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Konto och abonnemang",
  description: "Grunduppgifter, tariff, säkerhet och 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Konto",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Verksamhetens grunduppgifter",
          excerpt: "Underhåll företagsnamn, adress och kontaktuppgifter för din verksamhet centralt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Under /konto samlar myNextDays alla verksamhets- och kontofunktioner som avsnitt på en sida — du behöver inte växla mellan många undersidor. Verksamhetens grunduppgifter utgör grunden: företagsnamn, företagsform, adress och kontaktuppgifter, som används för fakturor, portaler och kommunikation med gäster.",
            },
            { type: "h2", text: "Öppna och redigera grunduppgifter" },
            {
              type: "steps",
              items: [
                "Öppna /konto.",
                "Byt till avsnittet ”Verksamhetens grunduppgifter”.",
                "Kontrollera företagsnamn, adress, telefonnummer och e-postadress för återfrågor.",
                "Gör dina ändringar.",
                "Spara avsnittet.",
              ],
            },
            { type: "h2", text: "Varför dessa uppgifter är viktiga" },
            {
              type: "p",
              text: "Verksamhetens grunduppgifter går in i fakturor, i registreringen hos anslutna portaler och i juridiskt obligatoriska uppgifter som webbplatsens ägaruppgifter. En ofullständig eller föråldrad adress kan leda till att fakturor ställs ut felaktigt eller att portalanslutningar försenas.",
            },
            {
              type: "ul",
              items: [
                "Företagsnamn och företagsform visas på alla utställda fakturor.",
                "Adressen behövs för registreringen hos portaler.",
                "Kontaktuppgifter fungerar som reservväg om systemnotiser inte når fram.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ändrar du din fakturaadress, kontrollera därefter de redan utställda fakturorna under [Avräkning och tariffkalkylator](/hilfe/konto-abo/abrechnung-tarifrechner) — befintliga underlag justeras inte retroaktivt.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Abonnemang och tariff",
          excerpt: "Din tariff avgör objektkontingenten — det bokade antalet objekt ser du alltid i kontot.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Ditt myNextDays-abonnemang omfattar en objektkontingent: det maximala antalet objekt (rum eller semesterboenden) som du kan förvalta aktivt samtidigt. Det aktuellt bokade antalet objekt visas i avsnittet ”Abonnemang och tariff” under /konto, tillsammans med den återstående kontingenten.",
            },
            { type: "h2", text: "Hålla koll på kontingenten" },
            {
              type: "p",
              text: "Kontingenten tillämpas serverside: når du din tariffs övre gräns går det inte att lägga till fler objekt förrän du inaktiverar ett befintligt objekt eller utökar din tariff. Det gäller oberoende av om det nya objektet är ett rum eller ett semesterboende — båda räknas likvärdigt mot kontingenten.",
            },
            {
              type: "steps",
              items: [
                "Öppna /konto och avsnittet ”Abonnemang och tariff”.",
                "Kontrollera det bokade antalet objekt i förhållande till din tariffs kontingent.",
                "Välj vid behov en större tariff för att lägga till fler objekt.",
                "Bekräfta tariffbytet.",
              ],
            },
            {
              type: "ul",
              items: [
                "Varje objekt räknas individuellt mot kontingenten, oberoende av objekttyp.",
                "Ett tariffbyte påverkar den tillgängliga kontingenten omedelbart.",
                "En nedgradering är bara möjlig om det aktiva antalet objekt passar den nya kontingenten.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "En nedgradering till en tariff med mindre kontingent avvisas så länge fler objekt är aktiva än vad den nya tariffen tillåter. Inaktivera först överskjutande objekt.",
            },
            {
              type: "note",
              variant: "info",
              text: "Detaljer om fakturor och tariffberäkningen hittar du under [Avräkning och tariffkalkylator](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Avräkning och tariffkalkylator",
          excerpt: "Fakturaadress, tidigare fakturor och tariffkalkylatorn för din objektkontingent.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Avsnittet ”Avräkning och tariffkalkylator” under /konto samlar allt kring fakturering: din fakturaadress, listan över tidigare fakturor för nedladdning samt en tariffkalkylator med vilken du kan följa kostnaderna för din aktuella eller en större objektkontingent.",
            },
            { type: "h2", text: "Fakturaadress och fakturor" },
            {
              type: "p",
              text: "Fakturaadressen kan avvika från din verksamhetsadress, till exempel om en revisionsbyrå tar emot underlagen. Redan utställda fakturor hittar du kronologiskt sorterade; var och en kan laddas ner som PDF.",
            },
            { type: "h2", text: "Använda tariffkalkylatorn" },
            {
              type: "steps",
              items: [
                "Öppna /konto och avsnittet ”Avräkning och tariffkalkylator”.",
                "Ange önskat antal objekt i tariffkalkylatorn.",
                "Jämför de resulterande kostnaderna per tariffnivå.",
                "Byt vid behov direkt från kalkylatorn till rätt tariff.",
              ],
            },
            {
              type: "ul",
              items: [
                "Tariffkalkylatorn visar kostnaderna i den valuta som är angiven för ditt konto.",
                "Fakturor finns permanent tillgängliga för nedladdning.",
                "Fakturaadressen kan underhållas oberoende av verksamhetens grunduppgifter.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Jämför regelbundet med tariffkalkylatorn om din objektkontingent fortfarande passar det faktiskt bokade antalet objekt — se [Abonnemang och tariff](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Ändra lösenord och e-post",
          excerpt: "Säkerhetskritiska ändringar kräver en förnyad inloggning och ett bekräftelsesteg.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Lösenord och e-postadress hör till de mest säkerhetskritiska uppgifterna i ditt konto. myNextDays kräver därför en förnyad autentisering vid båda ändringarna — du bekräftar ändringen med ditt aktuella lösenord, även om du redan är inloggad.",
            },
            { type: "h2", text: "Ändra lösenord" },
            {
              type: "steps",
              items: [
                "Öppna /konto och avsnittet ”Ändra lösenord och e-post”.",
                "Ange ditt aktuella lösenord som bekräftelse.",
                "Ange det nya lösenordet och upprepa det.",
                "Spara ändringen.",
              ],
            },
            { type: "h2", text: "Ändra e-postadress" },
            {
              type: "p",
              text: "Bytet av e-postadress sker som dubbel opt-in: efter bekräftelse av ditt aktuella lösenord får du en bekräftelselänk till den NYA adressen. Först när du klickar på denna länk träder ändringen i kraft — den gamla adressen förblir aktiv fram tills dess, så att åtkomsten till ditt konto aldrig avbryts.",
            },
            {
              type: "ul",
              items: [
                "Utan aktuellt lösenord går det inte att ändra vare sig lösenord eller e-post.",
                "Bekräftelselänken för den nya e-postadressen är giltig under en begränsad tid.",
                "Fram till bekräftelsen förblir den tidigare e-postadressen aktiv för inloggning och notiser.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Kontrollera efter en e-poständring även tvåfaktorsautentiseringen — se [Tvåfaktorsautentisering](/hilfe/konto-abo/zwei-faktor) — om återställningskoder var kopplade till den gamla adressen.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Tvåfaktorsautentisering",
          excerpt: "Ett extra inloggningssteg skyddar ditt konto mot obehörig åtkomst.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Tvåfaktorsautentiseringen (2FA) kompletterar ditt lösenord med en andra faktor via en autentiserar-app. Med den räcker det inte längre med ett stulet lösenord ensamt för att logga in på ditt myNextDays-konto.",
            },
            { type: "h2", text: "Ställa in 2FA" },
            {
              type: "steps",
              items: [
                "Öppna /konto och avsnittet ”Tvåfaktorsautentisering”.",
                "Bekräfta ditt aktuella lösenord för förnyad autentisering.",
                "Skanna den visade QR-koden med en autentiserar-app.",
                "Ange den genererade koden som bekräftelse.",
                "Spara de visade återställningskoderna på ett säkert ställe.",
              ],
            },
            { type: "h2", text: "Inaktivera 2FA" },
            {
              type: "p",
              text: "Även inaktivering av tvåfaktorsautentiseringen kräver en förnyad autentisering med ditt aktuella lösenord. På så sätt förhindrar myNextDays att någon med en redan öppen session helt enkelt stänger av ditt skydd.",
            },
            {
              type: "ul",
              items: [
                "Återställningskoder ger åtkomst om autentiserar-appen går förlorad.",
                "Varje återställningskod kan bara användas en gång.",
                "Att slå på och av 2FA är lika beroende av en lösenordsbekräftelse.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Förvara dina återställningskoder separat från enheten med autentiserar-appen, till exempel i en lösenordshanterare.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Enhetshistorik",
          excerpt: "Håll koll på från vilka enheter ditt konto är inloggat.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Enhetshistoriken under /konto visar dig på vilka enheter ditt konto för närvarande är inloggat — med enhetstyp, ungefärlig plats och tidpunkt för senaste aktivitet. Så upptäcker du snabbt om en inloggning verkligen kommer från dig.",
            },
            { type: "h2", text: "Kontrollera enhetshistorik" },
            {
              type: "steps",
              items: [
                "Öppna /konto och avsnittet ”Enhetshistorik”.",
                "Granska listan över inloggade enheter.",
                "Känner du igen en okänd enhet, logga ut den.",
                "Ändra därefter för säkerhets skull ditt lösenord.",
              ],
            },
            { type: "h2", text: "När en granskning är lämplig" },
            {
              type: "p",
              text: "Kontrollera enhetshistoriken särskilt efter en lösenords- eller e-poständring samt efter användning av en främmande eller offentlig enhet. En okänd post är en tydlig varningssignal för obehörig åtkomst.",
            },
            {
              type: "ul",
              items: [
                "Varje post visar enhetstyp, ungefärlig plats och senaste aktivitet.",
                "Enskilda enheter kan loggas ut individuellt, utan att påverka de andra.",
                "En oigenkänd enhet är anledning till ett omedelbart lösenordsbyte.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Känner du inte igen en enhet, logga ut den omedelbart och ändra sedan ditt lösenord under [Ändra lösenord och e-post](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Dataskydd",
          excerpt: "Styr sökmotorindexering per objekt och exportera dina data.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "I avsnittet ”Dataskydd” under /konto styr du två saker: om dina objektsidor får indexeras av sökmotorer, och hur du kan exportera dina data som lagras hos myNextDays.",
            },
            { type: "h2", text: "Sökmotorindexering per objekt" },
            {
              type: "p",
              text: "Som standard är sökmotorindexeringen inaktiverad för nya objekt. Först när du medvetet slår på den per objekt får sökmotorer som Google inkludera den offentliga objektsidan i sitt index. Så behåller du kontrollen över vilka objekt som går att hitta utanför portaler och den egna plattformen.",
            },
            {
              type: "steps",
              items: [
                "Öppna /konto och avsnittet ”Dataskydd”.",
                "Välj önskat objekt från listan.",
                "Slå på eller av sökmotorindexeringen.",
                "Använd samlingsreglaget vid flera objekt för att ställa in alla objekt enhetligt.",
              ],
            },
            { type: "h2", text: "Exportera data" },
            {
              type: "p",
              text: "Via dataexportfunktionen begär du en fullständig kopia av dina data som lagras i kontot. Exporten sammanställs och görs sedan tillgänglig för nedladdning.",
            },
            {
              type: "ul",
              items: [
                "Indexeringen kan styras individuellt per objekt, med samlingsreglage för alla objekt.",
                "Nya objekt startar i grunden utan sökmotorindexering.",
                "Dataexporten innehåller dina konto- och objektdata i strukturerad form.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Sökmotorindexeringen är oberoende av synligheten på portaler och den egna marknadsplatsen — den gäller uteslutande den offentliga objektsidan i sökmotorer.",
            },
          ],
        },
      ],
    },
  ],
};
