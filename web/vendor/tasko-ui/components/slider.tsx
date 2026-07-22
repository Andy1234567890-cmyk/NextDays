'use client';

import * as SliderPrimitive from '@radix-ui/react-slider';
import * as React from 'react';

import { cn } from '../lib/cn';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  const thumbCount = Array.isArray(props.value)
    ? props.value.length
    : Array.isArray(props.defaultValue)
      ? props.defaultValue.length
      : 1;

  const thumbClassName =
    'block h-5 w-5 rounded-full border-2 border-[#14ad9f] bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14ad9f] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn('relative flex w-full touch-none select-none items-center', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-[#14ad9f]" />
      </SliderPrimitive.Track>
      {thumbCount >= 1 && <SliderPrimitive.Thumb className={thumbClassName} />}
      {thumbCount >= 2 && <SliderPrimitive.Thumb className={thumbClassName} />}
      {thumbCount >= 3 && <SliderPrimitive.Thumb className={thumbClassName} />}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
