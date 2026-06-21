"use client";

// Dashboard-Topbar: Sidebar-Trigger, Seitentitel, Benachrichtigungen,
// Theme-Umschalter. Client-Komponente (Iconify + Interaktion).
import { Icon } from "@iconify/react";

import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function Topbar() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="font-display text-base font-extrabold">Übersicht</h1>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Benachrichtigungen">
          <Icon icon="ph:bell" className="size-5" />
        </Button>
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
