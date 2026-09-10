// Irische Fassung der Datenschutzerklärung — Übersetzung von `de.ts`.
//
// Inhaltliche Änderungen gehören ZUERST in `de.ts` (dort stehen die Belege zu
// Empfängern, Rechtsgrundlagen und offenen Punkten) und werden von dort in
// diese Datei nachgezogen. Struktur und Reihenfolge müssen `de.ts` entsprechen.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Fógra Príobháideachais",
  metaDescription:
    "Conas a phróiseálann myNextDays sonraí pearsanta: cuspóirí, bunúis dlí, faighteoirí, tréimhsí coinneála agus do chearta faoin RGCS.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Míníonn an fógra seo conas a phróiseálann ${ANBIETER.firma} sonraí pearsanta — nuair a thugtar cuairt ar an suíomh gréasáin seo, nuair a úsáidtear ardán myNextDays (an deais, an margadh agus an aip mhóibíleach) agus faoi chuimsiú an chaidrimh ghnó atá againn lenár gcustaiméirí.`,
    "Ní dhíolaimid sonraí agus ní chruthaímid próifílí a shainaithníonn tú mar dhuine. Ar an suíomh Gréasáin seo, ní thomhaisimid – ach le do thoiliú – raon feidhme ár leathanaigh agus rath ár bhfógraíochta; is féidir an dá chatagóir a dhíroghnú ina n-aonar (féach na hailt Tomhas Raon Feidhme agus Fógraíocht agus Tomhas Rathúlachta).. Maidir le fógraíocht, ní phróiseálaimid sonraí ach amháin nuair a thug tú toiliú sainráite – is é sin dár nuachtlitir (féach an rannán Cumarsáide), ar féidir leat díliostáil uaithi am ar bith le cliceáil amháin.",
  ],
  sections: [
    {
      heading: "Rialaitheoir",
      paragraphs: [
        "Is é an rialaitheoir atá freagrach as na gníomhaíochtaí próiseála a bhfuil cur síos orthu san fhógra seo:",
      ],
      zeilen: [
        {
          label: "Cuideachta",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Seoladh",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Ríomhphost",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Teileafón",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Raon feidhme agus róil",
      unterpunkte: [
        {
          paragraphs: [
            "Maidir le cuairt ar an suíomh gréasáin seo, le do chuntas custaiméara agus le riar ár gcaidrimh ghnó, is rialaitheoir sinne de réir bhrí Airteagal 4(7) den RGCS.",
          ],
        },
        {
          paragraphs: [
            "Maidir leis na sonraí a phróiseálann ár gcustaiméirí (tiarnaí talún, óstáin, gníomhaireachtaí) ar an Ardán faoi na haíonna, na húinéirí agus an fhoireann atá acu, is rialaitheoirí na custaiméirí agus is próiseálaí sinne de bhun Airteagal 28 den RGCS. Tá na sonraí sa [chomhaontú próiseála sonraí](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Má dhéanann tú áirithint ar chóiríocht mar aoi trínár margadh, próiseálaimid do shonraí áirithinte agus teagmhála inár n-ainm féin (oibriú an mhargaidh, próiseáil íocaíochtaí) agus thar ceann an ghnólachta óstaigh chomh maith. Ní thugtar do chonradh lóistín i gcrích ach leis an ngnólacht amháin; tá fógra príobháideachais an ghnólachta sin i bhfeidhm freisin.",
          ],
        },
      ],
    },
    {
      heading: "Cuairt ar an suíomh gréasáin seo",
      unterpunkte: [
        {
          titel: "Logchomhaid an fhreastalaí",
          paragraphs: [
            "Gach uair a dhéantar iarratas, seolann do bhrabhsálaí sonraí a bhfuil gá teicniúil leo, agus déanann ár bhfreastalaí gréasáin logáil orthu: seoladh IP, dáta agus am, an seoladh a iarradh, méid na sonraí a aistríodh, an cód stádais, an tagarcán agus aitheantóir an bhrabhsálaí. Is é an cuspóir an leathanach a sholáthar mar aon le hionsaithe agus cur isteach a bhrath agus a chosc. Is é Airteagal 6(1)(f) den RGCS an bunús dlí; is é ár leas dlisteanach oibriú slán agus cobhsaí. Ní choinnítear na logchomhaid ach chomh fada agus is gá le haghaidh oibriú agus slándáil, agus ní chomhcheanglaítear iad le sonraí eile.",
          ],
        },
        {
          titel: "Clófhoirne",
          paragraphs: [
            "Tá na clófhoirne a úsáidtear leabaithe go háitiúil ar ár bhfreastalaí féin. Ní dhéantar aon nasc le Google Fonts ná le seirbhís chlófhoirne eile.",
          ],
        },
        {
          titel: "Siombailí",
          paragraphs: [
            "Tá siombailí an tsuímh ghréasáin seo againne, díreach mar atá na clófhoirne: cuirtear isteach sa leathanach ar ár bhfreastalaí féin iad agus ní luchtaítear iad ó sheirbhís siombailí. Ní dhéantar aon nasc le tríú páirtí agus ní aistrítear do sheoladh IP chuig aon duine.",
          ],
        },
        {
          titel: "Cosaint ar thurscar don fhoirm teagmhála (reCAPTCHA)",
          paragraphs: [
            "Tá ár bhfoirm teagmhála cosanta ar mhórsheoltaí uathoibrithe le reCAPTCHA Enterprise ó Google Ireland Limited. Ní luchtaíonn do bhrabhsálaí script ó www.google.com le linn na foirme a líonadh ach amháin má thoilíonn tú leis; aistrítear ansin do sheoladh IP agus faisnéis faoi d’idirghníomhaíocht leis an bhfoirm chuig Google, agus déantar anailís uirthi ansin chun idirdhealú a dhéanamh idir duine agus script. Is é Airteagal 6(1)(a) den RGCS (toiliú) an bunús dlí; ina theannta sin tá [fógra príobháideachais Google](https://policies.google.com/privacy) i bhfeidhm.",
            "Gan aon toiliú uait, ní lódálfar aon rud ó Google agus ní shreabhfaidh aon sonraí chuige; ní ghlacfaimid leis an bhfoirm ansin, ach is féidir leat ríomhphost a sheoladh chugainn am ar bith. Má thugann tú toiliú, socraíonn reCAPTCHA a fhianán féin (_GRECAPTCHA, tréimhse bailíochta socraithe ag Google, suas le sé mhí), a úsáidtear le haghaidh measúnú riosca. Is féidir leat do thoiliú a athrú nó a tharraingt siar am ar bith tríd an deilbhín fianán ag bun ar chlé gach leathanaigh; scriosfar an fianán ansin.",
          ],
        },
        {
          titel: "Tomhas Teachta (Google Analytics)",
          paragraphs: [
            "Ar an suíomh Gréasáin seo, le Google Analytics 4 ó Google Ireland Limited, déanaimid tomhas ar an gcaoi a n-úsáidtear ár leathanaigh — cé na leathanaigh a dtugtar cuairt orthu, cá as a dtagann cuairteoirí, agus cén áit a n-éiríonn siad as. Is é an t-aon chuspóir ná feabhas a chur ar an tairiscint agus ar an inaimsitheacht.",
            "Ní dhéantar luchtú ach amháin le do thoiliú. Má thugann tú do thoiliú, luchtóidh do bhrabhsálaí script ó www.googletagmanager.com agus stórálfaidh sé dhá fhianán (“_ga” agus “_ga_<Aitheantóir>”, bailí ar feadh suas le dhá bhliain) le haitheantóir randamach ginte; seoltar an t-aitheantóir seo, na leathanaigh ar tugadh cuairt orthu, an foinse atreoraithe, an suíomh neasach ar leibhéal na tíre nó an réigiúin, an gléas agus an brabhsálaí, chomh maith le do sheoladh IP, a ghiorraíonn Google sula stóráiltear é. Is é an bonn dlíthiúil Airteagal 6(1)(a) den RGPD (toiliú).",
            "Tá an anailís teoranta againn go sainráite: tá Comharthaí Google agus pearsanú fógraíochta díchumasaithe. Dá bhrí sin, ní chruthaítear próifílí tras-ghléasanna ná spriocghrúpaí le haghaidh fógraíochta, agus ní roinnimid sonraí úsáide le líonraí fógraíochta. Ní dhéantar comhcheangal le do chuntas custaiméara.",
            "Próiseálann Google na sonraí mar ár bpróiseálaí ar bhonn conartha de réir Airteagal 28 den RGPD (Téarmaí Próiseála Sonraí Google Ads). Giorraítear do sheoladh IP ar fhreastalaithe san AE sula n-aistrítear sonraí chuig na SA; mar sin, aistrítear tacar sonraí bréag-ainmneach. Is é an bonn don aistriú ná cinneadh leordhóthanachta an Choimisiúin Eorpaigh maidir le Creat Príobháideachta Sonraí an AE-SAM (Airteagal 45 den RGPD), faoina bhfuil Google LLC deimhnithe; ina theannta sin, tá clásail chonarthacha chaighdeánacha an Choimisiúin Eorpaigh (Airteagal 46 den RGPD) curtha san áireamh ag Google. Tugaimid faoi deara go sainráite gur féidir le húdaráis na SA, de réir Alt 702 FISA, rochtain a fháil ar shonraí ó chuideachtaí deimhnithe agus dá bhrí sin ní féidir riosca iarmharach a chur as an áireamh go hiomlán. Tá [Beartas Príobháideachta Google](https://policies.google.com/privacy) i bhfeidhm freisin.",
            "Tréimhse stórála: Scriosfar na sonraí a bhaineann le himeachtaí agus le húsáideoirí go huathoibríoch inár maoin tar éis 14 mhí; fanann sonraí tuairiscithe comhiomlánaithe gan tagairt do chuairteoirí aonair ina dhiaidh sin. Rachaidh do thoiliú féin in éag tar éis sé mhí.",
            "Gan do thoiliú, ní luchtófar aon rud, ní shocrófar fianán ar bith, agus ní shreabhfaidh aon sonraí chuig Google. Is féidir leat do thoiliú a tharraingt siar am ar bith tríd an deilbhín fianán ag bun na láimhe clé de gach leathanach; cuirfear deireadh leis an tomhas láithreach ansin agus scriosfar na fianáin luaite. Tar éis sé mhí, iarrfaimid arís.",
          ],
        },
        {
          titel: "Fógraíocht agus Tomhas Feidhmíochta",
          paragraphs: [
            "Le do thoil, úsáidimid fianáin mhargaíochta chun rath ár bhfógraíochta a thomhas agus chun fógraí ábhartha a thaispeáint duit ar ardáin eile. Tá Meta Platforms Ireland (Meta-Pixel, fianán _fbp), LinkedIn Ireland (Insight-Tag, fianáin li_gc agus bcookie) agus Google Ireland Limited (Google Ads, fianán _gcl_au) páirteach. Is é Airteagal 6(1)(a) den RGPD an bonn dlíthiúil. Gan do thoil, ní lódálfar aon cheann de na scripteanna seo agus ní shocrófar aon fhianán; má tharraingíonn tú siar do thoil, scriosfaimid iad. Tá sonraí faoi gach fianán le fáil sa [Bheartas Fianán](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Cuntas custaiméara agus úsáid an Ardáin",
      paragraphs: [
        "Chun cuntas a chlárú agus a oibriú, próiseálaimid an fhaisnéis a chuireann tú féin nó do ghnólacht isteach: ainm, ainm cuideachta agus foirm dhlíthiúil, seoladh, seoladh ríomhphoist, uimhir theileafóin, ról agus ceadanna, sonraí cláir (m.sh. uimhir chláraithe gnó nó uimhir cháin bhreisluacha), sonraí bainc le haghaidh eisíocaíochtaí, mar aon leis an ábhar a chruthaítear sa chuntas.",
        "Chun an rochtain a chosaint, próiseálaimid logaí sínithe isteach freisin (am, seoladh IP, gléas agus brabhsálaí an tsínithe isteach) agus — má tá sé gníomhachtaithe — sonraí an fhíordheimhnithe déthoisc.",
        "Síniú isteach le Google: in ionad ríomhphoist agus pasfhocail, is féidir leat síniú isteach le cuntas Google. Má roghnaíonn tú an tslí sin, ní fhaighimid ó Google Ireland Limited ach do sheoladh ríomhphoist, d’ainm, do phictiúr próifíle agus aitheantóir do chuntais Google (na scónna „openid“, „email“, „profile“) — go sainráite gan aon rochtain ar do ríomhphoist, do theagmhálaithe, do chomhaid ná do fhéilirí. Ní fhaighimid amach do phasfhocal Google. Próiseálann Google an t-imeacht sínithe isteach mar rialaitheoir dá chuid féin; tá [fógra príobháideachais Google](https://policies.google.com/privacy) i bhfeidhm. Is é Airteagal 6(1)(b) den RGCS an bunús dlí, ós rud é go bhfónann an síniú isteach do chomhlíonadh an chonartha; is roghnach an tslí sínithe isteach sin agus is féidir í a mhalartú am ar bith le síniú isteach le ríomhphost agus pasfhocal.",
        "Is é Airteagal 6(1)(b) den RGCS an bunús dlí (comhlíonadh an chonartha úsáide, féach na [Téarmaí agus Coinníollacha Ginearálta](" +
          AGB_URL +
          ")), is é Airteagal 6(1)(f) den RGCS an bunús dlí do chosaint na rochtana agus is é Airteagal 6(1)(c) den RGCS an bunús dlí don choinneáil faoin dlí cánach agus tráchtála.",
      ],
    },
    {
      heading: "Áirithintí, sonraí aíonna agus sonraí réadmhaoine",
      paragraphs: [
        "Próiseáiltear áirithintí, sonraí aíonna, teachtaireachtaí, tascanna agus socraíochtaí tríd an Ardán. Áirítear leo sin go háirithe ainm agus sonraí teagmhála an aoi, na dátaí teachta agus imeachta, líon na dtaistealaithe, praghsanna agus stádas na híocaíochta, cartlanna teachtaireachtaí mar aon le — sa chás go dtaifeadann an gnólacht é — sonraí clárúcháin agus iarratais speisialta.",
        "Déantar an phróiseáil sin thar ceann agus ar threoir an ghnólachta faoi seach. Ní úsáidimid na sonraí sin chun ár gcuspóirí féin, ná le haghaidh fógraíochta, ná chun samhlacha intleachta saorga a thraenáil.",
        "Laistigh de ghnólacht, tá na sonraí deighilte de réir róil: ní fheiceann foireann ghlantacháin ná seirbhíse sonraí airgeadais ná díolacháin, agus ní fheiceann úinéirí ach a réadmhaoine féin. Idir gnólachtaí éagsúla tá na sonraí deighilte go teicniúil (rialacha rochtana bunaithe ar an tionónta sa bhunachar sonraí).",
      ],
    },
    {
      heading: "Próiseáil íocaíochtaí",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Déantar íocaíochtaí cárta agus eisíocaíochtaí trí Stripe Payments Europe, Limited, Éire. Aistrítear chuig Stripe na sonraí is gá le haghaidh na híocaíochta (méid, airgeadra, modh íocaíochta, ainm, seoladh ríomhphoist, tagairt áirithinte) mar aon leis na sonraí sainaitheanta a cheanglaítear le dlí i gcás chuntais ár gcustaiméirí (sealbhóir, úinéirí tairbhiúla, sonraí aitheantais, sonraí bainc). Ní shroicheann sonraí cárta iomlána ár gcórais. Is iad Airteagal 6(1)(b) den RGCS agus, i gcás oibleagáidí sainaitheanta agus frith-sciúradh airgid, Airteagal 6(1)(c) den RGCS na bunúis dlí. Tá na sonraí leagtha amach i [bhfógra príobháideachais Stripe](https://stripe.com/privacy).",
            "Naisc íocaíochta le haghaidh seirbhísí breise: má bhilleálann gnólacht seirbhís bhreise (m.sh. glantachán nó níochán) ar a aoi trí nasc íocaíochta, treoraíonn an nasc sin go leathanach íocaíochta a oibríonn Stripe. Aistrímid chuig Stripe chuige sin ainm na seirbhíse, an méid, an airgeadra mar aon le tagairt inmheánach don áirithint agus don ghnólacht; aistrítear lógó cuideachta an ghnólachta chuig a chuntas Stripe ionas go dtaispeánfaidh an leathanach a bhranda. Ar an leathanach íocaíochta féin, bailíonn Stripe sonraí íocaíochta agus gléis an aoi faoina fhreagracht féin. Ní thagann ar ais chugainn ach stádas na híocaíochta, an méid, na méideanna a coinníodh siar agus aitheantóirí na híocaíochta — ní thagann aon sonraí cárta.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Má thairgeann an gnólacht PayPal mar mhodh íocaíochta, aistrítear na sonraí íocaíochta chuig PayPal (Europe) S.à r.l. et Cie, S.C.A., Lucsamburg. Tá [fógra príobháideachais PayPal](https://www.paypal.com/de/webapps/mpp/ua/privacy-full) i bhfeidhm.",
          ],
        },
      ],
    },
    {
      heading: "Bealaí dáileacháin agus tairseacha",
      paragraphs: [
        "Má dhíolann gnólacht a réadmhaoine trí thairseacha ar nós Booking.com, Airbnb nó Expedia, malartaítear infhaighteachtaí, praghsanna, srianta agus sonraí áirithinte leis an tairseach faoi seach trínár soláthraí nascachta Channex.io Ltd, an Ríocht Aontaithe. Ón treo sin faighimid sonraí áirithinte agus sonraí aíonna na tairsí.",
        "Tá rialacha príobháideachais na tairsí faoi seach i bhfeidhm ina leith sin; sa mhéid sin is rialaitheoir neamhspleách an tairseach. Is é Airteagal 6(1)(b) den RGCS, i gcomhcheangal le treoir an ghnólachta, bunús dlí an aistrithe.",
      ],
    },
    {
      heading: "Cumarsáid",
      unterpunkte: [
        {
          titel: "Ríomhphost",
          paragraphs: [
            "Seolaimid agus faighimid ríomhphoist a bhaineann le húsáid an Ardáin (deimhnithe áirithinte, teachtaireachtaí córais, tacaíocht, naisc dheimhnithe agus cuiridh) trí fhreastalaí ríomhphoist dár gcuid féin a oibrímid sinn féin. Níl aon seirbhís sheolta sheachtrach comhtháite do na teachtaireachtaí sin.",
          ],
        },
        {
          titel: "Nuachtlitir agus réamhchlárú",
          paragraphs: [
            "Ar ár suíomh gréasáin is féidir leat clárú le haghaidh nuachta faoi myNextDays (réamhchlárú/nuachtlitir). Próiseáiltear ansin do sheoladh ríomhphoist, an teanga agus an áit ar chláraigh tú.",
            "Ritheann an clárú trí nós imeachta rogha isteach dhúbailte: tar éis an chláraithe, faigheann tú ríomhphost le nasc deimhnithe; ní bhíonn an clárú i bhfeidhm ach nuair a chliceálann tú air. Chun an toiliú a chruthú, sábhálaimid am an chláraithe agus an deimhnithe, an seoladh IP a úsáideadh, aitheantóir an bhrabhsálaí mar aon leis an bhfoclaíocht ar thoiligh tú léi. Ní fhónann an fhaisnéis sin ach mar chruthúnas de bhun Airteagal 7(1) den RGCS agus ní dhéantar anailís uirthi le haghaidh fógraíochta.",
            "Is é do thoiliú de bhun Airteagal 6(1)(a) den RGCS an bunús dlí; bunaímid stóráil an chruthúnais ar Airteagal 6(1)(c) i gcomhcheangal le hAirteagal 7(1) den RGCS. Is féidir leat an toiliú a chúlghairm am ar bith le héifeacht amach anseo — tríd an nasc díliostála atá i ngach ríomhphost nuachtlitreach nó go neamhfhoirmiúil trí ríomhphost chugainn. Ní chuireann an chúlghairm isteach ar dhlíthiúlacht na próiseála a rinneadh go dtí sin.",
            "Chun na nuachtlitreacha a riar agus a sheoladh, úsáidimid Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, an Fhrainc; brainse Gearmánach: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin) mar phróiseálaí. Aistrítear do sheoladh ríomhphoist agus an fhaisnéis bhreise atá luaite (teanga, foinse). Próiseáiltear na sonraí ar fhreastalaithe laistigh den Aontas Eorpach (an Fhrainc agus an Ghearmáin); tá comhaontú próiseála sonraí de bhun Airteagal 28 den RGCS i bhfeidhm le Brevo. Tá [fógra príobháideachais Brevo](https://www.brevo.com/legal/privacypolicy/) i bhfeidhm.",
            "Nuair a sheolaimid nuachtlitir, tomhaiseann Brevo thar ár gceann ar osclaíodh an teachtaireacht agus ar cliceáladh na naisc atá inti. Cabhraíonn an tomhas sin linn an t-ábhar agus an mhinicíocht a choigeartú; is cuid den toiliú é agus críochnaíonn sé le do dhíliostáil. Ní dhéantar aon chomhcheangal le foinsí sonraí eile ná aon phróifíliú.",
            "Fad is atá an deimhniú ar feitheamh, ní scríobhtar chuig do sheoladh agus ní aistrítear é chuig Brevo; téann iontráil nach bhfuil deimhnithe as feidhm tar éis seacht lá. Tar éis díliostála, cuirimid an seoladh faoi bhac i leith seoltaí amach agus coinnímid cruthúnas an toilithe agus na díliostála fad is féidir éilimh a dhéanamh astu; ar iarratas scriosaimid go hiomlán é.",
          ],
        },
        {
          titel: "Teachtaireachtaí ar an Ardán",
          paragraphs: [
            "Stóráiltear teachtaireachtaí idir an aoi agus an gnólacht ar an Ardán ionas go bhféadfaidh an dá thaobh an chartlann a fheiceáil. Má chuireann gnólacht bac ar aoi, cuirtear an cainéal teachtaireachtaí faoi bhac; fanann na teachtaireachtaí atá ann cheana ar fáil ar mhaithe le hinrianaitheacht.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Má úsáideann gnólacht an nasc le WhatsApp, aistrítear ábhar na dteachtaireachtaí agus uimhreacha teileafóin na bpáirtithe trí WhatsApp Business Platform ó Meta Platforms Ireland Limited. Is é an gnólacht a chinneann faoi úsáid na feidhme sin; gan é a bheith gníomhachtaithe, ní tharlaíonn aon aistriú.",
          ],
        },
      ],
    },
    {
      heading: "Feidhmeanna uathoibrithe agus intleacht shaorga",
      paragraphs: [
        "Maidir leis na feidhmeanna a bhfuil cur síos orthu anseo, tá Rialachán (AE) 2024/1689 (an Rialachán maidir le hIntleacht Shaorga, an „AI Act“) i bhfeidhm chomh maith leis an RGCS, agus tá na hoibleagáidí trédhearcachta faoi Airteagal 50 de infheidhme ó 2 Lúnasa 2026.",
      ],
      unterpunkte: [
        {
          titel: "Moltaí freagra",
          paragraphs: [
            "Le haghaidh moltaí freagra i mbosca isteach na dteachtaireachtaí, úsáidimid — sa chás go bhfuil an fheidhm gníomhachtaithe don ghnólacht — tairiscint samhlacha teanga Groq, Inc., SAM. Aistrítear comhthéacs na teachtaireachta faoi seach chuig an tseirbhís. Ní sheoltar moltaí go huathoibríoch; is duine daonna a chinneann faoin seoladh i gcónaí. Ní tharlaíonn aon chinnteoireacht uathoibrithe le héifeacht dhlíthiúil de réir bhrí Airteagal 22 den RGCS.",
            "Ní córas intleachta saorga é sin, dá bhrí sin, a idirghníomhaíonn go díreach le daoine nádúrtha de réir bhrí Airteagal 50(1) den Rialachán maidir le hIntleacht Shaorga: éilíonn an oibleagáid sin idirghníomhaíocht DHÍREACH, ina ndéanann an intleacht shaorga féin cumarsáid leis an duine agus nach trí idirghabhálaí daonna. Anseo, molann an fheidhm téacs don ghnólacht, a ndéanann ball foirne athbhreithniú air, a fhéadfaidh é a athrú agus a sheolann é féin — is é an ball foirne an t-idirghabhálaí sin, agus is leis an ngnólacht agus nach le róbat comhrá a bhíonn an aoi ag comhfhreagras. Níl aon chúntóir a fhreagraíonn go huathoibríoch in úsáid. De réir ár measúnaithe, ní chomhlíonann an fheidhm aon cheann de na cásanna d’intleacht shaorga ardriosca faoi Iarscríbhinn III den Rialachán maidir le hIntleacht Shaorga ach oiread.",
            "Ní „téacs faoi ábhair leasa phoiblí“ de réir bhrí Airteagal 50(4) den Rialachán maidir le hIntleacht Shaorga teachtaireachtaí chuig aíonna ach oiread: ní fhoilsítear iad, ach seoltar go leithleach chuig duine sonrach iad, agus baineann siad le riar fanachta. Beag beann air sin, tá an t-athbhreithniú daonna ag an mball foirne a sheolann i bhfeidhm anseo.",
            "Má thairgtear feidhm amach anseo a fhreagraíonn d’aíonna go huathoibríoch — gan cead daonna — cuirfear in iúl don aoi go feiceálach ag tús an dialóige go bhfuil sé ag scríobh le córas intleachta saorga. Gan an fógra sin, ní chuirfear feidhm den sórt sin ar fáil.",
          ],
        },
        {
          titel: "Comhairleoir táirge ar an suíomh Gréasáin seo",
          paragraphs: [
            "Ar an suíomh Gréasáin seo, freagraíonn comhairleoir táirge atá bunaithe ar AI ceisteanna faoinár mbogearraí. Ní úsáideann sé ach ábhar atá ar fáil go poiblí ar an suíomh Gréasáin seo (ailt cabhrach, tuairiscí feidhme, ceisteanna coitianta, téacsanna dlíthiúla) chomh maith leis na praghsanna reatha ónár mbilleáil. Níl sonraí custaiméirí, áirithintí nó sonraí aoi ar fáil dó.",
            "Murab ionann agus na moltaí freagraí san ionchur, freagraíonn an comhairleoir seo LÁITHREACH agus gan cead daonna. Is córas AI é dá bhrí sin de réir Airteagal 50(1) den Rialachán AI, a idirghníomhaíonn go díreach le daoine nádúrtha. Dá bhrí sin, cuirfear in iúl duit go soiléir ag tús an idirphlé go dtagann na freagraí ó chúntóir AI agus go bhféadfadh earráidí a bheith iontu.",
            "Déantar do cheist agus an teanga roghnaithe a phróiseáil. Seoltar an dá rud chuig Google Cloud (Vertex AI) i réigiún europe-west4 (An Ísiltír) le haghaidh freagra; ní tharlaíonn próiseáil lasmuigh den AE. Ní stórálaimid na ceisteanna go buan agus ní úsáidimid iad chun samhlacha AI a oiliúint. Is é an bonn dlíthiúil ár leas dlisteanach i bhfreagra tapa do pháirtithe leasmhara (Airteagal 6(1)(f) GDPR).",
            "Mura féidir leis an gcomhairleoir ceist a fhreagairt ó na hábhair atá ann cheana féin, tairgeann sé atreorú chuig ár dtacaíocht. Ansin amháin — agus ach amháin má chomhlánaíonn tú an fhoirm — bailímid ainm, seoladh ríomhphoist agus, go roghnach, d'uimhir theileafóin; déanaimid na sonraí seo a phróiseáil de réir na rialacha sa chuid “Cumarsáid”.",
          ],
        },
        {
          titel: "Róil faoin Rialachán maidir le hIntleacht Shaorga",
          paragraphs: [
            "Maidir leis na feidhmeanna intleachta saorga atá tógtha isteach sa táirge, is úsáideoir gairmiúil sinne de réir bhrí Airteagal 3(4) den Rialachán maidir le hIntleacht Shaorga; is iad soláthraithe na samhlacha faoi seach soláthraithe na samhlacha teanga bunúsacha. Má úsáideann gnólacht na feidhmeanna sin faoi chuimsiú a ghníomhaíochta gairmiúla, is úsáideoir gairmiúil é féin ina leith agus tá an oibleagáid maidir le litearthacht intleachta saorga faoi Airteagal 4 den Rialachán maidir le hIntleacht Shaorga air, oibleagáid atá i bhfeidhm ó 2 Feabhra 2025 gan spleáchas ar mhéid an ghnóthais. Ó 27 Iúil 2026 tá sí i bhfeidhm i bhfoirm Rialachán (AE) 2026/1744: glacann soláthraithe agus úsáideoirí gairmiúla bearta chun tacú le forbairt litearthachta intleachta saorga a bhfoirne; go sainráite ní gá leibhéal áirithe a ráthú. Tacaímid le nótaí san fheidhmchlár agus inár nIonad Cabhrach; is faoin ngnólacht a fhanann oiliúint a fhoirne féin.",
            "Má nascann gnólacht a chuntas le cúntóir intleachta saorga dá chuid féin (féach an pointe a leanas), is úsáideoir gairmiúil é ina leith sin freisin de réir bhrí an Rialacháin maidir le hIntleacht Shaorga — is é a chinneann faoin úsáid agus a fhoirmlíonn na hiarratais. Ní córas intleachta saorga an comhéadan féin: léann sé sonraí ón mbunachar sonraí agus tugann sé amach iad gan aon tátail a bhaint; deighleann aithesc 12 den Rialachán maidir le hIntleacht Shaorga córais den sórt sin go sainráite ó intleacht shaorga.",
          ],
        },
        {
          titel: "Nascadh le cúntóir intleachta saorga dá chuid féin",
          paragraphs: [
            "Is féidir le gnólacht a chuntas a nascadh trí chomhéadan le cúntóir intleachta saorga a roghnaigh sé féin agus a bhfuil conradh dá chuid féin aige leis — mar shampla Claude ó Anthropic PBC, SAM. Nuair atá nasc den sórt sin deonaithe, féadfaidh an cúntóir na nithe seo a léamh ar iarratas an ghnólachta: áitíocht, infhaighteacht agus praghsanna laethúla; áirithintí le hainm an aoi, tréimhse an fhanachta, an réadmhaoin, an cainéal áirithinte, an stádas mar aon leis an méid agus an t-airgeadra, sa mhéid a cheadaítear do ról an chuntais a dhéanann an cheist méideanna a fheiceáil; agus forbhreathnú ar na comhráite sa bhosca isteach. Gan nasc deonaithe, ní tharlaíonn aon aistriú.",
            "Ní aistrítear seoladh ríomhphoist ná uimhir theileafóin na n-aíonna, sonraí cárta, sonraí bainc ná admhálacha íocaíochta, cóid rochtana ná dosaeir réadmhaoine. Tá nótaí áirithinte agus ábhar teachtaireachtaí aíonna eisiata mar réamhshocrú, mar go bhféadfadh faisnéis faoin tsláinte nó catagóirí speisialta eile faoi Airteagal 9 den RGCS a bheith iontu; ní mór don ghnólacht iad a scaoileadh go sainráite agus ar leithligh nuair a dheonaíonn sé an nasc.",
            "Ní féidir ach le cuntas a bhfuil an ról „riarthóir“ aige an nasc a dheonú, agus ní le gach cuntas a bhfuil rochtain aige. Déantar logáil ar gach iarratas agus is féidir leis an ngnólacht é a fheiceáil faoi „Cuntas → Naisc“; féadfaidh sé an nasc a bhriseadh ansin am ar bith, agus críochnaíonn an rochtain láithreach leis sin.",
            "Ó thaobh dlí de, is treoir ón ngnólacht chugainn an aistriú sin (Airteagal 28(3)(a) den RGCS). Ní fo-phróiseálaí dár gcuid soláthraí an chúntóra — ní thugaimid coimisiún dó agus ní thugaimid treoracha dó; próiseálann sé na sonraí ar bhonn an chonartha a thug an gnólacht féin i gcrích leis. Is é an gnólacht, dá bhrí sin, atá freagrach as bunús dlí na próiseála sin, as a aíonna a chur ar an eolas agus as na coimircí a bhaineann le haistriú chuig tríú tír.",
          ],
        },
        {
          titel: "Aistriúcháin",
          paragraphs: [
            "Is féidir téacsanna réadmhaoine agus téacsanna ábhair a aistriú tríd an Cloud Translation API ó Google Ireland Limited. Aistrítear na téacsanna atá le haistriú; ní aistrítear sonraí pearsanta ach sa mhéid atá siad sna téacsanna sin.",
          ],
        },
        {
          titel: "Moltaí praghais",
          paragraphs: [
            "Le haghaidh moltaí praghais téimid i muinín sonraí margaidh, aimsire agus rátaí malairte ó fhoinsí seachtracha. Níl aon sonraí pearsanta sna hiarratais sin, ach an áit, an tréimhse agus tréithe na réadmhaoine amháin.",
          ],
        },
      ],
    },
    {
      heading: "Suíomhanna gréasáin agus fearainn ár gcustaiméirí",
      paragraphs: [
        "Má chruthaíonn gnólacht suíomh gréasáin dá chuid féin le fearann dá chuid féin tríd an tógálaí leathanach, riaraimid na taifid DNS is gá chuige sin trí Cloudflare, Inc. Aistrítear sonraí fearainn agus cumraíochta ansin; próiseálaimid sonraí cuairteoirí shuíomh gréasáin an chustaiméara mar atá curtha síos san fhógra seo.",
        "Is é an gnólacht faoi seach atá freagrach as ábhar, as fógra dlíthiúil agus as faisnéis phríobháideachais shuíomh gréasáin an chustaiméara.",
      ],
    },
    {
      heading: "Clár Comhpháirtíochta",
      paragraphs: [
        "Oibrímid clár comhpháirtíochta trína molann comhpháirtithe (tionchair, comhairleoirí, gníomhaireachtaí, custaiméirí) gnólachtaí do myNextDays agus faigheann siad coimisiún as sin. Sa phróiseas seo, déanaimid sonraí na gcomhpháirtithe a phróiseáil agus – go pointe beag – sonraí na ngnólachtaí molta.",
      ],
      unterpunkte: [
        {
          titel: "Sonraí na gComhpháirtithe",
          paragraphs: [
            "Nuair a dhéantar iarratas, déanaimid ainm, ainm na cuideachta, foirm dhlíthiúil, tír, seoladh ríomhphoist, teanga, cuntais meán sóisialta (ardán, seoladh, láimhseáil, raon feidhme féin-dhearbhaithe), uimhir aitheantais CBL (seiceáil tríd an gcóras VIES an AE), sonraí íocaíochta (IBAN, seoladh Wise nó PayPal) a phróiseáil, chomh maith leis an toiliú leis na téarmaí agus coinníollacha rannpháirtíochta le leagan agus am. Is é an bunús dlí ná comhlíonadh an chonartha comhpháirtíochta (Airteagal 6(1)(b) de RGCS); maidir le creidmheasanna agus coinneáil, tá feidhm ag na hoibleagáidí dlí cánach agus tráchtála (Airteagal 6(1)(c) de RGCS).",
            "Má bhainistíonn comhpháirtí foireann, feiceann sé ainm nó ainm na cuideachta, céim, líon na gcustaiméirí íocacha agus an coimisiún foirne a eascraíonn as sin óna chomhpháirtithe foirne. Stóráiltear teachtaireachtaí idir urraitheoir agus comhpháirtí foirne san ardán ionas go bhfeiceann an dá cheann an stair.",
          ],
        },
        {
          titel: "Cliceanna ar Naisc Chomhpháirtíochta",
          paragraphs: [
            "Má osclaíonn cuairteoir nasc comhpháirtíochta (mynextdays.com/p/CODE), stóráilimid an cód, an t-am, an leathanach a osclaíodh, an leathanach tagartha agus aon pharaiméadair feachtais chomh maith le seoladh IP agus aitheantóir brabhsálaí go heisiach mar suimeanna seiceála giorraithe (hash) – chun mí-úsáid a bhrath (carnadh), ní chun ath-aitheantas a dhéanamh. Ní chuirtear fianán rianaithe ar bun. Scriosaimid sonraí cliceála tar éis 90 lá. Is é an bunús dlí ná ár leas dlisteanach i mbilleáil atá saor ó chalaois don chlár (Airteagal 6(1)(f) de RGCS).",
          ],
        },
        {
          titel: "Cuntais agus Postálacha Meán Sóisialta Nasctha",
          paragraphs: [
            "Is féidir le comhpháirtithe a gcuntais ar YouTube (Google), Instagram agus Facebook (Meta) chomh maith le TikTok a nascadh go deonach leis an deais comhpháirtíochta. Sa phróiseas seo, tugann siad cead léitheoireachta don ardán faoi seach (OAuth); ní scríobhaimid aon rud sna cuntais seo. Stóráilimid aitheantóir agus ainm an chuntais, an comhartha rochtana criptithe, an t-am nasctha chomh maith le tomhas laethúil in aghaidh an chuntais: líon na leantóirí nó na síntiúsóirí, radhairc le 28 lá anuas, ráta idirghníomhaíochta agus líon na bpostálacha, gach ceann acu le ham freagartha an ardáin. Maidir le postálacha a chruthaíonn an comhpháirtí sa deais (teideal, ardán, seoladh, dáta foilsithe), stóráilimid radhairc, rudaí is maith leat, tuairimí, comhroinnt agus sábhálacha ón ardán freisin.",
            "Is é an cuspóir ná raon feidhme an chomhpháirtí a fhíorú agus cliceanna agus custaiméirí a shannadh d'iontrálacha aonair; déantar sonraí neamhfhíoraithe a mheá níos lú nuair a scaoiltear iad. Ní úsáidtear fianaise ar neamhréireachtaí (m.sh. léim leantóirí gan radhairc chomhfhreagracha) ach amháin le haghaidh athbhreithniú láimhe uainn agus ní bhíonn aon chinneadh uathoibrithe mar thoradh air. Is é an bunús dlí ná toiliú an chomhpháirtí (Airteagal 6(1)(a) de Rialachán Ginearálta maidir le Cosaint Sonraí), a thugann sé trí nascadh agus is féidir leis é a tharraingt siar am ar bith sa phainéal faoi “Dínascadh”; nuair a dhínascann sé, scriosaimid an comhartha rochtana láithreach, fanann luachanna tomhaiste stóráilte mar stair agus scriostar iad le cuntas an chomhpháirtí. Ní úsáidimid ach comhéadain oifigiúla na n-ardán; maidir le próiseáil ag Google, Meta agus TikTok, tá feidhm ag a bhfógraí príobháideachais féin.",
          ],
        },
        {
          titel: "Gnólachtaí Molta",
          paragraphs: [
            "Má chláraíonn gnó le cód comhpháirtí, stóráilimid sannadh an ghnó don chomhpháirtí chomh maith leis an am, an modh (nasc nó cód) agus an stádas. Ní fheiceann an comhpháirtí an gnó ach go bréag-ainm (uimhir seicheamhach, tír, stádas, méideanna) — ní ainm, seoladh ríomhphoist nó sonraí áirithinte. Ní féidir leis an gcomhpháirtí teagmháil a dhéanamh leis an ngnó tríd an ardán ach amháin má thoilíonn an gnó go sainráite leis sin le linn an chláraithe. Chun críocha socraíochta coimisiúin, déanaimid próiseáil ar ghlanmhéideanna síntiúis na sonrasc íoctha ón ngnó; is é an bunús dlí ná comhlíonadh an chomhaontaithe comhpháirtíochta agus an chomhaontaithe úsáide (Airteagal 6(1)(b) de Rialachán Ginearálta maidir le Cosaint Sonraí).",
          ],
        },
      ],
    },
    {
      heading: "Óstáil agus stóráil",
      paragraphs: [
        "Ritheann an Ardán, an bunachar sonraí, na meáin agus an freastalaí ríomhphoist ar fhreastalaithe Hetzner Online GmbH, an Ghearmáin, in ionad sonraí Heilsincí (an Fhionlainn) — is é sin, laistigh den Aontas Eorpach. Tá comhaontú próiseála sonraí i bhfeidhm le Hetzner.",
        "Cruthaítear cóipeanna cúltaca criptithe agus coinnítear iad criptithe ag soláthraí stórála laistigh den AE.",
      ],
    },
    {
      heading: "Forbhreathnú ar na faighteoirí",
      paragraphs: [
        "Seachas na soláthraithe seirbhíse atá luaite, ní roinnimid sonraí pearsanta ach sa chás go bhfuil oibleagáid dhlíthiúil orainn (m.sh. údaráis chánach, forfheidhmiú dlí) nó sa chás go n-iarrann tú féin nó an gnólacht freagrach é.",
      ],
      list: [
        "Hetzner Online GmbH (an Ghearmáin/an Fhionlainn) — óstáil, bunachar sonraí, meáin, freastalaí ríomhphoist",
        "Stripe Payments Europe, Limited (Éire) — íocaíochtaí, eisíocaíochtaí, fíorú céannachta",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Lucsamburg) — íocaíochtaí, má tá sé gníomhachtaithe",
        "Channex.io Ltd (an Ríocht Aontaithe) — nascadh le tairseacha áirithinte",
        "Meta Platforms Ireland Limited (Éire) — teachtaireachtaí WhatsApp, má tá sé gníomhachtaithe",
        "Sendinblue SAS / Brevo (an Fhrainc, an Ghearmáin) — riar agus seoladh na nuachtlitreach, le toiliú amháin",
        "Google Ireland Limited (Éire) — aistriúcháin; cosaint ar thurscar don fhoirm teagmhála (reCAPTCHA Enterprise), le toiliú amháin; síniú isteach le Google, má úsáidtear é; Tomhas Raon Feidhme (Google Analytics 4), le toiliú amháin",
        "Groq, Inc. (SAM) — moltaí freagra, má tá sé gníomhachtaithe",
        "Cloudflare, Inc. (SAM) — riar DNS le haghaidh fearainn custaiméirí",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Níl ar an liosta seo seirbhísí a chomhaontaíonn gnólacht féin le tríú páirtí agus a nascann sé lena chuntas tríd an gcomhéadan — mar shampla cúntóir intleachta saorga ar nós Claude ó Anthropic PBC, SAM. Ní soláthraithe seirbhíse ar thugamar coimisiún dóibh iad, ach faighteoirí ar threoir an ghnólachta faoi seach; gan nasc ón ngnólacht sin, ní shreabhann aon sonraí chucu. De réir liosta oifigiúil na rannpháirtithe ó Roinn Tráchtála SAM, níl Anthropic deimhnithe faoin EU-US Data Privacy Framework; bunaítear aistriú, dá bhrí sin, ar na clásail chaighdeánacha um chosaint sonraí, agus is é an gnólacht faoi seach, mar rialaitheoir, atá freagrach as freastal orthu.",
          ],
        },
      ],
    },
    {
      heading: "Aistriú chuig tríú tíortha",
      paragraphs: [
        "Tarlaíonn an phróiseáil laistigh den AE go bunúsach. I gcás na seirbhísí atá luaite thuas a bhfuil a suíomh lasmuigh den AE, féadfaidh aistriú chuig tríú tír teacht chun cinn.",
        "I gcás Groq, Inc. agus Cloudflare, Inc. (SAM), bunaímid an aistriú ar chlásail chaighdeánacha um chosaint sonraí an Choimisiúin Eorpaigh de bhun Airteagal 46(2)(c) den RGCS, sa mhéid nach féidir leis an bhfaighteoir cinneadh leordhóthanachta (EU-US Data Privacy Framework) a agairt.",
        "Is é Stripe Payments Europe, Limited (Éire) an páirtí conarthach maidir le próiseáil na n-íocaíochtaí. Sa mhéid a théann Stripe i muinín Stripe, LLC (SAM) chuige sin, tá an chuideachta sin deimhnithe faoin EU-US Data Privacy Framework; bunaítear an aistriú sa mhéid sin ar chinneadh leordhóthanachta an Choimisiúin Eorpaigh de bhun Airteagal 45 den RGCS. Ina theannta sin, tá na clásail chaighdeánacha um chosaint sonraí ón [gcomhaontú próiseála sonraí Stripe](https://stripe.com/legal/dpa) i bhfeidhm.",
        "I gcás Channex.io Ltd (an Ríocht Aontaithe) tá cinneadh leordhóthanachta an Choimisiúin Eorpaigh don Ríocht Aontaithe i bhfeidhm; má thiteann sé sin ar lár, beidh na clásail chaighdeánacha um chosaint sonraí i bhfeidhm.",
      ],
    },
    {
      heading: "Rochtain údarás ó thríú stáit (US CLOUD Act)",
      paragraphs: [
        "Féadfar ceangal ar sholáthraithe atá faoi réir dhlínse na Stát Aontaithe, faoin CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) Meiriceánach, sonraí a thabhairt suas d’údaráis SAM — fiú amháin nuair a bhíonn na sonraí sin ar fhreastalaithe laistigh den Aontas Eorpach. Féadfaidh rochtain den sórt sin a bheith ar neamhréir leis an RGCS, agus féadfaidh sé nach mbeidh cead dlíthiúil ag an soláthraí sinne ná tusa a chur ar an eolas faoi. Ní chuireann an cinneadh leordhóthanachta maidir leis an EU-US Data Privacy Framework ná na clásail chaighdeánacha um chosaint sonraí an riosca sin as an áireamh.",
        "Teorannaímid an riosca sin sa mhéid go n-oibrítear na córais bhunúsacha — an tArdán, an bunachar sonraí, na meáin, an freastalaí ríomhphoist agus na cóipeanna cúltaca — ag soláthraithe Eorpacha laistigh den AE, agus nach bhfuil aon dlínse SAM i bhfeidhm ansin.",
      ],
      unterpunkte: [
        {
          titel: "Seirbhísí lena mbaineann",
          paragraphs: [
            "Ní féidir dlínse SAM a bheith i gceist ach amháin i gcás na seirbhísí breise seo a leanas, atá teorannaithe go soiléir:",
          ],
          list: [
            "Groq, Inc. (SAM) — moltaí freagra i mbosca isteach na dteachtaireachtaí, ach amháin má ghníomhachtaíonn an gnólacht an fheidhm. Aistrítear comhthéacs na teachtaireachta faoi seach.",
            "Cloudflare, Inc. (SAM) — riar DNS le haghaidh fearainn custaiméirí. Aistrítear sonraí fearainn agus cumraíochta, ní aistrítear aon sonraí aíonna.",
            "Google LLC (SAM) — nuair a chláraítear le Google, le haistriúcháin agus le tomhas raon feidhme (Google Analytics 4, le toiliú amháin); is é Google Ireland Limited an páirtí conarthach i ngach cás, ach níl rochtain ag an máthairchuideachta SAM eisiata.",
          ],
        },
        {
          titel: "Inseachantacht",
          paragraphs: [
            "Is féidir an tArdán a úsáid gan na seirbhísí sin: is féidir na moltaí freagra a mhúchadh, ní bhaineann riar DNS ach le custaiméirí a bhfuil fearann dá gcuid féin acu, agus is rogha eile dheonach an síniú isteach le Google in ionad an tsínithe isteach le ríomhphost agus pasfhocal.",
          ],
        },
        {
          titel: "Idirdhealú ó dhlí Eorpach",
          paragraphs: [
            "Is dlí Meiriceánach an CLOUD Act, agus ní dlí den Aontas Eorpach é. Ní mór idirdhealú a dhéanamh idir é agus an EU Data Act (Rialachán (AE) 2023/2854), a rialaíonn aistriú agus iniomparthacht i gcás seirbhísí próiseála sonraí, agus an Cloud and AI Development Act, atá i nós imeachta reachtach na hEorpa faoi dháta an fhógra seo.",
          ],
        },
      ],
    },
    {
      heading: "Tréimhse coinneála",
      list: [
        "Sonraí cuntais: ar feadh ré an chaidrimh ghnó; ina dhiaidh sin scriosadh, sa mhéid nach bhfuil aon oibleagáid choinneála i bhfeidhm.",
        "Sonraí áirithinte, sonrascála agus íocaíochta: de réir dhlí cuntasaíochta na Danmhairge, cúig bliana tar éis dheireadh na bliana airgeadais lena mbaineann; i gcás custaiméirí atá lonnaithe sa Ghearmáin féadfaidh tréimhsí níos faide faoin dlí tráchtála agus cánach a bheith i bhfeidhm.",
        "Teachtaireachtaí agus sonraí aíonna ar an Ardán: ar threoir an ghnólachta fhreagraigh, ar a dhéanaí go dtí go scriosann sé sin iad nó go dtí deireadh an chonartha.",
        "Nuachtlitir: go dtí cúlghairm an toilithe; téann cláruithe neamhdheimhnithe as feidhm tar éis seacht lá. Fanann cruthúnas an toilithe agus na díliostála ar fáil thairis sin fad is atá gá leis mar chruthúnas.",
        "Logaí sínithe isteach agus imeachtaí slándála: go gearrthéarmach chun ionsaithe a bhrath.",
        "Logchomhaid an fhreastalaí: ach chomh fada agus is gá le haghaidh oibriú agus slándáil.",
        "Cóipeanna cúltaca: ar bhonn rollach, go dtí go gcuirtear cúltacaí níos nuaí ina n-ionad.",
      ],
    },
    {
      heading: "Do chearta",
      paragraphs: [
        "Tá an ceart agat rochtain a fháil (Airteagal 15), ceartúchán (Airteagal 16), scriosadh (Airteagal 17), srianadh na próiseála (Airteagal 18), iniomparthacht sonraí (Airteagal 20) agus agóid in aghaidh próiseála atá bunaithe ar leasanna dlisteanacha (Airteagal 21 den RGCS). Is féidir leat toiliú a thug tú a chúlghairm am ar bith le héifeacht amach anseo.",
        `Déan teagmháil linn chuige sin ag [${ANBIETER.email}](mailto:${ANBIETER.email}). Má bhaineann do shonraí le húsáid an Ardáin ag gnólacht, seolaimid d’iarratas ar aghaidh chuig an ngnólacht freagrach nó tacaímid leis é a fhreagairt.`,
        `Ina theannta sin, is féidir leat gearán a dhéanamh le húdarás maoirseachta um chosaint sonraí — is é ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}) an t-údarás atá freagrach dúinne. Is féidir leat dul chuig údarás maoirseachta d’áit chónaithe chomh maith.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Ein Abschnitt zu den Rechten, der die
      // Löschung nur als DSGVO-Artikel erwähnt, genügt der Prüfung nicht.
      heading: "Cuntas agus sonraí aipe a scriosadh",
      paragraphs: [
        "Is féidir leat scriosadh do chuntais a iarraidh tú féin am ar bith — san aip faoi ‘Próifíl → Cuntas’ nó trínár bhfoirm ar an ngréasán:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "Oibríonn an tslí ar an ngréasán d’aon ghnó fiú mura bhfuil an aip suiteáilte a thuilleadh agat nó mura féidir leat síniú isteach a thuilleadh. Mar chosaint ar mhí-úsáid, tarlaíonn sé i dhá chéim: cuireann tú seoladh ríomhphoist do chuntais isteach agus faigheann tú nasc deimhnithe chuig an seoladh sin go beacht. Ní bhíonn an t-iarratas bailí ach nuair a chliceálann tú air — ní dhéanann seoladh a chur isteach amháin aon ní. Déileálaimid leis an iarratas laistigh de 30 lá agus freagraímid trí ríomhphost.",
        "Leis an gcuntas, scriosaimid do shonraí rochtana, do phróifíl, do shonraí réadmhaoine agus féilire mar aon le do theachtaireachtaí. Ní scriostar doiciméid a bhfuil oibleagáid choinneála reachtúil ina leith — go háirithe sonraisc agus doiciméid áirithinte i leith tréimhsí a socraíodh (an oibleagáid chuntasaíochta faoi dhlí na Danmhairge, cúig bliana de ghnáth). Cuirtear na doiciméid sin faoi bhac ar feadh ré na tréimhse, is é sin, coinnítear iad chun an oibleagáid sin a chomhlíonadh amháin agus scriostar iad ina dhiaidh sin.",
      ],
    },
    {
      heading: "Slándáil na próiseála",
      paragraphs: [
        "Cosnaímid an phróiseáil trí bhearta teicniúla agus eagraíochtúla de bhun Airteagal 32 den RGCS, go háirithe: criptiú iompair ó cheann ceann (TLS), rialacha rochtana bunaithe ar an tionónta go díreach sa bhunachar sonraí, ceadanna bunaithe ar róil le deighilt idir sonraí airgeadais agus sonraí seirbhíse, fíordheimhniú déthoisc roghnach, teorannú ar iarrachtaí sínithe isteach, cóipeanna cúltaca criptithe le tástáil aisghabhála rialta mar aon le logáil imeachtaí a bhaineann le slándáil.",
      ],
    },
    {
      heading: "Oibleagáid faisnéis a sholáthar",
      paragraphs: [
        "Tá an fhaisnéis a bhfuil gá againn léi chun conradh a thabhairt i gcrích, le haghaidh socraíochta agus le haghaidh oibleagáidí dlíthiúla riachtanach — gan í ní féidir linn an tArdán a sholáthar. Is deonach an fhaisnéis eile go léir.",
      ],
    },
    {
      heading: "Athruithe ar an bhfógra seo",
      paragraphs: [
        "Coigeartaímid an fógra seo nuair a athraíonn an phróiseáil, na soláthraithe seirbhíse a úsáidtear nó an staid dhlíthiúil. Is é an leagan a fhoilsítear anseo atá i bhfeidhm i gcás ar bith; taispeánann an dáta thuas an staid reatha.",
      ],
    },
  ],
};

export default datenschutz;
