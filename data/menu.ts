/**
 * Xu Noodles menu — edit this file to change dishes, prices and categories.
 *
 * - Prices are in whole rupees (₹), before GST.
 * - `portions` is optional. When present, the customer picks Half or Full
 *   and the portion prices are used instead of `price`.
 * - `spice`: 0 = not spicy, 1 = mild, 2 = medium, 3 = hot.
 * - `emoji` and `color` control the placeholder "photo" on each card.
 */

export type CategoryId =
  | "soups"
  | "veg-starters"
  | "non-veg-starters"
  | "momos"
  | "noodles"
  | "fried-rice"
  | "gravies"
  | "combos"
  | "desserts-beverages";

export type Category = {
  id: CategoryId;
  name: string;
  emoji: string;
};

export type Portion = {
  label: string; // e.g. "Half", "Full"
  price: number;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: CategoryId;
  price: number; // used when there are no portions; otherwise the lowest portion price
  veg: boolean;
  spice: 0 | 1 | 2 | 3;
  bestseller?: boolean;
  portions?: Portion[];
  emoji: string;
  color: string; // Tailwind gradient classes for the placeholder image
};

// Order here = order on the menu page and in the category tabs.
export const categories: Category[] = [
  { id: "soups", name: "Soups", emoji: "🍲" },
  { id: "veg-starters", name: "Veg Starters", emoji: "🥦" },
  { id: "non-veg-starters", name: "Non-Veg Starters", emoji: "🍗" },
  { id: "momos", name: "Momos", emoji: "🥟" },
  { id: "noodles", name: "Noodles", emoji: "🍜" },
  { id: "fried-rice", name: "Fried Rice", emoji: "🍚" },
  { id: "gravies", name: "Main Course Gravies", emoji: "🥘" },
  { id: "combos", name: "Combos", emoji: "🍱" },
  { id: "desserts-beverages", name: "Desserts & Beverages", emoji: "🍨" },
];

// Helper for Half/Full items.
const halfFull = (half: number, full: number): Portion[] => [
  { label: "Half", price: half },
  { label: "Full", price: full },
];

