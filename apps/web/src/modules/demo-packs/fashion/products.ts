import type { DemoPackProduct, DemoPackProductImage } from "../types";

/**
 * Every product ships two frames - `<slug>-1` is the card/gallery primary and
 * `<slug>-2` is what the card swaps to on hover. Both files must exist under
 * apps/web/public/demo-assets/fashion/products/.
 */
function gallery(slug: string, title: string): DemoPackProductImage[] {
  return [
    { alt: `${title} - front view`, url: `/demo-assets/fashion/products/${slug}-1.webp` },
    { alt: `${title} - alternate view`, url: `/demo-assets/fashion/products/${slug}-2.webp` }
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

export const fashionDemoProducts = [
  // ------------------------------------------------------------ womens-clothing
  product({
    brandSlug: "sunhaven",
    categorySlug: "womens-clothing",
    compareAtPrice: "2990.00",
    description:
      "A lightweight woven dress for the months when anything heavier stops being an option. The fabric is loose enough to move air rather than cling after ten minutes outside, and the waist is defined without being fitted, so it works standing at a desk and sitting through a long lunch. It comes in a run of soft neutrals and warm sherbet shades that all wash well and do not need pressing after a line dry.",
    price: "2490.00",
    shortDescription: "Lightweight woven summer dress with a soft defined waist and easy care.",
    sku: "FAS-WOM-001",
    slug: "summer-dress",
    stockQuantity: 42,
    tagSlugs: ["summer-edit", "new-arrival", "on-sale"],
    title: "Summer Dress"
  }),
  product({
    brandSlug: "sunhaven",
    categorySlug: "womens-clothing",
    compareAtPrice: "2090.00",
    description:
      "A long cotton kurti with fine pintucks running down the front and a mandarin collar that sits neatly under a dupatta or on its own. The three-quarter sleeves keep it practical through a working day, and the flare below the yoke gives it enough movement to wear over churidar or straight trousers. Cotton this soft usually creases; this one is finished so it settles rather than holding every fold from the chair.",
    price: "1690.00",
    shortDescription: "Pintucked cotton kurti with a mandarin collar and three-quarter sleeves.",
    sku: "FAS-WOM-002",
    slug: "cotton-kurti",
    stockQuantity: 56,
    tagSlugs: ["cotton-comfort", "handcrafted", "on-sale"],
    title: "Cotton Kurti"
  }),
  product({
    brandSlug: "northloom",
    categorySlug: "womens-clothing",
    description:
      "A chunky knit cardigan cut long enough to cover the hips, which is the difference between a layer that works and one that rides up all evening. The V-neck leaves room for a collar underneath, and the tie at the waist means it can be closed on a cold morning and left open by afternoon. The yarn is a heathered green that hides everyday wear better than a flat colour does.",
    price: "2890.00",
    shortDescription: "Long chunky knit cardigan with a V-neck and a tie waist.",
    sku: "FAS-WOM-003",
    slug: "knit-cardigan",
    stockQuantity: 28,
    tagSlugs: ["winter-layer", "new-arrival", "limited-stock"],
    title: "Knit Cardigan"
  }),
  product({
    brandSlug: "denim-co",
    categorySlug: "womens-clothing",
    compareAtPrice: "3990.00",
    description:
      "A light-wash denim jacket with a sherpa-lined collar, which is the part that actually keeps the wind out on an early morning. The body is cut roomy enough to go over a knit without pulling at the shoulders, and the denim is pre-washed so it is wearable from the first day instead of after a month of breaking in. Four pockets, all of them deep enough to be useful.",
    price: "3290.00",
    shortDescription:
      "Light-wash denim jacket with a sherpa-lined collar and a roomy layering cut.",
    sku: "FAS-WOM-004",
    slug: "denim-jacket",
    stockQuantity: 24,
    tagSlugs: ["winter-layer", "on-sale", "best-seller"],
    title: "Denim Jacket"
  }),

  // -------------------------------------------------------------- mens-clothing
  product({
    brandSlug: "northloom",
    categorySlug: "mens-clothing",
    compareAtPrice: "2390.00",
    description:
      "A cotton formal shirt cut close through the body without being tight across the back, so it stays tucked through a full day. The collar has removable stays and holds its shape under a jacket rather than folding over by lunchtime, and the placket is stitched flat so it does not gape between buttons. Available in plain white, pale blue and a navy micro-print that reads solid from any distance.",
    price: "1890.00",
    shortDescription:
      "Cotton formal shirt with a structured collar, flat placket and a tailored cut.",
    sku: "FAS-MEN-001",
    slug: "formal-shirt",
    stockQuantity: 64,
    tagSlugs: ["office-ready", "on-sale", "everyday-essential"],
    title: "Formal Shirt"
  }),
  product({
    brandSlug: "urban-thread",
    categorySlug: "mens-clothing",
    compareAtPrice: "1190.00",
    description:
      "A plain crew-neck tee in combed cotton, heavy enough that the shoulder seam does not curl after a few washes. The neck ribbing is double-stitched, which is the seam that gives out first on a cheap tee, and the body is cut straight so it works untucked without looking like a nightshirt. Sold in black and a soft mint, both colours pre-shrunk so the size on the label is the size after washing.",
    price: "890.00",
    shortDescription: "Combed cotton crew-neck tee with double-stitched ribbing, pre-shrunk.",
    sku: "FAS-MEN-002",
    slug: "cotton-t-shirt",
    stockQuantity: 130,
    tagSlugs: ["cotton-comfort", "everyday-essential", "best-seller"],
    title: "Cotton T-Shirt"
  }),
  product({
    brandSlug: "denim-co",
    categorySlug: "mens-clothing",
    compareAtPrice: "2790.00",
    description:
      "Straight-leg jeans in a mid-weight denim with a small amount of stretch, which is enough to sit down comfortably without the knees bagging out by evening. The rise is mid, so they stay put without a belt doing all the work, and the leg is cut clean from the knee down to sit over a boot or a sneaker. Three washes are stocked, from a dark indigo through to a faded blue.",
    price: "2290.00",
    shortDescription: "Straight-leg stretch denim jeans with a mid rise, in three washes.",
    sku: "FAS-MEN-003",
    slug: "denim-jeans",
    stockQuantity: 78,
    tagSlugs: ["everyday-essential", "best-seller", "on-sale"],
    title: "Denim Jeans"
  }),
  product({
    brandSlug: "urban-thread",
    categorySlug: "mens-clothing",
    description:
      "A brushed-back pullover hoodie with a kangaroo pocket and a drawcord that is flat rather than round, so it does not work its way out of one side. The fleece inside is soft without being bulky, which matters in a climate where a hoodie is a January garment and not a December one. The hood is lined in the same fabric and holds its shape instead of collapsing flat against the neck.",
    price: "1990.00",
    shortDescription: "Brushed-back pullover hoodie with a kangaroo pocket and a flat drawcord.",
    sku: "FAS-MEN-004",
    slug: "pullover-hoodie",
    stockQuantity: 52,
    tagSlugs: ["cotton-comfort", "winter-layer", "everyday-essential"],
    title: "Pullover Hoodie"
  }),

  // ------------------------------------------------------------------- footwear
  product({
    brandSlug: "stridewell",
    categorySlug: "footwear",
    compareAtPrice: "4290.00",
    description:
      "A knit-upper running shoe light enough to forget about on a long walk, which is what most of these actually get used for. The upper flexes with the foot rather than creasing into a hard line across the toe box, and the midsole has enough give for pavement without feeling unstable on a kerb. The knit breathes, so they dry out overnight after being caught in the rain instead of staying damp for two days.",
    price: "3490.00",
    shortDescription: "Lightweight knit-upper running sneakers with a cushioned, flexible midsole.",
    sku: "FAS-FOO-001",
    slug: "running-sneakers",
    stockQuantity: 46,
    tagSlugs: ["everyday-essential", "best-seller", "on-sale"],
    title: "Running Sneakers"
  }),
  product({
    brandSlug: "solestep",
    categorySlug: "footwear",
    description:
      "Penny loafers in polished leather with a stacked heel and a leather sole edge, cut to sit close at the collar so they do not slip at the heel. The last is on the roomier side across the ball of the foot, which is where most formal shoes pinch, and the leather softens over a few weeks rather than needing a painful month. Suited to trousers and an office floor more than a long day on concrete.",
    price: "3990.00",
    shortDescription:
      "Polished leather penny loafers with a stacked heel and a close-fitting collar.",
    sku: "FAS-FOO-002",
    slug: "leather-loafers",
    stockQuantity: 22,
    tagSlugs: ["office-ready", "leather-goods", "new-arrival"],
    title: "Leather Loafers"
  }),
  product({
    brandSlug: "solestep",
    categorySlug: "footwear",
    compareAtPrice: "5290.00",
    description:
      "Suede ankle boots with a side buckle and a lugged rubber sole, so they hold on a wet footpath rather than sliding the way a leather sole does. The shaft finishes just above the ankle bone, which is short enough to wear under a straight trouser without bunching. Suede needs a protector spray before the first wear here - treated once at the start, they come through a season looking like the day they arrived.",
    price: "4490.00",
    shortDescription: "Suede ankle boots with a side buckle and a grippy lugged rubber sole.",
    sku: "FAS-FOO-003",
    slug: "ankle-boots",
    stockQuantity: 19,
    tagSlugs: ["leather-goods", "winter-layer", "limited-stock"],
    title: "Ankle Boots"
  }),
  product({
    brandSlug: "stridewell",
    categorySlug: "footwear",
    compareAtPrice: "2290.00",
    description:
      "Flat leather sandals with a square toe and a single toe post, in an off-white that goes with more than it looks like it will. The footbed is padded under the ball and the heel, the two places a flat sandal usually punishes after an hour, and the sole has enough tread to handle a tiled floor. The straps are unlined leather, so they take a few wears to mould and then stay that way.",
    price: "1890.00",
    shortDescription: "Square-toe flat leather sandals with a padded footbed and a toe post.",
    sku: "FAS-FOO-004",
    slug: "leather-sandals",
    stockQuantity: 61,
    tagSlugs: ["summer-edit", "leather-goods", "on-sale"],
    title: "Leather Sandals"
  }),

  // ----------------------------------------------------------------------- bags
  product({
    brandSlug: "carryall",
    categorySlug: "bags",
    compareAtPrice: "5990.00",
    description:
      "A full-grain leather shoulder bag with a soft unstructured body, so it holds its shape when full and folds down when it is not. The interior is one main compartment with a zipped pocket along the back wall - enough organisation to find a phone without turning the bag into a filing cabinet. The leather is finished but not sealed, which means it takes on a darker patina at the handles over the first year.",
    price: "4990.00",
    shortDescription:
      "Full-grain leather shoulder bag with a soft unstructured body and a zipped inner pocket.",
    sku: "FAS-BAG-001",
    slug: "leather-handbag",
    stockQuantity: 17,
    tagSlugs: ["leather-goods", "office-ready", "on-sale"],
    title: "Leather Handbag"
  }),
  product({
    brandSlug: "carryall",
    categorySlug: "bags",
    description:
      "A heavy cotton canvas tote with reinforced handle stitching, which is the join that fails on every cheap tote at exactly the wrong moment. It takes a laptop, a water bottle and a day's shopping without the base sagging into a point, and it folds flat enough to keep in another bag. Undyed natural canvas, so it washes cold without bleeding onto whatever else is in the machine.",
    price: "790.00",
    shortDescription: "Heavy cotton canvas tote with reinforced handles and a flat, roomy base.",
    sku: "FAS-BAG-002",
    slug: "canvas-tote-bag",
    stockQuantity: 145,
    tagSlugs: ["cotton-comfort", "everyday-essential", "gift-idea"],
    title: "Canvas Tote Bag"
  }),
  product({
    brandSlug: "velora",
    categorySlug: "bags",
    compareAtPrice: "3890.00",
    description:
      "A structured leather crossbody sized for a phone, a card holder, keys and not much else, which is the point of carrying one. The strap adjusts long enough to wear across the body and short enough to sit on the shoulder, and the flap closes on a magnetic tab that opens one-handed. Tan leather with brass hardware that stays brass rather than wearing through to a base metal after a season.",
    price: "3290.00",
    shortDescription:
      "Structured tan leather crossbody bag with an adjustable strap and a magnetic flap.",
    sku: "FAS-BAG-003",
    slug: "crossbody-bag",
    stockQuantity: 33,
    tagSlugs: ["leather-goods", "new-arrival", "on-sale"],
    title: "Crossbody Bag"
  }),
  product({
    brandSlug: "carryall",
    categorySlug: "bags",
    compareAtPrice: "3390.00",
    description:
      "A backpack with a padded sleeve that takes a 15-inch laptop and sits off the base, so setting the bag down does not put the whole weight on the machine. The front compartment has enough small pockets to keep a charger and a cable from ending up at the bottom, and the side pocket holds a full bottle without stretching. Padded shoulder straps and a back panel that is channelled rather than flat, which makes a difference on a warm commute.",
    price: "2790.00",
    shortDescription:
      "Commuter backpack with a suspended 15-inch laptop sleeve and an organised front panel.",
    sku: "FAS-BAG-004",
    slug: "laptop-backpack",
    stockQuantity: 38,
    tagSlugs: ["everyday-essential", "office-ready", "on-sale"],
    title: "Laptop Backpack"
  }),

  // -------------------------------------------------------------------- jewelry
  product({
    brandSlug: "auriva",
    categorySlug: "jewelry",
    compareAtPrice: "1890.00",
    description:
      "A gold-plated beaded chain hung with small cone drops that catch the light as they move, which is what makes it read as a statement piece rather than a plain chain. The plating is over brass at a thickness that survives daily wear if it is kept away from perfume and taken off before a shower. The clasp is a lobster type rather than a spring ring, so it can actually be fastened without a second pair of hands.",
    price: "1490.00",
    shortDescription: "Gold-plated beaded chain necklace with cone drops and a lobster clasp.",
    sku: "FAS-JEW-001",
    slug: "gold-plated-necklace",
    stockQuantity: 54,
    tagSlugs: ["handcrafted", "gift-idea", "on-sale"],
    title: "Gold Plated Necklace"
  }),
  product({
    brandSlug: "auriva",
    categorySlug: "jewelry",
    description:
      "Oval hoop earrings in polished stainless steel with a channel of set crystals along the outer edge. Steel rather than plated brass, so they can be worn through a wash without the finish clouding and they do not react on skin that struggles with cheaper metal. The hinge closes with a click that can be felt, which is a small thing until an earring goes missing on a bus.",
    price: "990.00",
    shortDescription:
      "Stainless steel oval hoop earrings with channel-set crystals and a click hinge.",
    sku: "FAS-JEW-002",
    slug: "silver-hoop-earrings",
    stockQuantity: 88,
    tagSlugs: ["gift-idea", "new-arrival", "handcrafted"],
    title: "Silver Hoop Earrings"
  }),
  product({
    brandSlug: "velora",
    categorySlug: "jewelry",
    compareAtPrice: "1690.00",
    description:
      "A fine open bangle finished in rose gold, with two small set stones at the ends where the cuff meets. It opens just enough to slip over the wrist bone and springs back, so there is no clasp to fight with and nothing to come undone during the day. Slim enough to stack with a watch on the same wrist without the two knocking against each other.",
    price: "1290.00",
    shortDescription: "Fine rose-gold open bangle with two set stones and no clasp to fasten.",
    sku: "FAS-JEW-003",
    slug: "charm-bracelet",
    stockQuantity: 67,
    tagSlugs: ["handcrafted", "gift-idea", "on-sale"],
    title: "Charm Bracelet"
  }),
  product({
    brandSlug: "velora",
    categorySlug: "jewelry",
    compareAtPrice: "6490.00",
    description:
      "A chronograph on a brown leather strap, with a white dial and applied indices that stay readable at a glance rather than needing a second look. The case is stainless steel at a size that sits under a shirt cuff, and the crystal is mineral, so it takes the knocks a desk gives it. Water resistant enough for rain and hand washing; the strap is standard-width, so it can be swapped when it eventually softens.",
    price: "4990.00",
    shortDescription:
      "Stainless steel chronograph watch on a brown leather strap with a white dial.",
    sku: "FAS-JEW-004",
    slug: "analog-wristwatch",
    stockQuantity: 21,
    tagSlugs: ["office-ready", "best-seller", "limited-stock"],
    title: "Analog Wristwatch"
  }),

  // ---------------------------------------------------------------- accessories
  product({
    brandSlug: "solestep",
    categorySlug: "accessories",
    compareAtPrice: "1490.00",
    description:
      "A full-grain leather belt with a brushed metal pin buckle, cut at 35mm so it passes through both trouser and jean loops. The strap is a single layer of leather rather than two thin layers bonded together, which is why it creases along the length instead of splitting across it. Five holes at standard spacing, and the tip is skived thin enough to feed through a keeper without a fight.",
    price: "1190.00",
    shortDescription: "35mm full-grain leather belt with a brushed pin buckle and five holes.",
    sku: "FAS-ACC-001",
    slug: "leather-belt",
    stockQuantity: 92,
    tagSlugs: ["leather-goods", "office-ready", "on-sale"],
    title: "Leather Belt"
  }),
  product({
    brandSlug: "solestep",
    categorySlug: "accessories",
    description:
      "A bifold wallet in soft leather that stays slim once it is loaded, which most bifolds stop doing after the third card. Six card slots, two note compartments and a slip pocket behind, with no coin pouch - the part that turns a wallet into a brick. The leather is unlined at the fold, so it breaks in along one clean crease instead of cracking across the middle.",
    price: "1390.00",
    shortDescription: "Slim leather bifold wallet with six card slots and two note compartments.",
    sku: "FAS-ACC-002",
    slug: "leather-wallet",
    stockQuantity: 104,
    tagSlugs: ["leather-goods", "gift-idea", "everyday-essential"],
    title: "Leather Wallet"
  }),
  product({
    brandSlug: "velora",
    categorySlug: "accessories",
    compareAtPrice: "2190.00",
    description:
      "Aviator sunglasses in a tortoiseshell acetate frame with gradient brown lenses, darker at the top where the sky is and lighter towards the bottom so the road stays visible. The lenses carry a UV400 rating, which is the number that matters and the one cheap frames quietly leave off. Spring hinges take the strain when they get pushed up onto the head, which is where most sunglasses spend half their life.",
    price: "1690.00",
    shortDescription:
      "Tortoiseshell aviator sunglasses with UV400 gradient lenses and spring hinges.",
    sku: "FAS-ACC-003",
    slug: "aviator-sunglasses",
    stockQuantity: 73,
    tagSlugs: ["summer-edit", "new-arrival", "gift-idea"],
    title: "Aviator Sunglasses"
  }),
  product({
    brandSlug: "urban-thread",
    categorySlug: "accessories",
    compareAtPrice: "890.00",
    description:
      "A six-panel cotton twill cap with a pre-curved brim, so it does not need a week of bending to stop looking like a shelf. The sweatband is a separate strip rather than a folded seam, which keeps it comfortable in humidity, and the crown holds its shape after a wash instead of collapsing. The back closes on a metal buckle strap that adjusts finer than a plastic snap.",
    price: "690.00",
    shortDescription: "Six-panel cotton twill cap with a pre-curved brim and a metal buckle strap.",
    sku: "FAS-ACC-004",
    slug: "baseball-cap",
    stockQuantity: 118,
    tagSlugs: ["summer-edit", "on-sale", "gift-idea"],
    title: "Baseball Cap"
  })
] satisfies DemoPackProduct[];
