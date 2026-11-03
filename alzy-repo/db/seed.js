'use strict';
/**
 * ALZY seed data — realistic Eswatini marketplace inventory, farms, coupons,
 * demo accounts and trading history so every dashboard is alive on first run.
 *   npm run reset   (re-seeds from scratch)
 */
const { connect, transaction } = require('./index');
const { hashPassword } = require('../lib/auth');
const config = require('../lib/config');

const force = process.argv.includes('--force');

const CATEGORIES = [
  ['fresh-vegetables', 'Fresh vegetables', 'carrot', 'green', 'food'],
  ['fruits', 'Fruits', 'leaf', 'orange', 'food'],
  ['meat-poultry', 'Meat & poultry', 'meat', 'red', 'food'],
  ['fish-seafood', 'Fish & seafood', 'fish', 'blue', 'food'],
  ['grains-cereals', 'Grains & cereals', 'grain', 'gold', 'food'],
  ['dairy-eggs', 'Dairy & eggs', 'egg', 'sand', 'food'],
  ['sauces-condiments', 'Sauces & condiments', 'jar', 'red', 'food'],
  ['spices-seasonings', 'Spices & seasonings', 'spice', 'orange', 'food'],
  ['beverages-drinks', 'Beverages & drinks', 'bottle', 'teal', 'food'],
  ['processed-foods', 'Processed & pantry', 'pouch', 'cocoa', 'food'],
  ['honey-preserves', 'Honey, jams & preserves', 'honey', 'gold', 'food'],
  ['farm-supplies', 'Farm inputs & seedlings', 'scale', 'lime', 'supplies'],
  ['packaging-glass', 'Glass jars & bottles', 'bottleGlass', 'teal', 'packaging'],
  ['packaging-plastic', 'Plastic containers & bottles', 'bottle', 'blue', 'packaging'],
  ['bags-wraps', 'Bags, wraps & covers', 'bag', 'sand', 'packaging'],
  ['private-label', 'Private label & branding', 'label', 'violet', 'packaging']
];

const SELLERS = [
  { key: 'ngwempisi', name: 'Ngwempisi Valley Farms', kind: 'farm', region: 'Malkerns', hue: 'green', plan: 'pro', tagline: 'Family-run vegetable farm since 2011', verified: 1, rating: 4.9, rating_count: 214, since: '2011', user: true,
    description: 'Three generations of vegetable growers in the lush Ngwempisi valley. We supply Mbabane and Manzini restaurants daily with pesticide-tested, hand-graded produce. Cold-chain pick-up at our Malkerns packhouse.' },
  { key: 'malkerns-coop', name: 'Malkerns Fresh Co-op', kind: 'farm', region: 'Malkerns', hue: 'lime', plan: 'growth', tagline: '42 smallholder growers, one supply chain', verified: 1, rating: 4.8, rating_count: 168, since: '2018',
    description: 'A co-operative of 42 smallholder farmers pooling produce for supermarkets, hotels and wholesalers. Aggregated volumes, consistent grading, consolidated weekly deliveries.' },
  { key: 'hhohho-highland', name: 'Hhohho Highland Growers', kind: 'farm', region: 'Piggs Peak', hue: 'teal', plan: 'growth', tagline: 'Cool-climate fruit from the highveld', verified: 1, rating: 4.7, rating_count: 96, since: '2015',
    description: 'High-altitude orchards producing premium avocados, granadilla and berries. We pack in returnable crates and deliver twice weekly to Mbabane.' },
  { key: 'beef-lamb', name: 'Eswatini Beef & Lamb', kind: 'processor', region: 'Matsapha', hue: 'red', plan: 'pro', tagline: 'Graded, halal-certified meat at scale', verified: 1, rating: 4.9, rating_count: 341, since: '2009',
    description: 'Matsapha abattoir and cutting plant. Halaal-certified, vet-inspected beef, lamb, goat and pork for butchers, restaurants and processors. Cold truck delivery nationwide.' },
  { key: 'lubombo-poultry', name: 'Lubombo Poultry', kind: 'farm', region: 'Siteki', hue: 'gold', plan: 'growth', tagline: 'Free-range chicken from the Lowveld', verified: 1, rating: 4.8, rating_count: 187, since: '2013',
    description: 'Siteki-based broiler operation supplying fresh and frozen chicken to supermarkets and restaurants. Weekly harvest schedule published every Monday.' },
  { key: 'ngulube-pork', name: 'Ngulube Pork & More', kind: 'processor', region: 'Hlatikulu', hue: 'rose', plan: 'free', tagline: 'Shiselweni pork & charcuterie', verified: 0, rating: 4.6, rating_count: 54, since: '2019',
    description: 'Small-batch pork butchery in Hlatikulu. Pasture-raised pigs, traditional boerewors, bacon and cold cuts.' },
  { key: 'siyabonga', name: 'Siyabonga Fisheries', kind: 'farm', region: 'Piggs Peak', hue: 'blue', plan: 'growth', tagline: 'Aquaculture in the highveld', verified: 1, rating: 4.7, rating_count: 73, since: '2017',
    description: 'Tilapia and bream farm using recirculating aquaculture. Fresh, chilled and smoked fish delivered within 24 hours of harvest.' },
  { key: 'shiselweni-millers', name: 'Shiselweni Grain Millers', kind: 'processor', region: 'Nhlangano', hue: 'sand', plan: 'pro', tagline: 'Stone-milled maize, sorghum & wheat', verified: 1, rating: 4.8, rating_count: 129, since: '2006',
    description: 'Nhlangano mill processing maize, sorghum and wheat from Eswatini growers. 25kg and bulk bagging for schools, retailers and processors.' },
  { key: 'siphofaneni', name: 'Siphofaneni Rice & Grains', kind: 'supplier', region: 'Big Bend', hue: 'cocoa', plan: 'free', tagline: 'Lowveld rice and legumes', verified: 0, rating: 4.5, rating_count: 38, since: '2020',
    description: 'Lowveld grain grower and aggregator supplying long-grain rice, sugar beans and groundnuts in bulk.' },
  { key: 'mbabane-dairy', name: 'Mbabane Dairy & Eggs', kind: 'processor', region: 'Mbabane', hue: 'sand', plan: 'growth', tagline: 'Milk, emasi and eggs daily', verified: 1, rating: 4.9, rating_count: 156, since: '2012',
    description: 'Daily milk collection from highveld dairy farms. Pasteurised milk, emasi, yoghurt, butter and free-range eggs delivered in returnable crates.' },
  { key: 'lihle', name: 'Lihle Sauces & Preserves', kind: 'processor', region: 'Manzini', hue: 'red', plan: 'growth', tagline: 'Small-batch sauces, made in Eswatini', verified: 1, rating: 4.8, rating_count: 112, since: '2016',
    description: 'Manzini food kitchen producing tomato sauce, chilli sauces, chutneys and jams for retail and food service. Co-packing available for private label.' },
  { key: 'ezulwini-spice', name: 'Ezulwini Spice House', kind: 'supplier', region: 'Ezulwini', hue: 'orange', plan: 'pro', tagline: 'Blended spices for kitchens at scale', verified: 1, rating: 4.9, rating_count: 88, since: '2014',
    description: 'Spice blending and packing house serving restaurants, caterers and retailers. HACCP-compliant blends, custom ratios on request.' },
  { key: 'manzini-wholesale', name: 'Manzini Wholesale Supply', kind: 'supplier', region: 'Manzini', hue: 'blue', plan: 'pro', tagline: 'Your monthly grocery, at wholesale', verified: 1, rating: 4.7, rating_count: 402, since: '2004',
    description: 'Manzini wholesale distributor of pantry staples, beverages and household food. Case and pallet pricing with monthly grocery bundles for households.' },
  { key: 'simunye-agro', name: 'Simunye Agro Supplies', kind: 'supplier', region: 'Simunye', hue: 'lime', plan: 'growth', tagline: 'Inputs that make harvests happen', verified: 1, rating: 4.8, rating_count: 91, since: '2010',
    description: 'Seed, fertilizer, irrigation and poultry inputs for Eswatini growers. Agronomist support included with bulk orders.' },
  { key: 'eswatini-glass', name: 'Eswatini Glass Works', kind: 'packaging', region: 'Matsapha', hue: 'teal', plan: 'pro', tagline: 'Bottles & jars, made for Africa', verified: 1, rating: 4.9, rating_count: 77, since: '2008',
    description: 'Matsapha glass plant supplying bottles, jars and closures to beverage, sauce and honey producers across the SADC region. Custom moulds available.' },
  { key: 'ncaba-packaging', name: 'Ncaba Packaging', kind: 'packaging', region: 'Matsapha', hue: 'violet', plan: 'growth', tagline: 'Plastic, paper, bags & wraps', verified: 1, rating: 4.7, rating_count: 143, since: '2011',
    description: 'Full-service packaging supplier: PET and HDPE bottles, punnets, takeaway containers, kraft paper bags, mailers and cling film. Low MOQs for start-ups.' },
  { key: 'imbali-studio', name: 'Imbali Brand Studio', kind: 'packaging', region: 'Mbabane', hue: 'pink', plan: 'growth', tagline: 'Own-brand packaging, end to end', verified: 1, rating: 4.9, rating_count: 46, since: '2019',
    description: 'Design, print and co-pack for farmers and food entrepreneurs launching their own brand. From label artwork to filled jars, we handle the whole chain.' },
  { key: 'bulembu-honey', name: 'Bulembu Honey Co', kind: 'farm', region: 'Piggs Peak', hue: 'gold', plan: 'growth', tagline: 'Wild honey from Bulembu forests', verified: 1, rating: 4.9, rating_count: 121, since: '2007',
    description: 'Community beekeeping project harvesting raw, unheated honey from indigenous forest. Bulk drums plus retail-ready jars, and private-label filling.' }
];

