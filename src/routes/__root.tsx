import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFB] px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-[#1B1A20] tracking-[-0.03em]">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-[#1B1A20]">Page not found</h2>
        <p className="mt-2 text-sm text-[#5C5A66]">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-[#1B1A20] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#2B2934] hover:shadow-[0_0_20px_rgba(199,184,245,0.45)]"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFB] px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold tracking-tight text-[#1B1A20]">This page didn't load</h1>
        <p className="mt-2 text-sm text-[#5C5A66]">
          Something went wrong. You can try refreshing or head back to the home page.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-[#1B1A20] px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-[#2B2934] hover:shadow-[0_0_20px_rgba(199,184,245,0.45)] cursor-pointer"
          >
            Try Again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-[#ECEBF0] bg-white px-6 py-2 text-sm font-semibold text-[#1B1A20] transition-colors hover:bg-[#F3F2F6] hover:border-[#9B99A6]"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SmileTime Pro" },
      {
        name: "description",
        content:
          "Enterprise facial recognition attendance platform with zero-photo retention, on-device matching, active anti-spoof liveness, and automated shift intelligence.",
      },
      { name: "author", content: "SmileTime Pro" },
      { property: "og:title", content: "SmileTime Pro" },
      {
        property: "og:description",
        content: "On-device face matching, active liveness, and role-based workforce analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" richColors theme="light" />
    </QueryClientProvider>
  );
}
