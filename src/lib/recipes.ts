export type Recipe = {
  id: string;
  name: string;
  heroImage?: string;
  servings: string;
  time: string;
  ingredients: { item: string; note?: string }[];
  steps: string[];
  substitutions: Record<string, string[]>;
};

export const DESSERT_RECIPES: Recipe[] = [
  {
    id: "ccc",
    name: "Chocolate Chip Cookies (pantry-friendly)",
    heroImage:
      "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1200&q=80",
    servings: "18–24 cookies",
    time: "25–35 min",
    ingredients: [
      { item: "1/2 cup (113g) unsalted butter, softened" },
      { item: "1/2 cup (100g) brown sugar" },
      { item: "1/3 cup (65g) granulated sugar" },
      { item: "1 large egg" },
      { item: "1 tsp vanilla extract" },
      { item: "1 1/2 cups (190g) all-purpose flour" },
      { item: "1/2 tsp baking soda" },
      { item: "1/2 tsp fine salt" },
      { item: "1 cup (170g) chocolate chips" },
    ],
    steps: [
      "Preheat oven to 350°F / 175°C. Line a baking sheet with parchment.",
      "Cream butter + sugars until fluffy (about 1–2 minutes).",
      "Mix in egg + vanilla until smooth.",
      "Whisk flour, baking soda, and salt. Add to bowl and mix JUST until no dry streaks.",
      "Fold in chocolate chips. Chill dough 10 minutes if very soft.",
      "Scoop 1–2 Tbsp mounds, spaced apart. Bake 9–12 minutes until edges set and centers look slightly underdone.",
      "Cool 5 minutes on tray, then move to rack. Celebrate.",
    ],
    substitutions: {
      butter: [
        "Use salted butter and reduce added salt by half.",
        "For dairy-free: use vegan butter sticks (not tub spread).",
      ],
      egg: [
        "1 flax egg (1 Tbsp ground flax + 3 Tbsp water, rest 10 min).",
        "3 Tbsp applesauce (slightly cakier).",
      ],
      flour: [
        "For gluten-free: use a 1:1 GF baking blend (add 1–2 Tbsp milk if dry).",
      ],
      sugar: [
        "No brown sugar? Use all white sugar + 1 Tbsp molasses if you have it.",
      ],
    },
  },
  {
    id: "brownies",
    name: "Fudgy One-Bowl Brownies",
    heroImage:
      "https://images.unsplash.com/photo-1606313564200-e75d5e30476f?auto=format&fit=crop&w=1200&q=80",
    servings: "9–16 squares",
    time: "35–45 min",
    ingredients: [
      { item: "1/2 cup (113g) butter" },
      { item: "1 cup (200g) sugar" },
      { item: "2 large eggs" },
      { item: "1 tsp vanilla" },
      { item: "1/3 cup (35g) cocoa powder" },
      { item: "1/2 cup (65g) all-purpose flour" },
      { item: "1/4 tsp salt" },
      { item: "1/4 tsp baking powder (optional)" },
    ],
    steps: [
      "Preheat oven to 350°F / 175°C. Line an 8x8 pan with parchment.",
      "Melt butter. Stir in sugar until glossy.",
      "Whisk in eggs one at a time + vanilla.",
      "Add cocoa, flour, salt (and baking powder if using). Mix until just combined.",
      "Bake 20–28 minutes. It’s done when a toothpick has moist crumbs (not wet batter).",
      "Cool fully for clean slices. Dramatic chocolate moment encouraged.",
    ],
    substitutions: {
      butter: ["Use coconut oil (same amount) for a slight coconut note."],
      eggs: ["Use 2 flax eggs (a bit more dense)."],
      cocoa: ["If using Dutch cocoa, reduce baking powder (or skip)."],
    },
  },
  {
    id: "no-bake-cheesecake",
    name: "No-Bake Cheesecake Cups",
    heroImage:
      "https://images.unsplash.com/photo-1514517604298-cf80e0fb7fef?auto=format&fit=crop&w=1200&q=80",
    servings: "4–6 cups",
    time: "15 min + chill",
    ingredients: [
      { item: "1 cup crushed cookies (graham/digestive/oreo)" },
      { item: "3 Tbsp melted butter" },
      { item: "8 oz (225g) cream cheese, softened" },
      { item: "1/3 cup (40g) powdered sugar" },
      { item: "1 tsp vanilla" },
      { item: "3/4 cup (180ml) heavy cream, cold" },
      { item: "Fruit or jam for topping" },
    ],
    steps: [
      "Mix cookie crumbs + melted butter. Press into cups.",
      "Beat cream cheese + powdered sugar + vanilla until smooth.",
      "Whip cold cream to soft peaks, then fold into cream cheese mixture.",
      "Spoon into cups. Chill 2 hours (or 30 min in freezer for a quick set).",
      "Top with fruit/jam. Eat with tiny-spoon elegance.",
    ],
    substitutions: {
      cream: ["Use coconut cream (chilled) for dairy-free (texture varies)."],
      cream_cheese: ["Use dairy-free cream cheese (may need extra chill time)."],
      cookies: ["Any crisp cookie works; adjust butter so crumbs look like wet sand."],
    },
  },
];

