"use client";

// Label mit optionalem Info-Tooltip: zeigt ein kleines „i"-Icon hinter dem
// Label-Text; der Hilfetext erscheint als Tooltip beim Hover/Fokus — statt als
// dauerhaft sichtbarer Untertext. Hält Formulare aufgeräumt.
import { Icon } from "@iconify/react";

import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  htmlFor?: string;
  children: React.ReactNode; // Label-Text
  hint?: string; // Tooltip-Inhalt (optional)
  required?: boolean;
};

export function LabelHint({ htmlFor, children, hint, required }: Props) {
  return (
    <span className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>
        {children}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {hint ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Mehr Informationen"
                className="inline-flex text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon icon="ph:info" className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{hint}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </span>
  );
}
