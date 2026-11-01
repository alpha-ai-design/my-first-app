-- Xu Noodles menu seed. Run in the Supabase SQL editor.
-- The menu_items table already exists; this only adds the emoji column and the dishes.
-- category uses the ids from data/menu.ts (e.g. 'soups'), which set the order on the menu page.
-- Dishes without Half/Full portions have price_half = null and their price in price_full.
-- Safe to run more than once: dishes that already exist (same name) are skipped.

alter table menu_items add column if not exists emoji text;

insert into menu_items (name, category, description, price_half, price_full, is_veg, spice_level, is_bestseller, emoji)
select v.name, v.category, v.description, v.price_half, v.price_full, v.is_veg, v.spice_level, v.is_bestseller, v.emoji
from (values
  ('Veg Manchow Soup', 'soups', 'Dark, peppery soup with chopped veggies, topped with crispy fried noodles.', null, 129, true, 2, true, '🍲'),
  ('Chicken Hot & Sour Soup', 'soups', 'Tangy, spicy broth with shredded chicken, egg ribbons and vinegar kick.', null, 149, false, 2, false, '🥣'),
  ('Veg Sweet Corn Soup', 'soups', 'Comforting, mildly sweet soup with creamed corn and spring onions.', null, 119, true, 0, false, '🌽'),
  ('Veg Manchurian Dry', 'veg-starters', 'Crispy veg balls tossed in garlic, ginger and soy with spring onions.', 159, 229, true, 2, true, '🧆'),
  ('Chilli Paneer Dry', 'veg-starters', 'Soft paneer cubes wok-tossed with capsicum, onion and green chillies.', 189, 279, true, 2, true, '🧀'),
  ('Honey Chilli Potato', 'veg-starters', 'Crunchy potato fingers glazed in sweet honey-chilli sauce with sesame.', 169, 239, true, 1, true, '🍟'),
  ('Crispy Corn Salt & Pepper', 'veg-starters', 'Golden fried corn kernels tossed with pepper, onion and coriander.', 159, 229, true, 1, false, '🌽'),
  ('Veg Spring Rolls', 'veg-starters', 'Crisp rolls stuffed with cabbage, carrot and noodles. 6 pcs.', null, 149, true, 0, false, '🌯'),
  ('Chilli Chicken Dry', 'non-veg-starters', 'The classic — crispy chicken tossed with green chillies, capsicum and soy.', 219, 329, false, 3, true, '🌶️'),
  ('Chicken Lollipop', 'non-veg-starters', 'Frenched chicken wings, fried crisp and served with Schezwan dip. 6 pcs.', null, 249, false, 2, false, '🍗'),
  ('Dragon Chicken', 'non-veg-starters', 'Fiery strips of chicken with cashews in a red chilli-garlic glaze.', 239, 349, false, 3, false, '🐉'),
  ('Veg Momos', 'momos', 'Steamed dumplings with spiced cabbage and carrot. Served with red chutney. 8 pcs.', null, 119, true, 1, false, '🥟'),
  ('Paneer Momos (Fried)', 'momos', 'Crispy fried momos stuffed with masala paneer. 8 pcs.', null, 149, true, 1, false, '🥟'),
  ('Chicken Momos', 'momos', 'Juicy chicken dumplings, steamed and served with fiery momo chutney. 8 pcs.', null, 149, false, 1, true, '🥟'),
  ('Chicken Tandoori Momos', 'momos', 'Momos marinated in tandoori masala and charred in the oven. 8 pcs.', null, 189, false, 2, false, '🔥'),
  ('Veg Hakka Noodles', 'noodles', 'Wok-tossed noodles with shredded veggies, soy and a hint of vinegar.', 139, 199, true, 1, true, '🍜'),
  ('Schezwan Noodles', 'noodles', 'Hakka noodles tossed in our house-made fiery Schezwan sauce.', 149, 219, true, 3, true, '🍜'),
  ('Chilli Garlic Noodles', 'noodles', 'Noodles loaded with burnt garlic and crushed red chillies.', 149, 219, true, 2, false, '🧄'),
  ('Chicken Singapore Noodles', 'noodles', 'Thin rice noodles with chicken, egg and a light curry-powder spice.', 189, 269, false, 1, false, '🍝'),
  ('Veg American Chopsuey', 'noodles', 'Crispy fried noodles topped with a thick sweet & tangy tomato-veg sauce.', null, 199, true, 0, false, '🥢'),
  ('Veg Fried Rice', 'fried-rice', 'Fluffy wok-fried rice with beans, carrot, cabbage and spring onion.', 139, 199, true, 0, false, '🍚'),
  ('Schezwan Fried Rice', 'fried-rice', 'Spicy fried rice tossed in house Schezwan sauce.', 149, 219, true, 3, true, '🍛'),
  ('Chicken Fried Rice', 'fried-rice', 'Wok-fried rice with egg, juicy chicken bits and spring onions.', 179, 259, false, 1, false, '🍚'),
  ('Veg Manchurian Gravy', 'gravies', 'Veg balls in a glossy garlic-soy gravy. Perfect with fried rice.', 179, 259, true, 2, true, '🥘'),
  ('Chilli Chicken Gravy', 'gravies', 'Chilli chicken in a rich, spicy soy-chilli gravy.', 229, 339, false, 3, false, '🍲'),
  ('Paneer in Hot Garlic Sauce', 'gravies', 'Paneer cubes simmered in a bold red garlic and chilli sauce.', 219, 319, true, 2, false, '🧄'),
  ('Hakka Noodles + Manchurian Gravy', 'combos', 'Full plate of Veg Hakka Noodles with a bowl of Veg Manchurian Gravy.', null, 249, true, 2, true, '🍱'),
  ('Fried Rice + Manchurian Gravy', 'combos', 'Veg Fried Rice with Veg Manchurian Gravy — the all-time favourite.', null, 249, true, 1, false, '🍱'),
  ('Chicken Fried Rice + Chilli Chicken Gravy', 'combos', 'Chicken Fried Rice paired with spicy Chilli Chicken Gravy.', null, 319, false, 3, false, '🍱'),
  ('Honey Noodles with Ice Cream', 'desserts-beverages', 'Crispy noodles drizzled with honey and sesame, with a scoop of vanilla.', null, 149, true, 0, true, '🍨'),
  ('Lemon Iced Tea', 'desserts-beverages', 'Chilled, refreshing black tea with lemon and mint.', null, 89, true, 0, false, '🧋'),
  ('Fresh Lime Soda', 'desserts-beverages', 'Sweet, salted or mixed — the perfect cooler for spicy food.', null, 79, true, 0, false, '🍋')
) as v (name, category, description, price_half, price_full, is_veg, spice_level, is_bestseller, emoji)
where not exists (select 1 from menu_items m where m.name = v.name);
