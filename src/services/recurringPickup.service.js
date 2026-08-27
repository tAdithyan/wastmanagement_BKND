import Pickup from "../models/pickup.modal.js";
import RecurringPickup from "../models/recurringPickup.model.js";

const dateKey = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

const generateRecurringPickupsOnce = async (now) => {
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  const contracts = await RecurringPickup.find({
    isActive: true,
    collectionDays: now.getDay(),
    startDate: { $lte: endOfDay },
    $or: [{ endDate: null }, { endDate: { $gte: startOfDay } }],
  });
  let generated = 0;
  for (const contract of contracts) {
    const [hours, minutes] = contract.preferredTime.split(":").map(Number);
    const preferredDate = new Date(now);
    preferredDate.setHours(hours, minutes, 0, 0);
    const generationKey = `${contract._id}:${dateKey(now)}`;
    try {
      const alreadyGenerated = await Pickup.exists({
        $or: [
          { recurringGenerationKey: generationKey },
          {
            recurringContractId: contract._id,
            preferredDate: { $gte: startOfDay, $lte: endOfDay },
          },
        ],
      });
      if (alreadyGenerated) continue;

      if (!contract.pickupLocation.type) contract.pickupLocation.type = "Point";
      await Pickup.create({
        customerId: contract.customerId,
        wasteType: contract.wasteType,
        preferredDate,
        pickupLocation: {
          type: "Point",
          coordinates: contract.pickupLocation.coordinates,
        },
        ratePerKg: contract.ratePerKg,
        recurringContractId: contract._id,
        recurringGenerationKey: generationKey,
        notes: [`Recurring collection: ${contract.name}`, contract.address, contract.notes].filter(Boolean).join(". "),
      });
      contract.lastGeneratedDate = now;
      await contract.save();
      generated += 1;
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  return generated;
};

let generationRun = null;
export const generateRecurringPickups = (now = new Date()) => {
  if (generationRun) return generationRun;
  generationRun = generateRecurringPickupsOnce(now).finally(() => { generationRun = null; });
  return generationRun;
};

let generationTimer;
export const startRecurringPickupScheduler = async () => {
  await generateRecurringPickups().catch((error) => console.error("Recurring pickup generation failed:", error));
  if (!generationTimer) generationTimer = setInterval(
    () => generateRecurringPickups().catch((error) => console.error("Recurring pickup generation failed:", error)),
    15 * 60 * 1000
  );
};
