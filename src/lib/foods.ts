/** Approximate values for common foods per typical serving (UK). Good enough for everyday tracking. */
export interface CommonFood {
  name: string;
  serving: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}
const f = (name: string, serving: string, kcal: number, protein: number, carbs: number, fat: number): CommonFood => ({ name, serving, kcal, protein, carbs, fat });

export const COMMON_FOODS: CommonFood[] = [
  // breakfast
  f('Porridge oats with semi-skimmed milk', '40 g oats + 200 ml', 250, 12, 35, 6),
  f('Weetabix with milk', '2 biscuits + 150 ml', 205, 10, 32, 3),
  f('Granola with yoghurt', '45 g + 100 g', 300, 11, 40, 10),
  f('Toast with butter', '2 slices', 230, 6, 30, 9),
  f('Egg, boiled or poached', '1 large', 78, 6, 0.5, 5),
  f('Scrambled eggs', '2 eggs', 200, 13, 1, 15),
  f('Full English breakfast', '1 plate', 800, 40, 45, 50),
  f('Bacon rasher, grilled', '1 rasher', 60, 5, 0, 4.5),
  f('Croissant', '1', 230, 5, 26, 12),
  // fruit & veg
  f('Banana', '1 medium', 105, 1.3, 27, 0.4),
  f('Apple', '1 medium', 80, 0.4, 21, 0.2),
  f('Orange', '1 medium', 60, 1.2, 15, 0.2),
  f('Berries, mixed', '80 g', 40, 0.8, 8, 0.3),
  f('Grapes', '80 g', 55, 0.5, 14, 0.1),
  f('Avocado', '½ fruit', 120, 1.5, 6, 11),
  f('Salad, mixed leaves', '1 bowl', 20, 1.5, 3, 0.3),
  f('Broccoli, boiled', '80 g', 28, 2.5, 3, 0.5),
  // carbs
  f('White rice, cooked', '180 g', 235, 4.5, 52, 0.5),
  f('Pasta, cooked', '200 g', 310, 11, 62, 2),
  f('Baked potato', '1 medium', 160, 4, 36, 0.2),
  f('Chips (oven)', '150 g', 250, 4, 38, 9),
  f('Bread, wholemeal', '1 slice', 95, 4, 16, 1),
  f('Wrap / tortilla', '1', 180, 5, 30, 4),
  // protein
  f('Chicken breast, grilled', '150 g', 240, 45, 0, 5),
  f('Salmon fillet, baked', '1 fillet (120 g)', 250, 26, 0, 16),
  f('Beef mince 5% fat, cooked', '125 g', 210, 29, 0, 10),
  f('Tuna, tinned in water', '1 tin (110 g)', 120, 27, 0, 1),
  f('Tofu, firm', '100 g', 145, 15, 2, 9),
  f('Baked beans', '½ tin (200 g)', 160, 9, 26, 0.5),
  f('Greek yoghurt 0%', '150 g', 85, 15, 6, 0),
  f('Cottage cheese', '100 g', 100, 11, 3.5, 4.5),
  f('Protein shake (whey + water)', '1 scoop', 120, 24, 3, 2),
  // dairy & snacks
  f('Cheddar cheese', '30 g', 125, 7.5, 0, 10.5),
  f('Milk, semi-skimmed', '200 ml', 95, 7, 10, 3.5),
  f('Peanut butter', '1 tbsp (15 g)', 95, 4, 2, 8),
  f('Almonds', '30 g', 175, 6, 2, 15),
  f('Crisps', '1 bag (25 g)', 130, 1.5, 13, 8),
  f('Chocolate bar', '1 standard (45 g)', 240, 3, 26, 13),
  f('Biscuit, digestive', '1', 70, 1, 9, 3),
  f('Cereal bar', '1', 120, 2, 18, 4),
  // meals & drinks
  f('Sandwich, chicken salad', '1 shop-bought', 380, 25, 40, 12),
  f('Spaghetti bolognese', '1 plate', 600, 32, 75, 18),
  f('Chicken curry with rice', '1 plate', 700, 38, 80, 22),
  f('Pizza, margherita', '½ medium', 550, 22, 70, 20),
  f('Burger in bun', '1', 500, 28, 38, 26),
  f('Fish and chips', '1 portion', 850, 35, 90, 40),
  f('Soup, tomato', '1 bowl (300 g)', 150, 3, 22, 5),
  f('Coffee, latte', '1 regular', 130, 8, 12, 5),
  f('Tea with milk', '1 mug', 20, 1, 2, 1),
  f('Orange juice', '200 ml', 90, 1.5, 20, 0),
  f('Beer, pint', '568 ml', 210, 2, 18, 0),
  f('Wine, glass', '175 ml', 160, 0, 4, 0),
  f('Fizzy drink, can', '330 ml', 140, 0, 35, 0),
];