export const menu: MenuItem[] = [
  // ---------- Soups ----------
  {
    id: "veg-manchow-soup",
    name: "Veg Manchow Soup",
    description: "Dark, peppery soup with chopped veggies, topped with crispy fried noodles.",
    category: "soups",
    price: 129,
    veg: true,
    spice: 2,
    bestseller: true,
    emoji: "🍲",
    color: "from-amber-700 to-red-900",
  },
  {
    id: "chicken-hot-sour-soup",
    name: "Chicken Hot & Sour Soup",
    description: "Tangy, spicy broth with shredded chicken, egg ribbons and vinegar kick.",
    category: "soups",
    price: 149,
    veg: false,
    spice: 2,
    emoji: "🥣",
    color: "from-orange-600 to-red-800",
  },
  {
    id: "sweet-corn-soup",
    name: "Veg Sweet Corn Soup",
    description: "Comforting, mildly sweet soup with creamed corn and spring onions.",
    category: "soups",
    price: 119,
    veg: true,
    spice: 0,
    emoji: "🌽",
    color: "from-yellow-400 to-amber-600",
  },

  // ---------- Veg Starters ----------
  {
    id: "veg-manchurian-dry",
    name: "Veg Manchurian Dry",
    description: "Crispy veg balls tossed in garlic, ginger and soy with spring onions.",
    category: "veg-starters",
    price: 159,
    veg: true,
    spice: 2,
    bestseller: true,
    portions: halfFull(159, 229),
    emoji: "🧆",
    color: "from-red-700 to-stone-900",
  },
  {
    id: "chilli-paneer-dry",
    name: "Chilli Paneer Dry",
    description: "Soft paneer cubes wok-tossed with capsicum, onion and green chillies.",
    category: "veg-starters",
    price: 189,
    veg: true,
    spice: 2,
    bestseller: true,
    portions: halfFull(189, 279),
    emoji: "🧀",
    color: "from-orange-500 to-red-700",
  },
  {
    id: "honey-chilli-potato",
    name: "Honey Chilli Potato",
    description: "Crunchy potato fingers glazed in sweet honey-chilli sauce with sesame.",
    category: "veg-starters",
    price: 169,
    veg: true,
    spice: 1,
    bestseller: true,
    portions: halfFull(169, 239),
    emoji: "🍟",
    color: "from-amber-500 to-orange-700",
  },
  {
    id: "crispy-corn",
    name: "Crispy Corn Salt & Pepper",
    description: "Golden fried corn kernels tossed with pepper, onion and coriander.",
    category: "veg-starters",
    price: 159,
    veg: true,
    spice: 1,
    portions: halfFull(159, 229),
    emoji: "🌽",
    color: "from-yellow-500 to-orange-600",
  },
  {
    id: "veg-spring-rolls",
    name: "Veg Spring Rolls",
    description: "Crisp rolls stuffed with cabbage, carrot and noodles. 6 pcs.",
    category: "veg-starters",
    price: 149,
    veg: true,
    spice: 0,
    emoji: "🌯",
    color: "from-amber-600 to-yellow-800",
  },

  // ---------- Non-Veg Starters ----------
  {
    id: "chilli-chicken-dry",
    name: "Chilli Chicken Dry",
    description: "The classic — crispy chicken tossed with green chillies, capsicum and soy.",
    category: "non-veg-starters",
    price: 219,
    veg: false,
    spice: 3,
    bestseller: true,
    portions: halfFull(219, 329),
    emoji: "🌶️",
    color: "from-red-600 to-red-950",
  },
  {
    id: "chicken-lollipop",
    name: "Chicken Lollipop",
    description: "Frenched chicken wings, fried crisp and served with Schezwan dip. 6 pcs.",
    category: "non-veg-starters",
    price: 249,
    veg: false,
    spice: 2,
    emoji: "🍗",
    color: "from-orange-600 to-red-900",
  },
  {
    id: "dragon-chicken",
    name: "Dragon Chicken",
    description: "Fiery strips of chicken with cashews in a red chilli-garlic glaze.",
    category: "non-veg-starters",
    price: 239,
    veg: false,
    spice: 3,
    portions: halfFull(239, 349),
    emoji: "🐉",
    color: "from-rose-600 to-stone-900",
  },

  // ---------- Momos ----------
  {
    id: "veg-momos",
    name: "Veg Momos",
    description: "Steamed dumplings with spiced cabbage and carrot. Served with red chutney. 8 pcs.",
    category: "momos",
    price: 119,
    veg: true,
    spice: 1,
    emoji: "🥟",
    color: "from-stone-300 to-amber-600",
  },
  {
    id: "paneer-momos-fried",
    name: "Paneer Momos (Fried)",
    description: "Crispy fried momos stuffed with masala paneer. 8 pcs.",
    category: "momos",
    price: 149,
    veg: true,
    spice: 1,
    emoji: "🥟",
    color: "from-amber-500 to-orange-800",
  },
  {
    id: "chicken-momos",
    name: "Chicken Momos",
    description: "Juicy chicken dumplings, steamed and served with fiery momo chutney. 8 pcs.",
    category: "momos",
    price: 149,
    veg: false,
    spice: 1,
    bestseller: true,
    emoji: "🥟",
    color: "from-orange-300 to-red-700",
  },
  {
    id: "chicken-tandoori-momos",
    name: "Chicken Tandoori Momos",
    description: "Momos marinated in tandoori masala and charred in the oven. 8 pcs.",
    category: "momos",
    price: 189,
    veg: false,
    spice: 2,
    emoji: "🔥",
    color: "from-red-500 to-orange-900",
  },

  // ---------- Noodles ----------
  {
    id: "veg-hakka-noodles",
    name: "Veg Hakka Noodles",
    description: "Wok-tossed noodles with shredded veggies, soy and a hint of vinegar.",
    category: "noodles",
    price: 139,
    veg: true,
    spice: 1,
    bestseller: true,
    portions: halfFull(139, 199),
    emoji: "🍜",
    color: "from-amber-500 to-amber-800",
  },
  {
    id: "schezwan-noodles",
    name: "Schezwan Noodles",
    description: "Hakka noodles tossed in our house-made fiery Schezwan sauce.",
    category: "noodles",
    price: 149,
    veg: true,
    spice: 3,
    bestseller: true,
    portions: halfFull(149, 219),
    emoji: "🍜",
    color: "from-red-600 to-red-900",
  },
  {
    id: "chilli-garlic-noodles",
    name: "Chilli Garlic Noodles",
    description: "Noodles loaded with burnt garlic and crushed red chillies.",
    category: "noodles",
    price: 149,
    veg: true,
    spice: 2,
    portions: halfFull(149, 219),
    emoji: "🧄",
    color: "from-orange-500 to-stone-800",
  },
  {
    id: "chicken-singapore-noodles",
    name: "Chicken Singapore Noodles",
    description: "Thin rice noodles with chicken, egg and a light curry-powder spice.",
    category: "noodles",
    price: 189,
    veg: false,
    spice: 1,
    portions: halfFull(189, 269),
    emoji: "🍝",
    color: "from-yellow-500 to-amber-800",
  },
  {
    id: "american-chopsuey",
    name: "Veg American Chopsuey",
    description: "Crispy fried noodles topped with a thick sweet & tangy tomato-veg sauce.",
    category: "noodles",
    price: 199,
    veg: true,
    spice: 0,
    emoji: "🥢",
    color: "from-red-500 to-amber-700",
  },

  // ---------- Fried Rice ----------
  {
    id: "veg-fried-rice",
    name: "Veg Fried Rice",
    description: "Fluffy wok-fried rice with beans, carrot, cabbage and spring onion.",
    category: "fried-rice",
    price: 139,
    veg: true,
    spice: 0,
    portions: halfFull(139, 199),
    emoji: "🍚",
    color: "from-yellow-300 to-amber-600",
  },
  {
    id: "schezwan-fried-rice",
    name: "Schezwan Fried Rice",
    description: "Spicy fried rice tossed in house Schezwan sauce.",
    category: "fried-rice",
    price: 149,
    veg: true,
    spice: 3,
    bestseller: true,
    portions: halfFull(149, 219),
    emoji: "🍛",
    color: "from-red-500 to-red-800",
  },
  {
    id: "chicken-fried-rice",
    name: "Chicken Fried Rice",
    description: "Wok-fried rice with egg, juicy chicken bits and spring onions.",
    category: "fried-rice",
    price: 179,
    veg: false,
    spice: 1,
    portions: halfFull(179, 259),
    emoji: "🍚",
    color: "from-amber-400 to-orange-700",
  },

  // ---------- Main Course Gravies ----------
  {
    id: "veg-manchurian-gravy",
    name: "Veg Manchurian Gravy",
    description: "Veg balls in a glossy garlic-soy gravy. Perfect with fried rice.",
    category: "gravies",
    price: 179,
    veg: true,
    spice: 2,
    bestseller: true,
    portions: halfFull(179, 259),
    emoji: "🥘",
    color: "from-red-800 to-stone-900",
  },
  {
    id: "chilli-chicken-gravy",
    name: "Chilli Chicken Gravy",
    description: "Chilli chicken in a rich, spicy soy-chilli gravy.",
    category: "gravies",
    price: 229,
    veg: false,
    spice: 3,
    portions: halfFull(229, 339),
    emoji: "🍲",
    color: "from-red-700 to-red-950",
  },
  {
    id: "paneer-hot-garlic",
    name: "Paneer in Hot Garlic Sauce",
    description: "Paneer cubes simmered in a bold red garlic and chilli sauce.",
    category: "gravies",
    price: 219,
    veg: true,
    spice: 2,
    portions: halfFull(219, 319),
    emoji: "🧄",
    color: "from-orange-600 to-red-900",
  },

  // ---------- Combos ----------
  {
    id: "combo-noodles-manchurian",
    name: "Hakka Noodles + Manchurian Gravy",
    description: "Full plate of Veg Hakka Noodles with a bowl of Veg Manchurian Gravy.",
    category: "combos",
    price: 249,
    veg: true,
    spice: 2,
    bestseller: true,
    emoji: "🍱",
    color: "from-amber-600 to-red-900",
  },
  {
    id: "combo-rice-manchurian",
    name: "Fried Rice + Manchurian Gravy",
    description: "Veg Fried Rice with Veg Manchurian Gravy — the all-time favourite.",
    category: "combos",
    price: 249,
    veg: true,
    spice: 1,
    emoji: "🍱",
    color: "from-yellow-500 to-red-800",
  },
  {
    id: "combo-chicken-rice",
    name: "Chicken Fried Rice + Chilli Chicken Gravy",
    description: "Chicken Fried Rice paired with spicy Chilli Chicken Gravy.",
    category: "combos",
    price: 319,
    veg: false,
    spice: 3,
    emoji: "🍱",
    color: "from-orange-600 to-stone-900",
  },

  // ---------- Desserts & Beverages ----------
  {
    id: "honey-noodles-ice-cream",
    name: "Honey Noodles with Ice Cream",
    description: "Crispy noodles drizzled with honey and sesame, with a scoop of vanilla.",
    category: "desserts-beverages",
    price: 149,
    veg: true,
    spice: 0,
    bestseller: true,
    emoji: "🍨",
    color: "from-yellow-300 to-amber-700",
  },
  {
    id: "lemon-iced-tea",
    name: "Lemon Iced Tea",
    description: "Chilled, refreshing black tea with lemon and mint.",
    category: "desserts-beverages",
    price: 89,
    veg: true,
    spice: 0,
    emoji: "🧋",
    color: "from-amber-300 to-orange-600",
  },
  {
    id: "fresh-lime-soda",
    name: "Fresh Lime Soda",
    description: "Sweet, salted or mixed — the perfect cooler for spicy food.",
    category: "desserts-beverages",
    price: 79,
    veg: true,
    spice: 0,
    emoji: "🍋",
    color: "from-lime-300 to-emerald-600",
  },
];

// Tax rate applied on the cart page.
export const GST_RATE = 0.05;

export const RESTAURANT_NAME = "Xu Noodles";
