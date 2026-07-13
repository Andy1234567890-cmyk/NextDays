// Tab-Navigator des Verwalter-/Mitarbeiter-Erlebnisses. Die Tab-Struktur hängt
// an der Rolle (§4.3), NICHT an clientseitigem Ausblenden von Inhalten:
//
//  admin/co_admin (Verwaltung): Übersicht · Kalender · Reservierungen ·
//    Aufgaben · Mehr(→ Inbox/Inserate/Profil). 5 sichtbare Tabs (Regel: max 5);
//    die selteneren Bereiche liegen hinter „Mehr" statt als 7. Tab.
//  staff/cleaner (Mitarbeiter): Aufgaben · Profil. Reduziert — KEIN Finanz-/
//    Vertriebseinblick (keine Reservierungen/Beträge, keine Übersicht, keine
//    Inbox/Inserate). BEWUSST auch kein Kalender-Tab: _STAFF hat kein
//    VIEW_CALENDAR (§4.3, permissions.py) — /calendar/availability würde 403
//    liefern; Belegungszeiten sehen Mitarbeiter über ihre Aufgaben. Das
//    Backend maskiert zusätzlich (doppelter Schutz).
//
// Begründung „Mehr" statt Rollen-Wildcard: staff/cleaner bekommen die
// Finanz-/Vertriebs-Tabs GAR NICHT (nicht nur versteckt) — ein gemeinsames
// „Mehr" für alle würde §4.3 nur kaschieren. Darum zwei getrennte Tab-Sätze.
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/Icon";
import { useAuth } from "@/contexts/AuthContext";
import { can } from "@/lib/permissions";
import type { HostTabParamList } from "@/navigation/types";
import HostCalendar from "@/screens/HostCalendar";
import HostDashboard from "@/screens/HostDashboard";
import HostInbox from "@/screens/HostInbox";
import HostListings from "@/screens/HostListings";
import HostMore from "@/screens/HostMore";
import HostProfile from "@/screens/HostProfile";
import HostReservations from "@/screens/HostReservations";
import HostTasks from "@/screens/HostTasks";
import { useTheme } from "@/theme/ThemeProvider";

const Tab = createBottomTabNavigator<HostTabParamList>();

export function HostTabs() {
  const t = useTheme();
  const { me } = useAuth();
  // MANAGE_TASKS deckt die Verwalter-Rollen ab (admin/co_admin); staff/cleaner
  // haben nur VIEW_OWN_TASKS.
  const isManager = can(me, "manage_tasks");
  const insets = useSafeAreaInsets();

  const icon = (name: IconName) =>
    ({ color, focused }: { color: string; focused: boolean }) => (
      <Icon n={name} s={23} sw={focused ? 2.1 : 1.7} c={color} />
    );

  const screenOptions = {
    headerShown: false,
    tabBarActiveTintColor: t.palette.accent,
    tabBarInactiveTintColor: t.palette.faint,
    tabBarStyle: {
      backgroundColor: t.palette.surface,
      borderTopColor: t.palette.line,
      // Feste Inhaltshöhe + untere Safe-Area (Home-Indicator), sonst kleben die
      // Labels am unteren Rand und der Indicator überlappt sie.
      height: 60 + insets.bottom,
      paddingTop: 8,
      paddingBottom: insets.bottom,
    },
    tabBarLabelStyle: { fontSize: 10.5, fontFamily: t.fonts.semibold },
  } as const;

  // Mitarbeiter-Erlebnis: reduzierte Tabs, kein Finanz-/Vertriebseinblick.
  if (!isManager) {
    return (
      <Tab.Navigator initialRouteName="Tasks" screenOptions={screenOptions}>
        <Tab.Screen name="Tasks" component={HostTasks} options={{ title: "Aufgaben", tabBarIcon: icon("list") }} />
        <Tab.Screen name="HostProfile" component={HostProfile} options={{ title: "Profil", tabBarIcon: icon("user") }} />
      </Tab.Navigator>
    );
  }

  // Verwalter-Erlebnis: 5 sichtbare Tabs; Inbox/Inserate/Profil hinter „Mehr“
  // (im Navigator vorhanden, aber ohne eigenen Tab-Button). display:"none"
  // entfernt den Slot GANZ — tabBarButton:()=>null ließe leeren Flex-Platz und
  // die sichtbaren Tabs würden nach links klumpen.
  const hidden = { tabBarItemStyle: { display: "none" } } as const;
  return (
    <Tab.Navigator initialRouteName="Dashboard" screenOptions={screenOptions}>
      <Tab.Screen name="Dashboard" component={HostDashboard} options={{ title: "Übersicht", tabBarIcon: icon("chart") }} />
      <Tab.Screen name="Calendar" component={HostCalendar} options={{ title: "Kalender", tabBarIcon: icon("cal") }} />
      <Tab.Screen name="Reservations" component={HostReservations} options={{ title: "Buchungen", tabBarIcon: icon("card") }} />
      <Tab.Screen name="Tasks" component={HostTasks} options={{ title: "Aufgaben", tabBarIcon: icon("list") }} />
      <Tab.Screen name="More" component={HostMore} options={{ title: "Mehr", tabBarIcon: icon("more") }} />
      {/* Über „Mehr“ erreichbar, aber nicht in der Leiste: */}
      <Tab.Screen name="HostInbox" component={HostInbox} options={{ title: "Inbox", ...hidden }} />
      <Tab.Screen name="Listings" component={HostListings} options={{ title: "Inserate", ...hidden }} />
      <Tab.Screen name="HostProfile" component={HostProfile} options={{ title: "Profil", ...hidden }} />
    </Tab.Navigator>
  );
}
