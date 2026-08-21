import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { ACCENTS } from "@/lib/binder/types";
import { useBinder } from "@/lib/binder/store";
import { useEffect } from "react";
import appCss from "../styles.css?url";

const APP_NAME = "Binder Builder";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#000000" },
      {
        name: "description",
        content: "Metro court-binder builder: cause title, index, merged PDFs, hearing mode, chronology, limitation desk.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
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
  const accent = useBinder((s) => s.accent);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

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
