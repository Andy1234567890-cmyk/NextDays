import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Paskyra ir prenumerata",
  description: "Pagrindiniai duomenys, tarifas, saugumas ir dviejų veiksnių autentifikavimas.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Paskyra",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Įmonės pagrindiniai duomenys",
          excerpt: "Centralizuotai tvarkyti savo įmonės pavadinimą, adresą ir kontaktinius duomenis.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Skiltyje /konto myNextDays sujungia visas įmonės ir paskyros funkcijas kaip skyrius viename puslapyje — jums nereikia keliauti tarp daugybės antrinių puslapių. Įmonės pagrindiniai duomenys yra pagrindas: įmonės pavadinimas, teisinė forma, adresas ir kontaktiniai duomenys, naudojami sąskaitoms, portalams ir bendravimui su svečiais.",
            },
            { type: "h2", text: "Pagrindinių duomenų atidarymas ir redagavimas" },
            {
              type: "steps",
              items: [
                "Atidarykite /konto.",
                "Pereikite į skyrių „Įmonės pagrindiniai duomenys“.",
                "Patikrinkite įmonės pavadinimą, adresą, telefono numerį ir el. pašto adresą pasiteiravimams.",
                "Atlikite savo pakeitimus.",
                "Išsaugokite skyrių.",
              ],
            },
            { type: "h2", text: "Kodėl šie duomenys svarbūs" },
            {
              type: "p",
              text: "Įmonės pagrindiniai duomenys naudojami sąskaitose, registracijoje prijungtuose portaluose ir teisiškai privalomuose duomenyse, tokiuose kaip įmonės rekvizitai. Neišsamus ar pasenęs adresas gali lemti klaidingai išrašomas sąskaitas arba vėluojantį portalų prijungimą.",
            },
            {
              type: "ul",
              items: [
                "Įmonės pavadinimas ir teisinė forma rodomi visose išrašytose sąskaitose.",
                "Adresas reikalingas registracijai portaluose.",
                "Kontaktiniai duomenys tarnauja kaip atsarginis būdas, jei sistemos pranešimai neateina.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Pakeitę sąskaitos adresą, po to patikrinkite jau išrašytas sąskaitas skyriuje [Atsiskaitymas ir tarifų skaičiuoklė](/hilfe/konto-abo/abrechnung-tarifrechner) — esami dokumentai atgaline data nekoreguojami.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Prenumerata ir tarifas",
          excerpt: "Jūsų tarifas nustato objektų kvotą — užsakytą objektų skaičių bet kada matote paskyroje.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Jūsų myNextDays prenumerata apima objektų kvotą: maksimalų objektų (kambarių ar poilsio objektų) skaičių, kuriuos galite vienu metu aktyviai valdyti. Šiuo metu užsakytas objektų skaičius rodomas skyriuje „Prenumerata ir tarifas“ skiltyje /konto, kartu su likusia kvota.",
            },
            { type: "h2", text: "Kvotos stebėjimas" },
            {
              type: "p",
              text: "Kvota tikrinama serverio pusėje: pasiekus jūsų tarifo viršutinę ribą, negalima sukurti jokio kito objekto, kol neišjungsite esamo objekto arba neišplėsite savo tarifo. Tai galioja nepriklausomai nuo to, ar naujas objektas yra kambarys, ar poilsio objektas — abu vienodai skaičiuojami į kvotą.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite /konto ir skyrių „Prenumerata ir tarifas“.",
                "Patikrinkite užsakytą objektų skaičių savo tarifo kvotos atžvilgiu.",
                "Prireikus pasirinkite didesnį tarifą, kad galėtumėte sukurti daugiau objektų.",
                "Patvirtinkite tarifo pakeitimą.",
              ],
            },
            {
              type: "ul",
              items: [
                "Kiekvienas objektas atskirai skaičiuojamas į kvotą, nepriklausomai nuo objekto tipo.",
                "Tarifo pakeitimas iš karto paveikia galimą kvotą.",
                "Sumažinimas galimas tik tuo atveju, jei aktyvių objektų skaičius atitinka naują kvotą.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Sumažinimas iki tarifo su mažesne kvota atmetamas, kol aktyvių objektų yra daugiau, nei leidžia naujas tarifas. Pirmiausia išjunkite perteklinius objektus.",
            },
            {
              type: "note",
              variant: "info",
              text: "Daugiau apie sąskaitas ir tarifo skaičiavimą rasite skyriuje [Atsiskaitymas ir tarifų skaičiuoklė](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Atsiskaitymas ir tarifų skaičiuoklė",
          excerpt: "Sąskaitos adresas, ankstesnės sąskaitos ir tarifų skaičiuoklė jūsų objektų kvotai.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Skyrius „Atsiskaitymas ir tarifų skaičiuoklė“ skiltyje /konto sujungia viską, kas susiję su sąskaitų išrašymu: jūsų sąskaitos adresą, ankstesnių sąskaitų sąrašą atsisiuntimui bei tarifų skaičiuoklę, kuria galite apskaičiuoti savo dabartinės ar didesnės objektų kvotos kainą.",
            },
            { type: "h2", text: "Sąskaitos adresas ir sąskaitos" },
            {
              type: "p",
              text: "Sąskaitos adresas gali skirtis nuo jūsų įmonės adreso, pavyzdžiui, jei dokumentus gauna mokesčių konsultantas. Jau išrašytas sąskaitas rasite surūšiuotas chronologiškai; kiekvieną galima atsisiųsti PDF formatu.",
            },
            { type: "h2", text: "Tarifų skaičiuoklės naudojimas" },
            {
              type: "steps",
              items: [
                "Atidarykite /konto ir skyrių „Atsiskaitymas ir tarifų skaičiuoklė“.",
                "Tarifų skaičiuoklėje įveskite norimą objektų skaičių.",
                "Palyginkite gaunamas kainas kiekvienam tarifo lygiui.",
                "Prireikus tiesiogiai iš skaičiuoklės pereikite prie tinkamo tarifo.",
              ],
            },
            {
              type: "ul",
              items: [
                "Tarifų skaičiuoklė rodo kainas jūsų paskyrai priskirta valiuta.",
                "Sąskaitos visada prieinamos atsisiuntimui.",
                "Sąskaitos adresą galima tvarkyti nepriklausomai nuo įmonės pagrindinių duomenų.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Naudodami tarifų skaičiuoklę reguliariai patikrinkite, ar jūsų objektų kvota vis dar atitinka faktiškai užsakytą objektų skaičių — žr. [Prenumerata ir tarifas](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Slaptažodžio ir el. pašto keitimas",
          excerpt: "Saugumui svarbūs pakeitimai reikalauja pakartotinio prisijungimo ir patvirtinimo žingsnio.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Slaptažodis ir el. pašto adresas priklauso prie svarbiausių jūsų paskyros saugumo duomenų. Todėl myNextDays abiem pakeitimams reikalauja pakartotinio autentifikavimo — pakeitimą patvirtinate savo dabartiniu slaptažodžiu, net jei jau esate prisijungę.",
            },
            { type: "h2", text: "Slaptažodžio keitimas" },
            {
              type: "steps",
              items: [
                "Atidarykite /konto ir skyrių „Slaptažodžio ir el. pašto keitimas“.",
                "Įveskite dabartinį slaptažodį patvirtinimui.",
                "Nustatykite naują slaptažodį ir jį pakartokite.",
                "Išsaugokite pakeitimą.",
              ],
            },
            { type: "h2", text: "El. pašto adreso keitimas" },
            {
              type: "p",
              text: "El. pašto adreso keitimas vyksta dviguba patvirtinimo tvarka: patvirtinus dabartinį slaptažodį, patvirtinimo nuorodą gaunate NAUJU adresu. Pakeitimas įsigalioja tik paspaudus šią nuorodą — senas adresas iki tol lieka aktyvus, kad prieiga prie jūsų paskyros niekada nebūtų nutraukta.",
            },
            {
              type: "ul",
              items: [
                "Be dabartinio slaptažodžio negalima pakeisti nei slaptažodžio, nei el. pašto.",
                "Naujo el. pašto adreso patvirtinimo nuoroda galioja ribotą laiką.",
                "Iki patvirtinimo ankstesnis el. pašto adresas lieka aktyvus prisijungimui ir pranešimams.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Pakeitę el. paštą, patikrinkite ir dviejų veiksnių autentifikavimą — žr. [Dviejų veiksnių autentifikavimas](/hilfe/konto-abo/zwei-faktor) — jei atkūrimo kodai buvo susieti su senu adresu.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Dviejų veiksnių autentifikavimas",
          excerpt: "Papildomas prisijungimo žingsnis apsaugo jūsų paskyrą nuo neteisėtos prieigos.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Dviejų veiksnių autentifikavimas (2FA) papildo jūsų slaptažodį antru veiksniu per autentifikatoriaus programėlę. Taip vien pavogto slaptažodžio nebeužtenka norint prisijungti prie jūsų myNextDays paskyros.",
            },
            { type: "h2", text: "2FA nustatymas" },
            {
              type: "steps",
              items: [
                "Atidarykite /konto ir skyrių „Dviejų veiksnių autentifikavimas“.",
                "Pakartotinam autentifikavimui patvirtinkite dabartinį slaptažodį.",
                "Nuskaitykite rodomą QR kodą autentifikatoriaus programėle.",
                "Įveskite sugeneruotą kodą patvirtinimui.",
                "Išsaugokite rodomus atkūrimo kodus saugioje vietoje.",
              ],
            },
            { type: "h2", text: "2FA išjungimas" },
            {
              type: "p",
              text: "Dviejų veiksnių autentifikavimo išjungimas taip pat reikalauja pakartotinio autentifikavimo jūsų dabartiniu slaptažodžiu. Taip myNextDays neleidžia, kad kas nors su jau atidaryta sesija tiesiog išjungtų jūsų apsaugą.",
            },
            {
              type: "ul",
              items: [
                "Atkūrimo kodai leidžia prisijungti, jei prarandama autentifikatoriaus programėlė.",
                "Kiekvienas atkūrimo kodas naudojamas tik vieną kartą.",
                "2FA įjungimas ir išjungimas vienodai susieti su slaptažodžio patvirtinimu.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Laikykite atkūrimo kodus atskirai nuo įrenginio su autentifikatoriaus programėle, pavyzdžiui, slaptažodžių tvarkyklėje.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Įrenginių istorija",
          excerpt: "Sekite, iš kurių įrenginių jūsų paskyra yra prisijungusi.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Įrenginių istorija skiltyje /konto rodo, kuriuose įrenginiuose jūsų paskyra šiuo metu prisijungusi — su įrenginio tipu, apytiksle vieta ir paskutinės veiklos laiku. Taip greitai atpažinsite, ar prisijungimas tikrai yra jūsų.",
            },
            { type: "h2", text: "Įrenginių istorijos tikrinimas" },
            {
              type: "steps",
              items: [
                "Atidarykite /konto ir skyrių „Įrenginių istorija“.",
                "Peržiūrėkite prisijungusių įrenginių sąrašą.",
                "Pastebėję nežinomą įrenginį, atjunkite jį.",
                "Po to saugumo sumetimais pakeiskite savo slaptažodį.",
              ],
            },
            { type: "h2", text: "Kada verta patikrinti" },
            {
              type: "p",
              text: "Ypač patikrinkite įrenginių istoriją po slaptažodžio ar el. pašto pakeitimo bei po naudojimosi svetimu ar viešu įrenginiu. Nežinomas įrašas yra aiškus perspėjimo signalas apie neteisėtą prieigą.",
            },
            {
              type: "ul",
              items: [
                "Kiekvienas įrašas rodo įrenginio tipą, apytikslę vietą ir paskutinę veiklą.",
                "Atskirus įrenginius galima tikslingai atjungti, nepaveikiant kitų.",
                "Neatpažintas įrenginys yra pagrindas nedelsiant pakeisti slaptažodį.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Jei neatpažįstate įrenginio, iš karto jį atjunkite ir po to pakeiskite slaptažodį skyriuje [Slaptažodžio ir el. pašto keitimas](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Duomenų apsauga",
          excerpt: "Valdyti paieškos sistemų indeksavimą kiekvienam objektui ir eksportuoti savo duomenis.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Skyriuje „Duomenų apsauga“ skiltyje /konto valdote du dalykus: ar jūsų objektų puslapius gali indeksuoti paieškos sistemos, ir kaip galite eksportuoti myNextDays saugomus savo duomenis.",
            },
            { type: "h2", text: "Paieškos sistemų indeksavimas kiekvienam objektui" },
            {
              type: "p",
              text: "Numatytuoju atveju naujiems objektams paieškos sistemų indeksavimas išjungtas. Tik sąmoningai jį įjungus kiekvienam objektui, tokios paieškos sistemos kaip Google gali įtraukti viešą objekto puslapį į savo indeksą. Taip išlaikote kontrolę, kurie objektai randami už portalų ir nuosavos platformos ribų.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite /konto ir skyrių „Duomenų apsauga“.",
                "Iš sąrašo pasirinkite norimą objektą.",
                "Įjunkite arba išjunkite paieškos sistemų indeksavimą.",
                "Turint kelis objektus, naudokite bendrą jungiklį, kad visus objektus nustatytumėte vienodai.",
              ],
            },
            { type: "h2", text: "Duomenų eksportavimas" },
            {
              type: "p",
              text: "Per duomenų eksporto funkciją užsakote pilną paskyroje saugomų duomenų kopiją. Eksportas sudaromas ir po to pateikiamas jums atsisiuntimui.",
            },
            {
              type: "ul",
              items: [
                "Indeksavimą galima valdyti atskirai kiekvienam objektui, su bendru jungikliu visiems objektams.",
                "Nauji objektai iš principo pradeda be paieškos sistemų indeksavimo.",
                "Duomenų eksportas apima jūsų paskyros ir objektų duomenis struktūruota forma.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Paieškos sistemų indeksavimas nepriklauso nuo matomumo portaluose ir nuosavoje prekyvietėje — jis liečia išimtinai viešą objekto puslapį paieškos sistemose.",
            },
          ],
        },
      ],
    },
  ],
};
