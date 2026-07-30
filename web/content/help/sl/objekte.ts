import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Objekti in oprema",
  description: "Ustvarjanje in urejanje sob ter počitniških objektov.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Upravljanje objektov",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Objekt = ena rezervljiva enota",
          excerpt: "Zakaj je vsak objekt v myNextDays natanko ena rezervljiva enota.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "V myNextDays je objekt vedno natanko ena rezervljiva enota — ena sama soba v hotelu ali celoten počitniški objekt. To načelo velja ne glede na to, ali upravljate počitniško hišo, počitniško stanovanje ali hotel, in je temelj za razpoložljivost, cene in rezervacije.",
            },
            { type: "h2", text: "Ne stavba s sobami pod njo" },
            {
              type: "p",
              text: "Pogosta zmota je, da hotelsko stavbo prikažete kot en objekt z več sobami pod njim. To v myNextDays ni predvideno. Če upravljate na primer hotel z osmimi dvoposteljnimi in štirimi enoposteljnimi sobami, ustvarite dvanajst posameznih objektov — ne enega objekta s številom sob.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Polja, kot je „število sob“, na ravni objekta zavestno ni. Vsaka soba potrebuje svoj objekt z lastnim koledarjem in lastnimi cenami.",
            },
            { type: "h2", text: "Počitniški objekti" },
            {
              type: "p",
              text: "Pri počitniški hiši ali počitniškem stanovanju celoten objekt ustreza rezervljivi enoti. Tu ni nadaljnje delitve — počitniški objekt je vedno samostojen objekt z lastnim koledarjem.",
            },
            { type: "h2", text: "Zakaj je to pomembno" },
            {
              type: "ul",
              items: [
                "Vsak objekt ima lasten koledar razpoložljivosti — dvojne rezervacije so preprečene natančno po objektih.",
                "Cene, oprema in fotografije veljajo za posamezen objekt, ne za stavbo.",
                "Objekt vedno pripada natanko enemu lastniku — brez večkratne dodelitve.",
                "Vidnost na kanalih (spletna stran, tržnica platforme, portali) se upravlja po posameznem objektu.",
              ],
            },
            {
              type: "p",
              text: "Kako izberete ustrezen tip objekta za svojo sobo ali počitniški objekt, preberite pod [Določanje tipa objekta](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Določanje tipa objekta",
          excerpt: "Pravilna dodelitev kategorije, tipa nepremičnine in vrste ponudbe.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Tip objekta določa, kako je vaš objekt uvrščen in filtriran na portalih in tržnici platforme. Sestavljajo ga tri medsebojno odvisna izbirna polja, ki jih izpolnite pri ustvarjanju ali urejanju objekta.",
            },
            { type: "h2", text: "Tri ravni izbire" },
            {
              type: "steps",
              items: [
                "Najprej izberite kategorijo — na primer počitniška nastanitev ali hotel.",
                "Nato izberite tip nepremičnine — na primer počitniško stanovanje, počitniško hišo, dvoposteljno ali enoposteljno sobo.",
                "Izberite vrsto ponudbe — na primer celoten objekt ali zasebno sobo.",
                "Dopolnite dodatna polja, ki se prikažejo glede na izbiro, na primer tip postelje ali nadstropje.",
              ],
            },
            { type: "h2", text: "Zakaj je vrstni red pomemben" },
            {
              type: "p",
              text: "Trije spustni seznami so medsebojno odvisni: izbira kategorije omeji razpoložljive tipe nepremičnin, izbira tipa nepremičnine pa nato vrste ponudb. Tako nastanejo le smiselne kombinacije, kakršne se uporabljajo tudi na velikih portalih.",
            },
            {
              type: "note",
              variant: "info",
              text: "Če naknadno spremenite kategorijo, myNextDays preveri, ali tip nepremičnine in vrsta ponudbe še vedno ustrezata, in vas po potrebi pozove k ponovni izbiri.",
            },
            { type: "h2", text: "Urejanje tipa objekta" },
            {
              type: "p",
              text: "V meniju Objekti odprite želeni objekt in preklopite na zavihek Osnovni podatki. Tam najdete tri spustne sezname pod Tip objekta. Ko shranite spremembo, se nova uvrstitev posreduje vsem aktivnim kanalom.",
            },
            {
              type: "ul",
              items: [
                "Kategorija: nadrejena uvrstitev (npr. počitniška nastanitev, hotel)",
                "Tip nepremičnine: konkreten tip objekta (npr. počitniško stanovanje, dvoposteljna soba)",
                "Vrsta ponudbe: kaj natanko se rezervira (npr. celoten objekt, zasebna soba)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Urejanje opreme",
          excerpt: "Izbira in ažurnost lastnosti opreme.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Oprema objekta bistveno vpliva na to, kako dobro je objekt najden in filtriran na portalih. Gostje ciljno filtrirajo po lastnostih, kot so WLAN, kuhinja ali parkirišče — manjkajoči podatki lahko objekt izključijo iz rezultatov iskanja.",
            },
            { type: "h2", text: "Izbira opreme" },
            {
              type: "steps",
              items: [
                "Odprite objekt in preklopite na zavihek Oprema.",
                "Izberite vse ustrezne lastnosti s podanega seznama.",
                "Po potrebi dopolnite podrobnosti, kot je število parkirnih mest ali vrsta kuhinje.",
                "Shranite spremembe — samodejno se posredujejo vsem aktivnim portalom.",
              ],
            },
            { type: "h2", text: "Od kod izvirajo lastnosti" },
            {
              type: "p",
              text: "Seznam opreme sledi katalogu lastnosti velikih portalov, da se vaši podatki tam pravilno uvrstijo. Lastnih, prosto izmišljenih lastnosti ni predvideno, ker jih ne bi bilo mogoče čisto prenesti na portale.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Opremo preverite po vsaki gradbeni spremembi — na primer novi klimatski napravi ali dodatni kopalnici — da podatki na vseh kanalih ostanejo ažurni.",
            },
            { type: "h2", text: "Pogoste skupine lastnosti" },
            {
              type: "ul",
              items: [
                "Osnovna oprema: WLAN, ogrevanje, klimatska naprava",
                "Kuhinja in prehrana: popolnoma opremljena kuhinja, pomivalni stroj, kavni aparat",
                "Kopalnica in perilo: lastna kopalnica, pralni stroj, brisače",
                "Zunanji prostor: balkon, terasa, vrt, parkirišče",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Fotografije in opis",
          excerpt: "Prepričljive slike in besedila za več rezervacij.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Fotografije in opis so za goste najpomembnejša podlaga za odločitev. Objekt je mogoče objaviti šele, ko sta navedena vsaj ena naslovna fotografija in opis.",
            },
            { type: "h2", text: "Nalaganje fotografij" },
            {
              type: "steps",
              items: [
                "Odprite objekt in preklopite na zavihek Fotografije.",
                "Slikovne datoteke povlecite v območje za nalaganje ali jih izberite prek okna za izbiro datotek.",
                "Določite naslovno fotografijo — prikaže se v rezultatih iskanja in kartičnih pregledih.",
                "Preostale fotografije razvrstite z vlečenjem v smiseln vrstni red.",
              ],
            },
            { type: "h2", text: "Pisanje opisa" },
            {
              type: "p",
              text: "Preklopite na zavihek Opis in vnesite naslov ter besedilo. Konkretno opišite lokacijo, posebnosti in ciljno skupino objekta — splošne fraze delujejo na portalih manj prepričljivo kot oprijemljivi podatki.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Fotografij drugih objektov ali s spleta ni dovoljeno uporabljati — portali to preverjajo in lahko ob kršitvah objekte zaprejo.",
            },
            { type: "h2", text: "Priporočila za dobre fotografije" },
            {
              type: "ul",
              items: [
                "Vsaj pet fotografij, v idealnem primeru po eno za vsak prostor",
                "Ležeč format, dobra osvetlitev, brez vodnih žigov",
                "Naslovna fotografija čim bolj privlačno in nedvoumno prikaže objekt",
                "Redno posodabljanje, zlasti po prenovah",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Zasedenost in kapaciteta",
          excerpt: "Pravilna navedba največjega števila gostov in razporeditve postelj.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Zasedenost določa, koliko gostov lahko objekt sprejme, in se preverja pri vsakem iskanju in rezervaciji. Napačni podatki vodijo bodisi do zavrnjenih povpraševanj bodisi do prezasedenosti — obojemu se je treba izogniti.",
            },
            { type: "h2", text: "Vnos zasedenosti" },
            {
              type: "steps",
              items: [
                "Odprite objekt in preklopite na zavihek Zasedenost.",
                "Vnesite največje število odraslih.",
                "Vnesite največje število otrok, če so dovoljeni.",
                "Navedite razporeditev postelj po prostoru, na primer zakonsko posteljo in dve enojni postelji.",
              ],
            },
            { type: "h2", text: "Meje zasedenosti" },
            {
              type: "p",
              text: "Pri povpraševanju za rezervacijo myNextDays samodejno preveri, ali je zahtevano število gostov znotraj navedene zasedenosti. Povpraševanja, ki presegajo največjo kapaciteto, so zavrnjena oziroma se sploh ne prikažejo kot rezervljiva.",
            },
            {
              type: "note",
              variant: "info",
              text: "Dodatna postelja ali otroška posteljica dejansko kapaciteto poveča le, če jo izrecno navedete v razporeditvi postelj — sicer največje število gostov ostane nespremenjeno.",
            },
            { type: "h2", text: "Tipični viri napak" },
            {
              type: "ul",
              items: [
                "Prevelika navedba največjega števila gostov, čeprav je na voljo le malo postelj",
                "Pozabljeno število otrok, čeprav je objekt namenjen družinam",
                "Razporeditev postelj po prenovi ni posodobljena",
              ],
            },
            {
              type: "p",
              text: "Če se zasedenost in oprema ne ujemata, dodatno preverite zavihek [Oprema](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Status objekta in vidnost",
          excerpt: "Razlika med aktivno/neaktivno stanje in tremi osmi kanalov.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "myNextDays razlikuje dve različni stvari, ki se pogosto zamenjujeta: status objekta (aktiven ali neaktiven) in vidnost na posameznih prodajnih kanalih. Obe upravljate ločeno drugo od druge.",
            },
            { type: "h2", text: "Status objekta" },
            {
              type: "p",
              text: "Status active pomeni, da je objekt načeloma prodajno sposoben. Status inactive objekt povsem izloči iz obratovanja — na primer pri dolgotrajni prenovi. Neaktiven objekt ni rezervljiv na nobenem kanalu, ne glede na stikala kanalov.",
            },
            { type: "h2", text: "Tri osi kanalov" },
            {
              type: "p",
              text: "Če je objekt aktiven, tri neodvisna stikala določajo, kje natanko je viden:",
            },
            {
              type: "ul",
              items: [
                "Spletna stran — vidnost na vaši lastni spletni strani myNextDays",
                "Tržnica platforme — vidnost na globalni tržnici myNextDays",
                "Portali — vidnost na Booking, Airbnb in drugih",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Te tri osi so povsem neodvisne od statusa objekta in druga od druge. Aktiven objekt je lahko npr. viden samo na spletni strani, ne pa na portalih.",
            },
            { type: "h2", text: "Sprememba statusa" },
            {
              type: "steps",
              items: [
                "Odprite objekt in preklopite na zavihek Pregled.",
                "Nastavite status na aktiven ali neaktiven.",
                "Po potrebi dodatno prilagodite tri stikala kanalov v zavihku Vidnost.",
                "Shranite spremembo — takoj velja na vseh zadevnih kanalih.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Za kratkoročno zaporo posameznih dni namesto tega uporabite Stop-Sell v koledarju — ta ciljno zapre dneve na vseh kanalih, ne da bi deaktivirali celoten objekt.",
            },
          ],
        },
      ],
    },
  ],
};
