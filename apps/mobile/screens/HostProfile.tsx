// Gastgeber · Profil. Zeigt das angemeldete Konto aus dem zentralen Auth-Context
// (me = /auth/me): E-Mail, Rolle, Berechtigungen. Abmelden setzt den Auth-Status
// auf signedOut → die Root-Navigation zeigt wieder den Gast-Bereich. Dieselbe
// Auth wie das Web-Dashboard.
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Card, Chip, Col, Row, Txt } from "@/components/ui/kit";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/theme/ThemeProvider";

export default function HostProfile() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { me, logout } = useAuth();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.palette.bg,
        paddingTop: insets.top + 8,
        paddingHorizontal: 20,
        gap: 18,
      }}
    >
      <Txt v="h1">Profil</Txt>

      <Card style={{ padding: 18, gap: 8 }}>
        <Txt v="title">{me?.email ?? "—"}</Txt>
        {me?.role && (
          <Txt v="sm" soft>
            Rolle: {me.role}
          </Txt>
        )}
        {me && me.capabilities.length > 0 && (
          <Col gap={6} style={{ marginTop: 4 }}>
            <Txt v="xs" soft>
              BERECHTIGUNGEN
            </Txt>
            <Row gap={6} style={{ flexWrap: "wrap" }}>
              {me.capabilities.map((c) => (
                <Chip key={c} variant="ghost">
                  {c}
                </Chip>
              ))}
            </Row>
          </Col>
        )}
      </Card>

      <Btn variant="outline" block icon="back" onPress={logout}>
        Abmelden
      </Btn>
    </View>
  );
}
