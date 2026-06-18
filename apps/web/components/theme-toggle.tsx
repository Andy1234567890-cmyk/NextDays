"use client";

// Light/Dark-Umschalter für die Topbar. Icons via Iconify (ph:*).
import { Icon } from "@iconify/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Erst nach Mount rendern — sonst Hydration-Mismatch (Server kennt das Theme nicht).
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Helles Design" : "Dunkles Design"}
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
