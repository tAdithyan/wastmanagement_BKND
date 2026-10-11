import Shift from "../models/shift.model.js";

const SHIFT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const SHIFT_CLEANUP_INTERVAL_MS = 30 * 1000;

export const closeInactiveShifts = async (now = new Date()) => {
  const cutoff = new Date(now.getTime() - SHIFT_IDLE_TIMEOUT_MS);
  const staleActivity = {
    $or: [
      { lastActivityAt: { $lte: cutoff } },
      { lastActivityAt: null, updatedAt: { $lte: cutoff } },
    ],
  };
  const staleShifts = await Shift.find({ status: "active", ...staleActivity })
    .select("_id startedAt")
    .lean();
  if (!staleShifts.length) return 0;

  await Shift.bulkWrite(staleShifts.map((shift) => ({
    updateOne: {
      filter: { _id: shift._id, status: "active", ...staleActivity },
      update: {
        $set: {
          status: "completed",
          endedAt: now,
          durationSeconds: Math.max(0, Math.floor((now.getTime() - new Date(shift.startedAt).getTime()) / 1000)),
        },
      },
    },
  })));
  return staleShifts.length;
};

export const startShiftCleanupScheduler = () => {
  const runCleanup = () => closeInactiveShifts().catch((error) => {
    console.error("Inactive shift cleanup failed:", error);
  });
  void runCleanup();
  return setInterval(runCleanup, SHIFT_CLEANUP_INTERVAL_MS);
};
