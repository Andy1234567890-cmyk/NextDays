'use client';
import { Icon } from '@iconify/react';
import * as React from 'react';
import { cn } from '../lib/cn';
import { Button } from './button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export type Option = {
  label: string;
  value: string;
};

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select items...',
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const _handleUnselect = (item: string) => {
    onChange(selected.filter(i => i !== item));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-auto min-h-10 w-full justify-between',
            selected.length > 0 ? 'h-auto' : 'h-10',
            className,
          )}
        >
          <div className="flex flex-wrap gap-1">
            {selected.length === 0 && (
              <span className="font-normal text-muted-foreground">{placeholder}</span>
            )}
            {selected.length > 0 && (
              <span className="font-normal">{selected.length} ausgewählt</span>
            )}
          </div>
          <Icon icon="lucide:chevrons-up-down" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Suchen..." />
          <CommandList>
            <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {options.map(option => (
                <CommandItem
                  key={option.value}
                  onSelect={() => {
                    onChange(
                      selected.includes(option.value)
                        ? selected.filter(item => item !== option.value)
                        : [...selected, option.value],
                    );
                  }}
                >
                  <Icon
                    icon="lucide:check"
                    className={cn(
                      'mr-2 h-4 w-4',
                      selected.includes(option.value) ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
