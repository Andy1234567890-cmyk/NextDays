import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Ägare och redovisningar",
  description: "Ägarkonton, redovisningar och provisioner.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Ägare",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Skapa ägare",
          excerpt: "Så skapar du ett nytt ägarkonto i myNextDays.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Ägare är egna konton i myNextDays som du använder för att förvalta objekt som tillhör en viss person eller ett bolag. Ett ägarkonto får en begränsad, skrivskyddad inblick i sina egna objekt, utan att själv kunna göra ändringar i verksamheten.",
            },
            { type: "h2", text: "Skapa nytt ägarkonto" },
            {
              type: "steps",
              items: [
                "Öppna avsnittet ”Ägare” i huvudmenyn.",
                "Klicka på ”Skapa ny ägare”.",
                "Ange namn, e-postadress och kontaktuppgifter.",
                "Ange vid behov fakturaadressen för redovisningar.",
                "Spara kontot.",
              ],
            },
            { type: "h2", text: "Ställa in åtkomst" },
            {
              type: "p",
              text: "Efter skapandet kan du skicka en inbjudan till ägaren för egen åtkomst. Ägaren loggar sedan in med egna inloggningsuppgifter och ser uteslutande de objekt som tilldelats hen.",
            },
            {
              type: "ul",
              items: [
                "Ett ägarkonto kan omfatta flera objekt.",
                "Varje objekt tillhör exakt en ägare.",
                "Kontaktuppgifter och fakturaadress kan alltid justeras i efterhand.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Hur du kopplar ett befintligt objekt till en ägare läser du under [Koppla objekt till en ägare](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Koppla objekt till en ägare",
          excerpt: "Varje objekt tillhör exakt en ägare — så ställer du in kopplingen.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "I myNextDays tillhör varje objekt exakt en ägare. En flerdubbel tilldelning är inte avsedd — ska ett objekt tillhöra en annan ägare, tar du först bort den befintliga kopplingen innan du sätter en ny.",
            },
            { type: "h2", text: "Göra kopplingen" },
            {
              type: "steps",
              items: [
                "Öppna objektet under ”Objekt”.",
                "Byt till fliken ”Ägare”.",
                "Välj den ansvariga ägaren från listan.",
                "Bekräfta kopplingen.",
                "Spara ändringen på objektet.",
              ],
            },
            { type: "h2", text: "Byte av ägare" },
            {
              type: "p",
              text: "Ändras ägaren för ett objekt, till exempel genom en försäljning, ersätter du den befintliga kopplingen med den nya. Redan skapade redovisningar för tidigare perioder förblir kopplade till den ursprungliga ägaren.",
            },
            {
              type: "ul",
              items: [
                "Ett objekt kan vid varje given tidpunkt bara vara kopplat till en ägare.",
                "Utan koppling visas objektet i ingen ägaråtkomst.",
                "Tidigare redovisningar förblir hos den ursprungliga ägaren.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "En flerdubbel koppling av ett objekt till flera ägare är utesluten — systemet tillåter inte en andra samtidig koppling.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Ägarredovisning (statement)",
          excerpt: "Så skapar du ett statement med intäkter efter avdragen provision för en ägare.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Ägarredovisningen, även kallad statement, sammanfattar alla intäkter för de tilldelade objekten under en vald period och drar av din överenskomna provision. Resultatet är det belopp du betalar ut till ägaren.",
            },
            { type: "h2", text: "Skapa statement" },
            {
              type: "steps",
              items: [
                "Öppna avsnittet ”Ägare” och välj önskad ägare.",
                "Byt till fliken ”Redovisning”.",
                "Välj redovisningsperiod.",
                "Kontrollera de listade bokningarna och intäkterna per objekt.",
                "Låt statementet skapas med avdragen provision.",
              ],
            },
            { type: "h2", text: "Statementets uppbyggnad" },
            {
              type: "p",
              text: "Ett statement listar per objekt bruttointäkterna från bokningar, den avdragna provisionen och det resulterande utbetalningsbeloppet. Tilläggskostnader som städning eller avgifter kan, beroende på överenskommelse, redovisas separat.",
            },
            {
              type: "ul",
              items: [
                "Bruttointäkter: summan av alla bokningar under perioden per objekt.",
                "Provision: din överenskomna andel, dras av från intäkterna.",
                "Utbetalningsbelopp: intäkter minus provision och eventuella ytterligare poster.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Belopp i statementet visas alltid i objektets valuta — det finns ingen schablonmässig valuta-fallback.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Skapa statement regelbundet på samma stickdatum, så att ägare får en tillförlitlig rytm för sina utbetalningar.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Ägaråtkomst",
          excerpt: "Vad ägare kan se i sin skrivskyddade åtkomst.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Ägaråtkomsten är en egen, skrivskyddad inloggning för myNextDays. Ägare ser där uteslutande de objekt som tilldelats dem samt tillhörande beläggningar och redovisningar — utan möjlighet att själva ändra inställningar.",
            },
            { type: "h2", text: "Vad ägare ser" },
            {
              type: "ul",
              items: [
                "Beläggningskalender för sina egna objekt.",
                "Skapade statement med intäkter och avdragen provision.",
                "Grunddata för sina objekt, till exempel utrustning och beskrivning.",
              ],
            },
            { type: "h2", text: "Aktivera åtkomst" },
            {
              type: "steps",
              items: [
                "Öppna ägaren under ”Ägare”.",
                "Klicka på ”Bjud in till åtkomst”.",
                "Ägaren får ett e-postmeddelande för att ställa in sitt eget lösenord.",
                "Efter inloggningen ser ägaren automatiskt bara sina tilldelade objekt.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ägaråtkomsten är strikt skrivskyddad: priser, tillgänglighet eller objektdata kan bara du som verksamhet ändra, inte ägaren själv.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mer om koppling av objekt hittar du under [Koppla objekt till en ägare](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
