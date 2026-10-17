import Pickup from "../models/pickup.modal.js";
import { ACTIVE_PICKUP_STATUSES } from "../constants/pickup-status.js";

const INDIA_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const EXPIRY_INTERVAL_MS = 15 * 60 * 1000;
let expiryTimer;
let expiryRun;

// Pickup dates are selected as local calendar dates and serialized as ISO
// timestamps. Use the Kerala/India calendar boundary even when the server runs
// in UTC, and expire a pickup only after its preferred date has ended.
export const expirePastPickups = (now = new Date()) => {
  if (expiryRun) return expiryRun;
  const indiaNow = new Date(now.getTime() + INDIA_OFFSET_MS);
  indiaNow.setUTCHours(0, 0, 0, 0);
  const startOfTodayInIndia = new Date(indiaNow.getTime() - INDIA_OFFSET_MS);

  expiryRun = Pickup.updateMany(
    { status: { $in: ACTIVE_PICKUP_STATUSES }, preferredDate: { $lt: startOfTodayInIndia } },
    { $set: { status: "expired" } },
  ).finally(() => { expiryRun = null; });
  return expiryRun;
};

export const startPickupExpiryScheduler = async () => {
  try {
    const result = await expirePastPickups();
    if (result.modifiedCount) console.log(`Expired ${result.modifiedCount} pickup(s) past their preferred date.`);
  } catch (error) {
    console.error("Pickup expiry failed:", error);
  }
  if (!expiryTimer) expiryTimer = setInterval(async () => {
    try {
      const result = await expirePastPickups();
      if (result.modifiedCount) console.log(`Expired ${result.modifiedCount} pickup(s) past their preferred date.`);
    } catch (error) {
      console.error("Pickup expiry failed:", error);
    }
  }, EXPIRY_INTERVAL_MS);
};
