'use client';

import * as AvatarPrimitive from '@radix-ui/react-avatar';
import type * as React from 'react';

// Hauptkomponenten
const Avatar = ({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) => (
  <AvatarPrimitive.Root
    data-slot="avatar"
    className={`inline-block overflow-hidden rounded-full ${className}`}
    {...props}
  />
);

const AvatarImage = ({
  className,
  src,
  alt,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) => (
  <AvatarPrimitive.Image
    data-slot="avatar-image"
    className={`h-full w-full rounded-full object-cover ${className}`}
    src={src}
    alt={alt}
    onError={e => {
      const target = e.target as HTMLImageElement;
      target.style.display = 'none';
    }}
    {...props}
  />
);

const AvatarFallback = ({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) => (
  <AvatarPrimitive.Fallback
    data-slot="avatar-fallback"
    className={`flex h-full w-full items-center justify-center rounded-full bg-gray-300 font-semibold text-gray-700 ${className}`}
    {...props}
  />
);

export { Avatar, AvatarImage, AvatarFallback };
