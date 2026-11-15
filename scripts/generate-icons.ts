/**
 * Erzeugt alle App-Icons und iOS-Splashscreens aus public/icons/icon.svg.
 *   npm run icons
 */
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";

const BG = "#0b0c12";
const svg = await readFile("public/icons/icon.svg");

async function icon(size: number, file: string, padding = 0, background?: string) {
  const inner = Math.round(size * (1 - padding * 2));
  const logo = await sharp(svg, { density: 512 }).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 })
    .toFile(file);
}

await mkdir("public/icons/splash", { recursive: true });

// Standard-Icons (transparent, abgerundet)
for (const size of [48, 72, 96, 128, 144, 152, 192, 256, 384, 512]) {
  await icon(size, `public/icons/icon-${size}.png`);
}
// Maskable: Logo in der sicheren Zone (80 %), vollflächiger Hintergrund
await icon(512, "public/icons/maskable-512.png", 0.12, "#5b5cf0");
await icon(192, "public/icons/maskable-192.png", 0.12, "#5b5cf0");
// Apple Touch Icon: ohne Transparenz
await icon(180, "public/apple-touch-icon.png", 0, "#5b5cf0");
await icon(32, "public/icons/favicon-32.png");

// Shortcut-Icons (einfarbig auf Akzent)
const shortcut = (path: string) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="24" fill="#5b5cf0"/><g transform="translate(24 24) scale(2)" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${path}</g></svg>`,
  );
await sharp(shortcut('<path d="M12 5v14M5 12h14"/>')).png({ palette: true }).toFile("public/icons/shortcut-add.png");
await sharp(shortcut('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'))
  .png({ palette: true })
  .toFile("public/icons/shortcut-abos.png");
await sharp(shortcut('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>'))
  .png({ palette: true })
  .toFile("public/icons/shortcut-wishlist.png");

// iOS-Splashscreens (Hochformat)
export const SPLASH = [
  [1320, 2868, 440, 956, 3],
  [1206, 2622, 402, 874, 3],
  [1290, 2796, 430, 932, 3],
  [1179, 2556, 393, 852, 3],
  [1284, 2778, 428, 926, 3],
  [1170, 2532, 390, 844, 3],
  [1125, 2436, 375, 812, 3],
  [1242, 2688, 414, 896, 3],
  [828, 1792, 414, 896, 2],
  [750, 1334, 375, 667, 2],
  [1640, 2360, 820, 1180, 2],
  [2048, 2732, 1024, 1366, 2],
] as const;

for (const [w, h] of SPLASH) {
  const size = Math.round(Math.min(w, h) * 0.28);
  const logo = await sharp(svg, { density: 512 }).resize(size, size).png().toBuffer();
  await sharp({ create: { width: w, height: h, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: "center" }])
    .png({ palette: true, quality: 85, compressionLevel: 9, effort: 10 })
    .toFile(`public/icons/splash/splash-${w}x${h}.png`);
}

console.log("✔ Icons erzeugt");
