import type { DemoPackProduct } from "../types";

export const electronicsDemoProducts = [
  product("Phone", "Nova X1 Smartphone", "nova-x1-smartphone", "smartphones", "ELE-PHO-001", "24990.00", "28990.00", 24),
  product("Phone", "Orbit Mini 5G Phone", "orbit-mini-5g-phone", "smartphones", "ELE-PHO-002", "18990.00", undefined, 32),
  product("Phone", "Luma Max Display Phone", "luma-max-display-phone", "smartphones", "ELE-PHO-003", "32990.00", "36990.00", 18),
  product("Phone", "Vega Lite Smartphone", "vega-lite-smartphone", "smartphones", "ELE-PHO-004", "14990.00", undefined, 45),
  product("Laptop", "TechBook Air 14", "techbook-air-14", "laptops", "ELE-LAP-001", "68990.00", "74990.00", 12),
  product("Laptop", "CorePad Studio Laptop", "corepad-studio-laptop", "laptops", "ELE-LAP-002", "84990.00", undefined, 10),
  product("Laptop", "VoltBook Pro 15", "voltbook-pro-15", "laptops", "ELE-LAP-003", "92990.00", "99990.00", 8),
  product("Laptop", "FlexNote Compact Laptop", "flexnote-compact-laptop", "laptops", "ELE-LAP-004", "55990.00", undefined, 16),
  product("Gear", "MagDock Charging Stand", "magdock-charging-stand", "accessories", "ELE-ACC-001", "2490.00", "2990.00", 60),
  product("Gear", "SwiftLink USB Hub", "swiftlink-usb-hub", "accessories", "ELE-ACC-002", "3190.00", undefined, 48),
  product("Gear", "ClearShell Tablet Case", "clearshell-tablet-case", "accessories", "ELE-ACC-003", "1590.00", "1990.00", 75),
  product("Gear", "PowerCube Travel Adapter", "powercube-travel-adapter", "accessories", "ELE-ACC-004", "2290.00", undefined, 54),
  product("Home", "Smart Home Hub", "smart-home-hub", "smart-home", "ELE-HOM-001", "7990.00", "8990.00", 20),
  product("Home", "GlowSense Smart Bulb Set", "glowsense-smart-bulb-set", "smart-home", "ELE-HOM-002", "3490.00", undefined, 40),
  product("Home", "SecureView Door Camera", "secureview-door-camera", "smart-home", "ELE-HOM-003", "11990.00", "13990.00", 14),
  product("Home", "RoomSense Climate Sensor", "roomsense-climate-sensor", "smart-home", "ELE-HOM-004", "2790.00", undefined, 52),
  product("Gaming", "Mechanical Keyboard Pro", "mechanical-keyboard-pro", "gaming", "ELE-GAM-001", "6490.00", "7490.00", 28),
  product("Gaming", "UltraView Monitor", "ultraview-monitor", "gaming", "ELE-GAM-002", "28990.00", undefined, 9),
  product("Gaming", "HyperGrip Game Mouse", "hypergrip-game-mouse", "gaming", "ELE-GAM-003", "3290.00", "3890.00", 36),
  product("Gaming", "ArcadePad Wireless Controller", "arcadepad-wireless-controller", "gaming", "ELE-GAM-004", "4590.00", undefined, 30),
  product("Audio", "Pulse Wireless Earbuds", "pulse-wireless-earbuds", "audio", "ELE-AUD-001", "4990.00", "5990.00", 42),
  product("Audio", "WaveBar Mini Speaker", "wavebar-mini-speaker", "audio", "ELE-AUD-002", "3790.00", undefined, 35),
  product("Audio", "StudioBeat Headphones", "studiobeat-headphones", "audio", "ELE-AUD-003", "8990.00", "9990.00", 18),
  product("Audio", "ClearCast Desk Microphone", "clearcast-desk-microphone", "audio", "ELE-AUD-004", "5490.00", undefined, 22)
] satisfies DemoPackProduct[];

function product(
  imageLabel: string,
  title: string,
  slug: string,
  categorySlug: string,
  sku: string,
  price: string,
  compareAtPrice: string | undefined,
  stockQuantity: number
) {
  return {
    categorySlug,
    compareAtPrice,
    description: `${title} is a fictional electronics demo product. Replace this copy with real specifications, warranty details, compatibility notes, and package contents before launch.`,
    imageAlt: `${title} electronics placeholder image`,
    imageUrl: createPlaceholderImage(imageLabel, title),
    price,
    shortDescription: `A fictional ${categorySlug.replace("-", " ")} product for a modern electronics storefront.`,
    sku,
    slug,
    stockQuantity,
    title
  } satisfies DemoPackProduct;
}

function createPlaceholderImage(label: string, title: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#eef6ff"/><stop offset="100%" stop-color="#c7d2fe"/></linearGradient></defs><rect width="1000" height="1000" fill="url(#g)"/><circle cx="760" cy="210" r="150" fill="#ffffff" opacity=".45"/><rect x="250" y="230" width="500" height="420" rx="48" fill="#0f172a" opacity=".12"/><rect x="310" y="290" width="380" height="270" rx="26" fill="#ffffff" opacity=".8"/><rect x="390" y="680" width="220" height="38" rx="19" fill="#2563eb" opacity=".32"/><text x="500" y="438" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#1d4ed8">${escapeSvg(label)}</text><text x="500" y="520" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#334155">${escapeSvg(title)}</text></svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeSvg(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
