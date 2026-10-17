import mongoose from "mongoose";

const sitePageSchema = new mongoose.Schema({
  slug: { type: String, enum: ["privacy-policy", "contact", "about-us"], required: true, unique: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  content: { type: String, required: true, maxlength: 50000 },
  socialLinks: [{ platform: { type: String, enum: ["Facebook", "Instagram", "YouTube", "X", "LinkedIn", "TikTok", "Other"], required: true }, url: { type: String, required: true, trim: true, maxlength: 500 } }],
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

const SitePage = mongoose.models.SitePage || mongoose.model("SitePage", sitePageSchema);
export default SitePage;
