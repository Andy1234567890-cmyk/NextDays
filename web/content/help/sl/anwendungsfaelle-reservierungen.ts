import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Rezervacije in koledar",
  description: "Obvladovanje rezervacij in koledarja.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Rezervacije in koledar",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Zanesljivo preprečevanje dvojnih rezervacij",
          excerpt: "Tako zagotovite, da objekt nikoli ni rezerviran dvakrat.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče",
            },
            {
              type: "p",
              text: "Objekt se hkrati prodaja prek več kanalov — portalov, kot so Booking, Airbnb in drugi, lastne platforme ter aplikacije. Dvojna rezervacija nastane, kadar razpoložljivost na enem kanalu ni pravočasno zaprta, potem ko je bila rezervacija opravljena na drugem kanalu.",
            },
            {
              type: "steps",
              items: [
                "V koledarju zasedenosti preverite, da je vsak objekt natanko ena vrstica z eno rezervljivo enoto — ne skupna kapaciteta več sob.",
                "Nove rezervacije ustvarjajte izključno prek koledarja zasedenosti ali povezanih kanalov, nikoli z ročnim vpisovanjem posameznih dni.",
                "Po vsaki rezervaciji preverite, da se rezervirane noči v koledarju takoj prikažejo kot zasedene.",
                "Ob tehničnih težavah ali vzdrževanju takoj uporabite Stop-Sell, namesto da dan pustite odprt.",
                "V primeru nejasnosti preverite časovnico rezervacije zadevne rezervacije, da razumete potek dogodkov.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Nikoli ne spreminjajte noči ali zapor ročno zunaj koledarja zasedenosti — le tako je zagotovljeno, da vsi kanali vidijo isto stanje razpoložljivosti in ne nastane vrzel za dvojno rezervacijo.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Premik rezervacije v drug objekt",
          excerpt: "Tako obstoječo rezervacijo pravilno premaknete na drug objekt.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče",
            },
            {
              type: "p",
              text: "Včasih se mora gost preseliti iz enega objekta v drugega, na primer zaradi tehnične napake ali na željo gosta. Pri premiku se dosedanje koledarske noči samodejno sprostijo in v ciljnem objektu na novo zasedejo.",
            },
            {
              type: "steps",
              items: [
                "Odprite zadevno rezervacijo v časovnici rezervacije.",
                "V akcijskem meniju izberite »Zamenjaj objekt« oz. »Premakni«.",
                "Izberite ciljni objekt in preverite njegovo razpoložljivost v izbranem obdobju.",
                "Potrdite premik.",
                "Nato v koledarju zasedenosti preverite, da so stare noči v izvornem objektu spet prikazane kot razpoložljive.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Sprostitev starih noči samodejno prevzame sistem — izvornega obdobja vam ni treba ročno odpirati. Gosta obvestite o zamenjavi objekta, še posebej če se razlikujeta oprema ali dostop.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Ustvarite dolgoročno rezervacijo",
          excerpt: "Tako pravilno ustvarite rezervacijo za daljše obdobje.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče",
            },
            {
              type: "p",
              text: "Za dolgoročne goste — na primer za več tednov ali mesecev — ustvarite rezervacijo kot običajno, vendar dodatno pazite na minimalno bivanje, pravila plačila in vidnost objekta na kanalih skozi celotno obdobje.",
            },
            {
              type: "steps",
              items: [
                "Odprite koledar zasedenosti želenega objekta in označite celotno obdobje.",
                "Ustvarite rezervacijo s podatki gosta ter načrtovanim datumom prihoda in odhoda.",
                "Po potrebi nastavite pravilo plačila z akontacijo in doplačilom, namesto da bi celoten znesek zahtevali takoj.",
                "Preverite, da nobeno pravilo o najkrajšem ali najdaljšem bivanju ni v nasprotju z dolgim obdobjem.",
                "Shranite rezervacijo in preverite, da je celotno obdobje v koledarju pravilno prikazano kot zasedeno.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Pri zelo dolgih bivanjih je priporočljivo doplačilo razdeliti na več delnih zneskov namesto ene same velike zapadlosti — tako ostane plačilno tveganje obvladljivo. Podrobnosti pod [Avtomatizacija doplačila](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