/** helpers ------------------------------------------------------------------ */
const d = (daysFromNow) => {
  const t = new Date('2026-11-03T08:00:00Z');
  t.setDate(t.getDate() + daysFromNow);
  return t.toISOString().slice(0, 10);
};
const dt = (daysFromNow, hours = 9) => {
  const t = new Date('2026-11-03T08:00:00Z');
  t.setDate(t.getDate() + daysFromNow);
  t.setHours(hours, 0, 0, 0);
  return t.toISOString().slice(0, 19).replace('T', ' ');
};
const slugify = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* products: [sellerKey, catSlug, name, unit, priceE, compareE|null, moq, step, stock, harvestDays|null, region, vessel, hue, icon, badge, featured] */
const PRODUCTS = [
  // Fresh vegetables
  ['ngwempisi', 'fresh-vegetables', 'Roma Tomatoes', 'kg', 18.5, 22, 5, 1, 480, 12, 'Malkerns', 'tomato', 'red', 'carrot', 'Farm fresh', 1],
  ['ngwempisi', 'fresh-vegetables', 'Butternut Squash', 'kg', 14, 17.5, 10, 1, 620, 18, 'Malkerns', 'potato', 'orange', 'carrot', 'Bulk deal', 0],
  ['ngwempisi', 'fresh-vegetables', 'Baby Spinach', 'kg', 22, null, 2, 0.5, 120, 6, 'Malkerns', 'leafy', 'green', 'leaf', 'New harvest', 1],
  ['ngwempisi', 'fresh-vegetables', 'Green Bell Peppers', 'kg', 26, 31, 5, 1, 240, 10, 'Malkerns', 'peppers', 'green', 'carrot', null, 0],
  ['ngwempisi', 'fresh-vegetables', 'Brown Onions (10kg pocket)', '10kg bag', 135, 158, 1, 1, 310, null, 'Malkerns', 'onion', 'sand', 'carrot', 'Best seller', 1],
  ['ngwempisi', 'fresh-vegetables', 'Carrots (5kg)', '5kg bag', 62, 74, 1, 1, 270, 5, 'Malkerns', 'carrot', 'orange', 'carrot', null, 0],
  ['malkerns-coop', 'fresh-vegetables', 'Cabbage (large head)', 'each', 12.5, 15, 10, 1, 900, 3, 'Malkerns', 'leafy', 'lime', 'leaf', null, 0],
  ['malkerns-coop', 'fresh-vegetables', 'Beetroot (bunch)', 'bunch', 16, null, 10, 1, 420, 4, 'Malkerns', 'leafy', 'rose', 'carrot', null, 0],
  ['malkerns-coop', 'fresh-vegetables', 'Fine Green Beans', 'kg', 34, 39.5, 5, 1, 180, 7, 'Malkerns', 'leafy', 'green', 'leaf', 'Farm fresh', 0],
  ['malkerns-coop', 'fresh-vegetables', 'Sweet Potatoes', 'kg', 11, 13, 20, 5, 1200, 20, 'Malkerns', 'potato', 'cocoa', 'carrot', 'Bulk deal', 0],
  ['malkerns-coop', 'fresh-vegetables', 'Crisphead Lettuce', 'each', 14, null, 12, 1, 300, 2, 'Malkerns', 'leafy', 'lime', 'leaf', null, 0],
  ['malkerns-coop', 'fresh-vegetables', 'Cucumber', 'kg', 15, 18, 10, 1, 260, 3, 'Malkerns', 'leafy', 'green', 'carrot', null, 0],
  // Fruits
  ['malkerns-coop', 'fruits', 'Eswatini Bananas (18kg)', '18kg box', 210, 245, 1, 1, 140, 9, 'Malkerns', 'crate', 'gold', 'leaf', 'Best seller', 1],
  ['hhohho-highland', 'fruits', 'Valencia Oranges (15kg)', '15kg pocket', 175, 205, 1, 1, 165, 14, 'Piggs Peak', 'sack', 'orange', 'leaf', null, 0],
  ['hhohho-highland', 'fruits', 'Granadilla (passion fruit)', 'kg', 48, 56, 2, 0.5, 90, 21, 'Piggs Peak', 'sack', 'violet', 'leaf', 'Farm fresh', 0],
  ['hhohho-highland', 'fruits', 'Pineapples', 'each', 28, 34, 6, 1, 220, 11, 'Piggs Peak', 'crate', 'gold', 'leaf', null, 0],
  ['hhohho-highland', 'fruits', 'Hass Avocados', 'kg', 38, 45, 3, 0.5, 150, 16, 'Piggs Peak', 'crate', 'green', 'leaf', 'New harvest', 1],
  ['hhohho-highland', 'fruits', 'Papaya', 'kg', 25, null, 5, 1, 130, 8, 'Piggs Peak', 'crate', 'orange', 'leaf', null, 0],
  ['malkerns-coop', 'fruits', 'Watermelon', 'each', 65, 78, 4, 1, 180, 12, 'Malkerns', 'crate', 'green', 'leaf', null, 0],
  ['hhohho-highland', 'fruits', 'Keitt Mangoes', 'kg', 32, 38, 5, 1, 210, 24, 'Piggs Peak', 'crate', 'gold', 'leaf', null, 0],
  ['hhohho-highland', 'fruits', 'Strawberries (250g punnet)', 'punnet', 45, 55, 6, 1, 80, 5, 'Piggs Peak', 'punnet', 'rose', 'leaf', 'Farm fresh', 0],
  ['malkerns-coop', 'fruits', 'Lemons (10kg)', '10kg pocket', 95, 110, 1, 1, 120, 10, 'Malkerns', 'sack', 'lime', 'leaf', null, 0],
  // Meat & poultry
  ['beef-lamb', 'meat-poultry', 'Beef Carcass Quarters (bulk)', 'kg', 89, 102, 40, 5, 1800, null, 'Matsapha', 'meat', 'red', 'meat', 'Wholesale', 1],
  ['beef-lamb', 'meat-poultry', 'Beef Mince (5kg)', '5kg pack', 445, 495, 1, 1, 260, null, 'Matsapha', 'meat', 'red', 'meat', null, 0],
  ['beef-lamb', 'meat-poultry', 'Beef Fillet', 'kg', 215, 245, 2, 0.5, 120, null, 'Matsapha', 'meat', 'red', 'meat', 'Best seller', 1],
  ['beef-lamb', 'meat-poultry', 'Lamb Chops', 'kg', 189, 215, 2, 0.5, 140, null, 'Matsapha', 'meat', 'rose', 'meat', null, 0],
  ['beef-lamb', 'meat-poultry', 'Goat Meat (halal)', 'kg', 125, 145, 5, 1, 230, null, 'Matsapha', 'meat', 'cocoa', 'meat', null, 0],
  ['ngulube-pork', 'meat-poultry', 'Pork Belly', 'kg', 98, 112, 3, 0.5, 90, null, 'Hlatikulu', 'meat', 'rose', 'meat', null, 0],
  ['ngulube-pork', 'meat-poultry', 'Pork Chops (10kg)', '10kg box', 920, 1050, 1, 1, 60, null, 'Hlatikulu', 'meat', 'rose', 'meat', 'Bulk deal', 0],
  ['lubombo-poultry', 'meat-poultry', 'Whole Chickens (10 × 1.2kg)', '10 birds', 385, 430, 1, 1, 320, 3, 'Siteki', 'chicken', 'gold', 'chicken', 'Best seller', 1],
  ['lubombo-poultry', 'meat-poultry', 'Chicken Portions (10kg)', '10kg box', 355, 395, 1, 1, 410, 4, 'Siteki', 'chicken', 'gold', 'chicken', null, 0],
  ['lubombo-poultry', 'meat-poultry', 'Chicken Gizzards (5kg)', '5kg box', 145, 170, 1, 1, 180, 2, 'Siteki', 'chicken', 'gold', 'chicken', null, 0],
  ['ngulube-pork', 'meat-poultry', 'Boerewors (5kg)', '5kg pack', 315, 350, 1, 1, 95, null, 'Hlatikulu', 'meat', 'red', 'meat', null, 0],
  ['lubombo-poultry', 'meat-poultry', 'Whole Turkey (frozen)', 'each', 265, 310, 2, 1, 70, null, 'Siteki', 'chicken', 'sand', 'chicken', null, 0],
  // Fish & seafood
  ['siyabonga', 'fish-seafood', 'Fresh Tilapia (whole, chilled)', 'kg', 92, 108, 2, 0.5, 160, 2, 'Piggs Peak', 'tray', 'blue', 'fish', 'Farm fresh', 1],
  ['siyabonga', 'fish-seafood', 'Smoked Tilapia', 'kg', 135, 155, 1, 0.5, 80, 2, 'Piggs Peak', 'fish', 'blue', 'fish', null, 0],
  ['siyabonga', 'fish-seafood', 'Frozen Hake Fillets (10kg)', '10kg box', 890, 980, 1, 1, 110, null, 'Piggs Peak', 'meat', 'blue', 'fish', 'Bulk deal', 0],
  ['siyabonga', 'fish-seafood', 'Bream (whole)', 'kg', 105, null, 3, 0.5, 70, 2, 'Piggs Peak', 'fish', 'blue', 'fish', null, 0],
  ['siyabonga', 'fish-seafood', 'Dried Fish (bulk)', '5kg bag', 240, 275, 1, 1, 65, null, 'Piggs Peak', 'fish', 'teal', 'fish', null, 0],
  ['siyabonga', 'fish-seafood', 'Frozen Prawns (2kg)', '2kg box', 460, 520, 1, 1, 90, null, 'Piggs Peak', 'fish', 'rose', 'fish', null, 0],
  // Grains & cereals
  ['shiselweni-millers', 'grains-cereals', 'Maize Meal (25kg)', '25kg bag', 310, 345, 1, 1, 720, null, 'Nhlangano', 'grainbag', 'gold', 'grain', 'Best seller', 1],
  ['siphofaneni', 'grains-cereals', 'Long Grain Rice (25kg)', '25kg bag', 690, 760, 1, 1, 380, null, 'Big Bend', 'grainbag', 'sand', 'grain', null, 0],
  ['shiselweni-millers', 'grains-cereals', 'Sihlangu Maize (50kg)', '50kg bag', 520, 575, 1, 1, 260, null, 'Nhlangano', 'grainbag', 'gold', 'grain', 'Bulk deal', 0],
  ['shiselweni-millers', 'grains-cereals', 'Wheat Flour (25kg)', '25kg bag', 425, 470, 1, 1, 340, null, 'Nhlangano', 'grainbag', 'sand', 'grain', null, 0],
  ['shiselweni-millers', 'grains-cereals', 'Sorghum Grain (25kg)', '25kg bag', 365, 400, 1, 1, 210, null, 'Nhlangano', 'grainbag', 'cocoa', 'grain', null, 0],
  ['siphofaneni', 'grains-cereals', 'Pearl Millet (10kg)', '10kg bag', 185, 205, 1, 1, 160, null, 'Big Bend', 'grainbag', 'sand', 'grain', null, 0],
  ['shiselweni-millers', 'grains-cereals', 'White Bread Flour (12.5kg)', '12.5kg bag', 245, 270, 1, 1, 280, null, 'Nhlangano', 'grainbag', 'sand', 'grain', null, 0],
  ['shiselweni-millers', 'grains-cereals', 'Samp (10kg)', '10kg bag', 155, 172, 1, 1, 190, null, 'Nhlangano', 'grainbag', 'gold', 'grain', null, 0],
  ['siphofaneni', 'grains-cereals', 'Sugar Beans (10kg)', '10kg bag', 285, 320, 1, 1, 240, null, 'Big Bend', 'grainbag', 'red', 'grain', null, 0],
  ['shiselweni-millers', 'grains-cereals', 'Rolled Oats (10kg)', '10kg bag', 275, 305, 1, 1, 130, null, 'Nhlangano', 'grainbag', 'sand', 'grain', null, 0],
  // Dairy & eggs
  ['mbabane-dairy', 'dairy-eggs', 'Fresh Milk (20L bulk)', '20L can', 320, 355, 1, 1, 140, 1, 'Mbabane', 'milk', 'slate', 'drop', 'Best seller', 0],
  ['mbabane-dairy', 'dairy-eggs', 'Yoghurt (1L × 12)', '12 pack', 245, 275, 1, 1, 110, 2, 'Mbabane', 'milk', 'rose', 'drop', null, 0],
  ['mbabane-dairy', 'dairy-eggs', 'Gouda Cheese (5kg)', '5kg wheel', 620, 690, 1, 1, 55, 5, 'Mbabane', 'box', 'gold', 'drop', null, 0],
  ['mbabane-dairy', 'dairy-eggs', 'Free-range Eggs (30 tray)', '30 eggs', 89, 102, 2, 1, 480, 2, 'Mbabane', 'eggs', 'sand', 'egg', 'Farm fresh', 1],
  ['mbabane-dairy', 'dairy-eggs', 'Eggs (180 bulk)', '180 eggs', 495, 560, 1, 1, 220, 2, 'Mbabane', 'eggs', 'sand', 'egg', 'Bulk deal', 0],
  ['mbabane-dairy', 'dairy-eggs', 'Butter (5kg)', '5kg block', 540, 595, 1, 1, 70, 6, 'Mbabane', 'box', 'gold', 'drop', null, 0],
  ['mbabane-dairy', 'dairy-eggs', 'Emasi / Sour Milk (20L)', '20L can', 340, 375, 1, 1, 90, 1, 'Mbabane', 'milk', 'slate', 'drop', null, 0],
  // Sauces & condiments
  ['lihle', 'sauces-condiments', 'Tomato Sauce (1L × 12)', '12 pack', 285, 320, 1, 1, 240, null, 'Manzini', 'sauce', 'red', 'jar', 'Best seller', 1],
  ['lihle', 'sauces-condiments', 'Chilli Sauce (250ml × 12)', '12 pack', 195, 225, 1, 1, 210, null, 'Manzini', 'peppers', 'red', 'jar', 'Farm fresh', 0],
  ['lihle', 'sauces-condiments', 'Peri-Peri Sauce (1L × 6)', '6 pack', 240, 275, 1, 1, 130, null, 'Manzini', 'sauce', 'orange', 'jar', null, 0],
  ['lihle', 'sauces-condiments', 'Barbecue Sauce (5L)', '5L can', 275, 310, 1, 1, 95, null, 'Manzini', 'sauce', 'cocoa', 'jar', null, 0],
  ['lihle', 'sauces-condiments', 'Mayonnaise (5L)', '5L can', 320, 360, 1, 1, 120, null, 'Manzini', 'sauce', 'sand', 'jar', null, 0],
  ['lihle', 'sauces-condiments', 'Piccalilli Relish (5kg)', '5kg bucket', 230, 260, 1, 1, 60, null, 'Manzini', 'sauce', 'gold', 'jar', null, 0],
  ['lihle', 'sauces-condiments', 'Habanero Hot Sauce (250ml × 12)', '12 pack', 235, 265, 1, 1, 150, null, 'Manzini', 'sauce', 'red', 'jar', null, 0],
  ['manzini-wholesale', 'sauces-condiments', 'Soy Sauce (5L)', '5L can', 265, 295, 1, 1, 110, null, 'Manzini', 'sauce', 'cocoa', 'jar', null, 0],
  ['manzini-wholesale', 'sauces-condiments', 'White Vinegar (5L)', '5L can', 125, 145, 1, 1, 160, null, 'Manzini', 'sauce', 'slate', 'jar', null, 0],
  ['lihle', 'sauces-condiments', 'Peanut Butter (400g × 6)', '6 pack', 178, 198, 1, 1, 190, null, 'Manzini', 'box', 'cocoa', 'jar', null, 0],
  // Spices & seasonings
  ['ezulwini-spice', 'spices-seasonings', 'Ground Paprika (1kg)', '1kg', 165, 190, 1, 1, 130, null, 'Ezulwini', 'spice', 'red', 'spice', null, 0],
  ['ezulwini-spice', 'spices-seasonings', 'Black Pepper (1kg)', '1kg', 210, 235, 1, 1, 120, null, 'Ezulwini', 'spice', 'slate', 'spice', null, 0],
  ['ezulwini-spice', 'spices-seasonings', 'Curry Powder (5kg)', '5kg', 480, 545, 1, 1, 70, null, 'Ezulwini', 'spice', 'gold', 'spice', 'Bulk deal', 0],
  ['ezulwini-spice', 'spices-seasonings', 'Braai Spice (10kg)', '10kg', 720, 810, 1, 1, 60, null, 'Ezulwini', 'spice', 'orange', 'spice', 'Best seller', 1],
  ['ezulwini-spice', 'spices-seasonings', 'Dried Chillies (2kg)', '2kg', 185, 210, 1, 1, 85, null, 'Ezulwini', 'peppers', 'red', 'spice', null, 0],
  ['ezulwini-spice', 'spices-seasonings', 'Garlic Powder (2kg)', '2kg', 230, 255, 1, 1, 90, null, 'Ezulwini', 'pouch', 'sand', 'spice', null, 0],
  ['ezulwini-spice', 'spices-seasonings', 'Ground Cinnamon (1kg)', '1kg', 195, 220, 1, 1, 75, null, 'Ezulwini', 'spice', 'cocoa', 'spice', null, 0],
  ['ezulwini-spice', 'spices-seasonings', 'Mixed Herbs (1kg)', '1kg', 145, 165, 1, 1, 100, null, 'Ezulwini', 'leafy', 'green', 'spice', null, 0],
  ['manzini-wholesale', 'spices-seasonings', 'Table Salt (25kg)', '25kg bag', 185, 205, 1, 1, 210, null, 'Manzini', 'spice', 'slate', 'spice', null, 0],
  // Beverages
  ['manzini-wholesale', 'beverages-drinks', 'Spring Water (500ml × 24)', '24 pack', 128, 148, 2, 1, 640, null, 'Manzini', 'water', 'blue', 'bottle', 'Best seller', 1],
  ['manzini-wholesale', 'beverages-drinks', 'Sparkling Water (500ml × 24)', '24 pack', 185, 210, 2, 1, 320, null, 'Manzini', 'beer', 'teal', 'bottle', null, 0],
  ['manzini-wholesale', 'beverages-drinks', 'Fruit Juice (1L × 12)', '12 pack', 245, 280, 1, 1, 280, null, 'Manzini', 'juice', 'orange', 'bottle', null, 0],
  ['manzini-wholesale', 'beverages-drinks', 'Guava Juice (20L bulk)', '20L can', 385, 430, 1, 1, 90, null, 'Manzini', 'juice', 'rose', 'drop', 'Bulk deal', 0],
  ['lihle', 'beverages-drinks', 'Cold Brew Coffee (1L × 6)', '6 pack', 330, 375, 1, 1, 70, null, 'Manzini', 'coffee', 'cocoa', 'coffee', null, 0],
  ['manzini-wholesale', 'beverages-drinks', 'Rooibos Tea (1000 bags)', '1000 bags', 295, 330, 1, 1, 130, null, 'Manzini', 'coffee', 'red', 'coffee', null, 0],
  ['manzini-wholesale', 'beverages-drinks', 'Energy Drink (250ml × 24)', '24 pack', 285, 320, 2, 1, 200, null, 'Manzini', 'beer', 'lime', 'bottle', null, 0],
  ['lihle', 'beverages-drinks', 'Craft Ginger Beer (330ml × 24)', '24 pack', 315, 360, 1, 1, 110, null, 'Manzini', 'beer', 'gold', 'bottle', 'Farm fresh', 0],
  ['manzini-wholesale', 'beverages-drinks', 'Green Tea (500 bags)', '500 bags', 185, 210, 1, 1, 95, null, 'Manzini', 'coffee', 'green', 'coffee', null, 0],
  ['manzini-wholesale', 'beverages-drinks', 'Litchi Juice (1L × 12)', '12 pack', 258, 290, 1, 1, 140, null, 'Manzini', 'juice', 'rose', 'bottle', null, 0],
  ['manzini-wholesale', 'beverages-drinks', 'Drinking Chocolate (1kg × 6)', '6 pack', 345, 390, 1, 1, 85, null, 'Manzini', 'coffee', 'cocoa', 'cup', null, 0],
  // Processed & pantry
  ['manzini-wholesale', 'processed-foods', 'Tinned Tomatoes (410g × 12)', '12 pack', 168, 190, 2, 1, 380, null, 'Manzini', 'can', 'red', 'can', null, 0],
  ['manzini-wholesale', 'processed-foods', 'Baked Beans (410g × 24)', '24 pack', 285, 320, 1, 1, 260, null, 'Manzini', 'grainbag', 'orange', 'can', null, 0],
  ['manzini-wholesale', 'processed-foods', 'Sweetcorn Kernels (410g × 24)', '24 pack', 295, 330, 1, 1, 240, null, 'Manzini', 'can', 'gold', 'can', null, 0],
  ['manzini-wholesale', 'processed-foods', 'Spaghetti (10kg bulk)', '10kg', 245, 275, 1, 1, 190, null, 'Manzini', 'pouch', 'sand', 'pouch', 'Bulk deal', 0],
  ['siphofaneni', 'processed-foods', 'Dried Kidney Beans (25kg)', '25kg bag', 720, 800, 1, 1, 120, null, 'Big Bend', 'grainbag', 'red', 'grain', null, 0],
  ['manzini-wholesale', 'processed-foods', 'Potato Crisps (60 pack carton)', '60 pack', 320, 360, 1, 1, 200, null, 'Manzini', 'pouch', 'gold', 'bag', null, 0],
  ['manzini-wholesale', 'processed-foods', 'Popcorn Kernels (10kg)', '10kg', 265, 295, 1, 1, 110, null, 'Manzini', 'pouch', 'sand', 'grain', null, 0],
  ['manzini-wholesale', 'processed-foods', 'Instant Noodles (60 pack)', '60 pack', 285, 320, 1, 1, 300, null, 'Manzini', 'pouch', 'orange', 'pouch', null, 0],
  ['shiselweni-millers', 'processed-foods', 'Samp & Beans Mix (10kg)', '10kg bag', 175, 198, 1, 1, 150, null, 'Nhlangano', 'grainbag', 'cocoa', 'grain', null, 0],
  ['manzini-wholesale', 'processed-foods', 'Frozen Mixed Vegetables (10kg)', '10kg box', 395, 440, 1, 1, 90, null, 'Manzini', 'pouch', 'green', 'leaf', null, 0],
  // Honey & preserves
  ['bulembu-honey', 'honey-preserves', 'Raw Wild Honey (1kg)', '1kg jar', 145, 168, 2, 1, 210, null, 'Piggs Peak', 'honey', 'gold', 'honey', 'Best seller', 1],
  ['bulembu-honey', 'honey-preserves', 'Raw Honey Bulk (25kg)', '25kg drum', 2650, 2950, 1, 1, 40, null, 'Piggs Peak', 'honey', 'gold', 'honey', 'Wholesale', 0],
  ['bulembu-honey', 'honey-preserves', 'Strawberry Jam (340g × 12)', '12 pack', 235, 265, 1, 1, 130, null, 'Piggs Peak', 'jar', 'rose', 'honey', null, 0],
  ['lihle', 'honey-preserves', 'Mango Chutney (5kg)', '5kg bucket', 245, 275, 1, 1, 70, null, 'Manzini', 'jar', 'orange', 'jar', null, 0],
  ['lihle', 'honey-preserves', 'Pickled Onions (5kg)', '5kg bucket', 210, 240, 1, 1, 60, null, 'Manzini', 'onion', 'violet', 'jar', null, 0],
  ['bulembu-honey', 'honey-preserves', 'Hot Honey (250g × 6)', '6 pack', 265, 295, 1, 1, 80, null, 'Piggs Peak', 'honey', 'red', 'honey', 'New harvest', 0],
  ['lihle', 'honey-preserves', 'Guava Jam (340g × 12)', '12 pack', 225, 255, 1, 1, 90, null, 'Manzini', 'jar', 'pink', 'honey', null, 0],
  // Farm inputs
  ['simunye-agro', 'farm-supplies', 'Hybrid Maize Seed (10kg)', '10kg bag', 385, 430, 1, 1, 180, null, 'Simunye', 'grainbag', 'lime', 'grain', null, 0],
  ['simunye-agro', 'farm-supplies', 'Tomato Seedlings (1000 tray)', '1000 tray', 275, 310, 1, 1, 120, null, 'Simunye', 'tray', 'green', 'leaf', 'Bulk deal', 0],
  ['simunye-agro', 'farm-supplies', 'NPK Fertilizer (50kg)', '50kg bag', 895, 990, 1, 1, 150, null, 'Simunye', 'sack', 'sand', 'scale', null, 0],
  ['simunye-agro', 'farm-supplies', 'Organic Compost (40kg)', '40kg bag', 165, 190, 2, 1, 260, null, 'Simunye', 'sack', 'cocoa', 'scale', null, 0],
  ['simunye-agro', 'farm-supplies', 'Drip Irrigation Starter Kit', 'kit', 1250, 1400, 1, 1, 45, null, 'Simunye', 'box', 'blue', 'drop', null, 0],
  ['simunye-agro', 'farm-supplies', 'Knapsack Sprayer 16L', 'each', 690, 780, 1, 1, 60, null, 'Simunye', 'sack', 'teal', 'scale', null, 0],
  ['simunye-agro', 'farm-supplies', 'Layers Feed (50kg)', '50kg bag', 485, 535, 1, 1, 190, null, 'Simunye', 'sack', 'gold', 'grain', null, 0],
  ['simunye-agro', 'farm-supplies', 'Shade Net 55% (4m roll)', 'roll', 780, 860, 1, 1, 40, null, 'Simunye', 'sack', 'green', 'leaf', null, 0],
  // Glass packaging
  ['eswatini-glass', 'packaging-glass', '500ml Glass Bottles (×12)', '12 bottles', 165, 190, 2, 1, 420, null, 'Matsapha', 'bottleGlass', 'teal', 'bottleGlass', 'Best seller', 1],
  ['eswatini-glass', 'packaging-glass', '250ml Jam Jars (×24)', '24 jars', 215, 245, 1, 1, 380, null, 'Matsapha', 'jar', 'gold', 'jar', null, 0],
  ['eswatini-glass', 'packaging-glass', '1L Swing-Top Bottles (×6)', '6 bottles', 195, 225, 1, 1, 160, null, 'Matsapha', 'bottleGlass', 'teal', 'bottleGlass', null, 0],
  ['eswatini-glass', 'packaging-glass', '100ml Spice Jars (×48)', '48 jars', 285, 320, 1, 1, 220, null, 'Matsapha', 'spice', 'orange', 'jar', null, 0],
  ['eswatini-glass', 'packaging-glass', '750ml Sauce Bottles (×12)', '12 bottles', 210, 240, 1, 1, 190, null, 'Matsapha', 'bottleGlass', 'red', 'bottleGlass', null, 0],
  ['eswatini-glass', 'packaging-glass', '1L Mason Jars (×12)', '12 jars', 265, 295, 1, 1, 140, null, 'Matsapha', 'jar', 'sand', 'jar', null, 0],
  ['eswatini-glass', 'packaging-glass', 'Honey Jars 500ml (×24)', '24 jars', 245, 275, 1, 1, 170, null, 'Matsapha', 'honey', 'gold', 'honey', null, 0],
  ['eswatini-glass', 'packaging-glass', 'Glass Dropper Bottles (×24)', '24 bottles', 320, 355, 1, 1, 90, null, 'Matsapha', 'bottleGlass', 'violet', 'bottleGlass', null, 0],
  // Plastic packaging
  ['ncaba-packaging', 'packaging-plastic', '500ml PET Bottles + Caps (×100)', '100 bottles', 285, 330, 1, 1, 520, null, 'Matsapha', 'stackbottles', 'blue', 'bottle', 'Best seller', 1],
  ['ncaba-packaging', 'packaging-plastic', '5L HDPE Jerrycans (×12)', '12 cans', 240, 275, 1, 1, 180, null, 'Matsapha', 'buckets', 'blue', 'bottle', null, 0],
  ['ncaba-packaging', 'packaging-plastic', '1L PET Bottles (×100)', '100 bottles', 315, 355, 1, 1, 340, null, 'Matsapha', 'stackbottles', 'teal', 'bottle', null, 0],
  ['ncaba-packaging', 'packaging-plastic', '250ml Squeeze Bottles (×50)', '50 bottles', 195, 225, 1, 1, 260, null, 'Matsapha', 'stackbottles', 'red', 'bottle', null, 0],
  ['ncaba-packaging', 'packaging-plastic', '750ml Deli Containers (×250)', '250 containers', 385, 430, 1, 1, 210, null, 'Matsapha', 'tray', 'slate', 'box', null, 0],
  ['ncaba-packaging', 'packaging-plastic', 'Berry Punnets (×500)', '500 punnets', 420, 470, 1, 1, 150, null, 'Matsapha', 'punnet', 'rose', 'box', null, 0],
  ['ncaba-packaging', 'packaging-plastic', '20L Buckets with Lids (×10)', '10 buckets', 275, 305, 1, 1, 130, null, 'Matsapha', 'buckets', 'teal', 'box', null, 0],
  ['ncaba-packaging', 'packaging-plastic', 'Takeaway Meal Boxes (×500)', '500 boxes', 465, 520, 1, 1, 240, null, 'Matsapha', 'tray', 'sand', 'box', 'Bulk deal', 0],
  // Bags & wraps
  ['ncaba-packaging', 'bags-wraps', 'Kraft Paper Bags (×500)', '500 bags', 385, 425, 1, 1, 320, null, 'Matsapha', 'kraft', 'sand', 'bag', 'Best seller', 1],
  ['ncaba-packaging', 'bags-wraps', 'Biodegradable Bags (×1000)', '1000 bags', 295, 340, 1, 1, 260, null, 'Matsapha', 'kraft', 'green', 'bag', null, 0],
  ['ncaba-packaging', 'bags-wraps', 'Reusable Shopping Bags (×250)', '250 bags', 725, 795, 1, 1, 90, null, 'Matsapha', 'kraft', 'blue', 'bag', null, 0],
  ['ncaba-packaging', 'bags-wraps', 'Cling Film (12 rolls)', '12 rolls', 245, 275, 1, 1, 180, null, 'Matsapha', 'film', 'blue', 'roll', null, 0],
  ['ncaba-packaging', 'bags-wraps', 'Shrink Wrap Rolls (×6)', '6 rolls', 340, 380, 1, 1, 110, null, 'Matsapha', 'film', 'slate', 'roll', null, 0],
  ['ncaba-packaging', 'bags-wraps', 'Vacuum Sealer Bags (×1000)', '1000 bags', 560, 620, 1, 1, 120, null, 'Matsapha', 'kraft', 'teal', 'bag', null, 0],
  ['ncaba-packaging', 'bags-wraps', 'Bread Bags (×1000)', '1000 bags', 265, 295, 1, 1, 190, null, 'Matsapha', 'kraft', 'gold', 'bag', null, 0],
  ['ncaba-packaging', 'bags-wraps', 'Courier Mailers (×500)', '500 mailers', 425, 480, 1, 1, 140, null, 'Matsapha', 'kraft', 'violet', 'bag', null, 0],
  // Private label
  ['imbali-studio', 'private-label', 'Own-Brand Hot Sauce Launch Pack (500 units)', '500 units', 12500, 14500, 1, 1, 12, null, 'Mbabane', 'labels', 'red', 'label', 'Brand studio', 1],
  ['imbali-studio', 'private-label', 'Own-Brand Honey Jar Kit (500 units)', '500 units', 9850, 11200, 1, 1, 15, null, 'Mbabane', 'honey', 'gold', 'honey', null, 0],
  ['imbali-studio', 'private-label', 'Custom Label Design + Print (1000)', '1000 labels', 2450, 2850, 1, 1, 25, null, 'Mbabane', 'labels', 'violet', 'label', null, 0],
  ['imbali-studio', 'private-label', 'Own-Brand Spice Range Starter (300)', '300 units', 6750, 7600, 1, 1, 10, null, 'Mbabane', 'spice', 'orange', 'spice', null, 0],
  ['imbali-studio', 'private-label', 'ALZY Brand Studio — Full Package', 'project', 25000, null, 1, 1, 8, null, 'Mbabane', 'labels', 'pink', 'star', 'Popular', 0]
];

