// Gastgeber · Profil. Zeigt das angemeldete Konto aus dem zentralen Auth-Context
// (me = /auth/me): E-Mail, Rolle, Berechtigungen. Abmelden setzt den Auth-Status
// auf signedOut → die Root-Navigation zeigt wieder den Gast-Bereich. Dieselbe
// Auth wie das Web-Dashboard.
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Chip, Col, Row, Txt } from "@/components/ui/kit";
import { ListRow } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/theme/ThemeProvider";

export default function HostProfile() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { me, logout } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40, gap: 24 }}>
        <Txt v="display">Profil</Txt>

        <Row gap={16}>
          <Avatar s={64} icon="user" />
          <Col gap={3} style={{ flex: 1 }}>
            <Txt v="h2" numberOfLines={1}>
              {me?.email ?? "—"}
            </Txt>
            {me?.role && (
              <Txt v="sm" soft>
                Rolle: {me.role}
              </Txt>
            )}
          </Col>
        </Row>

        {me && me.capabilities.length > 0 && (
          <Col gap={10}>
            <Txt v="h2">Berechtigungen</Txt>
            <Row gap={8} style={{ flexWrap: "wrap" }}>
              {me.capabilities.map((c) => (
                <Chip key={c}>{c}</Chip>
              ))}
            </Row>
          </Col>
        )}

        <View style={{ height: 1, backgroundColor: t.palette.line }} />

        <Col>
          <ListRow icon="logout" label="Abmelden" onPress={logout} danger last />
        </Col>
      </ScrollView>
    </View>
  );
}
