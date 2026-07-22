// Theme-Umschalter (Light/Dark) für die Top-Bar — Iconify-Icons (PROJECT.md §6).
import { Icon } from "@iconify/react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Theme umschalten"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <Icon
        icon={isDark ? "ph:sun-bold" : "ph:moon-bold"}
        width={20}
        height={20}
      />
    </Button>
  );
}