const VIDEO_COUPONS = [
  { code: 'FARM15', title: '15% off Ngwempisi Valley Farms', description: 'Watch the Eswatini Farmers Market feature to the end and unlock 15% off every Ngwempisi Valley Farms product.', type: 'percent', value: 15, min: 15000, seller: 'ngwempisi', youtube: '4hsmCF3KqZc', videoTitle: 'Eswatini Farmers Market feat. Cedric Cappuccino', duration: 141, perUser: 1, maxUses: 500 },
  { code: 'GROW20', title: '20% off Malkerns Fresh Co-op', description: 'A co-op of 42 growers feeding the nation. Watch to the end for 20% off your first co-op order.', type: 'percent', value: 20, min: 25000, seller: 'malkerns-coop', youtube: 'UM3JEYDSNbA', videoTitle: 'Enarfa Eswatini — Feeding the Nation', duration: 240, perUser: 1, maxUses: 400 },
  { code: 'CHILLI10', title: '10% off Lihle Sauces & Preserves', description: 'Short film on agribusiness in Eswatini. Finish it and get 10% off small-batch sauces.', type: 'percent', value: 10, min: 0, seller: 'lihle', youtube: '197LLvlqBow', videoTitle: 'Agribusiness TV Eswatini', duration: 11, perUser: 1, maxUses: 1000 },
  { code: 'PANTRY12', title: '12% off Manzini Wholesale pantry', description: 'Learn how to store produce so nothing goes to waste, then take 12% off pantry staples.', type: 'percent', value: 12, min: 20000, seller: 'manzini-wholesale', youtube: 'gY7o0zHZ0RU', videoTitle: 'Stop Wasting Food! 10 Storage Tricks That Actually Help', duration: 211, perUser: 1, maxUses: 600 },
  { code: 'PACK15', title: '15% off PET bottles — Ncaba Packaging', description: 'Thinking of bottling your own brand? Watch the full packaging masterclass and save 15%.', type: 'percent', value: 15, min: 0, product: '500ml PET Bottles + Caps (×100)', youtube: 'NeJJkAlnqd0', videoTitle: 'How to Start a Profitable Food Packaging Business in Africa', duration: 700, perUser: 1, maxUses: 300 },
  { code: 'FRESH50', title: 'E50 off orders over E500', description: 'Watch the short smallholder farming report and unlock a flat E50 off your grocery run.', type: 'fixed', value: 5000, min: 50000, youtube: 'OyLZjUT3PPY', videoTitle: 'Small-holder farmers benefit from consolidated farming', duration: 76, perUser: 1, maxUses: 2000 },
  { code: 'RESTAURANT8', title: '8% off Eswatini Beef & Lamb', description: 'For food-service buyers: watch the full video to unlock wholesale meat pricing.', type: 'percent', value: 8, min: 100000, seller: 'beef-lamb', youtube: 'HBPpxCf7MxQ', videoTitle: 'Starting a food trailer business in South Africa', duration: 196, perUser: 1, maxUses: 300 },
  { code: 'AGRO12', title: '12% off Simunye Agro Supplies', description: 'Watch the smallholder challenges report and save on inputs for your next season.', type: 'percent', value: 12, min: 30000, seller: 'simunye-agro', youtube: 'sq_Ix9bjOW8', videoTitle: 'Challenges for Smallholder Farmers', duration: 141, perUser: 1, maxUses: 250 }
];

