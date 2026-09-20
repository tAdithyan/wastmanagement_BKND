import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();

try {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const pickups = db.collection('pickups');
  const indexes = await pickups.listIndexes().toArray();
  console.log(JSON.stringify({ indexes: indexes.map(({ name, key, unique, sparse, partialFilterExpression }) => ({ name, key, unique, sparse, partialFilterExpression })) }, null, 2));
  for (const field of ['pickupId', 'recurringGenerationKey']) {
    const duplicates = await pickups.aggregate([
      ...(field === 'recurringGenerationKey' ? [{ $match: { [field]: { $exists: true } } }] : []),
      { $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } },
      { $group: { _id: null, duplicateGroups: { $sum: 1 }, documents: { $sum: '$count' } } },
    ]).toArray();
    console.log(JSON.stringify({ field, duplicates }));
  }
  const duplicateActive = await pickups.aggregate([
    { $match: { customerRequest: true, status: { $in: ['scheduled','assigned','on_the_way','in_progress'] } } },
    { $group: { _id: '$customerId', count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } },
    { $count: 'customers' },
  ]).toArray();
  console.log(JSON.stringify({ duplicateActive }));
} catch (error) {
  console.error(JSON.stringify({ errorType: error.name, code: error.code, message: error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[database URL]') }));
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
