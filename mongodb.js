import mongoose from "mongoose";

// Use your actual MongoDB connection string
const MONGO_URI =
  "mongodb+srv://adithyanttech_db_user:ZcRe2ecBMBvusxZP@cluster0.hsmxnc1.mongodb.net/waste_management_db?retryWrites=true&w=majority&appName=Cluster0";

async function copyDistricts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);

    console.log("✅ MongoDB connected");

    const client = mongoose.connection.getClient();

    // Source database
    const sourceDb = client.db("test");

    // Destination database
    const destinationDb = client.db("waste_management_db");

    // Collections
    const sourceCollection = sourceDb.collection("urbs");
    const destinationCollection =
      destinationDb.collection("urbs");

    // Get districts
    const districts = await sourceCollection
      .find({})
      .toArray();

    console.log(`Found ${districts.length} districts`);

    if (districts.length === 0) {
      console.log("❌ No districts found in test.districts");
      return;
    }

    // Check destination
    const existingCount =
      await destinationCollection.countDocuments();

    console.log(
      `Destination currently has ${existingCount} districts`
    );

    // Copy
    if (existingCount === 0) {
      await destinationCollection.insertMany(districts);

      console.log(
        `✅ ${districts.length} districts copied successfully`
      );
    } else {
      console.log(
        "⚠️ Destination already contains districts."
      );

      console.log(
        "Skipping insert to prevent duplicate _id errors."
      );
    }

    console.log("");
    console.log("Source:");
    console.log("test.districts");

    console.log("");
    console.log("Destination:");
    console.log("waste_management_db.districts");

  } catch (error) {
    console.error("❌ Copy failed:");
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB disconnected");
  }
}

copyDistricts();