const PROMO_COUPONS = [
  { code: 'WELCOME10', title: 'Welcome to ALZY — 10% off', description: 'One-click coupon for new accounts. Minimum order E150.', type: 'percent', value: 10, min: 15000, maxUses: 5000, perUser: 1 },
  { code: 'BULK250', title: 'E250 off wholesale orders over E2,500', description: 'For supermarkets, restaurants and wholesalers restocking in volume.', type: 'fixed', value: 25000, min: 250000, maxUses: 800, perUser: 2 },
  { code: 'GROCERY75', title: 'E75 off monthly groceries over E600', description: 'Build your monthly food basket and save E75 at checkout.', type: 'fixed', value: 7500, min: 60000, maxUses: 3000, perUser: 1 },
  { code: 'HONEY15', title: '15% off Bulembu Honey Co', description: 'Raw, unheated honey from Bulembu forest hives.', type: 'percent', value: 15, min: 10000, seller: 'bulembu-honey', maxUses: 400, perUser: 1 },
  { code: 'BRAAI20', title: '20% off Ezulwini Spice House', description: 'Stock up on braai blends, paprika and pepper.', type: 'percent', value: 20, min: 20000, seller: 'ezulwini-spice', maxUses: 350, perUser: 1 },
  { code: 'MONTHLY12', title: '12% off Manzini Wholesale', description: 'Everyday low prices, made lower for the month.', type: 'percent', value: 12, min: 40000, seller: 'manzini-wholesale', maxUses: 900, perUser: 3 }
];

