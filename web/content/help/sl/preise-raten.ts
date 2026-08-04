import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Cene in tarife",
  description: "Cenovni načrti, sezonske cene in dinamične cene.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Oblikovanje cen",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Osnovna cena in valuta",
          excerpt: "Tako določite osnovno ceno in svojemu objektu dodelite pravilno valuto.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Vsak objekt v myNextDays je natanko ena rezervljiva enota — ena sama soba ali počitniški objekt. Za to enoto določite osnovno ceno ter osrednjo valuto, ki velja za celoten objekt.",
            },
            { type: "h2", text: "Centralna določitev valute" },
            {
              type: "p",
              text: "Valuta objekta se nastavi enkrat na objekt in samodejno velja za vse cenovne načrte, ki jih za ta objekt ustvarite. Ločenega privzetega izpada valute ni — če valuta manjka, cen ni mogoče shraniti.",
            },
            {
              type: "steps",
              items: [
                "Odprite svoj objekt pod „Objekti“.",
                "Preklopite na zavihek „Cene“.",
                "Pod „Valuta objekta“ izberite ustrezno valuto.",
                "Vnesite osnovno ceno za standardno zasedenost.",
                "Shranite spremembe.",
              ],
            },
            { type: "h2", text: "Kaj se zgodi ob spremembi valute" },
            {
              type: "p",
              text: "Če naknadno spremenite valuto objekta, to vpliva na vse obstoječe cenovne načrte tega objekta, saj se ti vedno vodijo v valuti objekta. Nato preverite svoje cene, preden jih znova prenesete na portale.",
            },
            {
              type: "ul",
              items: [
                "Objekt ima natanko eno valuto — ne več po posameznem cenovnem načrtu.",
                "Osnovna cena je izhodiščna vrednost za izpeljane tarife.",
                "Zneski se vedno prikazujejo v nastavljeni valuti objekta.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Brez nastavljene valute ni mogoče shraniti nobene cene niti prenesti nobene tarife na portale. To najprej preverite, če sprememba cene ne uspe.",
            },
            {
              type: "note",
              variant: "info",
              text: "Več o izpeljanih cenah najdete pod [Izpeljane tarife](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Ustvarjanje cenovnih načrtov",
          excerpt: "Cenovni načrti združujejo ceno, pogoje odpovedi in prehrano za objekt.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Cenovni načrt določa, pod kakšnimi pogoji je mogoče objekt rezervirati: ceno, pravila odpovedi, prehrano in najkrajše bivanje. Objekt lahko hkrati ponuja več cenovnih načrtov, na primer prilagodljivega in nepreklicnega.",
            },
            { type: "h2", text: "Ustvarjanje novega cenovnega načrta" },
            {
              type: "steps",
              items: [
                "Odprite objekt in preklopite na zavihek „Cene“.",
                "Kliknite „Ustvari nov cenovni načrt“.",
                "Izberite razumljivo ime, npr. „Prilagodljivo“ ali „Nepreklicno“.",
                "Določite, ali je načrt osnovna tarifa ali izpeljana tarifa.",
                "Navedite pogoje odpovedi in prehrano.",
                "Shranite in aktivirajte cenovni načrt.",
              ],
            },
            { type: "h2", text: "Osnovna tarifa proti dodatnim cenovnim načrtom" },
            {
              type: "p",
              text: "Najprej ustvarite osnovno tarifo (pogosto imenovano „BAR“, Best Available Rate). Vsi dodatni cenovni načrti so lahko bodisi samostojno urejeni bodisi izpeljani iz te osnovne tarife.",
            },
            {
              type: "ul",
              items: [
                "Osnovna tarifa: ročno urejena osnovna cena na noč.",
                "Dodatni cenovni načrti: samostojni ali kot doplačilo/popust na osnovno tarifo.",
                "Vsak cenovni načrt je mogoče posamično prenesti na portale.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Število cenovnih načrtov na objekt ohranjajte obvladljivo — preveč različic gostom otežuje primerjavo in povečuje delo pri urejanju.",
            },
            {
              type: "note",
              variant: "info",
              text: "Podrobnosti o doplačilih in popustih najdete pod [Izpeljane tarife](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Izpeljane tarife",
          excerpt: "Izpeljani cenovni načrti se samodejno izračunajo iz osnovne tarife.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Izpeljana tarifa je cenovni načrt, katerega cena se ne ureja ročno, temveč se samodejno izračuna iz osnovne tarife — kot fiksno doplačilo, popust ali odstotek. To zmanjša delo pri urejanju, saj sprememba cene pri osnovni tarifi samodejno posodobi vse izpeljane načrte.",
            },
            { type: "h2", text: "Tipičen primer" },
            {
              type: "p",
              text: "Pogost vzorec je načrt z zajtrkom, izpeljan iz osnovne tarife brez prehrane: cena zajtrka je določena kot doplačilo na noč in osebo na osnovno tarifo. Če spremenite osnovno tarifo, se cena zajtrka samodejno prilagodi.",
            },
            { type: "h2", text: "Nastavitev izpeljane tarife" },
            {
              type: "steps",
              items: [
                "Odprite želeni cenovni načrt v zavihku „Cene“.",
                "Kot vir cene izberite „Izpeljano iz …“ in ustrezno osnovno tarifo.",
                "Določite, ali razlika velja kot fiksni znesek ali kot odstotek.",
                "Določite, ali gre za doplačilo ali popust.",
                "Shranite dodelitev.",
              ],
            },
            {
              type: "ul",
              items: [
                "Doplačilo: npr. prehrana, poznejša možnost odpovedi.",
                "Popust: npr. nepreklicen načrt s cenovno ugodnostjo.",
                "Osnovna tarifa ostaja edini ročno urejan vir.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Izpeljane tarife ni mogoče hkrati ročno preglasiti. Najprej prekinite izpeljavo, če želite posamezno ceno določiti drugače.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Sezonske in vikend cene",
          excerpt: "Ciljno prilagajanje cen za sezonska obdobja in vikende.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Povpraševanje niha čez leto in znotraj tedna. S sezonskimi in vikend cenami prilagodite osnovno ceno za določena obdobja ali dneve v tednu, ne da bi morali za vsak dan posebej v koledar.",
            },
            { type: "h2", text: "Ustvarjanje sezonskega obdobja" },
            {
              type: "steps",
              items: [
                "Pri objektu odprite zavihek „Cene“ in razdelek „Sezonske cene“.",
                "Ustvarite novo obdobje z datumom začetka in konca.",
                "Navedite ceno ali odstotno odstopanje od osnovne cene za to obdobje.",
                "Shranite sezonsko obdobje.",
              ],
            },
            { type: "h2", text: "Vikend cene" },
            {
              type: "p",
              text: "Poleg tega lahko posamezne dni v tednu, na primer petek in soboto, opremite z lastnim doplačilom. To doplačilo velja dodatno k trenutno veljavni sezonski ali osnovni ceni.",
            },
            {
              type: "ul",
              items: [
                "Sezonske cene veljajo za strnjena obdobja.",
                "Vikend cene veljajo po posameznem dnevu v tednu, neodvisno od sezone.",
                "Obe pravili je mogoče kombinirati.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Če se prekriva več sezonskih obdobij, velja nazadnje ustvarjeno oz. najbolj specifično pravilo. Po shranjevanju preverite koledar.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Za samodejne prilagoditve, temelječe na povpraševanju, so dodatno primerne [Dinamične cene](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Dinamične cene",
          excerpt: "Samodejno prilagajanje cen povpraševanju, predčasnosti rezervacije in zasedenosti.",
          updated: "Posodobljeno: avgust 2026",
          body: [
            {
              type: "note",
              variant: "info",
              text: "Dinamične cene so plačljiv dodatni modul. Naročite ga v razdelku »Razširitve«, kjer je navedena tudi cena. Brez modula samodejni izračun ne deluje.",
            },
            {
              type: "p",
              text: "Dinamične cene samodejno prilagodijo osnovno ceno glede na dejavnike, kot so predčasnost rezervacije, trenutna zasedenost in povpraševanje — podobno kot to počnejo veliki portali pri svojih lastnih cenovnih priporočilih. Tako se odzovete na spremembe na trgu, ne da bi vsak dan ročno prilagajali.",
            },
            { type: "h2", text: "Aktiviranje dinamičnih cen" },
            {
              type: "steps",
              items: [
                "Modul naročite v „Orodja → Razširitve“ — brez modula samodejni izračun ne teče.",
                "V glavnem meniju odprite „Distribucija → Dinamične cene“.",
                "V razpredelnici objektov kliknite ikono svinčnika pri želenem objektu („Določi osnovno ceno“).",
                "Izberite strategijo osnovne cene: na podlagi podatkov ali fiksno osnovno ceno.",
                "Določite najnižjo in najvišjo ceno ter v polju „Občutljivost na zasedenost (%)“ nastavite, kako močno vpliva zasedenost.",
                "Vklopite „Dinamične cene aktivne“ in shranite.",
              ],
            },
            { type: "h2", text: "Meje in varnost" },
            {
              type: "p",
              text: "Spodnja in zgornja meja cene preprečita, da bi samodejni algoritem določil cene, ki za vaš obrat niso sprejemljive. Izpeljani cenovni načrti samodejno sledijo dinamično izračunani osnovni tarifi.",
            },
            {
              type: "ul",
              items: [
                "Spodnja meja cene ščiti pred prenizkimi cenami ob šibkem povpraševanju.",
                "Zgornja meja cene ščiti pred pretiranimi cenami ob visokem povpraševanju.",
                "Izpeljane tarife samodejno prevzamejo novo osnovno tarifo.",
                "Dnevna cena, ročno nastavljena v koledarju, ima vedno prednost pred samodejnim izračunom.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dinamične cene vplivajo samo na osnovno tarifo. Ročno trdno nastavljeni cenovni načrti brez izpeljave se ne spremenijo samodejno.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Popusti za dolžino bivanja",
          excerpt: "Nastavitev popustov za daljša bivanja in zgodnje rezervacije.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Popusti za dolžino bivanja nagradijo goste za daljše rezervacije ali zgodnje rezerviranje. Uporabijo se kot odstotek celotne cene bivanja in jih je mogoče neodvisno konfigurirati po posameznem objektu.",
            },
            { type: "h2", text: "Vrste popustov" },
            {
              type: "ul",
              items: [
                "Popust za dolgo bivanje: od določenega števila noči, npr. od 7 ali 28 noči.",
                "Popust za zgodnjo rezervacijo: pri rezervaciji dovolj zgodaj vnaprej.",
                "Popust za rezervacijo v zadnjem trenutku: pri kratkoročni rezervaciji blizu datuma prihoda.",
              ],
            },
            { type: "h2", text: "Nastavitev popusta" },
            {
              type: "steps",
              items: [
                "Pri objektu odprite zavihek „Cene“ in razdelek „Popusti“.",
                "Izberite želeno vrsto popusta.",
                "Določite prag, npr. najmanjše število noči ali predčasnost.",
                "Vnesite popust v odstotkih.",
                "Shranite pravilo.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Popusti veljajo za celotno ceno posameznega cenovnega načrta in so gostu prikazani že v pregledu cen.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Popuste za dolgo bivanje kombinirajte z [Najkrajše in najdaljše bivanje](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt), da ciljno spodbudite daljše rezervacije.",
            },
          ],
        },
      ],
    },
  ],
};
