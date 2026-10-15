import { config } from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

config({ path: join(process.cwd(), '.env.local') });

const NEON_URL =
  process.env.DATABASE_URL ??
  'postgresql://neondb_owner:npg_VTof5LD7OmUX@ep-frosty-lab-a16pu6w4-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require';

const pool = new Pool({
  connectionString: NEON_URL,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🔧 Running schema migrations...');
    const schema = readFileSync(join(process.cwd(), 'scripts', 'schema.sql'), 'utf-8');
    await client.query(schema);
    console.log('✅ Schema ready.');

    console.log('\n👤 Seeding users...');
    const adminHash   = await bcrypt.hash('123456789', 10);
    const waiterHash  = await bcrypt.hash('waiter123', 10);
    const managerHash = await bcrypt.hash('manager123', 10);

    await client.query(`
      INSERT INTO users (name, email, password_hash, role) VALUES
        ('Jayanth Murala',  'jayanthmurala@gmail.com', $1, 'manager'),
        ('Arjun Kumar',     'waiter@demo.com',          $2, 'waiter'),
        ('Priya Sharma',    'manager@demo.com',         $3, 'manager'),
        ('Rahul Verma',     'waiter2@demo.com',         $2, 'waiter')
      ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            role          = EXCLUDED.role,
            name          = EXCLUDED.name
    `, [adminHash, waiterHash, managerHash]);
    console.log('  ✓ jayanthmurala@gmail.com  (manager, pw: 123456789)');
    console.log('  ✓ waiter@demo.com          (waiter,  pw: waiter123)');
    console.log('  ✓ manager@demo.com         (manager, pw: manager123)');

    console.log('\n🍳 Seeding kitchens...');
    await client.query(`
      INSERT INTO kitchens (id, name, description) VALUES
        (1, 'Main Kitchen',    'North Indian, Biryanis, Tandoor'),
        (2, 'Chinese Kitchen', 'Chinese, Noodles, Rice'),
        (3, 'Fast Food',       'Snacks, Beverages, Quick Bites')
      ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, description = EXCLUDED.description
    `);
    // Reset sequence
    await client.query(`SELECT setval('kitchens_id_seq', (SELECT MAX(id) FROM kitchens))`);
    console.log('  ✓ 3 kitchens created');

    console.log('\n🪑 Seeding tables...');
    for (let i = 1; i <= 12; i++) {
      const capacity = i <= 4 ? 2 : i <= 8 ? 4 : 6;
      await client.query(`
        INSERT INTO tables (name, capacity, status) VALUES ($1, $2, 'available')
        ON CONFLICT (name) DO UPDATE SET capacity = EXCLUDED.capacity
      `, [`T${i}`, capacity]);
    }
    console.log('  ✓ 12 tables (T1–T12) created');

    console.log('\n🍽️  Seeding menu items...');
    const menuItems: [string, string, number, string, number][] = [
      // ── Main Kitchen ──────────────────────────────────────────
      // Starters
      ['Chicken Tikka',              'Marinated chicken pieces from tandoor',                     220, 'Starters',   1],
      ['Paneer Tikka',               'Marinated cottage cheese from tandoor',                     200, 'Starters',   1],
      ['Veg Seekh Kebab',            'Spiced vegetable skewers from tandoor',                     180, 'Starters',   1],
      ['Soup of the Day',            "Chef's special fresh soup",                                 120, 'Starters',   1],
      // Mains
      ['Chicken Biryani',            'Aromatic basmati rice cooked with tender chicken pieces',   320, 'Mains',      1],
      ['Mutton Biryani',             'Slow-cooked mutton with fragrant spices and basmati',       380, 'Mains',      1],
      ['Veg Biryani',                'Fragrant rice with seasonal vegetables and spices',         260, 'Mains',      1],
      ['Butter Chicken',             'Tender chicken in velvety butter-tomato gravy',             300, 'Mains',      1],
      ['Paneer Tikka Masala',        'Grilled cottage cheese in rich tomato-cream sauce',         280, 'Mains',      1],
      ['Dal Makhani',                'Creamy black lentils slow-cooked overnight',                220, 'Mains',      1],
      ['Palak Paneer',               'Cottage cheese in smooth spinach gravy',                    240, 'Mains',      1],
      ['Tandoori Chicken (Half)',    'Marinated chicken grilled in clay oven',                    350, 'Mains',      1],
      // Breads
      ['Butter Naan',                'Soft leavened bread with butter',                            40, 'Breads',     1],
      ['Garlic Naan',                'Naan topped with garlic and butter',                         50, 'Breads',     1],
      ['Tandoori Roti',              'Whole wheat bread from tandoor',                             30, 'Breads',     1],
      ['Paratha',                    'Layered whole wheat flatbread',                              45, 'Breads',     1],
      // Desserts
      ['Gulab Jamun (2 pcs)',        'Soft milk dumplings in sugar syrup',                         80, 'Desserts',   1],
      ['Rasgulla (2 pcs)',           'Spongy cottage cheese balls in syrup',                       70, 'Desserts',   1],
      ['Gajar Ka Halwa',             'Carrot pudding with dry fruits',                            110, 'Desserts',   1],
      // ── Chinese Kitchen ───────────────────────────────────────
      ['Hot & Sour Soup',            'Classic Indo-Chinese hot and sour broth',                   120, 'Chinese',    2],
      ['Spring Rolls (4 pcs)',        'Crispy vegetable spring rolls',                             160, 'Chinese',    2],
      ['Veg Hakka Noodles',          'Stir-fried noodles with fresh vegetables',                  180, 'Chinese',    2],
      ['Chicken Hakka Noodles',      'Stir-fried noodles with chicken',                           220, 'Chinese',    2],
      ['Veg Fried Rice',             'Wok-tossed rice with vegetables',                           160, 'Chinese',    2],
      ['Chicken Fried Rice',         'Wok-tossed rice with chicken',                              200, 'Chinese',    2],
      ['Veg Manchurian (Gravy)',     'Crispy veg balls in tangy Indo-Chinese sauce',              180, 'Chinese',    2],
      ['Chicken Manchurian',         'Crispy chicken in Indo-Chinese sauce',                      220, 'Chinese',    2],
      // ── Fast Food ─────────────────────────────────────────────
      ['French Fries',               'Crispy golden fries with dipping sauce',                    120, 'Snacks',     3],
      ['Onion Rings',                'Battered and fried onion rings',                            130, 'Snacks',     3],
      ['Veg Burger',                 'Crispy patty with fresh vegetables',                        150, 'Snacks',     3],
      ['Chicken Burger',             'Grilled chicken with lettuce and mayo',                     180, 'Snacks',     3],
      ['Grilled Sandwich',           'Toasted sandwich with cheese and veggies',                  140, 'Snacks',     3],
      // Beverages
      ['Mango Lassi',                'Thick yogurt drink with fresh mango',                        80, 'Beverages',  3],
      ['Cold Coffee',                'Chilled blended coffee with cream',                          90, 'Beverages',  3],
      ['Fresh Lime Soda',            'Refreshing lime with soda and mint',                         60, 'Beverages',  3],
      ['Coke / Pepsi',               'Chilled soft drink (300 ml)',                                50, 'Beverages',  3],
      ['Mineral Water',              'Packaged drinking water (1 L)',                               30, 'Beverages',  3],
      ['Masala Chai',                'Traditional Indian spiced tea',                              40, 'Beverages',  3],
      ['Filter Coffee',              'South Indian style drip coffee',                             50, 'Beverages',  3],
      ['Ice Cream (2 scoops)',       'Choice of vanilla, chocolate, or mango',                     90, 'Desserts',   3],
    ];

    for (const [name, desc, price, category, kitchenId] of menuItems) {
      await client.query(`
        INSERT INTO menu_items (name, description, price, category, kitchen_id, available)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT DO NOTHING
      `, [name, desc, price, category, kitchenId]);
    }
    console.log(`  ✓ ${menuItems.length} menu items created`);

    console.log('\n✅ Database seed complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  LOGIN CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  jayanthmurala@gmail.com  /  123456789   (manager)');
    console.log('  waiter@demo.com          /  waiter123   (waiter)');
    console.log('  manager@demo.com         /  manager123  (manager)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((e) => { console.error('Seed failed:', e); process.exit(1); });
