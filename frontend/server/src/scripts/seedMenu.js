import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const menu = [
  {
    name: 'Broast (بروست)',
    products: [
      'Quarter Breast (ربع صدر)',
      'Quarter Thigh (ربع ورك)',
      'Half Chicken (نص فروج)',
      'Whole Chicken (فروجة كاملة)',
    ],
  },
  {
    name: 'Grilled Chicken (شواية)',
    products: [
      'Quarter Breast (ربع صدر)',
      'Quarter Thigh (ربع ورك)',
      'Half Chicken (نص فروج)',
      'Whole Chicken (فروجة كاملة)',
    ],
  },
  {
    name: 'Potatoes (بطاطس)',
    products: [
      'Crispy Potatoes (بطاطس كريسبي)',
      'Syrian Potato Sandwich (ساندوتش بطاطس سوري)',
      'Potato Box (باكيت بطاطس)',
    ],
  },
  {
    name: 'Fatta (فتة)',
    products: [
      'Shawarma Fatta (فتة شاورما)',
      'Crispy Fatta (فتة كريسبي)',
    ],
  },
  {
    name: 'Extras (إضافات)',
    products: [
      'Garlic Sauce (تومية)',
      'Coleslaw (كول سلو)',
      'Pickles (مخلل)',
      'Saj Bread (عيش صاج)',
      'Cola Can (كولا كان)',
      'Cola 1L (كولا لتر)',
      'Cola 2L (كولا 2 لتر)',
    ],
  },
];

async function seedMenu() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI must be configured');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  // Migrate the old global name index so identical item names can belong to
  // different categories while remaining unique within one category.
  try {
    await Product.collection.dropIndex('name_1');
  } catch (error) {
    if (error.codeName !== 'IndexNotFound') throw error;
  }
  await Product.syncIndexes();

  let createdCategories = 0;
  let createdProducts = 0;

  for (const categoryData of menu) {
    const category = await Category.findOneAndUpdate(
      { name: categoryData.name },
      { $setOnInsert: { name: categoryData.name } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (category.createdAt.getTime() === category.updatedAt.getTime()) {
      createdCategories += 1;
    }

    for (const productName of categoryData.products) {
      const result = await Product.updateOne(
        { name: productName, category: category._id },
        { $setOnInsert: { name: productName, category: category._id, price: 0, status: 'active' } },
        { upsert: true }
      );
      if (result.upsertedCount) createdProducts += 1;
    }
  }

  console.log(`Menu seeded: ${createdCategories} categories, ${createdProducts} products created`);
}

seedMenu()
  .catch((error) => {
    console.error('Menu seed failed', { name: error.name || 'Error', code: error.code });
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
