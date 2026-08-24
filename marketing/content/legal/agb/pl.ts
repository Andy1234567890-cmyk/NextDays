// KOPIE aus web/content/legal/agb/pl.ts — bewusst dupliziert, weil die
// Apps isoliert gebaut werden (ADR-0016): der Docker-Kontext dieser App
// enthält web/ nicht. Inhaltliche Änderungen IMMER in beiden Dateien.
// Zusätzlich zur web-Fassung: slug/metaDescription/numbered/toc für den
// Renderer dieser App.
import type { LegalDoc } from "../types";

// Polnische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. § 5 Absatz 1–2 folgt Stripes offiziellem Empfehlungstext
// (Stripe Connected Account Agreement) — Wortlaut sinngemäß, URLs nicht verändern.
export const agb: LegalDoc = {
  slug: "agb",
  metaDescription:
    "Ogólne warunki korzystania z platformy myNextDays dla agencji i wynajmujących.",
  numbered: false,
  toc: true,
  title: "Ogólne Warunki Handlowe (Regulamin) dla agencji i wynajmujących",
  stand: "Stan na: 13 sierpnia 2026 r.",
  intro: [
    "Niniejsze Ogólne Warunki Handlowe (zwane dalej „Regulaminem”) określają zasady korzystania z platformy oprogramowania myNextDays (zwanej dalej „Platformą”) przez agencje, wynajmujących, zarządców nieruchomości oraz innych użytkowników prowadzących działalność gospodarczą (zwanych dalej „Użytkownikiem”).",
    "Dostawcą Platformy jest myNextDays ApS, spółka z ograniczoną odpowiedzialnością (anpartsselskab) prawa duńskiego, Hirtshalsvej 21, 9881 Bindslev, Dania, zarejestrowana w duńskim Centralnym Rejestrze Przedsiębiorców (CVR) pod numerem CVR 46615182 (zwana dalej „myNextDays” lub „my”).",
    "Platforma jest przeznaczona wyłącznie dla przedsiębiorców w rozumieniu § 14 niemieckiego kodeksu cywilnego (BGB) lub odpowiednich przepisów danego państwa członkowskiego UE. Nie jest przeznaczona dla konsumentów.",
  ],
  sections: [
    {
      heading: "§ 1 Zakres obowiązywania",
      paragraphs: [
        "Niniejszy Regulamin ma zastosowanie do wszystkich umów dotyczących korzystania z Platformy zawieranych między myNextDays a Użytkownikiem oraz do wszystkich usług i modułów udostępnianych za jej pośrednictwem.",
        "Odmienne, sprzeczne lub uzupełniające warunki handlowe Użytkownika stają się częścią umowy tylko wtedy, gdy myNextDays wyraźnie zaakceptuje ich obowiązywanie w formie tekstowej.",
      ],
    },
    {
      heading: "§ 2 Przedmiot umowy i usługi",
      paragraphs: [
        "myNextDays udostępnia Użytkownikowi oprogramowanie w chmurze do zarządzania obiektami wakacyjnymi i przedsiębiorstwami noclegowymi. Zakres funkcji wynika z aktualnego opisu usług i obejmuje w szczególności:",
      ],
      list: [
        "zarządzanie obiektami, kalendarzami obłożenia i rezerwacjami (system zarządzania nieruchomościami),",
        "połączenie z zewnętrznymi kanałami rezerwacyjnymi (np. Booking.com, Airbnb) za pośrednictwem menedżera kanałów,",
        "publikowanie ofert za pośrednictwem własnego kanału rezerwacyjnego Platformy myNextDays,",
        "tworzenie własnych stron internetowych za pomocą zintegrowanego kreatora stron,",
        "funkcje księgowe, rozliczeniowe i analityczne, w tym rozliczenia dla właścicieli,",
        "komunikację z gośćmi oraz przyjmowanie płatności za pośrednictwem zintegrowanej obsługi płatności (§ 5).",
      ],
    },
    {
      heading: "§ 3 Rejestracja, konto i dane Użytkownika",
      paragraphs: [
        "Korzystanie z Platformy wymaga rejestracji konta. Użytkownik jest zobowiązany do podawania przy rejestracji oraz przez cały okres obowiązywania umowy prawdziwych, aktualnych i kompletnych danych dotyczących swojej osoby i swojego przedsiębiorstwa oraz do ich niezwłocznej aktualizacji w przypadku zmian.",
        "Dane dostępowe należy zachowywać w tajemnicy i chronić przed dostępem osób trzecich. Użytkownik ma obowiązek niezwłocznie poinformować myNextDays, jeżeli istnieją przesłanki wskazujące na nadużycie jego konta.",
        "Konto jest nieprzenoszalne. Użytkownik zapewnia, że wszystkie osoby korzystające z konta w jego imieniu przestrzegają niniejszego Regulaminu.",
      ],
    },
    {
      heading: "§ 4 Rola myNextDays przy rezerwacjach",
      paragraphs: [
        "Umowy o świadczenie usług noclegowych dotyczące obiektów oferowanych na Platformie, w połączonych kanałach zewnętrznych lub na własnej stronie internetowej Użytkownika są zawierane wyłącznie między Użytkownikiem (lub reprezentowanym przez niego właścicielem) a danym gościem. myNextDays nie staje się stroną umowy o nocleg.",
        "Za prawidłowość i zgodność z prawem treści ofert (opisów, zdjęć, cen, dostępności, podatków i opłat) odpowiada wyłącznie Użytkownik.",
      ],
    },
    {
      heading: "§ 5 Obsługa płatności przez Stripe",
      paragraphs: [
        "Usługi obsługi płatności dla agencji i wynajmujących na myNextDays są świadczone przez Stripe i podlegają umowie [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), która obejmuje warunki korzystania z usług Stripe (łącznie „Umowa o Usługi Stripe”). Akceptując niniejszy Regulamin lub kontynuując działalność jako agencja lub wynajmujący na myNextDays, Użytkownik wyraża zgodę na związanie się Umową o Usługi Stripe, która może być co pewien czas zmieniana przez Stripe.",
        "Warunkiem umożliwienia przez myNextDays usług obsługi płatności za pośrednictwem Stripe jest przekazanie myNextDays przez Użytkownika prawdziwych i kompletnych informacji o nim samym i jego przedsiębiorstwie. Użytkownik upoważnia myNextDays do udostępniania Stripe tych informacji oraz danych transakcyjnych związanych z korzystaniem z usług obsługi płatności świadczonych przez Stripe.",
        "Dla stosunku prawnego ze Stripe miarodajny jest podlinkowany anglojęzyczny tekst umowy w aktualnie obowiązującej wersji. Stroną umowy dla użytkowników z Europejskiego Obszaru Gospodarczego jest spółka Stripe wskazana w Umowie o Usługi Stripe (obecnie Stripe Payments Europe, Limited, Irlandia). Stripe przetwarza dane osobowe zgodnie z [Polityką prywatności Stripe](https://stripe.com/privacy).",
        "W celu wypełnienia ustawowych obowiązków identyfikacyjnych i weryfikacyjnych (m.in. przeciwdziałanie praniu pieniędzy, „Know Your Customer”) myNextDays i Stripe mogą w każdej chwili zażądać dodatkowych informacji i dokumentów, w szczególności dokumentów tożsamości, informacji o beneficjentach rzeczywistych oraz danych rachunku bankowego. Jeżeli żądane informacje lub dokumenty nie zostaną dostarczone w wyznaczonym terminie, przyjmowanie płatności lub wypłaty mogą zostać w całości lub częściowo wstrzymane do czasu skompletowania danych.",
      ],
    },
    {
      heading: "§ 6 Wypłaty, obciążenia zwrotne i salda ujemne",
      paragraphs: [
        "Sposób rozliczenia zależy od kanału rezerwacji. W przypadku rezerwacji dokonanych przez własny silnik rezerwacyjny Użytkownika oraz rezerwacji za pośrednictwem podłączonych portali dystrybucyjnych płatności gości wpływają bezpośrednio na rachunek płatniczy Użytkownika; w tych przypadkach Użytkownik jest wobec gościa odbiorcą płatności i stroną umowy o świadczenie usługi zakwaterowania (§ 4), a myNextDays w żadnym momencie nie staje się posiadaczem tych środków. myNextDays nie pobiera od takich rezerwacji żadnej procentowej opłaty rezerwacyjnej; prowizja za rezerwacje za pośrednictwem podłączonych portali dystrybucyjnych jest wykazywana odrębnie i fakturowana następczo.",
        "W przypadku rezerwacji dokonanych za pośrednictwem portalu rezerwacyjnego myNextDays płatność jest realizowana przez myNextDays. myNextDays potrąca przy tym prowizję pośrednictwa wskazaną w każdorazowo obowiązującym cenniku, wraz z kosztami obsługi płatności, i przekazuje pozostałą kwotę Użytkownikowi zgodnie z poniższymi ustępami. Wynagrodzenie za korzystanie z oprogramowania (§ 7) pozostaje nienaruszone.",
        "Wypłaty są dokonywane na rachunek bankowy wskazany przez Użytkownika. myNextDays może dostosować harmonogram wypłat ze względu na ryzyko, w szczególności w przypadku nowych kont, nietypowych wzorców transakcji lub trwających weryfikacji.",
        "Zwroty na rzecz gości ponosi ekonomicznie Użytkownik. Obciążenia zwrotne oraz wynikające z nich opłaty ponosi Użytkownik w przypadku rezerwacji dokonanych przez własny silnik rezerwacyjny oraz za pośrednictwem podłączonych portali dystrybucyjnych, ponieważ w tych przypadkach Użytkownik jest odbiorcą płatności; w przypadku rezerwacji dokonanych za pośrednictwem portalu rezerwacyjnego myNextDays ryzyko obciążenia zwrotnego ponosi myNextDays, chyba że wynika ono z naruszenia obowiązków przez Użytkownika (w szczególności niewykonania lub istotnej niezgodności usługi zakwaterowania). myNextDays jest uprawniona do potrącenia kwot obciążających Użytkownika z przyszłymi wypłatami.",
        "Jeżeli na rachunku płatniczym Użytkownika powstanie saldo ujemne, Użytkownik jest zobowiązany do jego niezwłocznego wyrównania. Użytkownik upoważnia myNextDays i Stripe do pobierania sald ujemnych ze wskazanego rachunku bankowego, o ile jest to prawnie dopuszczalne.",
      ],
    },
    {
      heading: "§ 7 Opłaty i rozliczenia",
      paragraphs: [
        "Opłaty za korzystanie z Platformy wynikają z cennika uzgodnionego przy zawarciu umowy lub z indywidualnej oferty. Wszystkie ceny nie zawierają obowiązujących podatków ustawowych i są wyrażone w walucie wskazanej w umowie.",
        "Opłaty zależne od transakcji (np. opłaty za płatności lub kanały) mogą być potrącane lub rozliczane bezpośrednio przy realizacji danej transakcji.",
        "Jeżeli Użytkownik pozostaje w zwłoce z płatnościami, myNextDays może po uprzednim powiadomieniu zablokować dostęp do Platformy do czasu uregulowania zaległych należności.",
      ],
    },
    {
      heading: "§ 8 Obowiązki Użytkownika; własne dokumenty prawne",
      paragraphs: [
        "Użytkownik zapewnia, że jego oferty, treści i praktyki handlowe są zgodne z obowiązującym prawem, w szczególności z przepisami o usługach noclegowych, obowiązkach meldunkowych, podatkach i ochronie konsumentów obowiązującymi w miejscu położenia obiektu. Użytkownik na własną odpowiedzialność posiada wymagane zezwolenia, rejestracje i licencje.",
        "Za strony internetowe prowadzone przez Użytkownika za pomocą kreatora stron oraz za jego oferty na Platformie odpowiada sam Użytkownik; obejmuje to w szczególności własny regulamin dla gości, własne dane identyfikacyjne usługodawcy (impressum) oraz własne informacje o ochronie danych.",
        "Zabronione są w szczególności: zamieszczanie nieprawdziwych lub wprowadzających w błąd ofert, realizacja transakcji pozornych lub oszukańczych, obchodzenie obsługi płatności zgodnie z § 5 w odniesieniu do rezerwacji zawartych za pośrednictwem Platformy oraz każde korzystanie, które zagraża bezpieczeństwu lub dostępności Platformy.",
      ],
    },
    {
      heading: "§ 9 Zewnętrzne kanały rezerwacyjne",
      paragraphs: [
        "W przypadku połączenia z kanałami zewnętrznymi (np. Booking.com, Airbnb) dodatkowo obowiązują warunki danego operatora kanału. Wymagane w tym celu umowy Użytkownik zawiera bezpośrednio z operatorem kanału.",
        "myNextDays zapewnia techniczną synchronizację dostępności, cen i danych rezerwacji, nie ma jednak wpływu na treści, prowizje ani decyzje operatorów kanałów i nie odpowiada za ich dostępność.",
      ],
    },
    {
      heading: "§ 10 Dostępność i rozwój Platformy",
      paragraphs: [
        "myNextDays świadczy usługi z należytą starannością wymaganą w obrocie profesjonalnym i dąży do wysokiej dostępności Platformy. Okna serwisowe, prace rozwojowe oraz okoliczności pozostające poza wpływem myNextDays (np. zakłócenia u dostawców zewnętrznych) mogą tymczasowo ograniczać dostępność.",
        "myNextDays może rozwijać Platformę i zmieniać jej funkcje, o ile nie zagraża to celowi umowy, a zmiana jest dla Użytkownika akceptowalna.",
      ],
    },
    {
      heading: "§ 11 Dane i ochrona danych",
      paragraphs: [
        "Jeżeli myNextDays w ramach udostępniania Platformy przetwarza dane osobowe w imieniu Użytkownika (w szczególności dane gości), strony zawierają umowę powierzenia przetwarzania danych zgodnie z art. 28 RODO.",
        "Użytkownik pozostaje odpowiedzialny za dopuszczalność gromadzenia i przetwarzania wprowadzanych przez niego danych w świetle przepisów o ochronie danych. Szczegóły dotyczące przetwarzania danych przez myNextDays wynikają z informacji o ochronie danych Platformy; do przetwarzania danych przez Stripe stosuje się § 5.",
      ],
    },
    {
      heading: "§ 12 Wykorzystanie sztucznej inteligencji",
      paragraphs: [
        "myNextDays wykorzystuje w poszczególnych funkcjach systemy sztucznej inteligencji, w szczególności do rekomendacji cenowych (dynamic pricing), do propozycji odpowiedzi w skrzynce odbiorczej wiadomości oraz do wspomagania pomocy technicznej. Funkcje te generują propozycje; decyzja o ich wykorzystaniu i odpowiedzialność za nie należą do Użytkownika. Rekomendacje cenowe nie zastępują własnej oceny handlowej.",
        "Jeżeli goście wchodzą w bezpośrednią interakcję z systemem sztucznej inteligencji, są o tym informowani (art. 50 ust. 1 rozporządzenia (UE) 2024/1689 — „aktu w sprawie sztucznej inteligencji”). Teksty, które system sztucznej inteligencji wygenerował lub istotnie zmienił i które Użytkownik przekazuje gościom, Użytkownik ma obowiązek oznaczyć, o ile ciąży na nim taki obowiązek prawny.",
        "myNextDays nie eksploatuje systemów sztucznej inteligencji, które zgodnie z załącznikiem III do aktu w sprawie sztucznej inteligencji uznaje się za systemy wysokiego ryzyka, ani nie stosuje praktyk zakazanych na podstawie art. 5 aktu w sprawie sztucznej inteligencji. Dane wprowadzane przez Użytkownika oraz dane jego gości nie są bez odrębnego zlecenia wykorzystywane do trenowania modeli.",
        "Użytkownik nie może wykorzystywać funkcji sztucznej inteligencji do wywoływania u gości wrażenia komunikacji z człowiekiem tam, gdzie istnieje obowiązek ujawnienia, ani do składania prawnie wiążących oświadczeń bez własnej weryfikacji.",
        "Jeżeli Użytkownik połączy swoje konto za pośrednictwem przewidzianego do tego interfejsu programistycznego z własnym asystentem sztucznej inteligencji (na przykład Claude firmy Anthropic), obowiązuje następujące: Użytkownik samodzielnie zawiera umowę o korzystanie z tej usługi i jest odpowiedzialny za jej wykorzystanie. Połączenie stanowi jego polecenie dla myNextDays, aby przekazała tam udostępnione dane — w tym przekazanie do kraju trzeciego, jeżeli dostawca ma siedzibę poza Unią Europejską. Użytkownik zapewnia, że ma do tego podstawę prawną, że jego własne informacje o ochronie danych wskazują odbiorcę oraz że spełnione są wymagane gwarancje dotyczące przekazywania.",
        "Do takiego połączenia Użytkownik wykorzystuje dostęp, dla którego dostawca oferuje powierzenie przetwarzania danych i wyklucza wykorzystywanie danych do trenowania modeli — w przypadku Claude są to dostępy dla klientów biznesowych (Team, Enterprise lub API). Dostępy przeznaczone do użytku prywatnego z reguły tego nie spełniają; z tego powodu nie są odpowiednie dla danych gości. myNextDays nie może rozpoznać, jakiego dostępu używa Użytkownik, i wskazuje na to w okienku dialogowym zgody.",
        "Użytkownik uwzględnia przy tym, że treści, które ręcznie kopiuje z interfejsu użytkownika do pola wprowadzania asystenta, z reguły nie są objęte umownymi ograniczeniami dostawcy — inaczej niż dane pobierane za pośrednictwem interfejsu programistycznego.",
        "Dane pochodzące z portalu rezerwacyjnego Użytkownik wykorzystuje również za pośrednictwem interfejsu programistycznego wyłącznie do realizacji i obsługi danej rezerwacji — nie do oceny osób, do profilowania ani do celów reklamowych. Portale narzucają to ograniczenie celu we własnych warunkach.",
      ],
    },
    {
      heading: "§ 13 Skargi i mediacja",
      paragraphs: [
        "myNextDays prowadzi dla użytkowników prowadzących działalność gospodarczą bezpłatny wewnętrzny system rozpatrywania skarg (art. 11 rozporządzenia (UE) 2019/1150 — „rozporządzenia P2B”). Skargi — w szczególności dotyczące zarzucanych naruszeń niniejszego Regulaminu, problemów technicznych o istotnym oddziaływaniu lub środków podjętych przez myNextDays wobec Użytkownika — można zgłaszać w dowolnej formie na adres info@mynextdays.dk lub za pośrednictwem pomocy technicznej w aplikacji. Otrzymanie skargi jest potwierdzane; jej rozpatrzenie następuje niezwłocznie i w odpowiednim terminie, w sprawach nieskomplikowanych z reguły w ciągu 14 dni. Wynik jest przekazywany Użytkownikowi jasnym językiem.",
        "Jeżeli w postępowaniu skargowym nie dojdzie do porozumienia, myNextDays jest gotowa zwrócić się wraz z Użytkownikiem pozasądowo do następujących mediatorów (art. 12 rozporządzenia P2B): (1) WIPO Arbitration and Mediation Center, 34 chemin des Colombettes, 1211 Genewa 20, Szwajcaria — postępowania także na odległość i w wielu językach; (2) Voldgiftsinstituttet — Danish Institute of Arbitration, Kronprinsessegade 28, 1306 Kopenhaga K, Dania — państwo siedziby dostawcy.",
        "Wskazanie mediatorów nie zobowiązuje Użytkownika do przeprowadzenia postępowania mediacyjnego; prawo do wystąpienia do sądu pozostaje nienaruszone. W rozsądnych kosztach mediacji myNextDays partycypuje; ich podział wynika z regulaminu danego mediatora oraz z okoliczności konkretnego przypadku.",
        "myNextDays publikuje corocznie informacje o liczbie skarg, o czasie ich rozpatrywania oraz o podjętych środkach.",
      ],
    },
    {
      heading: "§ 14 Własność intelektualna",
      paragraphs: [
        "Wszelkie prawa do Platformy, jej oprogramowania i treści (z wyjątkiem treści zamieszczanych przez Użytkownika) przysługują myNextDays lub jej licencjodawcom. Użytkownik otrzymuje na okres obowiązywania umowy niewyłączne, nieprzenoszalne prawo do korzystania z Platformy w zakresie uzgodnionym w umowie.",
        "W odniesieniu do treści zamieszczanych przez Użytkownika Użytkownik udziela myNextDays niewyłącznych praw do korzystania z nich w zakresie niezbędnym do prowadzenia Platformy (w szczególności do przechowywania, zwielokrotniania, wyświetlania i przekazywania do połączonych kanałów).",
      ],
    },
    {
      heading: "§ 15 Odpowiedzialność",
      paragraphs: [
        "myNextDays ponosi nieograniczoną odpowiedzialność za winę umyślną i rażące niedbalstwo oraz za szkody wynikające z naruszenia życia, ciała lub zdrowia.",
        "W przypadku zwykłego niedbalstwa myNextDays odpowiada wyłącznie za naruszenie istotnych obowiązków umownych (obowiązków kardynalnych), w granicach typowej dla umowy, możliwej do przewidzenia szkody. Odpowiedzialność na podstawie przepisów o odpowiedzialności za produkt oraz z tytułu udzielonych gwarancji pozostaje nienaruszona.",
        "Za utratę danych myNextDays odpowiada tylko w takim zakresie, w jakim szkoda powstałaby również przy prawidłowym, regularnym tworzeniu kopii zapasowych przez Użytkownika, chyba że tworzenie kopii zapasowych należy na mocy umowy do obowiązków myNextDays.",
      ],
    },
    {
      heading: "§ 16 Okres obowiązywania, wypowiedzenie i blokada",
      paragraphs: [
        "Okres obowiązywania i terminy wypowiedzenia wynikają z danej umowy. Prawo do nadzwyczajnego wypowiedzenia z ważnego powodu pozostaje nienaruszone.",
        "myNextDays może tymczasowo zablokować dostęp do Platformy lub poszczególne funkcje (w tym przyjmowanie płatności i wypłaty), jeżeli istnieją konkretne przesłanki naruszenia niniejszego Regulaminu, oszustwa lub nadużycia albo jeżeli myNextDays jest do tego zobowiązana przepisami prawa lub poleceniem dostawcy usług płatniczych. Użytkownik zostanie poinformowany o blokadzie, o ile jest to prawnie dopuszczalne.",
        "Po zakończeniu umowy myNextDays na żądanie udostępni Użytkownikowi jego dane do eksportu w powszechnie stosowanym formacie w ciągu 30 dni; następnie dane zostaną usunięte, o ile nie stoją temu na przeszkodzie ustawowe obowiązki przechowywania.",
      ],
    },
    {
      heading: "§ 17 Zmiany niniejszego Regulaminu",
      paragraphs: [
        "myNextDays może zmienić niniejszy Regulamin ze skutkiem na przyszłość, o ile jest to konieczne z ważnych przyczyn (w szczególności z powodu zmian przepisów prawa, orzecznictwa lub wymogów dostawców usług płatniczych), a Użytkownik nie zostanie przez to nadmiernie pokrzywdzony.",
        "Zmiany będą zapowiadane Użytkownikowi w formie tekstowej co najmniej sześć tygodni przed ich wejściem w życie. Jeżeli Użytkownik nie zgłosi sprzeciwu w okresie zapowiedzi lub będzie nadal korzystać z Platformy po wejściu zmian w życie, zmieniony Regulamin uznaje się za przyjęty; na ten skutek zostanie osobno zwrócona uwaga w zapowiedzi.",
      ],
    },
    {
      heading: "§ 18 Postanowienia końcowe",
      paragraphs: [
        "Zastosowanie ma prawo państwa, w którym dostawca Platformy ma swoją siedzibę, z wyłączeniem Konwencji Narodów Zjednoczonych o umowach międzynarodowej sprzedaży towarów. Bezwzględnie obowiązujące przepisy państwa, w którym Użytkownik ma swoją siedzibę, pozostają nienaruszone.",
        "Wyłącznie właściwym sądem dla wszystkich sporów wynikających z niniejszej umowy lub z nią związanych jest — w zakresie prawnie dopuszczalnym — sąd właściwy dla siedziby dostawcy Platformy.",
        "Jeżeli poszczególne postanowienia niniejszego Regulaminu są lub staną się nieskuteczne, nie narusza to skuteczności pozostałych postanowień.",
      ],
    },
  ],
};
