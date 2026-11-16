/**
 * Installable app manifest. `share_target` puts “Logbook” in the phone's share sheet
 * (Android / Chrome, once installed); shared links open /capture pre-filled.
 *
 * A plain route handler rather than app/manifest.ts: Next's metadata-route loader breaks
 * when the project path contains an apostrophe (this folder is "JK's 2nd BRAIN").
 */
const MANIFEST = {
  name: "Logbook",
  short_name: "Logbook",
  description: "Your private second brain — links, notes, tasks and daily progress.",
  id: "/",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#0b0c0e",
  theme_color: "#0b0c0e",
  icons: [
    { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  shortcuts: [
    { name: "Tasks", url: "/tasks" },
    { name: "Journal", url: "/journal" },
    { name: "Save a link", url: "/capture" },
  ],
  share_target: {
    action: "/capture",
    method: "GET",
    params: { title: "title", text: "text", url: "url" },
  },
};

export const dynamic = "force-static";

export function GET() {
  return Response.json(MANIFEST, { headers: { "Content-Type": "application/manifest+json" } });
}
