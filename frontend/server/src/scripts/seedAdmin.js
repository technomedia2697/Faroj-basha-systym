import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const seedAdmin = async () => {
  try {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!process.env.MONGODB_URI || !email || !password) {
      throw new Error('MONGODB_URI, ADMIN_EMAIL, and ADMIN_PASSWORD must be configured');
    }
    if (password.length < 12) {
      throw new Error('ADMIN_PASSWORD must be at least 12 characters');
    }
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error('ADMIN_PASSWORD must not exceed 72 UTF-8 bytes');
    }
    if (Buffer.byteLength(process.env.JWT_SECRET || '', 'utf8') < 32) {
      throw new Error('JWT_SECRET must be configured with at least 32 bytes');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const normalizedEmail = email.trim().toLowerCase();
    const adminExists = await User.findOne({ email: normalizedEmail });
    
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const admin = await User.create({
        email: normalizedEmail,
        password: hashedPassword,
        name: process.env.ADMIN_NAME || 'Administrator',
        role: 'admin'
      });
      console.log('Administrator created', { email: normalizedEmail, name: admin.name });
    } else {
      console.log('Administrator already exists', { email: normalizedEmail });
    }
  } catch (error) {
    console.error('Administrator setup failed', { name: error.name || 'Error', code: error.code });
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedAdmin();
