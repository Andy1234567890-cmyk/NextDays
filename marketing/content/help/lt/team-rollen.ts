import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Komanda ir teisės",
  description: "Darbuotojai, vaidmenys ir prieigos teisės.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Prieiga",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Darbuotojo kvietimas",
          excerpt: "Kaip pakviesti naujus darbuotojus į savo myNextDays paskyrą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Į savo įmonę galite pakviesti bet kokį skaičių darbuotojų — pavyzdžiui, registratūrai, valymui ar administravimui. Kiekvienas kvietimas susietas su el. pašto adresu ir iš karto suteikia fiksuotą vaidmenį, kuris nustato prieigą internete ir myNextDays programėlėje.",
            },
            { type: "h2", text: "Kvietimo siuntimas" },
            {
              type: "steps",
              items: [
                "Atidarykite „Paskyra“ ir pereikite į skyrių „Komanda“.",
                "Spustelėkite „Pakviesti darbuotoją“.",
                "Įveskite asmens el. pašto adresą.",
                "Pasirinkite tinkamą vaidmenį, pvz., darbuotojas arba valytojas.",
                "Patvirtinkite kvietimą.",
              ],
            },
            { type: "h2", text: "Kas vyksta po to" },
            {
              type: "p",
              text: "Pakviestas asmuo gauna el. laišką su nuoroda susikurti savo slaptažodį ir prisijungti. Prisijungimas galioja vienodai internetiniam skydeliui ir myNextDays programėlei — atskiros paskyros kiekvienam frontendui nėra.",
            },
            {
              type: "ul",
              items: [
                "Kvietimas galioja tol, kol jis priimamas arba atšaukiamas.",
                "Neišspręstus kvietimus matote skyriuje „Komanda“ su būsena „Laukiama“.",
                "Vaidmenį bet kada galima vėliau pakoreguoti.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kurios sritys matomos kuriam vaidmeniui, sužinosite skyriuje [Vaidmenys ir teisės](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Nuo pat pradžių suteikite siauriausią tinkamą vaidmenį — teises bet kada vėliau galima išplėsti.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Vaidmenys ir teisės",
          excerpt: "Penki myNextDays vaidmenys ir ką kiekvienas gali daryti.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "myNextDays skiria penkis vaidmenis: administratorius, bendraadministratorius, darbuotojas, valytojas ir savininkas. Kiekvienas vaidmuo nustato, kurios sritys matomos internetiniame skydelyje ir myNextDays programėlėje — teisės tikrinamos serverio pusėje, o ne tik paslepiamos sąsajoje.",
            },
            { type: "h2", text: "Vaidmenų apžvalga" },
            {
              type: "ul",
              items: [
                "Administratorius: pilna prieiga prie visų sričių, įskaitant finansus, pardavimus ir komandos valdymą.",
                "Bendraadministratorius: beveik tokia pati prieiga kaip administratoriaus, skirta antram įmonės vadovybės lygiui.",
                "Darbuotojas: operatyvinė prieiga prie rezervacijų, kalendoriaus ir užduočių, be finansų ar pardavimų matomumo.",
                "Valytojas: prieiga išimtinai prie priskirtų valymo užduočių ir objekto duomenų, be finansų ar pardavimų matomumo.",
                "Savininkas: tik skaitymo prieiga prie savo objektų, be teisės valdyti svetimus objektus.",
              ],
            },
            { type: "h2", text: "Vaidmens priskyrimas ar keitimas" },
            {
              type: "steps",
              items: [
                "Atidarykite „Paskyra“ → „Komanda“.",
                "Iš sąrašo pasirinkite atitinkamą darbuotoją.",
                "Spustelėkite „Keisti vaidmenį“.",
                "Pasirinkite naują vaidmenį ir patvirtinkite.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Darbuotojai ir valytojai iš principo nemato kainų, apyvartos ar rezervacijų kanalų — šis apribojimas taikomas serverio pusėje ir jo apeiti per sąsają negalima.",
            },
            {
              type: "note",
              variant: "info",
              text: "Apžvalgą pagal vaidmenį rasite skyriuje [Ką mato kiekvienas vaidmuo](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Ką mato kiekvienas vaidmuo",
          excerpt: "Konkrečios sritys ir vaizdai kiekvienam vaidmeniui internete ir programėlėje.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Be pagrindinių teisių, aprašytų skyriuje [Vaidmenys ir teisės](/hilfe/team-rollen/rollen-berechtigungen), konkretus atskirų sričių žvilgsnis padeda naujų darbuotojų įtraukimo metu suformuoti teisingus lūkesčius.",
            },
            { type: "h2", text: "Kalendorius ir rezervacijos" },
            {
              type: "p",
              text: "Administratorius, bendraadministratorius ir darbuotojas mato visą užimtumo planą su svečio duomenimis ir užduotimis. Valytojas mato tik jam priskirtus terminus kartu su objekto adresu ir kontroliniu sąrašu, tačiau ne svečių vardus ar kainas. Savininkai mato užimtumo kalendorių išimtinai savo objektams, tik skaitymo režimu.",
            },
            { type: "h2", text: "Finansai ir pardavimai" },
            {
              type: "ul",
              items: [
                "Apyvarta, komisiniai mokesčiai ir sąskaitos: tik administratorius ir bendraadministratorius.",
                "Portalai (OTA prijungimas) ir platformos matomumas: tik administratorius ir bendraadministratorius.",
                "Darbuotojas ir valytojas: jokios prieigos prie finansų ar pardavimų sričių, taip pat ir prie detalių puslapių.",
              ],
            },
            { type: "h2", text: "Komanda ir nustatymai" },
            {
              type: "p",
              text: "Darbuotojų, vaidmenų ir paskyros nustatymų valdymas priklauso tik administratoriui ir bendraadministratoriui. Savininkai ir operatyviniai vaidmenys šios srities myNextDays programėlėje ir internetiniame skydelyje visai nemato.",
            },
            {
              type: "note",
              variant: "info",
              text: "Šis paskirstymas vienodai galioja internetiniame skydelyje ir myNextDays programėlėje, nes abu frontendai tikrina tą patį vaidmenį iš jūsų paskyros.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Po pakvietimo trumpai kartu su darbuotoju išbandykite naują vaidmenį, kad išvengtumėte nesusipratimų dėl matomų sričių.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Prieigos atėmimas",
          excerpt: "Iš karto ir visiškai pašalinti darbuotojo prieigą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Jei darbuotojas palieka jūsų įmonę arba pasikeičia bendradarbiavimas, pašalinkite prieigą tiesiogiai paskyroje. Atėmimas veikia serverio pusėje ir iš karto — ne tik pasibaigus esamai sesijai.",
            },
            { type: "h2", text: "Prieigos pašalinimas" },
            {
              type: "steps",
              items: [
                "Atidarykite „Paskyra“ → „Komanda“.",
                "Pasirinkite atitinkamą darbuotoją.",
                "Spustelėkite „Atimti prieigą“.",
                "Patvirtinkite veiksmą.",
              ],
            },
            { type: "h2", text: "Poveikis vykstančioms sesijoms" },
            {
              type: "p",
              text: "Po atėmimo asmuo nebegali iš naujo prisijungti nei internetiniame skydelyje, nei myNextDays programėlėje. Jau priskirtas užduotis ar valymo terminus turėtumėte iš anksto priskirti kitam darbuotojui, kad niekas neliktų neatlikta.",
            },
            {
              type: "ul",
              items: [
                "Prieš atimant prieigą, iš naujo priskirti atviras užduotis.",
                "Prieigą vėliau galima atkurti pakartotiniu kvietimu.",
                "Atėmimas paveikia tik šią įmonę, o ne kitas asmens paskyras.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Atimkite prieigą greitai, kai tik pasibaigia bendradarbiavimas — kitaip atviros darbuotojų paskyros lieka nereikalinga saugumo rizika.",
            },
          ],
        },
      ],
    },
  ],
};
