// Partner-AGB — Litauisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Dalyvavimo „myNextDays“ partnerių programoje sąlygos: priskyrimas, komisinių pagrindas, lygiai, komandos komisiniai, draudimai, ženklinimas, išmokėjimas.",
  numbered: false,
  toc: true,
  title: "Dalyvavimo partnerių programoje sąlygos (partnerių BendraSios Sąlygos) – projektas",
  standIso: "2026-09-02",
  intro: [
    "PROJEKTAS – Šios sąlygos yra „myNextDays“ darbo versija ir dar nebuvo teisiškai patikrintos. Iki patvirtintos versijos išleidimo jos laikomos programos aprašymu, o ne galutiniu sutarties tekstu. Patvirtinta versija bus paskelbta šiuo adresu su nauju versijos numeriu; partnerių bus paprašyta iš naujo sutikti su sąlygomis prisijungiant kitą kartą.",
    `Šios dalyvavimo sąlygos reglamentuoja dalyvavimą partnerių programoje (Affiliate programa), kurią vykdo ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (toliau – „myNextDays“ arba „mes“) per partnerius (toliau – „Partneris“).`,
    "Partnerių programa skirta asmenims ir įmonėms, įsikūrusioms ES, Šveicarijoje ar Jungtinėje Karalystėje, kurie rekomenduoja įmones (nuomotojus, agentūras, viešbučius) „myNextDays“ platformoje.",
  ],
  sections: [
    {
      heading: "§ 1 Dalyvavimas ir patvirtinimas",
      paragraphs: [
        "Dalyvavimas reikalauja paraiškos per partnerių valdymo pultą. Privalomi duomenys yra vardas arba įmonės pavadinimas, teisinė forma, šalis, bent viena socialinės žiniasklaidos paskyra su adresu, naudotojo vardu ir pasiekiamumu, o įmonėms – PVM mokėtojo kodas.",
        "„myNextDays“ asmeniškai peržiūri kiekvieną paraišką ir laisvai sprendžia dėl patvirtinimo. Nėra teisės būti priimtam. Dalyvavimas yra nemokamas; „myNextDays“ prenumerata nėra reikalavimas.",
        "Partneris nuolat atnaujina savo duomenis, ypač kanalus, teisinę formą, mokesčių ir išmokėjimo duomenis.",
        "Nurodytas pasiekiamumas iš pradžių yra savarankiškas pareiškimas. Partneris gali savanoriškai susieti savo „YouTube“, „Instagram“, „Facebook“ ir „TikTok“ paskyras; tada sekėjai ir peržiūros bus nuskaitomi iš platformos ir rodomi kaip patvirtinti. Nepatvirtintas pasiekiamumas bus mažiau svarbus patvirtinant ir vėlesnių patikrinimų metu. Susiejimą galima bet kada atjungti valdymo pulte; išsami informacija apie duomenų tvarkymą pateikiama privatumo politikoje.",
      ],
    },
    {
      heading: "§ 2 Įmonių priskyrimas (Attribution)",
      paragraphs: [
        "Įmonė priskiriama Partneriui, jei ji užsiregistruoja naudodama Partnerio rekomendacijos kodą. Kodas registracijos metu yra aiškiai rodomas įmonei ir patvirtinamas išsiuntimu. Stebėjimo slapukai nenaudojami.",
        "Įmonė priskiriama tik vienam Partneriui; lemiamas yra registracijos metu patvirtintas kodas. Vėlesnis perskirstymas atliekamas tik „myNextDays“ įrodžius klaidą.",
        "Nepriskiriamos Partnerio, jo akcininkų, darbuotojų ar giminaičių įmonės, taip pat įmonės, kurios jau yra arba buvo „myNextDays“ klientai.",
      ],
    },
    {
      heading: "§ 3 Komisiniai už nuosavus klientus",
      paragraphs: [
        "Komisinių pagrindas yra priskirtos įmonės grynasis abonemento apyvartos (pagrindinis tarifas ir moduliai) iš apmokėtų sąskaitų – be PVM, be portalo komisinių, papildomų paslaugų, papildomų skaičiavimų ir kitų tarpinių elementų.",
        "Komisinis tarifas priklauso nuo partnerio rango mokėjimo metu. Rangai ir tarifai skelbiami programos puslapyje. Rangas nustatomas pagal apmokančių klientų skaičių partnerio struktūroje: jo paties apmokantys klientai ir jo komandos partnerių apmokantys klientai (§ 4), kiekvienas klientas vieną kartą. Rangas nustatomas kas mėnesį nustatytą dieną; paaukštinimas galioja iš karto, o pažeminimas – tik tada, kai skaičius du kartus iš eilės nustatytomis dienomis buvo žemiau slenksčio.",
        "Jei partneris pirmą kartą pasiekia rangą nuo „Aufsteiger“, jis vieną kartą gauna programos puslapyje nurodytą paaukštinimo premiją (šiuo metu 50,00 EUR už kiekvieną rangą, visiems partneriams eurais). Kiekvienas rangas apmokamas tik vieną kartą, net ir po pažeminimo ir pakartotinio paaukštinimo. Premijai taikomas grąžinimo laikotarpis pagal § 7.",
        "Komisinis mokestis už kiekvieną įmonę atsiranda dvylikai mėnesių nuo pirmojo apmokamo prenumeratos sąskaitos; per partnerį tarpininkaujamas nemokamas bandomasis laikotarpis ir nemokamas mėnuo neįskaičiuojami. Jei prenumerata baigiasi anksčiau, komisinis mokestis baigiasi su paskutine apmokėta sąskaita.",
        "Nuo „Elite-Partner“ rango partneris papildomai gauna superkomisinį mokestį programos puslapyje nurodytu dydžiu (šiuo metu 2,5 %) nuo visų jo struktūros klientų – nuosavų klientų ir jo komandos partnerių klientų – grynųjų prenumeratos pajamų, be dvylikos mėnesių apribojimo, kol atitinkamas klientas turi apmokamą prenumeratą ir partneris turi rangą mokėjimo metu. Jis atsiranda kartu su komisiniu mokesčiu pagal 2 sakinį ir § 4.",
        "Nuo „Elite-Partner“ rango partneris už kiekvieną per myBestDays gautą ir apmokėtą įmonės, kuri priskirta jam arba vienam iš jo komandos partnerių, užsakymą gauna užsakymo dalį programos puslapyje nurodytu dydžiu (šiuo metu 0,5 %) nuo svečio sumokėtos užsakymo sumos užsakymo valiuta, be laiko apribojimo, kol galioja priskyrimas ir partneris turi rangą užsakymo apmokėjimo metu. Užstatai nėra užsakymo suma. Grąžinimai svečiui proporcingai sumažina dalį (§ 7).",
      ],
    },
    {
      heading: "§ 4 Komandos komisinis mokestis",
      paragraphs: [
        "Nuo „Aufsteiger“ rango partneris gali vadovauti komandos partneriams. Jei kitas partneris pateikia paraišką per partnerio komandos nuorodą ir matomai patvirtina jo kodą savo paraiškoje, jis, patvirtinus, priskiriamas partnerio komandai (toliau – „Rėmėjas“). Jei Rėmėjas paraiškos pateikimo metu neturi rango, paraiška lieka galiojanti, tačiau komandos priskyrimas neatsiranda.",
        "Rėmėjas gauna komandos komisinį mokestį nuo savo komandos partnerių klientų grynųjų prenumeratos pajamų, lygų skirtumui tarp jo paties komisinio tarifo ir komandos partnerio komisinio tarifo, atsižvelgiant į rangą mokėjimo metu. Jei abu yra tame pačiame range arba komandos partneris yra aukštesniame, komandos komisinis mokestis neatsiranda. Komandos partnerio komisinis mokestis ir Rėmėjo komandos komisinis mokestis kartu niekada neviršija aukščiausio tarifo (šiuo metu 30 %).",
        "Komandinis atlygis yra tik vieno lygio gylio: komandos partneriai negauna komandinio atlygio už partnerius, kuriuos jie patys pritraukia. Už partnerio pritraukimą atlygis nemokamas; dalyvio mokestis nerenkamas. Komandinis atlygis gaunamas tik iš apmokėtų prenumeratos pajamų.",
        "Komandinis atlygis kiekvienam komandos klientui mokamas dvylika mėnesių nuo jo pirmos apmokėtos sąskaitos, jam taikomas tas pats grąžinimo laikotarpis ir jis proporcingai atšaukiamas grąžinus arba atšaukus mokėjimą (§ 7). Jis mokamas tik tol, kol rėmėjas ir komandos partneris yra patvirtinti; priešingu atveju jis sustabdomas iki išaiškinimo.",
        "Komandos priskyrimas yra vienkartinis. Pakeitimą atlieka tik myNextDays, nurodydama dokumentuotą priežastį.",
      ],
    },
    {
      heading: "§ 5 Partnerio pareigos ir ženklinimas",
      paragraphs: [
        "Partneris kiekvieną rekomendaciją pažymi savo nuoroda arba kodu kaip reklamą – įrašo pradžioje, įrašo kalba, atsižvelgiant į savo šalies reikalavimus (Vokietijoje, be kita ko, § 5a Abs. 4 UWG, Danijoje markedsføringsloven § 6 Abs. 4). myNextDays pateikia kiekvienos šalies formuluotes partnerio prietaisų skydelyje.",
        "Partneris apie myNextDays teikia tik tokią informaciją, kuri atitinka paskelbtus paslaugų aprašymus, ir neteikia jokių pažadų myNextDays vardu. Ypač draudžiami sėkmės ir garantijos pažadai (pvz., „garantuotas visiškas užimtumas per tris dienas“) bei pareiškimai apie pajamas, kurie neatitinka paskelbtų paslaugų aprašymų.",
        "Kiekvienas vaizdo įrašas ir kiekvienas įrašas, kuriame minimas myNextDays arba yra partnerio nuoroda, prieš paskelbimą pateikiamas peržiūrai kaip failas partnerio prietaisų skydelyje. Partnerio nuoroda atsiranda tik po raštiško myNextDays patvirtinimo; paskelbimas be patvirtinimo draudžiamas. myNextDays gali atšaukti patvirtinimą; jau gauti komisiniai lieka nepakitę.",
        "Logotipams, ekrano nuotraukoms, B-Roll, perdangoms ir ekrano kopijoms partneris naudoja tik myNextDays pateiktą reklaminę medžiagą. Nuosavi, nepatikrinti programinės įrangos įrašai neleidžiami.",
      ],
    },
    {
      heading: "§ 6 Draudžiama praktika",
      paragraphs: ["Ypač draudžiama:"],
      list: [
        "Prekės ženklo siūlymas: mokami skelbimai apie prekės ženklą „myNextDays“, rašybos variantus ir derinius (pvz., „myNextDays kainos“) paieškos sistemose ir tinkluose;",
        "Slapukų numetimas, paslėpti nukreipimai, iFrames, automatinis partnerio nuorodos iškvietimas ar kitoks techninis priskyrimo manipuliavimas;",
        "Saviskyra: savo įmonių, akcininkų, darbuotojų ar giminaičių registravimas per savo kodą arba komandos partnerio kodą;",
        "Pirkta aprėptis (pirkti sekėjai, paspaudimų fermos, botų srautas) ir paskatos įmonėms registruotis (grąžinimai, dovanos, loterijos);",
        "Įdarbinimo pažadai: partnerių pritraukimas su pajamų pažadais, kurie nėra gauti iš apmokėtų prenumeratos pajamų, arba programos pristatymas kaip pajamų šaltinio pritraukiant daugiau partnerių;",
        "Šlamštas, neleistina tiesioginė rinkodara ir trečiųjų šalių prekių ženklų ar turinio naudojimas be teisių.",
      ],
    },
    {
      heading: "7 § Grąžinimo laikotarpis, atšaukimas, sulaikymas",
      paragraphs: [
        "Kiekviena komisinio atlyginimo eilutė po jos sukūrimo yra atvira 30 dienų (grąžinimo laikotarpis) ir po to gali būti išmokėta. Jei pagrindinė sąskaita faktūra yra visiškai ar iš dalies grąžinama arba atšaukiama (Chargeback), komisinis atlyginimas – įskaitant juo pagrįstą komandos komisinį atlyginimą – proporcingai atšaukiamas, net ir po išmokėjimo, atskaičiuojant iš būsimų komisinių.",
        "Įtarus 2, 5 ar 6 straipsnio pažeidimą, myNextDays gali sulaikyti priskyrimus ir komisinius iki paaiškinimo. Jei pažeidimas pasitvirtina, atitinkami komisiniai anuliuojami.",
      ],
    },
    {
      heading: "8 § Išmokėjimas ir kreditas",
      paragraphs: [
        "Išmokėtini komisiniai atlyginimai kas mėnesį surenkami pagal valiutą ir išmokami, kai tik pasiekia programos puslapyje arba prietaisų skydelyje nurodytą minimalią atitinkamos valiutos sumą. Valiutų konvertavimas nevyksta.",
        "Atsiskaitymas vykdomas kredito procedūra (savarankiškas sąskaitų išrašymas, momsloven § 52a): myNextDays kiekvienam išmokėjimui sukuria kreditą; Partneris neišrašo sąskaitos faktūros. Partneris sutinka su kredito procedūra.",
        "Verslininkai gauna kreditą su nuoroda į paslaugos gavėjo mokestinę prievolę (atvirkštinis apmokestinimas); būtina sąlyga yra galiojantis, patvirtintas PVM mokėtojo kodas. Privatūs asmenys gauna kreditą be PVM ir patys apmokestina komisinį atlyginimą.",
        "Išmokėjimas atliekamas SEPA pavedimu, Wise arba PayPal į Partnerio prietaisų skydelyje nurodytus duomenis.",
      ],
    },
    {
      heading: "9 § Duomenys ir įžvalga",
      paragraphs: [
        "Partneris mato priskirtas įmones pseudonimu (numeris, šalis, statusas, sumos). Įmonių pavadinimai, el. pašto adresai ar užsakymų duomenys neatskleidžiami. Rėmėjas mato savo komandos partnerių vardą ar įmonės pavadinimą, rangą, mokančių klientų skaičių ir iš to gaunamą komandos komisinį atlyginimą, bet ne klientų detales.",
        "Susijusių paskyrų ir sukurtų įrašų atžvilgiu myNextDays mato sekėjus, peržiūras, sąveikas, taip pat paspaudimus ir klientus kiekvienam įrašui. Nukrypimai (pvz., sekėjų šuolis be atitinkamų peržiūrų arba didelis neatitikimas tarp savarankiško deklaravimo ir patvirtintos vertės) yra nuorodos asmeniniam patikrinimui pagal 6 ir 10 straipsnius, o ne automatinis blokavimas.",
        "Asmens duomenų tvarkymas partnerystės programoje aprašytas privatumo politikoje.",
      ],
    },
    {
      heading: "10 § Trukmė, blokavimas ir nutraukimas",
      paragraphs: [
        "Dalyvavimas yra neterminuotas ir gali būti bet kada nutrauktas abiejų šalių raštu. Jau susidarę, išmokėtini komisiniai atlyginimai išmokami pagal 8 straipsnį; po nutraukimo nauji komisiniai atlyginimai nesusidaro.",
        "myNextDays gali blokuoti Partnerį, jei jis pažeidžia šias sąlygas. Blokavimo metu komisiniai atlyginimai sulaikomi; patvirtinus pažeidimą, jie anuliuojami.",
      ],
    },
    {
      heading: "11 § Pakeitimai",
      paragraphs: [
        "myNextDays gali keisti šias sąlygas ir pakopas, įsigaliojančias ateityje. Pakeitimai bus paskelbti partnerio prietaisų skydelyje ir šiame puslapyje su versijos numeriu; esant esminiams pakeitimams, partnerio bus prašoma pakartotinai sutikti. Jau uždirbti komisiniai lieka nepakitę.",
      ],
    },
    {
      heading: "§ 12 Taikytina teisė",
      paragraphs: [
        "Taikoma Danijos teisė, išskyrus kolizines normas. Privalomos vartotojų apsaugos nuostatos valstybės, kurioje privatus partneris nuolat gyvena, lieka nepakitusios.",
      ],
    },
  ],
};
