import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Lastniki in obračuni",
  description: "Računi lastnikov, obračuni in provizije.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Lastniki",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Ustvarjanje lastnika",
          excerpt: "Tako v myNextDays ustvarite nov račun lastnika.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Lastniki so lastni računi v myNextDays, prek katerih upravljate objekte, ki pripadajo določeni osebi ali družbi. Račun lastnika prejme omejen vpogled samo za branje v svoje lastne objekte, brez možnosti, da bi sam spreminjal nastavitve obrata.",
            },
            { type: "h2", text: "Ustvarjanje novega računa lastnika" },
            {
              type: "steps",
              items: [
                "Odprite razdelek „Lastniki“ v glavnem meniju.",
                "Kliknite „Ustvari novega lastnika“.",
                "Vnesite ime, e-poštni naslov in kontaktne podatke.",
                "Po potrebi navedite naslov za izstavitev računov za obračune.",
                "Shranite račun.",
              ],
            },
            { type: "h2", text: "Nastavitev dostopa" },
            {
              type: "p",
              text: "Po ustvarjanju lahko lastniku pošljete povabilo za lasten dostop. Lastnik se nato prijavi z lastnimi podatki za dostop in vidi izključno njemu dodeljene objekte.",
            },
            {
              type: "ul",
              items: [
                "Račun lastnika lahko vključuje več objektov.",
                "Vsak objekt pripada natanko enemu lastniku.",
                "Kontaktne podatke in naslov za izstavitev računov je mogoče kadar koli naknadno prilagoditi.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kako obstoječi objekt dodelite lastniku, preberite pod [Dodelitev objekta lastniku](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Dodelitev objekta lastniku",
          excerpt: "Vsak objekt pripada natanko enemu lastniku — tako nastavite dodelitev.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "V myNextDays vsak objekt pripada natanko enemu lastniku. Večkratna dodelitev ni predvidena — če naj objekt pripada drugemu lastniku, najprej razveljavite obstoječo dodelitev, preden nastavite novo.",
            },
            { type: "h2", text: "Izvedba dodelitve" },
            {
              type: "steps",
              items: [
                "Odprite objekt pod „Objekti“.",
                "Preklopite na zavihek „Lastnik“.",
                "S seznama izberite pristojnega lastnika.",
                "Potrdite dodelitev.",
                "Shranite spremembo pri objektu.",
              ],
            },
            { type: "h2", text: "Zamenjava lastnika" },
            {
              type: "p",
              text: "Če se lastnik objekta spremeni, na primer zaradi prodaje, obstoječo dodelitev nadomestite z novo. Že ustvarjeni obračuni za pretekla obdobja pri tem ostanejo dodeljeni prvotnemu lastniku.",
            },
            {
              type: "ul",
              items: [
                "Objekt je lahko v vsakem trenutku dodeljen le enemu lastniku.",
                "Brez dodelitve se objekt ne prikaže v nobenem dostopu za lastnike.",
                "Pretekli obračuni ostanejo pri prvotnem lastniku.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Večkratna dodelitev objekta več lastnikom je izključena — sistem ne dopušča druge sočasne dodelitve.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Obračun za lastnika (Statement)",
          excerpt: "Tako za lastnika ustvarite obračun s prihodki, zmanjšanimi za provizijo.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Obračun za lastnika, imenovan tudi statement, za izbrano obdobje združi vse prihodke dodeljenih objektov in odšteje vašo dogovorjeno provizijo. Rezultat je znesek, ki ga izplačate lastniku.",
            },
            { type: "h2", text: "Ustvarjanje obračuna" },
            {
              type: "steps",
              items: [
                "Odprite razdelek „Lastniki“ in izberite želenega lastnika.",
                "Preklopite na zavihek „Obračun“.",
                "Izberite obračunsko obdobje.",
                "Preverite navedene rezervacije in prihodke po objektih.",
                "Ustvarite obračun z odšteto provizijo.",
              ],
            },
            { type: "h2", text: "Zgradba obračuna" },
            {
              type: "p",
              text: "Obračun za vsak objekt navaja bruto prihodke iz rezervacij, od njih odšteto provizijo in iz tega izhajajoč znesek izplačila. Dodatni stroški, kot so čiščenje ali pristojbine, se lahko glede na dogovor prikažejo ločeno.",
            },
            {
              type: "ul",
              items: [
                "Bruto prihodki: vsota vseh rezervacij v obdobju po objektu.",
                "Provizija: vaš dogovorjeni delež, se odšteje od prihodkov.",
                "Znesek izplačila: prihodki, zmanjšani za provizijo in po potrebi druge postavke.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Zneski v obračunu se vedno izkazujejo v valuti objekta — ni enotnega splošnega privzetega izpada valute.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Obračune ustvarjajte redno na isti presečni datum, da imajo lastniki zanesljiv ritem za svoja izplačila.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Dostop za lastnike",
          excerpt: "Kaj lahko lastniki vidijo v svojem dostopu samo za branje.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Dostop za lastnike je lastna prijava v myNextDays samo za branje. Lastniki v njej vidijo izključno njim dodeljene objekte ter pripadajočo zasedenost in obračune — brez možnosti, da bi sami spreminjali nastavitve.",
            },
            { type: "h2", text: "Kaj lastniki vidijo" },
            {
              type: "ul",
              items: [
                "Koledar zasedenosti svojih lastnih objektov.",
                "Ustvarjene obračune s prihodki in odšteto provizijo.",
                "Osnovne podatke svojih objektov, na primer opremo in opis.",
              ],
            },
            { type: "h2", text: "Aktiviranje dostopa" },
            {
              type: "steps",
              items: [
                "Odprite lastnika pod „Lastniki“.",
                "Kliknite „Povabi na dostop“.",
                "Lastnik prejme e-pošto za nastavitev lastnega gesla.",
                "Po prijavi lastnik samodejno vidi le njemu dodeljene objekte.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dostop za lastnike je strogo samo za branje: cene, razpoložljivosti ali podatke objekta lahko spreminjate le vi kot obrat, ne lastnik sam.",
            },
            {
              type: "note",
              variant: "info",
              text: "Več o dodeljevanju objektov najdete pod [Dodelitev objekta lastniku](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
