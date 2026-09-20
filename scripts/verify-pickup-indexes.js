import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Pickup from '../src/models/pickup.modal.js';

dotenv.config();
try {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await Pickup.init();
  console.log('Pickup model indexes initialized successfully. No records deleted.');
} catch (error) {
  console.error({ errorType: error.name, code: error.code, message: error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[database URL]') });
  process.exitCode=1;
} finally { await mongoose.disconnect(); }
