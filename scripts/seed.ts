import { config } from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

config({ path: join(process.cwd(), '.env.local') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Running schema...');
    const schema = readFileSync(join(process.cwd(), 'scripts', 'schema.sql'), 'utf-8');
    await client.query(schema);

    console.log('🌱 Seeding users...');
    const waiterHash = await bcrypt.hash('waiter123', 10);
    const managerHash = await bcrypt.hash('manager123', 10);
    await client.query(`
      INSERT INTO users (name, email, password_hash, role) VALUES
        ('Arjun Kumar', 'waiter@demo.com', $1, 'waiter'),
        ('Priya Sharma', 'manager@demo.com', $2, 'manager'),
        ('Rahul Verma', 'waiter2@demo.com', $1, 'waiter')
      ON CONFLICT (email) DO NOTHING
    `, [waiterHash, managerHash]);

    console.log('🌱 Seeding kitchens...');
    await client.query(`
      INSERT INTO kitchens (name, description) VALUES
        ('Main Kitchen', 'North Indian, Biryanis, Tandoor'),
        ('Chinese Kitchen', 'Chinese, Noodles, Rice'),
        ('Fast Food', 'Snacks, Beverages, Quick Bites')
      ON CONFLICT DO NOTHING
    `);

    console.log('🌱 Seeding tables...');
    for (let i = 1; i <= 12; i++) {
      const capacity = i <= 4 ? 2 : i <= 8 ? 4 : 6;
      await client.query(`
        INSERT INTO tables (name, capacity, status) VALUES ($1, $2, 'available')
        ON CONFLICT (name) DO NOTHING
      `, [`T${i}`, capacity]);
    }

    console.log('🌱 Seeding menu items...');
    const kitchens = await client.query(`SELECT id, name FROM kitchens ORDER BY id`);
    const [mainId, chineseId, fastFoodId] = kitchens.rows.map(r => r.id);

    const menuItems = [
      // Main Kitchen - Mains
      ['Chicken Biryani', 'Aromatic basmati rice cooked with tender chicken pieces', 320, 'Mains', mainId],
      ['Mutton Biryani', 'Slow-cooked mutton with fragrant spices and basmati', 380, 'Mains', mainId],
      ['Veg Biryani', 'Fragrant rice with seasonal vegetables and spices', 260, 'Mains', mainId],
      ['Dal Makhani', 'Creamy black lentils slow-cooked overnight', 220, 'Mains', mainId],
      ['Paneer Tikka Masala', 'Grilled cottage cheese in rich tomato-cream sauce', 280, 'Mains', mainId],
      ['Butter Chicken', 'Tender chicken in velvety butter-tomato gravy', 300, 'Mains', mainId],
      ['Tandoori Chicken (Half)', 'Marinated chicken grilled in clay oven', 350, 'Mains', mainId],
      ['Palak Paneer', 'Cottage cheese in smooth spinach gravy', 240, 'Mains', mainId],
      // Main Kitchen - Breads
      ['Butter Naan', 'Soft leavened bread with butter', 40, 'Breads', mainId],
      ['Garlic Naan', 'Naan topped with garlic and butter', 50, 'Breads', mainId],
      ['Tandoori Roti', 'Whole wheat bread from tandoor', 30, 'Breads', mainId],
      ['Paratha', 'Layered whole wheat flatbread', 45, 'Breads', mainId],
      // Main Kitchen - Starters
      ['Veg Seekh Kebab', 'Spiced vegetable skewers from tandoor', 180, 'Starters', mainId],
      ['Chicken Tikka', 'Marinated chicken pieces from tandoor', 220, 'Starters', mainId],
      ['Paneer Tikka', 'Marinated cottage cheese from tandoor', 200, 'Starters', mainId],
      ['Soup of the Day', 'Chef\'s special fresh soup', 120, 'Starters', mainId],
      // Chinese Kitchen
      ['Veg Hakka Noodles', 'Stir-fried noodles with fresh vegetables', 180, 'Chinese', chineseId],
      ['Chicken Hakka Noodles', 'Stir-fried noodles with chicken', 220, 'Chinese', chineseId],
      ['Veg Fried Rice', 'Wok-tossed rice with vegetables', 160, 'Chinese', chineseId],
      ['Chicken Fried Rice', 'Wok-tossed rice with chicken', 200, 'Chinese', chineseId],
      ['Veg Manchurian (Gravy)', 'Crispy veg balls in tangy sauce', 180, 'Chinese', chineseId],
      ['Chicken Manchurian', 'Crispy chicken in Indo-Chinese sauce', 220, 'Chinese', chineseId],
      ['Hot & Sour Soup', 'Classic Indo-Chinese hot and sour broth', 120, 'Chinese', chineseId],
      ['Spring Rolls (4 pcs)', 'Crispy vegetable spring rolls', 160, 'Chinese', chineseId],
      // Fast Food
      ['French Fries', 'Crispy golden fries with dipping sauce', 120, 'Snacks', fastFoodId],
      ['Onion Rings', 'Battered and fried onion rings', 130, 'Snacks', fastFoodId],
      ['Veg Burger', 'Crispy patty with fresh vegetables', 150, 'Snacks', fastFoodId],
      ['Chicken Burger', 'Grilled chicken with lettuce and mayo', 180, 'Snacks', fastFoodId],
      ['Grilled Sandwich', 'Toasted sandwich with cheese and veggies', 140, 'Snacks', fastFoodId],
      // Beverages
      ['Mango Lassi', 'Thick yogurt drink with fresh mango', 80, 'Beverages', fastFoodId],
      ['Cold Coffee', 'Chilled blended coffee with cream', 90, 'Beverages', fastFoodId],
      ['Fresh Lime Soda', 'Refreshing lime with soda and mint', 60, 'Beverages', fastFoodId],
      ['Coke / Pepsi', 'Chilled soft drink (300ml)', 50, 'Beverages', fastFoodId],
      ['Mineral Water', 'Packaged drinking water (1L)', 30, 'Beverages', fastFoodId],
      ['Masala Chai', 'Traditional Indian spiced tea', 40, 'Beverages', fastFoodId],
      ['Filter Coffee', 'South Indian style drip coffee', 50, 'Beverages', fastFoodId],
      // Desserts
      ['Gulab Jamun (2 pcs)', 'Soft milk dumplings in sugar syrup', 80, 'Desserts', mainId],
      ['Rasgulla (2 pcs)', 'Spongy cottage cheese balls in syrup', 70, 'Desserts', mainId],
      ['Ice Cream (2 scoops)', 'Choice of vanilla, chocolate, or mango', 90, 'Desserts', fastFoodId],
      ['Gajar Ka Halwa', 'Carrot pudding with dry fruits', 110, 'Desserts', mainId],
    ];

    for (const [name, desc, price, category, kitchenId] of menuItems) {
      await client.query(`
        INSERT INTO menu_items (name, description, price, category, kitchen_id, available)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT DO NOTHING
      `, [name, desc, price, category, kitchenId]);
    }

    console.log('✅ Seed completed successfully!');
    console.log('\nDemo credentials:');
    console.log('  Waiter: waiter@demo.com / waiter123');
    console.log('  Manager: manager@demo.com / manager123');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
