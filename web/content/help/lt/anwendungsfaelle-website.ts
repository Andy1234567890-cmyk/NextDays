import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Svetainė",
  description: "Optimaliai naudoti savo svetainę.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Svetainė",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Svetainės paskelbimas viešai",
          excerpt: "Kaip publikuoti savo nuosavą svetainę kaip savarankišką pardavimo kanalą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija",
            },
            {
              type: "p",
              text: "Jūsų svetainė yra atskiras pardavimo kanalas šalia portalų ir platformos. Puslapius kuriate redaktoriuje, tačiau tik paskelbus svetainė tampa matoma svečiams ir jūsų objektai joje tampa rezervuojami.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite svetainės redaktorių ir patikrinkite, ar visi norimi puslapiai užpildyti turiniu.",
                "Objekto skirtuke kiekvienam objektui pasirinkite, ar jis turi būti matomas svetainėje — šis matomumas nepriklauso nuo portalų ir platformos.",
                "Prieš paskelbdami patikrinkite peržiūrą kompiuterio ir mobiliajame vaizde.",
                "Spustelėkite „Publikuoti“, kad svetainę aktyvuotumėte svečiams.",
                "Po publikavimo patikrinkite viešą URL ir išbandykite pavyzdinę rezervaciją per svetainę.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Objekto svetainės matomumas yra atskira ašis — objektas gali būti aktyvus portaluose, bet paslėptas svetainėje, ir atvirkščiai. Daugiau skyriuje [Nuosavo domeno nustatymas](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Nuosavo domeno nustatymas",
          excerpt: "Kaip susieti savo nuosavą domeną su jūsų myNextDays svetaine.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija",
            },
            {
              type: "p",
              text: "Nuosavas domenas, pavyzdžiui, www.jusu-imone.lt, atrodo profesionaliau nei standartinis adresas ir stiprina jūsų prekės ženklą svečių, norinčių rezervuoti tiesiogiai pas jus, akyse.",
            },
            {
              type: "steps",
              items: [
                "Svetainės redaktoriuje atidarykite skyrių „Domenas“ ir įveskite norimą nuosavą domeną.",
                "Pas savo domeno teikėją sukurkite rodomus DNS įrašus (paprastai CNAME arba A įrašą).",
                "Palaukite, kol domenas bus rodomas kaip prijungtas, o SSL sertifikatas — kaip aktyvus; tai, priklausomai nuo teikėjo, gali užtrukti kelias valandas.",
                "Išbandykite savo domeno atidarymą privačiame naršyklės lange, kad neįtakotų talpykloje išsaugoti seni įrašai.",
                "Patikrinkite, ar senieji standartiniai adresai toliau nukreipia į naują domeną, kad esamos nuorodos neliktų negaliojančios.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "DNS įrašus keiskite tik taip, kaip nurodyta — neteisingos reikšmės gali sutrikdyti esamus jūsų domeno el. pašto nustatymus. Abejodami pasitikslinkite su savo domeno teikėju, prieš perrašydami esamus įrašus.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Tiesioginių rezervacijų didinimas",
          excerpt: "Kaip nukreipti daugiau svečių į savo svetainę vietoj portalų.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija",
            },
            {
              type: "p",
              text: "Rezervacijos per nuosavą svetainę jūsų įmonei paprastai yra pigesnės nei per portalus, nes čia netaikomas portalo komisinis mokestis. Keliomis tikslingomis priemonėmis padidinsite tiesioginių rezervacijų per savo svetainę, kaip savarankišką kanalą, dalį.",
            },
            {
              type: "steps",
              items: [
                "Įsitikinkite, kad visi rezervuojami objektai matomi svetainėje ir turi aktualias nuotraukas bei aprašymus.",
                "Nustatykite tik svetainei skirtą nuolaidą ar privalumą, pavyzdžiui, nedidelę kainos nuolaidą, palyginti su portalais.",
                "Nurodykite savo domeną rezervacijos patvirtinimuose ir bendraujant su svečiais, kurie jau kartą rezervavo.",
                "Reguliariai tikrinkite rezervacijų statistiką, kad stebėtumėte svetainės dalį visose rezervacijose laikui bėgant.",
                "Optimizuokite svetainės įkėlimo laiką ir mobilųjį vaizdavimą, nes didžioji dalis svečių rezervuoja per išmanųjį telefoną.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Tik svetainei skirtas privalumas veikia tik tuo atveju, jei svečiai apskritai randa svetainę — aktyviai nuorodykite į ją, o ne pasitikėkite vien portalais. Apie publikavimą žr. [Svetainės paskelbimas viešai](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
