import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Objektai ir patogumai",
  description: "Kambarių ir poilsio objektų kūrimas ir tvarkymas.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Objektų valdymas",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Objektas = viena rezervuojama vienetas",
          excerpt: "Kodėl kiekvienas myNextDays objektas yra lygiai viena rezervuojama vienetas.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "myNextDays sistemoje objektas visada yra lygiai viena rezervuojama vienetas — atskiras viešbučio kambarys arba visas poilsio objektas. Šis principas galioja nepriklausomai nuo to, ar valdote poilsio namą, poilsio butą, ar viešbutį, ir yra prieinamumo, kainų bei rezervacijų pagrindas.",
            },
            { type: "h2", text: "Ne pastatas su kambariais po juo" },
            {
              type: "p",
              text: "Dažnas nesusipratimas — viešbučio pastatą vaizduoti kaip vieną objektą su keliais kambariais po juo. myNextDays sistemoje tai nenumatyta. Jei, pavyzdžiui, valdote viešbutį su aštuoniais dviviečiais ir keturiais vienviečiais kambariais, sukurkite dvylika atskirų objektų — o ne vieną objektą su kambarių skaičiaus lauku.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Objekto lygmenyje sąmoningai nėra lauko „Kambarių skaičius“. Kiekvienam kambariui reikia atskiro objekto su savo kalendoriumi ir savomis kainomis.",
            },
            { type: "h2", text: "Poilsio objektai" },
            {
              type: "p",
              text: "Poilsio namo ar poilsio buto atveju visas objektas atitinka rezervuojamą vienetą. Čia jokio tolesnio skaidymo nėra — poilsio objektas visada yra savarankiškas objektas su savo kalendoriumi.",
            },
            { type: "h2", text: "Kodėl tai svarbu" },
            {
              type: "ul",
              items: [
                "Kiekvienas objektas turi savo prieinamumo kalendorių — dvigubos rezervacijos užkertamos tiksliai objekto lygmeniu.",
                "Kainos, patogumai ir nuotraukos galioja objektui, o ne pastatui.",
                "Objektas visada priklauso lygiai vienam savininkui — kelių priskyrimų nėra.",
                "Kanalo matomumas (svetainė, platformos prekyvietė, portalai) valdomas kiekvienam objektui atskirai.",
              ],
            },
            {
              type: "p",
              text: "Kaip pasirinkti tinkamą objekto tipą savo kambariui ar poilsio objektui, skaitykite skyriuje [Objekto tipo nustatymas](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Objekto tipo nustatymas",
          excerpt: "Teisingai priskirti kategoriją, nekilnojamojo turto tipą ir pasiūlymo rūšį.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Objekto tipas nustato, kaip jūsų objektas klasifikuojamas ir filtruojamas portaluose bei platformos prekyvietėje. Jį sudaro trys vienas nuo kito priklausantys pasirinkimo laukai, kuriuos pereinate kurdami ar redaguodami objektą.",
            },
            { type: "h2", text: "Trys pasirinkimo lygiai" },
            {
              type: "steps",
              items: [
                "Pirmiausia pasirinkite kategoriją — pavyzdžiui, poilsio apgyvendinimą arba viešbutį.",
                "Toliau pasirinkite nekilnojamojo turto tipą — pavyzdžiui, poilsio butą, poilsio namą, dvivietį ar vienvietį kambarį.",
                "Pasirinkite pasiūlymo rūšį — pavyzdžiui, visą objektą arba privatų kambarį.",
                "Papildykite, priklausomai nuo pasirinkimo, atsiradusius papildomus laukus, pavyzdžiui, lovos tipą ar aukštą.",
              ],
            },
            { type: "h2", text: "Kodėl tvarka yra svarbi" },
            {
              type: "p",
              text: "Šie trys išskleidžiamieji sąrašai priklauso vienas nuo kito: kategorijos pasirinkimas apriboja galimus nekilnojamojo turto tipus, o nekilnojamojo turto tipo pasirinkimas savo ruožtu — pasiūlymo rūšis. Taip susidaro tik prasmingi deriniai, kokie naudojami ir didžiuosiuose portaluose.",
            },
            {
              type: "note",
              variant: "info",
              text: "Jei vėliau pakeisite kategoriją, myNextDays patikrins, ar nekilnojamojo turto tipas ir pasiūlymo rūšis vis dar tinka, ir prireikus paprašys pasirinkti iš naujo.",
            },
            { type: "h2", text: "Objekto tipo redagavimas" },
            {
              type: "p",
              text: "Meniu Objektai atidarykite norimą objektą ir pereikite į skirtuką Pagrindiniai duomenys. Ten po Objekto tipu rasite tris išskleidžiamuosius sąrašus. Išsaugojus pakeitimą, naujas klasifikavimas perduodamas visiems aktyviems kanalams.",
            },
            {
              type: "ul",
              items: [
                "Kategorija: aukštesnio lygio klasifikacija (pvz., poilsio apgyvendinimas, viešbutis)",
                "Nekilnojamojo turto tipas: konkretus objekto tipas (pvz., poilsio butas, dvivietis kambarys)",
                "Pasiūlymo rūšis: kas tiksliai rezervuojama (pvz., visas objektas, privatus kambarys)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Patogumų tvarkymas",
          excerpt: "Pasirinkti ir nuolat atnaujinti patogumų požymius.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Objekto patogumai iš esmės lemia, kaip gerai jis randamas ir filtruojamas portaluose. Svečiai tikslingai filtruoja pagal tokius požymius kaip „Wi-Fi“, virtuvė ar automobilių stovėjimo vieta — trūkstami duomenys gali pašalinti objektą iš paieškos rezultatų.",
            },
            { type: "h2", text: "Patogumų pasirinkimas" },
            {
              type: "steps",
              items: [
                "Atidarykite objektą ir pereikite į skirtuką Patogumai.",
                "Iš pateikto sąrašo pasirinkite visus tinkamus požymius.",
                "Prireikus papildykite detales, pavyzdžiui, stovėjimo vietų skaičių ar virtuvės tipą.",
                "Išsaugokite pakeitimus — jie automatiškai perduodami visiems aktyviems portalams.",
              ],
            },
            { type: "h2", text: "Iš kur atsiranda požymiai" },
            {
              type: "p",
              text: "Patogumų sąrašas atitinka didžiųjų portalų požymių katalogą, kad jūsų duomenys ten būtų teisingai priskirti. Savų, laisvai sugalvotų požymių nenumatyta, nes jų nebūtų galima tvarkingai perduoti portalams.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Po kiekvieno statybinio pakeitimo — pavyzdžiui, įrengus naują oro kondicionierių ar papildomą vonios kambarį — patikrinkite patogumus, kad duomenys visuose kanaluose liktų aktualūs.",
            },
            { type: "h2", text: "Dažniausios požymių grupės" },
            {
              type: "ul",
              items: [
                "Pagrindiniai patogumai: „Wi-Fi“, šildymas, oro kondicionierius",
                "Virtuvė ir maitinimas: pilnai įrengta virtuvė, indaplovė, kavos aparatas",
                "Vonios kambarys ir skalbiniai: atskiras vonios kambarys, skalbimo mašina, rankšluosčiai",
                "Lauko erdvė: balkonas, terasa, sodas, automobilių stovėjimo vieta",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Nuotraukos ir aprašymas",
          excerpt: "Įtaigios nuotraukos ir tekstai daugiau rezervacijų pritraukimui.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Nuotraukos ir aprašymas svečiams yra svarbiausias sprendimo pagrindas. Objektą galima publikuoti tik tada, kai įkelta bent viena titulinė nuotrauka ir aprašymas.",
            },
            { type: "h2", text: "Nuotraukų įkėlimas" },
            {
              type: "steps",
              items: [
                "Atidarykite objektą ir pereikite į skirtuką Nuotraukos.",
                "Nuvilkite vaizdų failus į įkėlimo sritį arba pasirinkite juos per failų dialogo langą.",
                "Nustatykite titulinę nuotrauką — ji bus rodoma paieškos rezultatuose ir kortelėse.",
                "Kitas nuotraukas sutvarkykite prasminga tvarka, tempdami jas pele.",
              ],
            },
            { type: "h2", text: "Aprašymo rašymas" },
            {
              type: "p",
              text: "Pereikite į skirtuką Aprašymas ir įveskite pavadinimą bei aprašomąjį tekstą. Konkrečiai aprašykite objekto vietą, ypatumus ir tikslinę auditoriją — bendros frazės portaluose atrodo mažiau įtikinamai nei konkretūs detalūs faktai.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Negalima naudoti kitų objektų nuotraukų ar nuotraukų iš interneto — portalai tai tikrina ir pažeidimo atveju gali objektą užblokuoti.",
            },
            { type: "h2", text: "Rekomendacijos geroms nuotraukoms" },
            {
              type: "ul",
              items: [
                "Bent penkios nuotraukos, idealiu atveju — po vieną kiekvienam kambariui",
                "Horizontalus formatas, geras apšvietimas, be vandens ženklų",
                "Titulinė nuotrauka rodo objektą kuo patraukliau ir vienareikšmiškai",
                "Reguliariai atnaujinti, ypač po renovacijų",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Talpa ir pajėgumas",
          excerpt: "Teisingai nurodyti maksimalų svečių skaičių ir lovų išdėstymą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Talpa nustato, kiek svečių gali priimti objektas, ir tikrinama kiekvienos paieškos bei rezervacijos metu. Neteisingi duomenys sukelia arba atmestas užklausas, arba perpildymą — abiejų dalykų reikėtų vengti.",
            },
            { type: "h2", text: "Talpos įvedimas" },
            {
              type: "steps",
              items: [
                "Atidarykite objektą ir pereikite į skirtuką Talpa.",
                "Įveskite maksimalų suaugusiųjų skaičių.",
                "Įveskite maksimalų vaikų skaičių, jei jie priimami.",
                "Nurodykite lovų išdėstymą kiekvienam kambariui, pavyzdžiui, dviguba lova ir dvi vienvietės lovos.",
              ],
            },
            { type: "h2", text: "Talpos ribos" },
            {
              type: "p",
              text: "Gavus rezervacijos užklausą, myNextDays automatiškai patikrina, ar prašomas svečių skaičius neviršija nustatytos talpos. Užklausos, viršijančios maksimalų pajėgumą, atmetamos arba iš viso nerodomos kaip rezervuojamos.",
            },
            {
              type: "note",
              variant: "info",
              text: "Papildoma lova ar lovytė kūdikiui realų pajėgumą padidina tik tuo atveju, jei ją aiškiai įtraukiate į lovų išdėstymą — kitaip maksimalus svečių skaičius lieka nepakitęs.",
            },
            { type: "h2", text: "Dažniausios klaidų priežastys" },
            {
              type: "ul",
              items: [
                "Per didelis maksimalus svečių skaičius, nors lovų yra mažai",
                "Pamirštas vaikų skaičius, nors objektas orientuotas į šeimas",
                "Po renovacijos neatnaujintas lovų išdėstymas",
              ],
            },
            {
              type: "p",
              text: "Jei talpa ir patogumai nedera tarpusavyje, papildomai patikrinkite skirtuką [Patogumai](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Objekto būsena ir matomumas",
          excerpt: "Skirtumas tarp aktyvus / neaktyvus ir trijų kanalų ašių.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "myNextDays skiria du dažnai painiojamus dalykus: objekto būseną (aktyvus arba neaktyvus) ir matomumą atskiruose pardavimo kanaluose. Abu valdote atskirai.",
            },
            { type: "h2", text: "Objekto būsena" },
            {
              type: "p",
              text: "Būsena active reiškia, kad objektas iš esmės tinkamas parduoti. Būsena inactive visiškai išjungia objektą iš veiklos — pavyzdžiui, ilgalaikės renovacijos atveju. Neaktyvus objektas nerezervuojamas jokiame kanale, nepriklausomai nuo kanalų jungiklių.",
            },
            { type: "h2", text: "Trys kanalų ašys" },
            {
              type: "p",
              text: "Jei objektas aktyvus, trys nepriklausomi jungikliai nusprendžia, kur tiksliai jis matomas:",
            },
            {
              type: "ul",
              items: [
                "Svetainė — matomumas jūsų nuosavoje myNextDays svetainėje",
                "Platformos prekyvietė — matomumas visuotinėje myBestDays prekyvietėje",
                "Portalai — matomumas Booking, Airbnb ir kituose portaluose",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Šios trys ašys visiškai nepriklauso nuo objekto būsenos ir viena nuo kitos. Pavyzdžiui, aktyvus objektas gali būti matomas tik svetainėje, bet ne portaluose.",
            },
            { type: "h2", text: "Būsenos keitimas" },
            {
              type: "steps",
              items: [
                "Atidarykite objektą ir pereikite į skirtuką Apžvalga.",
                "Nustatykite būseną kaip aktyvus arba neaktyvus.",
                "Prireikus papildomai pakoreguokite tris kanalų jungiklius skirtuke Matomumas.",
                "Išsaugokite pakeitimą — jis iš karto galioja visuose susijusiuose kanaluose.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Norėdami trumpam blokuoti atskiras dienas, vietoj to naudokite kalendoriuje Pardavimo stabdymą (Stop-Sell) — tai tikslingai blokuoja dienas visuose kanaluose, neišjungiant viso objekto.",
            },
          ],
        },
      ],
    },
  ],
};
