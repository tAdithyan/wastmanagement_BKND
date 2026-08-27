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
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
