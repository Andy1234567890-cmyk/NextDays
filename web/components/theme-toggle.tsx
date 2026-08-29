"use client";

// Light/Dark-Umschalter für die Topbar. Icons via Iconify (ph:*).
import { Icon } from "@iconify/react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("common");

  // Erst nach Mount rendern — sonst Hydration-Mismatch (Server kennt das Theme nicht).
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  // ALLES, was vom Theme abhaengt, haengt am `mounted`-Riegel — nicht nur das
  // Icon. Vorher stand das `aria-label` ausserhalb: serverseitig ist
  // `resolvedTheme` undefined (also „Dunkles Design"), im Client danach
  // „Helles Design" — React meldete das als Hydration-Mismatch auf genau
  // diesem Attribut. Ein halber Riegel ist kein Riegel.
  const label = !mounted
    ? t("themeToggle")
    : isDark
      ? t("themeToggleLight")
      : t("themeToggleDark");

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted ? (
        <Icon icon={isDark ? "ph:sun" : "ph:moon"} className="size-5" />
      ) : (
        <Icon icon="ph:circle-dashed" className="size-5 opacity-0" />
      )}
    </Button>
  );
}
