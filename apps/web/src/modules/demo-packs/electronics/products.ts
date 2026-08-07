import type { DemoPackProduct, DemoPackProductImage } from "../types";

/**
 * Every product ships two frames - `<slug>-1` is the card/gallery primary and
 * `<slug>-2` is what the card swaps to on hover. Both files must exist under
 * apps/web/public/demo-assets/electronics/products/.
 */
function gallery(slug: string, title: string): DemoPackProductImage[] {
  return [
    { alt: `${title} - front view`, url: `/demo-assets/electronics/products/${slug}-1.webp` },
    { alt: `${title} - alternate view`, url: `/demo-assets/electronics/products/${slug}-2.webp` }
  ];
}

function product(
  input: Omit<DemoPackProduct, "imageAlt" | "imageUrl" | "images">
): DemoPackProduct {
  const images = gallery(input.slug, input.title);
  const primary = images[0]!;

  return {
    ...input,
    imageAlt: primary.alt,
    imageUrl: primary.url,
    images
  };
}

export const electronicsDemoProducts = [
  // ---------------------------------------------------------------------- audio
  product({
    brandSlug: "auralis",
    categorySlug: "audio",
    compareAtPrice: "3290.00",
    description:
      "In-ear buds that sit tight enough to stay put on a bus ride without needing a push back in every few minutes. Active noise cancelling takes the edge off engine drone and fan noise rather than pretending to erase it, and a transparency mode lets conversation back in without pulling a bud out. The buds run about six hours on their own and the case carries three more charges, so a week of commuting rarely needs a wall socket.",
    price: "2490.00",
    shortDescription:
      "Noise cancelling wireless earbuds with transparency mode and a three-charge case.",
    sku: "ELE-AUD-001",
    slug: "wireless-earbuds",
    stockQuantity: 64,
    tagSlugs: ["best-seller", "wireless", "noise-cancelling"],
    title: "Wireless Earbuds"
  }),
  product({
    brandSlug: "pulsewave",
    categorySlug: "audio",
    description:
      "A speaker sized to fit in a side pocket that still fills a room at half volume. The rubberised shell and IPX7 rating mean it survives a rooftop in the rain or a splash at the edge of a pool, which is where portable speakers usually die. Pairing takes a couple of seconds, two units can be linked for stereo, and twelve hours of playback outlasts most gatherings it gets carried to.",
    price: "3290.00",
    shortDescription:
      "Water-resistant Bluetooth speaker with stereo pairing and twelve-hour playback.",
    sku: "ELE-AUD-002",
    slug: "bluetooth-speaker",
    stockQuantity: 47,
    tagSlugs: ["best-seller", "travel-ready", "wireless"],
    title: "Bluetooth Speaker"
  }),
  product({
    brandSlug: "auralis",
    categorySlug: "audio",
    compareAtPrice: "5990.00",
    description:
      "Over-ear headphones tuned for long listening sessions rather than one loud demo track. The earcups sit around the ear instead of pressing on it, the headband adjusts in small steps so it holds without pinching, and the padding stays breathable through a full working day. Bluetooth pairing remembers the last two devices, a charge covers roughly a week of daily use, and a short cable is included for the times a wired connection is simply easier.",
    price: "4990.00",
    shortDescription:
      "Comfortable over-ear headphones with noise cancelling and two-device pairing.",
    sku: "ELE-AUD-003",
    slug: "over-ear-headphones",
    stockQuantity: 31,
    tagSlugs: ["noise-cancelling", "on-sale", "long-battery"],
    title: "Over-Ear Headphones"
  }),
  product({
    brandSlug: "pulsewave",
    categorySlug: "audio",
    description:
      "A slim bar that sits in front of a television without blocking the screen or the remote sensor, which is the practical problem most soundbars create. Dialogue comes through clearly at low volume - the reason most people replace TV speakers in the first place - and a separate wireless subwoofer can be tucked behind a sofa. Connects over HDMI ARC with a single cable, or over Bluetooth when it is doubling as a music speaker.",
    price: "8990.00",
    shortDescription: "Slim TV soundbar with clear dialogue, HDMI ARC and a wireless subwoofer.",
    sku: "ELE-AUD-004",
    slug: "soundbar-for-tv",
    stockQuantity: 18,
    tagSlugs: ["new-arrival", "smart-home", "gift-idea"],
    title: "Soundbar for TV"
  }),

  // ---------------------------------------------------------- mobile-accessories
  product({
    brandSlug: "cellgrip",
    categorySlug: "mobile-accessories",
    compareAtPrice: "690.00",
    description:
      "A slim case with a raised lip around the camera and the screen, so the phone lands on the case rather than on glass. The sides are textured where fingers actually grip and smooth where a pocket has to let it slide, and the buttons stay clicky instead of turning into vague mush. Thin enough that wireless charging still works through it without lining anything up first.",
    price: "490.00",
    shortDescription: "Slim protective phone case with raised camera and screen lips.",
    sku: "ELE-MOB-001",
    slug: "phone-case",
    stockQuantity: 120,
    tagSlugs: ["best-seller", "on-sale", "gift-idea"],
    title: "Phone Case"
  }),
  product({
    brandSlug: "voltix",
    categorySlug: "mobile-accessories",
    description:
      "A braided USB-C cable rated for 60W, which is enough to fast charge a phone and to keep a small laptop topped up. The braiding is there because the failure point on a cheap cable is always the neck where it bends against a pocket, and the moulded ends give it something to bend around. One metre suits a desk or a bedside table; it also carries data rather than power alone.",
    price: "390.00",
    shortDescription: "Braided 1m USB-C cable rated for 60W charging and data transfer.",
    sku: "ELE-MOB-002",
    slug: "usb-c-cable",
    stockQuantity: 180,
    tagSlugs: ["fast-charging", "best-seller", "travel-ready"],
    title: "USB-C Cable"
  }),
  product({
    brandSlug: "voltix",
    categorySlug: "mobile-accessories",
    compareAtPrice: "2290.00",
    description:
      "A 10,000 mAh power bank that holds enough charge for two full phone top-ups and still fits in a small bag pocket. Both the USB-C and USB-A ports can run at once, and the USB-C port takes fast input as well as output, so the bank itself refills in a couple of hours rather than overnight. Four dots on the side show the remaining charge, which is far more useful than guessing from a single blinking light.",
    price: "1890.00",
    shortDescription:
      "10,000 mAh power bank with USB-C in/out, dual ports and a four-dot charge gauge.",
    sku: "ELE-MOB-003",
    slug: "power-bank",
    stockQuantity: 72,
    tagSlugs: ["fast-charging", "travel-ready", "best-seller"],
    title: "Power Bank"
  }),
  product({
    brandSlug: "voltix",
    categorySlug: "mobile-accessories",
    description:
      "A flat charging pad for the corner of a desk or a bedside table, so the phone goes down in the same place every night instead of hunting for a cable in the dark. The top surface is a grippy matt finish that keeps the phone from sliding off when a notification buzzes, and the pad is slim enough to sit under a monitor stand. Works through most slim cases, and the braided cable is long enough to reach behind a desk.",
    price: "1290.00",
    shortDescription: "Slim 15W wireless charging pad with a non-slip surface and braided cable.",
    sku: "ELE-MOB-004",
    slug: "wireless-charging-pad",
    stockQuantity: 58,
    tagSlugs: ["wireless", "fast-charging", "new-arrival"],
    title: "Wireless Charging Pad"
  }),

  // ------------------------------------------------------------------ computing
  product({
    brandSlug: "nexcore",
    categorySlug: "computing",
    compareAtPrice: "74990.00",
    description:
      "A 14-inch laptop light enough to carry all day and quick enough that a browser with thirty tabs open does not become a negotiation. The keyboard has real travel rather than the flat panels that make long typing sessions unpleasant, and the matte screen stays readable next to a window. 16GB of memory and a 512GB SSD cover normal work without a second thought, and the battery gets through a full day away from a socket.",
    price: "68990.00",
    shortDescription:
      "14-inch laptop with 16GB memory, a 512GB SSD, a matte screen and all-day battery.",
    sku: "ELE-CMP-001",
    slug: "14-inch-laptop",
    stockQuantity: 14,
    tagSlugs: ["best-seller", "work-from-home", "new-arrival"],
    title: "14-inch Laptop"
  }),
  product({
    brandSlug: "typeline",
    categorySlug: "computing",
    description:
      "A quiet wireless mouse shaped for a hand that rests on it for hours rather than one that grips it for minutes. The scroll wheel steps cleanly instead of spinning loose, and the click is muted enough to use in a shared room or a late call. Connects over a small USB receiver or Bluetooth, and a single AA battery runs it for months, which saves the nightly charging ritual.",
    price: "890.00",
    shortDescription: "Quiet wireless mouse with USB receiver, Bluetooth and months of battery.",
    sku: "ELE-CMP-002",
    slug: "wireless-mouse",
    stockQuantity: 96,
    tagSlugs: ["wireless", "work-from-home", "best-seller"],
    title: "Wireless Mouse"
  }),
  product({
    brandSlug: "nexcore",
    categorySlug: "computing",
    compareAtPrice: "2790.00",
    description:
      "A 1080p webcam that fixes the two things laptop cameras get wrong: it sits at eye level on top of a monitor, and it handles a bright window behind you without turning your face into a silhouette. The clip grips both slim monitors and thicker laptop lids, and the ball joint lets it be aimed once and left alone. A physical shutter slides over the lens, which settles the question of whether it is off.",
    price: "2290.00",
    shortDescription:
      "1080p webcam with a privacy shutter, adjustable clip and backlight handling.",
    sku: "ELE-CMP-003",
    slug: "hd-webcam",
    stockQuantity: 44,
    tagSlugs: ["work-from-home", "new-arrival", "on-sale"],
    title: "HD Webcam"
  }),
  product({
    brandSlug: "nexcore",
    categorySlug: "computing",
    compareAtPrice: "17990.00",
    description:
      "A 24-inch 1080p monitor with thin bezels, which matters mostly when two of them sit side by side. The panel holds colour steadily off-centre rather than washing out the moment you lean back, and the stand tilts far enough to get the top of the screen level with your eyes. HDMI and DisplayPort inputs are both present, so it works with a desktop and a laptop dock without an adapter hunt.",
    price: "15990.00",
    shortDescription:
      "24-inch 1080p LED monitor with thin bezels, a tilting stand, HDMI and DisplayPort.",
    sku: "ELE-CMP-004",
    slug: "24-inch-led-monitor",
    stockQuantity: 22,
    tagSlugs: ["work-from-home", "on-sale", "best-seller"],
    title: "24-inch LED Monitor"
  }),

  // ------------------------------------------------------------------ wearables
  product({
    brandSlug: "fitpulse",
    categorySlug: "wearables",
    description:
      "A smartwatch that shows the notification, the step count and the time without asking to be charged every night. Heart rate and sleep tracking run in the background, workouts can be started from the wrist rather than the phone, and the always-on display stays readable in direct sunlight. The case is light enough to keep on overnight, which is the only way sleep tracking is any use at all.",
    price: "4490.00",
    shortDescription:
      "Smartwatch with heart rate, sleep tracking, an always-on display and multi-day battery.",
    sku: "ELE-WER-001",
    slug: "smartwatch",
    stockQuantity: 38,
    tagSlugs: ["best-seller", "new-arrival", "long-battery"],
    title: "Smartwatch"
  }),
  product({
    brandSlug: "fitpulse",
    categorySlug: "wearables",
    compareAtPrice: "2690.00",
    description:
      "A slim band for people who want the step count and the sleep summary without a watch face on their wrist. It tracks heart rate continuously, buzzes for calls and messages, and survives a shower or a swim without being taken off. Two weeks between charges is the real selling point - a tracker that spends half its life on a charging cradle stops getting worn.",
    price: "2190.00",
    shortDescription:
      "Slim fitness tracker band with heart rate, sleep tracking and two-week battery.",
    sku: "ELE-WER-002",
    slug: "fitness-tracker-band",
    stockQuantity: 66,
    tagSlugs: ["long-battery", "on-sale", "gift-idea"],
    title: "Fitness Tracker Band"
  }),
  product({
    brandSlug: "fitpulse",
    categorySlug: "wearables",
    description:
      "A watch for a child old enough to walk to school alone but not old enough for a phone. It makes and takes calls from a short approved list, shares its location with a parent's app, and has a school mode that silences everything during class hours. The strap is soft silicone that can be rinsed under a tap, and the case shrugs off the drops that a phone would not survive.",
    price: "2990.00",
    shortDescription:
      "Kids smartwatch with approved-contact calling, location sharing and a school mode.",
    sku: "ELE-WER-003",
    slug: "kids-smartwatch",
    stockQuantity: 29,
    tagSlugs: ["gift-idea", "new-arrival", "long-battery"],
    title: "Kids Smartwatch"
  }),
  product({
    brandSlug: "cellgrip",
    categorySlug: "wearables",
    compareAtPrice: "550.00",
    description:
      "A soft silicone strap for the days the original band is in the wash or has finally given up at the pin holes. The quick-release pins mean swapping takes seconds without a tool, and the perforations along the length keep a wrist from getting clammy through a workout. Fits the common 22mm lug width used by most round smartwatches and fitness watches.",
    price: "390.00",
    shortDescription: "Perforated 22mm silicone watch strap with quick-release pins.",
    sku: "ELE-WER-004",
    slug: "smartwatch-silicone-strap",
    stockQuantity: 140,
    tagSlugs: ["on-sale", "gift-idea", "best-seller"],
    title: "Smartwatch Silicone Strap"
  }),

  // ------------------------------------------------------------------- home-tech
  product({
    brandSlug: "lumio",
    categorySlug: "home-tech",
    description:
      "A bulb that screws into an ordinary socket and then answers to a phone, a schedule or a voice assistant. Brightness and colour temperature both adjust, so the same lamp can be warm in the evening and plain white for work, and the colour mode is there for the occasions that call for it. It remembers its last state after a power cut instead of blazing on at full brightness at four in the morning.",
    price: "790.00",
    shortDescription:
      "Wi-Fi smart LED bulb with adjustable brightness, colour temperature and colour.",
    sku: "ELE-HOM-001",
    slug: "smart-led-bulb",
    stockQuantity: 88,
    tagSlugs: ["smart-home", "new-arrival", "gift-idea"],
    title: "Smart LED Bulb"
  }),
  product({
    brandSlug: "lumio",
    categorySlug: "home-tech",
    description:
      "A dual-band router that covers a normal flat on both the 2.4GHz band, which reaches through walls, and the 5GHz band, which is faster in the same room. Setup runs from a phone rather than a numbered sheet of defaults, and a guest network can be switched on without handing over the main password. Four ethernet ports on the back cover a desktop, a television and whatever else prefers a cable.",
    price: "2490.00",
    shortDescription:
      "Dual-band Wi-Fi router with app setup, a guest network and four ethernet ports.",
    sku: "ELE-HOM-002",
    slug: "dual-band-wifi-router",
    stockQuantity: 34,
    tagSlugs: ["smart-home", "work-from-home", "best-seller"],
    title: "Dual-Band Wi-Fi Router"
  }),
  product({
    brandSlug: "lumio",
    categorySlug: "home-tech",
    compareAtPrice: "890.00",
    description:
      "A plug that sits between a socket and whatever is plugged into it, and makes that thing switchable from a phone. Most useful for the appliances that have no smart features of their own - a fan, a lamp, a water pump - and for the timer, which turns things off after you have already left the house. The body is slim enough not to block the second socket in a double outlet.",
    price: "690.00",
    shortDescription:
      "Wi-Fi smart plug with app control, scheduling and a slim single-socket body.",
    sku: "ELE-HOM-003",
    slug: "smart-plug",
    stockQuantity: 76,
    tagSlugs: ["smart-home", "on-sale", "gift-idea"],
    title: "Smart Plug"
  }),
  product({
    brandSlug: "lumio",
    categorySlug: "home-tech",
    description:
      "An indoor camera that covers a hallway or a shop floor and sends a notification when something moves, with night vision for the hours that actually matter. Footage records to a microSD card in the camera as well as to the cloud, so the feed does not go dark the moment the internet does. Two-way audio lets you answer the door or tell the dog to get off the sofa from wherever you are.",
    price: "3490.00",
    shortDescription:
      "Indoor security camera with motion alerts, night vision, two-way audio and local recording.",
    sku: "ELE-HOM-004",
    slug: "home-security-camera",
    stockQuantity: 41,
    tagSlugs: ["smart-home", "new-arrival", "best-seller"],
    title: "Home Security Camera"
  }),

  // --------------------------------------------------------------------- gaming
  product({
    brandSlug: "raventek",
    categorySlug: "gaming",
    compareAtPrice: "3990.00",
    description:
      "A headset built for sessions measured in hours, which means the clamp is firm enough to stay put but not so firm that it aches by the second hour. The boom microphone flips up to mute, so there is no hunting for a switch mid-conversation, and it picks up speech rather than the keyboard underneath it. Connects over USB on a PC or the 3.5mm cable on a console or a phone.",
    price: "3290.00",
    shortDescription:
      "Over-ear gaming headset with a flip-to-mute boom mic, USB and 3.5mm connections.",
    sku: "ELE-GAM-001",
    slug: "gaming-headset",
    stockQuantity: 52,
    tagSlugs: ["gaming-gear", "best-seller", "noise-cancelling"],
    title: "Gaming Headset"
  }),
  product({
    brandSlug: "raventek",
    categorySlug: "gaming",
    description:
      "A full-size mechanical keyboard with a number pad, which matters as much for spreadsheets as for games. The switches are tactile rather than clicky, so the typing feedback is there without the noise carrying across a room, and the keycaps are moulded so the legends do not wear off the WASD block first. Per-key backlighting can be set to a single colour and left alone if the rainbow is not the point.",
    price: "4990.00",
    shortDescription:
      "Full-size mechanical keyboard with tactile switches, a number pad and per-key backlighting.",
    sku: "ELE-GAM-002",
    slug: "rgb-mechanical-keyboard",
    stockQuantity: 37,
    tagSlugs: ["gaming-gear", "best-seller", "work-from-home"],
    title: "RGB Mechanical Keyboard"
  }),
  product({
    brandSlug: "raventek",
    categorySlug: "gaming",
    description:
      "A wireless controller with the layout most players already have muscle memory for, so nothing has to be relearned. The sticks have a firm centre return rather than the loose wander that ruins aiming after a few months, and the triggers are analogue for the games that need them. Pairs with a PC or an Android device over Bluetooth, runs about twenty hours per charge, and refills over USB-C while still in use.",
    price: "3990.00",
    shortDescription:
      "Bluetooth game controller with analogue triggers, twenty-hour battery and USB-C charging.",
    sku: "ELE-GAM-003",
    slug: "wireless-game-controller",
    stockQuantity: 26,
    tagSlugs: ["gaming-gear", "wireless", "new-arrival"],
    title: "Wireless Game Controller"
  }),
  product({
    brandSlug: "typeline",
    categorySlug: "gaming",
    compareAtPrice: "2090.00",
    description:
      "A light mouse with a sensor that tracks accurately across a cloth mat and a DPI button for switching between a fast desktop setting and a slower one for aiming. Two thumb buttons sit where a thumb already rests, and the cable is a soft braided type that does not fight back against quick movements. The lighting can be dimmed or switched off entirely from the driver.",
    price: "1690.00",
    shortDescription:
      "Lightweight RGB gaming mouse with on-the-fly DPI switching and two thumb buttons.",
    sku: "ELE-GAM-004",
    slug: "rgb-gaming-mouse",
    stockQuantity: 61,
    tagSlugs: ["gaming-gear", "on-sale", "new-arrival"],
    title: "RGB Gaming Mouse"
  })
] satisfies DemoPackProduct[];
