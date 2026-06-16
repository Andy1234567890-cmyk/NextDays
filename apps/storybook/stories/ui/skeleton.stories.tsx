import type { Meta, StoryObj } from "@storybook/react";

import { Skeleton, SkeletonAvatar, SkeletonText } from "@/components/ui/skeleton";

const meta = {
  title: "UI-Bausteine/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

// Einzelner Block als Standard-Platzhalter.
export const Standard: Story = {
  args: { className: "h-6 w-48" },
};

// Verschiedene Formen (Block, Zeile, Kreis).
export const Formen: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="size-12 rounded-full" />
    </div>
  ),
};

// Mehrzeiliger Text-Platzhalter.
export const Textzeilen: Story = {
  render: () => <SkeletonText lines={4} className="w-80" />,
};

// Avatar-Platzhalter in mehreren Größen.
export const Avatare: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <SkeletonAvatar className="size-8" />
      <SkeletonAvatar />
      <SkeletonAvatar className="size-14" />
    </div>
  ),
};

// Realistische Karte (z.B. ladende Reservierung) aus mehreren Skeletons.
export const Karte: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-4 rounded-(--radius) border border-border bg-background p-4">
      <div className="flex items-center gap-3">
        <SkeletonAvatar />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-32 w-full" />
      <SkeletonText lines={3} />
    </div>
  ),
};

// Ladende Listenzeilen (z.B. Aufgabenliste).
export const Liste: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-(--radius) border border-border p-3"
        >
          <Skeleton className="size-9 rounded-(--radius)" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  ),
};
