'use client';

import { Icon } from '@iconify/react';
import type * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { cn } from '../lib/cn';
import { buttonVariants } from './button';

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = {
    months: 'flex flex-col sm:flex-row gap-2',
    month: 'flex flex-col gap-4',
    month_caption: 'flex justify-center pt-1 relative items-center w-full',
    caption_label: 'text-sm font-medium',
    nav: 'flex items-center gap-1',
    button_previous: cn(
      buttonVariants({ variant: 'outline' }),
      'size-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1',
    ),
    button_next: cn(
      buttonVariants({ variant: 'outline' }),
      'size-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1',
    ),
    month_grid: 'w-full border-collapse',
    weekdays: 'flex w-full',
    weekday:
      'text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] justify-center flex',
    week: 'flex w-full mt-2',
    day: cn(
      'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent',
      props.mode === 'range'
        ? '[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md'
        : '[&:has([aria-selected])]:rounded-md',
    ),
    day_button: cn(
      buttonVariants({ variant: 'ghost' }),
      'size-8 p-0 font-normal aria-selected:opacity-100',
    ),
    range_start:
      'day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground',
    range_end: 'day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground',
    selected:
      'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
    today: 'bg-accent text-accent-foreground',
    outside:
      'day-outside text-muted-foreground opacity-50 aria-selected:text-muted-foreground aria-selected:opacity-30',
    disabled: 'text-muted-foreground opacity-50',
    range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
    hidden: 'invisible',
    ...classNames,
  } as Record<string, string>;

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={defaultClassNames}
      components={{
        Chevron: ({ orientation, ...chevronProps }: { orientation?: string; [key: string]: unknown }) =>
          orientation === 'left' ? (
            <Icon icon="lucide:chevron-left" className="size-4" {...chevronProps} />
          ) : (
            <Icon icon="lucide:chevron-right" className="size-4" {...chevronProps} />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
