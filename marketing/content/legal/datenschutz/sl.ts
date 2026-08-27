// Slowenische Fassung der Datenschutzerklärung.
//
// Referenz ist content/legal/datenschutz/de.ts — INHALTLICHE Änderungen gehören
// ZUERST dorthin und werden von dort in alle Sprachfassungen nachgezogen. Diese
// Datei hat dieselbe Struktur wie de.ts (20 Abschnitte, gleiche Absatzzahlen);
// Firmen-, Register-, Dienstleister- und Rechtsakt-Bezeichnungen bleiben
// unübersetzt.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Izjava o varstvu podatkov",
  metaDescription:
    "Kako myNextDays obdeluje osebne podatke: nameni, pravne podlage, prejemniki, obdobja hrambe in vaše pravice po GDPR.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Ta izjava opisuje, kako ${ANBIETER.firma} obdeluje osebne podatke — pri obisku tega spletnega mesta, pri uporabi platforme myNextDays (nadzorna plošča, tržnica in mobilna aplikacija) ter v okviru poslovnega razmerja z našimi strankami.`,
    "Ne prodajamo podatkov in ne ustvarjamo profilov, ki bi vas identificirali kot osebo. Na tej spletni strani – samo z vašim soglasjem – merimo doseg naših strani in uspeh našega oglaševanja; obe kategoriji je mogoče posamično odkljukati (glejte razdelka Merjenje dosega ter Oglaševanje in merjenje uspešnosti). Podatke za namene oglaševanja obdelujemo izključno tam, kjer ste izrecno privolili – in sicer za naše e-novice (glejte poglavje Komunikacija), na katere se lahko kadar koli odjavite z enim klikom.",
  ],
  sections: [
    {
      heading: "Upravljavec",
      paragraphs: ["Za obdelave, opisane v tej izjavi, je odgovoren:"],
      zeilen: [
        {
          label: "Družba",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Naslov",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "E-pošta",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Področje uporabe in vloge",
      unterpunkte: [
        {
          paragraphs: [
            "Za obisk tega spletnega mesta, za vaš uporabniški račun in za izvajanje našega poslovnega razmerja smo upravljavec v smislu člena 4(7) GDPR.",
          ],
        },
        {
          paragraphs: [
            "Za podatke, ki jih naše stranke (najemodajalci, hoteli, agencije) na platformi obdelujejo o svojih gostih, lastnikih in zaposlenih, so upravljavci stranke, mi pa smo obdelovalec po členu 28 GDPR. Podrobnosti so navedene v [pogodbi o obdelavi podatkov](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Če kot gost rezervirate nastanitev prek naše tržnice, obdelujemo vaše rezervacijske in kontaktne podatke tako v svojem imenu (upravljanje tržnice, obdelava plačil) kot tudi za gostujoči obrat. Vaša nastanitvena pogodba je sklenjena izključno z obratom; poleg te izjave veljajo njegove informacije o varstvu podatkov.",
          ],
        },
      ],
    },
    {
      heading: "Obisk tega spletnega mesta",
      unterpunkte: [
        {
          titel: "Dnevniške datoteke strežnika",
          paragraphs: [
            "Pri vsakem priklicu vaš brskalnik posreduje tehnično potrebne podatke, ki jih naš spletni strežnik zabeleži: naslov IP, datum in uro, priklicani naslov, količino prenesenih podatkov, kodo stanja, napotitveno stran in oznako brskalnika. Namen je zagotavljanje strani ter zaznavanje in odvračanje napadov in motenj. Pravna podlaga je člen 6(1)(f) GDPR; naš zakoniti interes je varno in stabilno delovanje. Dnevniki se hranijo le tako dolgo, kot je potrebno za delovanje in varnost, in se ne združujejo z drugimi podatki.",
          ],
        },
        {
          titel: "Pisave",
          paragraphs: [
            "Uporabljene pisave so vključene lokalno na našem strežniku. Do povezave z Google Fonts ali z drugo storitvijo pisav ne pride.",
          ],
        },
        {
          titel: "Ikone",
          paragraphs: [
            "Ikone tega spletnega mesta so, tako kot pisave, pri nas: na strani jih vstavi naš strežnik in se ne nalagajo iz storitve za ikone. Pri tem ne pride do nobene povezave s tretjo osebo in vaš naslov IP se ne posreduje nikomur.",
          ],
        },
        {
          titel:
            "Zaščita kontaktnega obrazca pred nezaželeno pošto (reCAPTCHA)",
          paragraphs: [
            "Naš kontaktni obrazec je pred samodejnimi množičnimi sporočili zaščiten s storitvijo reCAPTCHA Enterprise družbe Google Ireland Limited. Samo če v to privolite, vaš brskalnik pri izpolnjevanju obrazca naloži skript z naslova www.google.com; pri tem se družbi Google posredujeta vaš naslov IP in podatki o vaši interakciji z obrazcem ter se tam ovrednotita, da se loči človek od skripta. Pravna podlaga je člen 6(1)(a) GDPR (privolitev); dopolnilno velja [izjava o varstvu podatkov družbe Google](https://policies.google.com/privacy).",
            "Brez vašega soglasja Google ne bo naložil ničesar in tja ne bodo posredovani nobeni podatki; obrazca takrat ne bomo sprejeli, lahko pa nam kadar koli pošljete e-pošto. Če podate soglasje, reCAPTCHA nastavi lasten piškotek (_GRECAPTCHA, trajanje določi Google, do šest mesecev), ki se uporablja za oceno tveganja. Svoje soglasje lahko kadar koli spremenite ali prekličete prek ikone piškotka v spodnjem levem kotu vsake strani; piškotek bo nato izbrisan.",
          ],
        },
        {
          titel: "Merjenje dosega (Google Analytics)",
          paragraphs: [
            "Na tej spletni strani z Google Analytics 4 podjetja Google Ireland Limited merimo, kako se uporabljajo naše strani – katere strani so obiskane, od kod prihajajo obiskovalci in na kateri točki zapustijo stran. Namen je izključno izboljšanje ponudbe in prepoznavnosti.",
            "Nalaganje poteka izključno z vašim soglasjem. Če ga podate, vaš brskalnik naloži skript z www.googletagmanager.com in shrani dva piškotka (»_ga« in »_ga_<ID>«, veljavnost do dveh let) z naključno generiranim ID-jem; posredujejo se ta ID, obiskane strani, vir napotitve, približna lokacija na ravni države ali regije, naprava in brskalnik ter vaš IP-naslov, ki ga Google skrajša pred vsakim shranjevanjem. Pravna podlaga je člen 6(1)(a) GDPR (soglasje).",
            "Izrecno smo omejili analizo: Googlovi signali in personalizacija oglasov so izklopljeni. Zato ne nastajajo profili med napravami in ciljne skupine za oglaševanje, in ne posredujemo podatkov o uporabi oglaševalskim omrežjem. Združevanje z vašim uporabniškim računom ne poteka.",
            "Google obdeluje podatke kot naš obdelovalec na podlagi pogodbe v skladu s členom 28 GDPR (Google Ads Data Processing Terms). Skrajšanje vašega IP-naslova poteka na strežnikih v EU, preden se podatki prenesejo v ZDA; torej se posreduje psevdonimiziran nabor podatkov. Podlaga za prenos je odločba Evropske komisije o ustreznosti za EU-US Data Privacy Framework (člen 45 GDPR), pod katero je Google LLC certificiran; poleg tega je Google vključil standardne pogodbene klavzule Evropske komisije (člen 46 GDPR). Izrecno opozarjamo, da lahko ameriški organi v skladu s členom 702 FISA dostopajo tudi do podatkov certificiranih podjetij in zato preostalega tveganja ni mogoče popolnoma izključiti. Poleg tega velja [Googlova politika zasebnosti](https://policies.google.com/privacy).",
            "Trajanje shranjevanja: Podatki o dogodkih in uporabnikih se v naši lastnini samodejno izbrišejo po 14 mesecih; združeni podatki poročil brez povezave s posameznimi obiskovalci ostanejo shranjeni. Vaše soglasje samo poteče po šestih mesecih.",
            "Brez vašega soglasja se nič ne naloži, ne nastavi se piškotek in Googlu ne tečejo podatki. Svoje soglasje lahko kadar koli prekličete prek ikone piškotka v spodnjem levem kotu vsake strani; merjenje se nato takoj konča in omenjeni piškotki se izbrišejo. Po šestih mesecih vas bomo ponovno vprašali.",
          ],
        },
        {
          titel: "Oglaševanje in merjenje uspešnosti",
          paragraphs: [
            "Z vašim soglasjem uporabljamo tržne piškotke za merjenje uspešnosti našega oglaševanja in prikazovanje ustreznih oglasov na drugih platformah. Vključeni so Meta Platforms Ireland (Meta-Pixel, piškotek _fbp), LinkedIn Ireland (Insight-Tag, piškotka li_gc in bcookie) in Google Ireland Limited (Google Ads, piškotek _gcl_au). Pravna podlaga je člen 6(1)(a) GDPR. Brez vašega soglasja noben od teh skriptov ne bo naložen in noben piškotek ne bo nastavljen; ob preklicu jih bomo izbrisali. Podrobnosti o vsakem piškotku so na voljo v [Pravilniku o piškotkih](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Uporabniški račun in uporaba platforme",
      paragraphs: [
        "Za registracijo in vodenje računa obdelujemo podatke, ki jih vnesete vi ali vaš obrat: ime, firmo in pravno obliko, naslov, e-poštni naslov, telefonsko številko, vlogo in pooblastila, registrske podatke (npr. številko vpisa v poslovni register ali identifikacijsko številko za DDV), bančno povezavo za izplačila ter vsebine, ki se ustvarijo v računu.",
        "Za zavarovanje dostopa poleg tega obdelujemo dnevnike prijav (čas, naslov IP, napravo in brskalnik ob prijavi) in — če je vklopljena — podatke dvostopenjskega preverjanja pristnosti.",
        "Prijava z Google: namesto z e-poštnim naslovom in geslom se lahko prijavite tudi z računom Google. Če izberete to pot, od družbe Google Ireland Limited prejmemo izključno vaš e-poštni naslov, vaše ime, vašo profilno sliko in oznako vašega računa Google (obsegi „openid“, „email“, „profile“) — izrecno nobenega dostopa do vaše e-pošte, stikov, datotek ali koledarja. Vašega gesla za Google ne izvemo. Google pri tem obdeluje postopek prijave kot samostojen upravljavec; velja [izjava o varstvu podatkov družbe Google](https://policies.google.com/privacy). Pravna podlaga je člen 6(1)(b) GDPR, saj prijava služi izvajanju pogodbe; izbira te poti prijave je prostovoljna in jo lahko kadar koli nadomestite s prijavo z e-poštnim naslovom in geslom.",
        "Pravna podlaga je člen 6(1)(b) GDPR (izvajanje pogodbe o uporabi, glejte [splošne pogoje poslovanja](" +
          AGB_URL +
          ")), za zavarovanje dostopa člen 6(1)(f) GDPR, za hrambo iz davčnih in gospodarskopravnih razlogov pa člen 6(1)(c) GDPR.",
      ],
    },
    {
      heading: "Rezervacije, podatki gostov in podatki o objektih",
      paragraphs: [
        "Prek platforme se obdelujejo rezervacije, podatki gostov, sporočila, opravila in obračuni. Med njimi so zlasti ime in kontaktni podatki gosta, prihod in odhod, število potnikov, cene in stanje plačila, potek sporočil ter — če jih obrat evidentira — prijavni podatki in posebne želje.",
        "Ta obdelava poteka po naročilu in navodilih posameznega obrata. Teh podatkov ne uporabljamo za lastne namene, ne za oglaševanje in ne za učenje modelov umetne inteligence.",
        "Znotraj obrata so podatki ločeni po vlogah: čistilno in servisno osebje ne vidi finančnih in prodajnih podatkov, lastniki pa le svoje objekte. Med različnimi obrati so podatki tehnično ločeni (pravila dostopa, vezana na najemnika, neposredno v podatkovni zbirki).",
      ],
    },
    {
      heading: "Obdelava plačil",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Plačila s kartico in izplačila potekajo prek družbe Stripe Payments Europe, Limited, Irska. Pri tem se družbi Stripe posredujejo podatki, potrebni za plačilo (znesek, valuta, plačilno sredstvo, ime, e-poštni naslov, sklic rezervacije), za račune naših strank pa z zakonom predpisani identifikacijski podatki (imetnik, dejanski lastniki, podatki iz osebnega dokumenta, bančna povezava). Popolni podatki o kartici do naših sistemov ne pridejo. Pravni podlagi sta člen 6(1)(b) GDPR in, za obveznosti identifikacije in preprečevanja pranja denarja, člen 6(1)(c) GDPR. Podrobnosti ureja [izjava o varstvu podatkov družbe Stripe](https://stripe.com/privacy).",
            "Plačilne povezave za dodatne storitve: če obrat svojemu gostu obračuna dodatno storitev (npr. čiščenje ali perilo) prek plačilne povezave, ta povezava vodi na plačilno stran, ki jo upravlja Stripe. Za to družbi Stripe posredujemo naziv storitve, znesek, valuto in interni sklic na rezervacijo in obrat; logotip obrata se prenese na njegov račun Stripe, da stran prikazuje njegovo znamko. Na sami plačilni strani Stripe zbira plačilne podatke in podatke o napravi gosta v lastni odgovornosti. K nam se vrnejo le stanje plačila, znesek, zadržani zneski in oznake plačila — nobeni podatki o kartici.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Če obrat ponuja PayPal kot način plačila, se plačilni podatki posredujejo družbi PayPal (Europe) S.à r.l. et Cie, S.C.A., Luksemburg. Velja [izjava o varstvu podatkov družbe PayPal](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Prodajni kanali in portali",
      paragraphs: [
        "Če obrat svoje objekte prodaja prek portalov, kot so Booking.com, Airbnb ali Expedia, se razpoložljivost, cene, omejitve in rezervacijski podatki izmenjujejo s posameznim portalom prek našega ponudnika povezav Channex.io Ltd, Združeno kraljestvo. Iz te smeri prejemamo rezervacijske podatke in podatke gostov s portala.",
        "Za posamezni portal veljajo njegova lastna določila o varstvu podatkov; v tem obsegu je portal samostojen upravljavec. Pravna podlaga posredovanja je člen 6(1)(b) GDPR v povezavi z naročilom obrata.",
      ],
    },
    {
      heading: "Komunikacija",
      unterpunkte: [
        {
          titel: "E-pošta",
          paragraphs: [
            "E-poštna sporočila v okviru uporabe (potrditve rezervacij, sistemska sporočila, podpora, potrditvene in vabilne povezave) pošiljamo in prejemamo prek lastnega poštnega strežnika, ki ga upravljamo sami. Za ta sporočila ni vključena nobena zunanja storitev pošiljanja.",
          ],
        },
        {
          titel: "E-novice in prednaročilo",
          paragraphs: [
            "Na našem spletnem mestu se lahko prijavite na novice o myNextDays (prednaročilo/e-novice). Pri tem se obdelujejo vaš e-poštni naslov, jezik in mesto, na katerem ste se prijavili.",
            "Prijava poteka po postopku dvojne privolitve: po vpisu prejmete e-poštno sporočilo s potrditveno povezavo; prijava začne veljati šele s klikom na to povezavo. Za dokazovanje privolitve shranimo čas prijave in potrditve, pri tem uporabljeni naslov IP, oznako brskalnika in besedilo, s katerim ste soglašali. Ti podatki služijo izključno dokazovanju po členu 7(1) GDPR in se ne vrednotijo za oglaševanje.",
            "Pravna podlaga je vaša privolitev po členu 6(1)(a) GDPR; hrambo dokaza opiramo na člen 6(1)(c) v povezavi s členom 7(1) GDPR. Privolitev lahko kadar koli prekličete z učinkom za naprej — prek povezave za odjavo v vsakem sporočilu e-novic ali neformalno po e-pošti na nas. Preklic ne vpliva na zakonitost obdelave, izvedene do tega trenutka.",
            "Za upravljanje in pošiljanje e-novic uporabljamo Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Francija; nemška podružnica: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin) kot obdelovalca. Posredujeta se vaš e-poštni naslov in navedeni dodatni podatki (jezik, vir). Podatki se obdelujejo na strežnikih v Evropski uniji (Francija in Nemčija); z družbo Brevo je sklenjena pogodba o obdelavi podatkov po členu 28 GDPR. Velja [izjava o varstvu podatkov družbe Brevo](https://www.brevo.com/legal/privacypolicy/).",
            "Ko pošljemo e-novice, Brevo za nas meri, ali je bilo sporočilo odprto in ali je bilo kliknjeno na povezave v njem. To merjenje nam pomaga prilagajati vsebino in pogostost; je del privolitve in se konča z vašo odjavo. Do združevanja z drugimi viri podatkov ali do oblikovanja profilov ne pride.",
            "Dokler potrditve ni, vašemu naslovu ne pošiljamo ničesar in ga ne posredujemo družbi Brevo; nepotrjen vpis zapade po sedmih dneh. Po odjavi naslov blokiramo za pošiljanje, dokaz o privolitvi in odjavi pa hranimo tako dolgo, dokler je iz njega mogoče uveljavljati zahtevke; na zahtevo ga v celoti izbrišemo.",
          ],
        },
        {
          titel: "Sporočila na platformi",
          paragraphs: [
            "Sporočila med gostom in obratom se shranjujejo na platformi, da lahko obe strani vpogledata v njihov potek. Če obrat blokira gosta, se sporočilni kanal zapre; obstoječa sporočila ostanejo ohranjena zaradi sledljivosti.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Če obrat uporablja povezavo z WhatsApp, se vsebine sporočil in telefonske številke udeleženih posredujejo prek platforme WhatsApp Business Platform družbe Meta Platforms Ireland Limited. O uporabi te funkcije odloča obrat; brez vklopa do posredovanja ne pride.",
          ],
        },
      ],
    },
    {
      heading: "Samodejne funkcije in umetna inteligenca",
      paragraphs: [
        "Za funkcije, opisane v tem poglavju, poleg GDPR velja Uredba (EU) 2024/1689 (akt o umetni inteligenci, „AI Act“), katere obveznosti glede preglednosti iz člena 50 se uporabljajo od 2. avgusta 2026.",
      ],
      unterpunkte: [
        {
          titel: "Predlogi odgovorov",
          paragraphs: [
            "Za predloge odgovorov v prejeti pošti sporočil uporabljamo — če je funkcija za obrat vklopljena — ponudbo jezikovnih modelov družbe Groq, Inc., ZDA. Pri tem se storitvi posreduje posamezni kontekst sporočila. Predlogi se ne pošiljajo samodejno; o pošiljanju vedno odloča človek. Do samodejnega sprejemanja odločitev s pravnim učinkom v smislu člena 22 GDPR ne pride.",
            "Ne gre torej za sistem umetne inteligence, ki bi v smislu člena 50(1) akta o umetni inteligenci neposredno komuniciral s fizičnimi osebami: obveznost predpostavlja NEPOSREDNO interakcijo, pri kateri umetna inteligenca sama komunicira z osebo in ne prek človeškega posrednika. Tu funkcija obratu predlaga besedilo, ki ga zaposleni preveri, lahko spremeni in sam pošlje — zaposleni je ta posrednik, gost si dopisuje z obratom in ne s klepetalnim robotom. Samodejno odgovarjajoč pomočnik ni v uporabi. Po naši presoji funkcija tudi ne izpolnjuje nobenega od primerov umetne inteligence velikega tveganja iz Priloge III k aktu o umetni inteligenci.",
            "Sporočila gostom poleg tega niso „besedilo o zadevah javnega interesa“ v smislu člena 50(4) akta o umetni inteligenci: niso objavljena, temveč posamično poslana določeni osebi, in se nanašajo na izvedbo bivanja. Neodvisno od tega tu velja človeški pregled s strani zaposlenega, ki sporočilo pošlje.",
            "Če bi bila v prihodnje ponujena funkcija, ki gostom odgovarja samodejno — brez človeške odobritve —, bo gost na začetku pogovora vidno opozorjen, da piše s sistemom umetne inteligence. Brez tega opozorila taka funkcija ne bo dana na voljo.",
          ],
        },
        {
          titel: "Vloge po aktu o umetni inteligenci",
          paragraphs: [
            "Za funkcije umetne inteligence, vgrajene v izdelek, smo uvajalec v smislu člena 3(4) akta o umetni inteligenci; ponudniki jezikovnih modelov, na katerih temeljijo, so posamezni ponudniki modelov. Če obrat te funkcije uporablja v okviru svoje poklicne dejavnosti, je za to sam uvajalec in ga zadeva obveznost pismenosti na področju umetne inteligence po členu 4 akta o umetni inteligenci, ki velja od 2. februarja 2025 neodvisno od velikosti podjetja. Od 27. julija 2026 velja v besedilu Uredbe (EU) 2026/1744: ponudniki in uvajalci sprejmejo ukrepe za podporo razvoju pismenosti svojega osebja na področju umetne inteligence; določene ravni pri tem izrecno ni treba zagotoviti. Podpiramo z napotki v aplikaciji in v našem središču za pomoč; usposabljanje lastnih zaposlenih ostaja naloga obrata.",
            "Če obrat svoj račun poveže z lastnim pomočnikom umetne inteligence (glejte naslednjo točko), je tudi za to uvajalec v smislu akta o umetni inteligenci — odloča o uporabi in oblikuje poizvedbe. Vmesnik sam ni sistem umetne inteligence: bere podatke iz podatkovne zbirke in jih izpiše, brez sklepanja; uvodna izjava 12 akta o umetni inteligenci take sisteme izrecno razmejuje od umetne inteligence.",
          ],
        },
        {
          titel: "Povezava z lastnim pomočnikom umetne inteligence",
          paragraphs: [
            "Obrat lahko svoj račun prek vmesnika poveže s pomočnikom umetne inteligence, ki ga je izbral sam in z katerim ima lastno pogodbo — na primer Claude družbe Anthropic PBC, ZDA. Če je taka povezava dana, lahko pomočnik na poizvedbo obrata bere: zasedenost, razpoložljivost in dnevne cene; rezervacije z imenom gosta, obdobjem bivanja, objektom, rezervacijskim kanalom, stanjem ter zneskom in valuto, če vloga poizvedujočega računa sme videti zneske; in pregled pogovorov v prejeti pošti. Brez dane povezave do posredovanja ne pride.",
            "Pri tem se ne posredujejo e-poštni naslov in telefonska številka gostov, podatki o kartici, bančne povezave in plačilni dokumenti, dostopne kode ter dosjeji objektov. Opombe k rezervacijam in vsebina sporočil gostov so privzeto izvzete, ker lahko vsebujejo navedbe o zdravju ali druge posebne vrste podatkov po členu 9 GDPR; obrat jih mora pri dajanju povezave izrecno in ločeno sprostiti.",
            "Povezavo lahko da le račun z vlogo „skrbnik“, ne vsak račun z dostopom. Vsaka poizvedba se beleži in je za obrat na vpogled v razdelku „Račun → Povezave“; povezavo lahko tam kadar koli prekine in dostop se s tem takoj konča.",
            "Pravno je to posredovanje navodilo obrata, naslovljeno na nas (člen 28(3)(a) GDPR). Ponudnik pomočnika ni naš podobdelovalec — ne naročamo mu in mu ne dajemo navodil; podatke obdeluje na podlagi pogodbe, ki jo je obrat z njim sklenil sam. Za pravno podlago te obdelave, za obveščanje svojih gostov in za zagotovila pri prenosu v tretjo državo je zato odgovoren obrat.",
          ],
        },
        {
          titel: "Prevodi",
          paragraphs: [
            "Besedila objektov in vsebinska besedila je mogoče prevajati prek Cloud Translation API družbe Google Ireland Limited. Pri tem se posredujejo besedila, ki jih je treba prevesti; osebni podatki le, kolikor so v teh besedilih vsebovani.",
          ],
        },
        {
          titel: "Priporočila cen",
          paragraphs: [
            "Za priporočila cen dostopamo do tržnih, vremenskih in tečajnih podatkov zunanjih virov. Te poizvedbe ne vsebujejo osebnih podatkov, temveč le kraj, obdobje in značilnosti objekta.",
          ],
        },
      ],
    },
    {
      heading: "Spletna mesta in domene naših strank",
      paragraphs: [
        "Če obrat prek gradnika ustvari lastno spletno mesto z lastno domeno, za to potrebne zapise DNS upravljamo prek družbe Cloudflare, Inc. Pri tem se posredujejo podatki o domeni in konfiguraciji; podatke obiskovalcev spletnega mesta stranke obdelujemo tako, kot je opisano v tej izjavi.",
        "Za vsebine, imprint in informacije o varstvu podatkov na spletnem mestu stranke je odgovoren posamezni obrat.",
      ],
    },
    {
      heading: "Gostovanje in shranjevanje",
      paragraphs: [
        "Platforma, podatkovna zbirka, mediji in poštni strežnik tečejo na strežnikih družbe Hetzner Online GmbH, Nemčija, v podatkovnem središču Helsinki (Finska) — torej v Evropski uniji. Z družbo Hetzner je sklenjena pogodba o obdelavi podatkov.",
        "Varnostne kopije se izdelujejo šifrirano in se šifrirane hranijo pri ponudniku shranjevanja v EU.",
      ],
    },
    {
      heading: "Prejemniki v pregledu",
      paragraphs: [
        "Razen navedenim ponudnikom storitev osebne podatke posredujemo le, kadar smo k temu zakonsko zavezani (npr. davčnim organom, organom kazenskega pregona) ali kadar to zahtevate vi oziroma odgovorni obrat.",
      ],
      list: [
        "Hetzner Online GmbH (Nemčija/Finska) — gostovanje, podatkovna zbirka, mediji, poštni strežnik",
        "Stripe Payments Europe, Limited (Irska) — plačila, izplačila, preverjanje istovetnosti",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luksemburg) — plačila, če je vklopljeno",
        "Channex.io Ltd (Združeno kraljestvo) — povezava z rezervacijskimi portali",
        "Meta Platforms Ireland Limited (Irska) — sporočila WhatsApp, če je vklopljeno",
        "Sendinblue SAS / Brevo (Francija, Nemčija) — upravljanje in pošiljanje e-novic, le ob privolitvi",
        "Google Ireland Limited (Irska) — prevodi; zaščita kontaktnega obrazca pred nezaželeno pošto (reCAPTCHA Enterprise), le ob privolitvi; prijava z Google, če se uporablja; Merjenje dosega (Google Analytics 4), samo s soglasjem",
        "Groq, Inc. (ZDA) — predlogi odgovorov, če je vklopljeno",
        "Cloudflare, Inc. (ZDA) — upravljanje DNS za domene strank",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Na tem seznamu niso storitve, ki jih obrat sam dogovori s tretjo osebo in jih prek vmesnika poveže s svojim računom — na primer pomočnik umetne inteligence, kot je Claude družbe Anthropic PBC, ZDA. To niso ponudniki storitev, ki bi jih naročili mi, temveč prejemniki po navodilu posameznega obrata; brez njegove povezave tja ne stečejo nobeni podatki. Anthropic po uradnem seznamu udeležencev ministrstva za trgovino ZDA ni certificirana v okviru EU-US Data Privacy Framework; prenos se zato opira na standardna določila o varstvu podatkov, za katera mora odgovarjati posamezni obrat kot upravljavec.",
          ],
        },
      ],
    },
    {
      heading: "Prenos v tretje države",
      paragraphs: [
        "Obdelava načeloma poteka v EU. Pri zgoraj navedenih storitvah s sedežem zunaj EU lahko pride do prenosa v tretjo državo.",
        "Pri Groq, Inc. in Cloudflare, Inc. (ZDA) prenos opiramo na standardna določila o varstvu podatkov Evropske komisije po členu 46(2)(c) GDPR, kolikor se prejemnik ne more sklicevati na sklep o ustreznosti (EU-US Data Privacy Framework).",
        "Pogodbeni partner pri obdelavi plačil je Stripe Payments Europe, Limited (Irska). Kolikor Stripe pri tem uporablja Stripe, LLC (ZDA), je ta certificirana v okviru EU-US Data Privacy Framework; prenos se v tem obsegu opira na sklep Evropske komisije o ustreznosti po členu 45 GDPR. Dopolnilno veljajo standardna določila o varstvu podatkov iz [pogodbe o obdelavi podatkov družbe Stripe](https://stripe.com/legal/dpa).",
        "Za Channex.io Ltd (Združeno kraljestvo) velja sklep Evropske komisije o ustreznosti za Združeno kraljestvo; če ta preneha, se uporabijo standardna določila o varstvu podatkov.",
      ],
    },
    {
      heading: "Dostop organov tretjih držav (US CLOUD Act)",
      paragraphs: [
        "Ponudniki, ki so podvrženi pravni pristojnosti Združenih držav, so lahko po ameriškem zakonu CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) zavezani izročiti podatke organom ZDA — tudi kadar so ti podatki na strežnikih v Evropski uniji. Tak dostop je lahko v nasprotju z GDPR, ponudniku pa je lahko pravno preprečeno, da bi o njem obvestil nas ali vas. Niti sklep o ustreznosti glede EU-US Data Privacy Framework niti standardna določila o varstvu podatkov tega tveganja ne izključujejo.",
        "To tveganje omejujemo s tem, da nosilne sisteme — platformo, podatkovno zbirko, medije, poštni strežnik in varnostne kopije — upravljajo evropski ponudniki v EU, kjer pravna pristojnost ZDA ne velja.",
      ],
      unterpunkte: [
        {
          titel: "Zadevne storitve",
          paragraphs: [
            "Pravna pristojnost ZDA pride v poštev izključno pri naslednjih, jasno razmejenih dodatnih storitvah:",
          ],
          list: [
            "Groq, Inc. (ZDA) — predlogi odgovorov v prejeti pošti sporočil, le če obrat funkcijo vklopi. Posreduje se posamezni kontekst sporočila.",
            "Cloudflare, Inc. (ZDA) — upravljanje DNS za domene strank. Posredujejo se podatki o domeni in konfiguraciji, nobeni podatki gostov.",
            "Google LLC (ZDA) – ob prijavi z Googlom, pri prevodih in pri merjenju dosega (Google Analytics 4, samo s soglasjem); pogodbeni partner je Google Ireland Limited, vendar dostop matične družbe v ZDA ni izključen.",
          ],
        },
        {
          titel: "Možnost izogniti se",
          paragraphs: [
            "Uporaba platforme je mogoča brez teh storitev: predloge odgovorov je mogoče izklopiti, upravljanje DNS zadeva le stranke z lastno domeno, prijava z Google pa je prostovoljna možnost namesto prijave z e-poštnim naslovom in geslom.",
          ],
        },
        {
          titel: "Razmejitev do evropskega prava",
          paragraphs: [
            "CLOUD Act je ameriško pravo, ne pravo Evropske unije. Razlikovati ga je treba od EU Data Act (Uredba (EU) 2023/2854), ki ureja menjavo ponudnika in prenosljivost pri storitvah obdelave podatkov, ter od Cloud and AI Development Act, ki je ob nastanku te izjave v evropskem zakonodajnem postopku.",
          ],
        },
      ],
    },
    {
      heading: "Obdobje hrambe",
      list: [
        "Podatki računa: za čas trajanja poslovnega razmerja; nato izbris, kolikor ne obstaja obveznost hrambe.",
        "Rezervacijski, računski in plačilni podatki: po danskem zakonu o računovodstvu pet let po koncu poslovnega leta, ki se jim pripišejo; pri strankah s sedežem v Nemčiji lahko veljajo daljši gospodarskopravni in davčnopravni roki.",
        "Sporočila in podatki gostov na platformi: po navodilih odgovornega obrata, najdlje do izbrisa z njegove strani oziroma do prenehanja pogodbe.",
        "E-novice: do preklica privolitve; nepotrjene prijave zapadejo po sedmih dneh. Dokaz o privolitvi in odjavi ostane poleg tega ohranjen tako dolgo, dokler je potreben kot dokaz.",
        "Dnevniki prijav in varnostni dogodki: kratkotrajno, za zaznavanje napadov.",
        "Dnevniške datoteke strežnika: le tako dolgo, kot je potrebno za delovanje in varnost.",
        "Varnostne kopije: krožno, dokler jih ne nadomestijo novejše kopije.",
      ],
    },
    {
      heading: "Vaše pravice",
      paragraphs: [
        "Imate pravico do dostopa (člen 15), popravka (člen 16), izbrisa (člen 17), omejitve obdelave (člen 18), prenosljivosti podatkov (člen 20) in ugovora zoper obdelave na podlagi zakonitih interesov (člen 21 GDPR). Dano privolitev lahko kadar koli prekličete z učinkom za naprej.",
        `Za to se obrnite na [${ANBIETER.email}](mailto:${ANBIETER.email}). Če se vaši podatki nanašajo na uporabo platforme s strani obrata, vašo zahtevo posredujemo odgovornemu obratu ali ga podpremo pri odgovoru.`,
        `Poleg tega lahko vložite pritožbo pri nadzornem organu za varstvo podatkov — za nas je pristojen ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Obrnete se lahko tudi na nadzorni organ v kraju svojega prebivališča.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Nicht mit „Ihre Rechte" zusammenlegen.
      heading: "Izbris računa in podatkov aplikacije",
      paragraphs: [
        "Izbris svojega računa lahko kadar koli zahtevate sami — v aplikaciji pod „Profil → Račun“ ali prek našega obrazca na spletu:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "Pot na spletu namenoma deluje tudi tedaj, ko aplikacije nimate več nameščene ali se ne morete več prijaviti. Zaradi zaščite pred zlorabo poteka v dveh korakih: vnesete e-poštni naslov svojega računa in prav na ta naslov prejmete potrditveno povezavo. Zahteva postane veljavna šele s klikom nanjo — sam vnesen naslov ne povzroči ničesar. Zahtevo obravnavamo v 30 dneh in odgovorimo po e-pošti.",
        "Z računom izbrišemo vaše dostopne podatke, vaš profil, vaše podatke o objektih in koledarju ter vaša sporočila. Ne izbrišejo se listine, za katere velja zakonska obveznost hrambe — zlasti računi in rezervacijske listine obračunanih obdobij (obveznost vodenja knjig po danskem pravu, praviloma pet let). Te listine se za čas roka blokirajo, torej hranijo izključno za izpolnitev te obveznosti, in se nato izbrišejo.",
      ],
    },
    {
      heading: "Varnost obdelave",
      paragraphs: [
        "Obdelavo zavarujemo s tehničnimi in organizacijskimi ukrepi po členu 32 GDPR, zlasti: dosledno šifriranje prenosa (TLS), pravila dostopa, vezana na najemnika, neposredno v podatkovni zbirki, pooblastila na podlagi vlog z ločitvijo finančnih in servisnih podatkov, izbirno dvostopenjsko preverjanje pristnosti, omejitev poskusov prijave, šifrirane varnostne kopije z rednim preizkusom obnovitve ter beleženje varnostno pomembnih dogodkov.",
      ],
    },
    {
      heading: "Obveznost zagotovitve podatkov",
      paragraphs: [
        "Podatki, ki jih potrebujemo za sklenitev pogodbe, obračun in izpolnjevanje zakonskih obveznosti, so nujni — brez njih platforme ne moremo zagotoviti. Vsi drugi podatki so prostovoljni.",
      ],
    },
    {
      heading: "Spremembe te izjave",
      paragraphs: [
        "To izjavo prilagodimo, kadar se spremenijo obdelava, uporabljeni ponudniki storitev ali pravni položaj. Velja vsakokrat tu objavljena različica; datum zgoraj prikazuje stanje.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte Export
// bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default datenschutz;
