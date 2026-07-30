import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Uppgifter och städning",
  description: "Organisera städscheman och teamuppgifter.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Drift",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Skapa uppgifter",
          excerpt: "Så skapar du en ny uppgift för ett objekt eller en period.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Uppgifter samlar allt som behöver göras kring ett objekt — från städning efter utcheckning till underhållsarbeten eller gästförfrågningar. Varje uppgift hänger på exakt ett objekt och kan tilldelas en teammedlem.",
            },
            { type: "h2", text: "Skapa ny uppgift" },
            {
              type: "steps",
              items: [
                "Öppna avsnittet ”Uppgifter” i huvudmenyn.",
                "Klicka på ”Ny uppgift”.",
                "Välj det berörda objektet.",
                "Ange en titel och valfritt en beskrivning.",
                "Fastställ förfallodatum och -tid.",
                "Spara uppgiften.",
              ],
            },
            { type: "h2", text: "Uppgiftstyper" },
            {
              type: "p",
              text: "Utöver fria uppgifter finns systemgenererade uppgifter, till exempel automatiskt schemalagd städning efter en utcheckning. Dessa är redan kopplade till objektet och rätt tidsfönster och behöver bara tilldelas en teammedlem.",
            },
            {
              type: "ul",
              items: [
                "Manuell uppgift: fritt registrerad, t.ex. underhåll eller specialönskemål.",
                "Automatisk städuppgift: härledd från utcheckningsdatumet.",
                "Återkommande uppgift: för regelbundna kontroller eller inspektioner.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Detaljer om den automatiska schemaläggningen hittar du under [Städscheman](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Ge precisa titlar — teammedlemmar ser ofta bara titeln och objektet på en blick i den mobila vyn.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Städscheman",
          excerpt: "Låt städning efter utcheckning schemaläggas automatiskt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Ett städschema säkerställer att en städuppgift för det berörda objektet skapas automatiskt efter varje utcheckning — utan att du behöver följa upp varje bokning för sig. Det minskar glömda överlämningar och säkerställer ett tillförlitligt förlopp mellan två vistelser.",
            },
            { type: "h2", text: "Aktivera automatisk schemaläggning" },
            {
              type: "steps",
              items: [
                "Öppna objektet och byt till fliken ”Städning”.",
                "Aktivera ”Schemalägg städning automatiskt efter utcheckning”.",
                "Fastställ hur mycket tid som avsätts för städning efter utcheckningen.",
                "Bestäm valfritt ett standardteam eller en standardstädare.",
                "Spara inställningen.",
              ],
            },
            { type: "h2", text: "Samspel med kalendern" },
            {
              type: "p",
              text: "Så snart en bokning avbokas eller flyttas anpassas den tillhörande städuppgiften automatiskt till det nya utcheckningsdatumet. På så sätt förblir städschemat alltid synkroniserat med det faktiska beläggningsläget.",
            },
            {
              type: "ul",
              items: [
                "Städning skapas automatiskt vid varje utcheckning med aktivt schema.",
                "Flyttas bokningen, flyttas städuppgiften med.",
                "Avbokar gäster vistelsen tas städuppgiften bort.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Utan aktiverat städschema skapas inga automatiska uppgifter — skapa då städningar manuellt under [Skapa uppgifter](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Tilldela uppgifter",
          excerpt: "Fördela uppgifter målinriktat till städare eller teammedlemmar.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "För att en uppgift ska utföras tilldelar du den till en konkret teammedlem — till exempel en städare eller en medarbetare med underhållsansvar. Som standard är det bara den tilldelade personen som ser uppgiften i sin egen översikt.",
            },
            { type: "h2", text: "Tilldela uppgift manuellt" },
            {
              type: "steps",
              items: [
                "Öppna uppgiften i listan ”Uppgifter”.",
                "Klicka på ”Tilldela”.",
                "Välj den ansvariga teammedlemmen från listan.",
                "Bekräfta tilldelningen.",
              ],
            },
            { type: "h2", text: "Tilldelning per objekt" },
            {
              type: "p",
              text: "Är ett objekt redan fast tilldelat en städare kan du låta uppgifter för detta objekt automatiskt tilldelas den personen också. Det sparar klick vid återkommande städningar och minskar antalet frågor.",
            },
            {
              type: "ul",
              items: [
                "Manuell tilldelning: du väljer personen själv per uppgift.",
                "Fast objekttilldelning: nya uppgifter för detta objekt går automatiskt till den angivna personen.",
                "En uppgift har alltid exakt en ansvarig person.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Städare och medarbetare ser uteslutande sina egna tilldelade uppgifter, inga finans- eller försäljningsdata för objektet.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Följa uppgiftsstatus",
          excerpt: "Håll koll på bearbetningsläget för uppgifter i realtid.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Varje uppgift genomgår en tydlig status — från öppen via pågående till avslutad. Så ser du alltid om en städning eller ett underhåll blir klart i tid före nästa incheckning.",
            },
            { type: "h2", text: "Statusöversikt" },
            {
              type: "ul",
              items: [
                "Öppen: uppgiften är skapad men ännu inte påbörjad.",
                "Pågående: den tilldelade personen har påbörjat uppgiften.",
                "Avslutad: uppgiften är utförd och bekräftad.",
              ],
            },
            { type: "h2", text: "Uppdatera status" },
            {
              type: "steps",
              items: [
                "Öppna uppgiften från listan ”Uppgifter”.",
                "Välj rätt status, t.ex. ”Pågående” eller ”Avslutad”.",
                "Lägg vid behov till en kort anteckning, till exempel om avvikelser i objektet.",
                "Spara ändringen.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Statusändringar visas omedelbart i den delade uppgiftslistan — en manuell omladdning behövs inte.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Är en städning fortfarande öppen strax före nästa incheckning, kontrollera först tilldelningen innan du kontaktar gästen.",
            },
          ],
        },
      ],
    },
  ],
};
