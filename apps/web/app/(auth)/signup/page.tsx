// Sign-up-Seite (vor dem Login, wie Lodgify): abgeblendeter Demo-Kalender im
// Hintergrund, davor das zentrierte Sign-up-Modal. Server Component — das
// Modal kapselt die Interaktion (Auswahl → Ladebalken).
import { DemoCalendar } from "@/components/signup/demo-calendar";
import { SignupModal } from "@/components/signup/signup-modal";

export default function SignupPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Hintergrund: statischer Demo-Kalender, leicht unscharf + abgeblendet */}
      <div aria-hidden className="absolute inset-0 scale-105 blur-[2px]">
        <DemoCalendar />
      </div>
      <div aria-hidden className="absolute inset-0 bg-background/60" />

      {/* Vordergrund: Sign-up-Modal */}
      <div className="relative flex min-h-screen items-center justify-center p-4">
        <SignupModal />
      </div>
    </main>
  );
}
