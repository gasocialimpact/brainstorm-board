import "@fontsource/familjen-grotesk/400.css";
import "@fontsource/familjen-grotesk/500.css";
import "@fontsource/familjen-grotesk/600.css";
import "@fontsource/familjen-grotesk/700.css";
import "@fontsource/young-serif/400.css";
import { FONT_FAMILY, Fonts } from "@excalidraw/excalidraw";

// GSIC's brand fonts, self-hosted, added to Excalidraw's font picker.
//
// Excalidraw has no public API for extra fonts, but its font table
// (FONT_FAMILY) and registry (Fonts.registered) are exported. Text elements
// store a numeric family id; ids 100+ are ours and well clear of Excalidraw's.
// The font files come from the @fontsource packages (CSS @font-face), so the
// registry entries carry metrics only, measured from the fonts themselves.

export const GSIC_FONTS = {
  "Familjen Grotesk": 100,
  "Young Serif": 101,
} as const;

/** Default for all generated text (templates, clusters, new text) */
export const BODY_FONT = GSIC_FONTS["Familjen Grotesk"];
export const HEADING_FONT = GSIC_FONTS["Young Serif"];

const METRICS: Record<keyof typeof GSIC_FONTS, { ascender: number; descender: number; lineHeight: number }> = {
  "Familjen Grotesk": { ascender: 1025, descender: -225, lineHeight: 1.25 },
  "Young Serif": { ascender: 1046, descender: -366, lineHeight: 1.4 },
};

type Registry = Map<number, { metadata: { metrics: Record<string, number> }; fontFaces: unknown[] }>;

/** Must run before any text using these fonts is created or rendered. */
export function registerGsicFonts() {
  Object.assign(FONT_FAMILY as Record<string, number>, GSIC_FONTS);
  const registry = Fonts.registered as unknown as Registry;
  for (const [name, id] of Object.entries(GSIC_FONTS) as [keyof typeof GSIC_FONTS, number][]) {
    if (!registry.has(id)) {
      registry.set(id, { metadata: { metrics: { unitsPerEm: 1000, ...METRICS[name] } }, fontFaces: [] });
    }
  }
}

/** Wait (briefly) for the fonts to load so text is measured with them. */
export function fontsReady() {
  const load = Promise.all(
    Object.keys(GSIC_FONTS).map((name) => document.fonts.load(`20px "${name}"`, "Aa")),
  );
  return Promise.race([load, new Promise((r) => setTimeout(r, 3000))]);
}
