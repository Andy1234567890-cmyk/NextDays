// Platzhalter-Screen für noch nicht ausgestaltete Tabs (Merkliste, Profil).
import { Icon, type IconName } from "@/components/ui/Icon";
import { Col, Txt } from "@/components/ui/kit";
import { Screen } from "@/components/ui/Screen";
import { useTheme } from "@/theme/ThemeProvider";

export function Placeholder({ title, hint, icon }: { title: string; hint: string; icon: IconName }) {
  const t = useTheme();
  return (
    <Screen scroll={false}>
      <Col gap={12} style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Icon n={icon} s={40} c={t.palette.faint} />
        <Txt v="h2">{title}</Txt>
        <Txt v="sm" soft style={{ textAlign: "center" }}>
          {hint}
        </Txt>
      </Col>
    </Screen>
  );
}