const USERS = [
  { name: 'Alzy Admin', email: 'admin@alzy.co.sz', password: 'Admin123!', role: 'admin', region: 'Mbabane', phone: '+268 7600 0001' },
  { name: 'Thandiwe Dlamini', email: 'thandi@example.com', password: 'Alzy123!', role: 'buyer', region: 'Mbabane', phone: '+268 7612 3456' },
  { name: 'Sipho Maseko', email: 'sipho@example.com', password: 'Alzy123!', role: 'buyer', region: 'Manzini', phone: '+268 7645 8890' },
  { name: 'Mbabane Grill House', email: 'orders@grillhouse.co.sz', password: 'Alzy123!', role: 'buyer', region: 'Mbabane', phone: '+268 2404 1122' },
  { name: 'Ngwempisi Farms', email: 'farm@ngwempisi.co.sz', password: 'Farmer123!', role: 'farmer', region: 'Malkerns', phone: '+268 7633 2211' },
  { name: 'Manzini Wholesale', email: 'supply@manziniwholesale.co.sz', password: 'Supplier123!', role: 'supplier', region: 'Manzini', phone: '+268 2505 7788' }
];

function seed() {
  const db = connect();
  if (!force) {
    const n = db.prepare('SELECT count(*) AS n FROM products').get().n;
    if (n > 0) { console.log(`ALZY already seeded (${n} products). Use "npm run reset" to rebuild.`); return; }
  } else {
    const tables = ['revenue_ledger', 'logistics', 'payments', 'order_items', 'orders', 'messages', 'threads', 'favorites', 'brand_projects', 'subscriptions', 'reviews', 'coupon_claims', 'coupons', 'products', 'categories', 'sellers', 'sessions', 'users'];
    db.pragma('foreign_keys = OFF');
    for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
    db.prepare("DELETE FROM sqlite_sequence").run();
    db.pragma('foreign_keys = ON');
  }

  transaction(() => {
    /* users */
    const insUser = db.prepare('INSERT INTO users (name,email,password_hash,role,phone,region) VALUES (?,?,?,?,?,?)');
    const userIds = {};
    for (const u of USERS) {
      const info = insUser.run(u.name, u.email, hashPassword(u.password), u.role, u.phone, u.region);
      userIds[u.email] = info.lastInsertRowid;
    }

    /* categories */
    const insCat = db.prepare('INSERT INTO categories (slug,name,icon,hue,kind,sort) VALUES (?,?,?,?,?,?)');
    const catIds = {};
    CATEGORIES.forEach(([slug, name, icon, hue, kind], i) => {
      const r = insCat.run(slug, name, icon, hue, kind, i);
      catIds[slug] = r.lastInsertRowid;
    });

    /* sellers */
    const insSeller = db.prepare(`INSERT INTO sellers (user_id,kind,name,slug,tagline,description,region,hue,plan,plan_renews,verified,rating,rating_count,orders_count,since,payout_note)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const sellerIds = {};
    for (const s of SELLERS) {
      const sellerUsers = { ngwempisi: 'farm@ngwempisi.co.sz', 'manzini-wholesale': 'supply@manziniwholesale.co.sz' };
      const uid = sellerUsers[s.key] ? userIds[sellerUsers[s.key]] : null;
      const r = insSeller.run(
        uid || null, s.kind, s.name, s.key, s.tagline, s.description, s.region, s.hue,
        s.plan, s.plan === 'free' ? null : d(30), s.verified, s.rating, s.rating_count,
        Math.round(80 + s.rating_count * 1.6), s.since,
        s.kind === 'farm' ? 'Paid out weekly · MoMo Business' : 'Paid out weekly · EFT'
      );
      sellerIds[s.key] = r.lastInsertRowid;
    }

    /* products */
    const insProduct = db.prepare(`INSERT INTO products
      (slug,seller_id,category_id,name,description,unit,price,compare_price,moq,step,stock,harvest_date,region,vessel,hue,icon,badge,featured,featured_until,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const productIds = {};
    const featuredSlots = PRODUCTS.filter(p => p[15] === 1).length;
    PRODUCTS.forEach((p, idx) => {
      const [sellerKey, catSlug, name, unit, priceE, compareE, moq, step, stock, harvestDays, region, vessel, hue, icon, badge, featured] = p;
      const slug = slugify(name) + '-' + (idx + 1);
      const desc = `Sold by ${SELLERS.find(s => s.key === sellerKey).name}. ${unit} pricing${moq > 1 ? `, minimum order ${moq} ${unit}${moq > 1 ? 's' : ''}` : ''}. ${harvestDays !== null ? 'Harvest scheduled ' + d(harvestDays) + '.' : 'Available from stock.'} Cold-chain and consolidated delivery available through ALZY logistics.`;
      const r = insProduct.run(
        slug, sellerIds[sellerKey], catIds[catSlug], name, desc, unit,
        Math.round(priceE * 100), compareE ? Math.round(compareE * 100) : null,
        moq, step, stock, harvestDays !== null ? d(harvestDays) : null, region,
        vessel, hue, icon, badge || null, featured ? 1 : 0,
        featured ? d(10 + (idx % 14)) : null, 'active'
      );
      productIds[name] = r.lastInsertRowid;
    });

    /* coupons */
    const insCoupon = db.prepare(`INSERT INTO coupons (code,title,description,type,value,min_subtotal,product_id,seller_id,kind,youtube_id,video_title,duration,max_uses,per_user,expires_at,active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const couponIds = {};
    for (const c of VIDEO_COUPONS) {
      const r = insCoupon.run(c.code, c.title, c.description, c.type, c.value, c.min,
        c.product ? productIds[c.product] : null, c.seller ? sellerIds[c.seller] : null, 'video',
        c.youtube, c.videoTitle, c.duration, c.maxUses, c.perUser, d(60), 1);
      couponIds[c.code] = r.lastInsertRowid;
    }
    for (const c of PROMO_COUPONS) {
      const r = insCoupon.run(c.code, c.title, c.description, c.type, c.value, c.min,
        null, c.seller ? sellerIds[c.seller] : null, 'promo', null, null, 0, c.maxUses, c.perUser, d(45), 1);
      couponIds[c.code] = r.lastInsertRowid;
    }

    /* demo claims for the demo buyer */
    const demoId = userIds['thandi@example.com'];
    const insClaim = db.prepare(`INSERT INTO coupon_claims (coupon_id,user_id,status,watched_seconds,liked,started_at,earned_at) VALUES (?,?,?,?,?,?,?)`);
    insClaim.run(couponIds['FARM15'], demoId, 'earned', 141, 1, dt(-3, 10), dt(-3, 10));
    insClaim.run(couponIds['WELCOME10'], demoId, 'earned', 0, 0, dt(-20, 8), dt(-20, 8));
    // mark WELCOME10 as used by the demo order below
    insClaim.run(couponIds['FRESH50'], demoId, 'earned', 76, 1, dt(-1, 18), dt(-1, 18));

    /* reviews */
    const insReview = db.prepare('INSERT INTO reviews (product_id,user_id,rating,comment,created_at) VALUES (?,?,?,?,?)');
    const reviewSeeds = [
      ['Roma Tomatoes', demoId, 5, 'Firm, deep red and graded properly. My restaurant uses 40kg a week and quality has been consistent.', dt(-12)],
      ['Whole Chickens (10 × 1.2kg)', demoId, 5, 'Fresh, never frozen, and the cold chain held all the way to Mbabane.', dt(-9)],
      ['Maize Meal (25kg)', userIds['sipho@example.com'], 4, 'Great price for 25kg. Delivery took a day longer than promised.', dt(-14)],
      ['Raw Wild Honey (1kg)', demoId, 5, 'Best honey I have bought in Eswatini. The raw texture is perfect.', dt(-6)],
      ['500ml PET Bottles + Caps (×100)', userIds['sipho@example.com'], 5, 'Started my own chilli sauce brand with these. Caps fit perfectly.', dt(-4)],
      ['Beef Fillet', userIds['orders@grillhouse.co.sz'], 5, 'Restaurant grade. Trim is clean and the price beats our old butcher.', dt(-7)],
      ['Kraft Paper Bags (×500)', demoId, 4, 'Sturdy bags, nice finish. Wish the handles were slightly thicker.', dt(-2)],
      ['Free-range Eggs (30 tray)', demoId, 5, 'Zero cracked eggs in the last three trays. Excellent.', dt(-1)]
    ];
    for (const [name, uid, rating, comment, when] of reviewSeeds) {
      if (productIds[name]) insReview.run(productIds[name], uid, rating, comment, when);
    }

    /* subscriptions + ledger */
    const insSub = db.prepare('INSERT INTO subscriptions (seller_id,plan,price,status,started_at,renews_at) VALUES (?,?,?,?,?,?)');
    const insLedger = db.prepare('INSERT INTO revenue_ledger (kind,ref_type,ref_id,seller_id,amount,note,created_at) VALUES (?,?,?,?,?,?,?)');
    for (const s of SELLERS) {
      if (s.plan === 'free') continue;
      const price = config.revenue.subscriptions[s.plan].price;
      const started = dt(-90 - Math.floor(Math.random() * 120), 8);
      insSub.run(sellerIds[s.key], s.plan, price, 'active', started, d(30));
      for (let m = 0; m < 3; m++) {
        insLedger.run('subscription', 'seller', sellerIds[s.key], sellerIds[s.key], price, `${config.revenue.subscriptions[s.plan].label} plan — monthly`, dt(-m * 30 - 2, 6));
      }
    }

    /* featured listings purchased */
    const featuredProducts = PRODUCTS.filter(p => p[15] === 1);
    for (const p of featuredProducts) {
      const pid = productIds[p[2]];
      const seller = SELLERS.find(s => s.key === p[0]);
      insLedger.run('featured', 'product', pid, sellerIds[seller.key], config.revenue.featured.price, `Featured listing — ${p[2]}`, dt(-3, 7));
    }

    /* brand projects */
    const insBrand = db.prepare('INSERT INTO brand_projects (user_id,brand_name,product_type,vessel,colorway,quantity,unit_price,setup_fee,notes,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    insBrand.run(demoId, 'Thandi’s Kitchen', 'Hot sauce', 'bottle', 'red', 500, 180, 250000, 'Own-brand chilli sauce for Spar and local delis.', 'quoted', dt(-8));
    insBrand.run(userIds['sipho@example.com'], 'Maseko Honey', 'Raw honey', 'jar', 'gold', 1000, 165, 250000, 'Honey from my hives in Manzini, retail jars.', 'in_production', dt(-22));
    insLedger.run('brand', 'project', 1, null, 250000, 'Brand Studio setup fee — Thandi’s Kitchen', dt(-8));
    insLedger.run('brand', 'project', 2, null, 250000, 'Brand Studio setup fee — Maseko Honey', dt(-22));

    /* demo orders with commissions + logistics */
    const insOrder = db.prepare(`INSERT INTO orders (code,user_id,status,subtotal,discount_total,delivery_fee,commission_total,total,payment_method,payment_status,payment_ref,delivery_region,delivery_address,delivery_phone,notes,coupon_codes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insItem = db.prepare(`INSERT INTO order_items (order_id,product_id,seller_id,name,unit,qty,unit_price,line_total,discount,commission,coupon_code,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insPay = db.prepare('INSERT INTO payments (order_id,user_id,method,amount,status,reference,created_at) VALUES (?,?,?,?,?,?,?)');
    const insLogistics = db.prepare('INSERT INTO logistics (order_id,region,km,fee,carrier,status,scheduled_for,created_at) VALUES (?,?,?,?,?,?,?,?)');

    const orderSeeds = [
      { buyer: 'thandi@example.com', days: -18, region: 'Mbabane', method: 'momo', status: 'delivered',
        items: [['Roma Tomatoes', 20], ['Free-range Eggs (30 tray)', 2], ['Raw Wild Honey (1kg)', 2], ['Maize Meal (25kg)', 1]], coupon: 'WELCOME10' },
      { buyer: 'thandi@example.com', days: -6, region: 'Mbabane', method: 'card', status: 'delivered',
        items: [['Whole Chickens (10 × 1.2kg)', 1], ['Baby Spinach', 4], ['Carrots (5kg)', 2]], coupon: 'FARM15' },
      { buyer: 'thandi@example.com', days: -1, region: 'Mbabane', method: 'momo', status: 'processing',
        items: [['Kraft Paper Bags (×500)', 1], ['500ml PET Bottles + Caps (×100)', 2], ['Strawberry Jam (340g × 12)', 1]], coupon: 'FRESH50' },
      { buyer: 'orders@grillhouse.co.sz', days: -12, region: 'Mbabane', method: 'eft', status: 'delivered',
        items: [['Beef Fillet', 25], ['Whole Chickens (10 × 1.2kg)', 6], ['Tomato Sauce (1L × 12)', 4], ['Braai Spice (10kg)', 2]], coupon: 'BULK250' },
      { buyer: 'orders@grillhouse.co.sz', days: -3, region: 'Mbabane', method: 'eft', status: 'dispatched',
        items: [['Beef Carcass Quarters (bulk)', 120], ['Curry Powder (5kg)', 3], ['Fine Green Beans', 15]], coupon: 'RESTAURANT8' },
      { buyer: 'sipho@example.com', days: -9, region: 'Manzini', method: 'cod', status: 'delivered',
        items: [['Maize Meal (25kg)', 2], ['Sugar Beans (10kg)', 1], ['Long Grain Rice (25kg)', 1], ['Spring Water (500ml × 24)', 3]], coupon: null },
      { buyer: 'sipho@example.com', days: -2, region: 'Manzini', method: 'momo', status: 'paid',
        items: [['Braai Spice (10kg)', 1], ['Chicken Portions (10kg)', 2], ['Craft Ginger Beer (330ml × 24)', 2]], coupon: 'BRAAI20' },
      { buyer: 'orders@grillhouse.co.sz', days: -45, region: 'Mbabane', method: 'card', status: 'delivered',
        items: [['Beef Mince (5kg)', 8], ['Pork Chops (10kg)', 2], ['Mayonnaise (5L)', 3]], coupon: null }
    ];

    let orderSeq = 1000;
    for (const o of orderSeeds) {
      const uid = userIds[o.buyer];
      let subtotal = 0, commission = 0, discountTotal = 0;
      const lines = o.items.map(([name, qty]) => {
        const p = db.prepare('SELECT * FROM products WHERE name = ?').get(name);
        const lineTotal = p.price * qty;
        subtotal += lineTotal;
        return { p, qty, lineTotal };
      });
      if (o.coupon) {
        const c = db.prepare('SELECT * FROM coupons WHERE code = ?').get(o.coupon);
        const eligibleSeller = c.seller_id;
        const elig = lines.filter(l => !eligibleSeller || l.p.seller_id === eligibleSeller);
        const eligSubtotal = elig.reduce((n, l) => n + l.lineTotal, 0);
        discountTotal = c.type === 'percent' ? Math.round(eligSubtotal * c.value / 100) : Math.min(c.value, eligSubtotal);
        lines.forEach(l => {
          const share = elig.includes(l) && eligSubtotal > 0 ? Math.round(discountTotal * (l.lineTotal / eligSubtotal)) : 0;
          l.discount = share;
          l.commission = Math.round((l.lineTotal - share) * (config.revenue.commissionByTier[db.prepare('SELECT plan FROM sellers WHERE id=?').get(l.p.seller_id).plan] || 0.06));
          commission += l.commission;
        });
      } else {
        lines.forEach(l => {
          l.discount = 0;
          const plan = db.prepare('SELECT plan FROM sellers WHERE id=?').get(l.p.seller_id).plan;
          l.commission = Math.round(l.lineTotal * (config.revenue.commissionByTier[plan] || 0.06));
          commission += l.commission;
        });
      }
      const region = config.deliveryRegions.find(r => r.name === o.region);
      const km = region ? region.km : 30;
      const deliveryFee = config.revenue.logistics.baseFee + Math.max(0, km - config.revenue.logistics.freeKm) * config.revenue.logistics.perKm;
      const total = subtotal - discountTotal + deliveryFee;
      const code = `ALZ-${(orderSeq++).toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const created = dt(o.days, 10 + (orderSeq % 6));
      const r = insOrder.run(code, uid, o.status, subtotal, discountTotal, deliveryFee, commission, total,
        o.method, o.method === 'cod' ? 'on_delivery' : 'paid', 'REF-' + code, o.region,
        'Plot 42, Mbabane', db.prepare('SELECT phone FROM users WHERE id=?').get(uid).phone, null,
        o.coupon ? JSON.stringify([o.coupon]) : null, created, created);
      const orderId = r.lastInsertRowid;
      for (const l of lines) {
        insItem.run(orderId, l.p.id, l.p.seller_id, l.p.name, l.p.unit, l.qty, l.p.price, l.lineTotal, l.discount, l.commission, o.coupon, o.status === 'delivered' ? 'delivered' : o.status);
        insLedger.run('commission', 'order', orderId, l.p.seller_id, l.commission, `Commission — ${l.p.name}`, created);
      }
      insPay.run(orderId, uid, o.method, total, o.method === 'cod' ? 'pending' : 'paid', 'REF-' + code, created);
      insLogistics.run(orderId, o.region, km, deliveryFee, 'ALZY Logistics', o.status === 'delivered' ? 'delivered' : (o.status === 'dispatched' ? 'in_transit' : 'scheduled'), d(o.days + 1), created);
      insLedger.run('logistics', 'order', orderId, null, deliveryFee, `Logistics coordination — ${o.region}`, created);
    }

    /* messages between demo buyer and a farm */
    const thread = db.prepare('INSERT INTO threads (product_id,buyer_id,seller_id,subject,created_at) VALUES (?,?,?,?,?)')
      .run(productIds['Roma Tomatoes'], demoId, sellerIds['ngwempisi'], 'Weekly tomato supply for a restaurant', dt(-5, 14));
    db.prepare('INSERT INTO messages (thread_id,sender_id,body,created_at) VALUES (?,?,?,?)')
      .run(thread.lastInsertRowid, demoId, 'Hi! Can you supply 40kg of Roma tomatoes every Tuesday and Friday? What is your best price for a monthly contract?', dt(-5, 14));
    db.prepare('INSERT INTO messages (thread_id,sender_id,body,created_at) VALUES (?,?,?,?)')
      .run(thread.lastInsertRowid, userIds['farm@ngwempisi.co.sz'], 'Sawubona Thandi. Yes, we can commit 40kg twice a week. On a monthly contract we can hold E17.50/kg and include cold-chain delivery to Mbabane. Shall I set up the standing order?', dt(-5, 16));

    console.log('ALZY seeded:', {
      users: USERS.length,
      sellers: SELLERS.length,
      categories: CATEGORIES.length,
      products: PRODUCTS.length,
      coupons: VIDEO_COUPONS.length + PROMO_COUPONS.length,
      orders: orderSeeds.length
    });
  });
}

seed();
