import { createFileRoute, Link } from "@tanstack/react-router";
import { ScanFace, ShieldCheck, Activity, Users, LineChart, Lock } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sentra — AI Facial Recognition Attendance" },
      {
        name: "description",
        content:
          "Enterprise face-recognition attendance: liveness-checked check-in, encrypted face templates, and real-time workforce analytics.",
      },
      { property: "og:title", content: "Sentra — AI Facial Recognition Attendance" },
      {
        property: "og:description",
        content:
          "Liveness-checked facial attendance for the enterprise. Embeddings only, never raw photos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: ScanFace,
    title: "Sub-second recognition",
    body: "A deep-learning detector, 68-point aligner, and 128-D embedding network run on-device for instant identification.",
  },
  {
    icon: ShieldCheck,
    title: "Active liveness",
    body: "Randomised blink and head-turn challenges block printed photos, phone screens, and replayed video.",
  },
  {
    icon: Lock,
    title: "Template-only storage",
    body: "Only irreversible math vectors are stored. Face images never leave the browser and never touch the database.",
  },
  {
    icon: Users,
    title: "Workforce records",
    body: "Employees, departments, statuses, and enrolment state managed by role-scoped HR and admin accounts.",
  },
  {
    icon: Activity,
    title: "Attendance engine",
    body: "Check-in, check-out, and breaks with duplicate suppression, confidence, and liveness scoring on every event.",
  },
  {
    icon: LineChart,
    title: "Audit-ready",
    body: "Every recognition writes a signed event row with match distance so compliance teams can reconstruct any day.",
  },
];

function Landing() {
  return (
    <main className="min-h-screen hero-surface">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="accent-surface flex h-8 w-8 items-center justify-center rounded-lg">
            <ScanFace className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-semibold">Sentra</span>
        </div>
        <Link to="/auth">
          <Button variant="outline" size="sm">
            Sign in
          </Button>
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pt-20">
        <p className="mb-4 inline-flex rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
          Facial attendance · liveness verified · privacy by design
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
          Attendance that recognises your people, not their badges.
        </h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
          Sentra replaces fingerprints, RFID cards, and paper sign-ins with liveness-checked facial
          recognition. Employees enrol once from five angles; every subsequent check-in takes under two
          seconds.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/auth">
            <Button size="lg">Open the console</Button>
          </Link>
          <Link to="/kiosk">
            <Button size="lg" variant="outline">
              Launch attendance kiosk
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-3">
        {features.map((f) => (
          <article key={f.title} className="panel p-6">
            <f.icon className="h-6 w-6 text-primary" />
            <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
