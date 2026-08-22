import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { ACCENTS } from "@/lib/binder/types";
import { useBinder } from "@/lib/binder/store";
import { useCourt } from "@/lib/binder/court-store";
import { useEffect } from "react";
import appCss from "../styles.css?url";

const APP_NAME = "Binder Builder";
const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#000000" },
      { name: "description",
        content: "Metro chambers desk: fetch Bombay HC / SAT / NCLT records, scan cause lists, download orders, compile binders.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: asset("favicon.svg") },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: asset("__grok/manifest.webmanifest") },
      { rel: "apple-touch-icon", href: asset("__grok/icon-180.png") },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@200;300;400;600;700&family=Barlow:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  component: RootShell,
});

function RootShell() {
  const hydrate = useBinder((s) => s.hydrate);
  const ready = useBinder((s) => s.ready);
  const accent = useBinder((s) => s.accent);
  const courtHydrated = useCourt((s) => s.hydrated);
  useEffect(() => {
    void hydrate();
    void Promise.resolve(useCourt.persist.rehydrate()).then(() => {
      useCourt.getState().setHydrated();
    });
  }, [hydrate]);
  useEffect(() => {
    if (!ready || !courtHydrated) return;
    void import("@/lib/binder/autoscan").then((m) => m.startAutoScan());
    return () => {
      void import("@/lib/binder/autoscan").then((m) => m.stopAutoScan());
    };
  }, [ready, courtHydrated]);

  return (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <head>
        <HeadContent />
      </head>
      <body
        className="bg-bg text-fg"
        style={{ ["--color-accent" as string]: ACCENTS[accent] }}
      >
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
