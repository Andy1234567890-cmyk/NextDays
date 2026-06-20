import * as React from 'react';
import { cn } from '../lib/cn';

const VisuallyHidden = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'clip-[rect(0,0,0,0)] absolute -m-px h-px w-px overflow-hidden whitespace-nowrap border-0 p-0',
        className,
      )}
      style={{
        clip: 'rect(0, 0, 0, 0)',
        clipPath: 'inset(50%)',
        height: '1px',
        overflow: 'hidden',
        position: 'absolute',
        whiteSpace: 'nowrap',
        width: '1px',
      }}
      {...props}
    />
  ),
);
VisuallyHidden.displayName = 'VisuallyHidden';

export { VisuallyHidden };
