import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/waste_management_db";
    const conn = await mongoose.connect(uri);

    console.log(`🍃 MongoDB Connected: ${conn.connection.host} / ${conn.connection.name}`);
    
    // Proactively drop the conflicting unique index on email if it exists
    try {
      await conn.connection.db.collection('users').dropIndex('email_1');
      console.log("🧹 Successfully dropped old email_1 index");
    } catch (indexErr) {
      // Index might not exist, which is fine
    }

    // Reconcile pickups recurringGenerationKey index and clean up duplicates
    try {
      const pickupsCol = conn.connection.db.collection('pickups');
      const indexes = await pickupsCol.indexes();
      const existingKeyIndex = indexes.find(i => i.name === 'recurringGenerationKey_1');

      if (existingKeyIndex && !existingKeyIndex.partialFilterExpression) {
        await pickupsCol.dropIndex('recurringGenerationKey_1');
        console.log("🧹 Dropped legacy recurringGenerationKey_1 index to update with partialFilterExpression");
      }

      const duplicates = await pickupsCol.aggregate([
        { $match: { recurringGenerationKey: { $type: 'string' } } },
        { $group: { _id: '$recurringGenerationKey', count: { $sum: 1 }, docs: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } }
      ]).toArray();

      for (const dup of duplicates) {
        const [keep, ...removeIds] = dup.docs;
        await pickupsCol.deleteMany({ _id: { $in: removeIds } });
        console.log(`🧹 Cleaned up ${removeIds.length} duplicate pickup(s) for recurringGenerationKey: ${dup._id}`);
      }
    } catch (pickupErr) {
      // Collection or index might not exist yet, which is fine
    }
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
