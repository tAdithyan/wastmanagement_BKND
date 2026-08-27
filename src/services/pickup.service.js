import Pickup from "../models/pickup.modal.js";
import User from "../models/user.model.js";
import WastePrice from "../models/wastePrice.model.js";
import ApiError from "../utils/apiError.js";
import { notifyPickupEvent } from "./notification.service.js";



export const getAllPickups = async (user = null) => {
    try {
        const query = {};
        if (["ROL_6", "CLIENT_ADMIN"].includes(user?.role)) {
            const RecurringPickup = (await import("../models/recurringPickup.model.js")).default;
            query.recurringContractId = { $in: await RecurringPickup.find({ $or: [{ clientAdminId: user._id }, { customerId: user._id }] }).distinct("_id") };
        }
        const pickups = await Pickup.find(query)
            .populate("customerId operatorId")
            .populate("recurringContractId", "name collectionDays preferredTime ratePerKg address");
        return pickups;
    } catch (error) {
        throw error;

    }
}



export const getPickupById = async (id) => {
    try {
        const pickup = await Pickup.findById(id)
            .populate("customerId operatorId")
            .populate("recurringContractId", "name collectionDays preferredTime ratePerKg address");
        return pickup;
    } catch (error) {
        throw error;

    }
}



export const getPickupByCustomerId = async (id) => {
    try {
        const pickup = await Pickup.find({ customerId: id }).populate("customerId operatorId");
        return pickup;
    } catch (error) {
        throw error;

    }
}

export const getPickupForAgents = async (id) => {
    try {
        const pickup = await Pickup.find({ operatorId: id }).populate("customerId operatorId");
        return pickup;
    } catch (error) {
        throw error;

    }
}


export const getpickupsByStatus = async (status) => {
    try {
        const pickup = await Pickup.find({ status }).populate("customerId operatorId");
        return pickup;
    } catch (error) {
        throw error;

    }
}



export const createPickup = async (data) => {
    try {
        const pickup = await Pickup.create(data);
        await notifyPickupEvent({ recipientId: pickup.customerId, pickupId: pickup._id, event: "pickup_scheduled", title: "Pickup scheduled", message: `${pickup.pickupId} was scheduled successfully.` });
        return pickup;
    } catch (error) {
        throw error;

    }
}


export const updatePickup = async (id, data) => {
    try {
        const updateData = { ...data };
        const existingPickup = await Pickup.findById(id);
        if (!existingPickup) throw new ApiError(404, "Pickup not found");

        if (data.weight !== undefined) {
            const weight = Number(data.weight);
            if (!Number.isFinite(weight) || weight < 0) {
                throw new ApiError(400, "Weight must be a valid positive number");
            }

            const wasteType = data.wasteType || existingPickup.wasteType;
            const categoryPrice = await WastePrice.findOne({ category: wasteType });
            const pricePerKg = existingPickup.ratePerKg ?? categoryPrice?.pricePerKg;
            if (pricePerKg == null) {
                throw new ApiError(400, `Price per kg is not configured for ${wasteType}`);
            }

            updateData.weight = weight;
            updateData.amount = Number((weight * pricePerKg).toFixed(2));
        }

        const pickup = await Pickup.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        const customerId = existingPickup.customerId;
        if (!existingPickup.operatorId && pickup.operatorId) {
            await Promise.all([
                notifyPickupEvent({ recipientId: customerId, pickupId: pickup._id, event: "operator_assigned", title: "Operator assigned", message: `A collection agent was assigned to ${pickup.pickupId}.` }),
                notifyPickupEvent({ recipientId: pickup.operatorId, pickupId: pickup._id, event: "pickup_assigned", title: "New pickup assigned", message: `${pickup.pickupId} has been assigned to you.` }),
            ]);
        }
        if (data.status === "on_the_way" && existingPickup.status !== "on_the_way") await notifyPickupEvent({ recipientId: customerId, pickupId: pickup._id, event: "operator_on_the_way", title: "Operator on the way", message: `Your agent is travelling to pickup ${pickup.pickupId}.` });
        if (data.status === "in_progress" && existingPickup.status !== "in_progress") await notifyPickupEvent({ recipientId: customerId, pickupId: pickup._id, event: "pickup_started", title: "Pickup started", message: `Collection has started for ${pickup.pickupId}.` });
        if (data.weight !== undefined && Number(data.weight) > 0 && Number(existingPickup.weight || 0) !== Number(data.weight)) await notifyPickupEvent({ recipientId: customerId, pickupId: pickup._id, event: "weight_recorded", title: "Waste weight recorded", message: `${Number(data.weight).toFixed(2)} kg was recorded for ${pickup.pickupId}.` });
        return pickup;
    } catch (error) {
        throw error;

    }
}



export const cancelPickup = async (id, data) => {
    try {
        const pickup = await Pickup.findByIdAndUpdate(id, { status: "cancelled", cancellationReason: data.cancellationReason }, { new: true });
        return pickup;
    } catch (error) {
        throw error;

    }
}



export const deletePickup = async (id) => {
    try {
        const pickup = await Pickup.findByIdAndDelete(id);
        return pickup;
    } catch (error) {
        throw error;

    }
}




export const completePickup = async (id, data) => {
    try {
        const pickup = await Pickup.findById(id);
        if (!pickup) throw new ApiError(404, "Pickup not found");
        if (pickup.status === "completed") throw new ApiError(400, "Pickup is already completed");
        if (!pickup.weight || pickup.weight <= 0) throw new ApiError(400, "Pickup weight is required before completion");

        const categoryPrice = await WastePrice.findOne({ category: pickup.wasteType });
        const pricePerKg = pickup.ratePerKg ?? categoryPrice?.pricePerKg;
        if (pricePerKg == null) throw new ApiError(400, `Price per kg is not configured for ${pickup.wasteType}`);

        const amount = Number((pickup.weight * pricePerKg).toFixed(2));
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new ApiError(400, "Calculated pickup amount must be greater than zero");
        }
        const user = await User.findById(pickup.customerId);
        if (!user) throw new ApiError(404, "Customer not found");
        if (pickup.recurringContractId) {
            pickup.amount = amount;
            pickup.status = "completed";
            pickup.paymentStatus = "accrued";
            await pickup.save();
            await Promise.all([
                notifyPickupEvent({ recipientId: user._id, pickupId: pickup._id, event: "pickup_completed", title: "Pickup completed", message: `${pickup.pickupId} was completed successfully.` }),
                notifyPickupEvent({ recipientId: user._id, pickupId: pickup._id, event: "monthly_charge_accrued", title: "Added to monthly bill", message: `₹${amount.toFixed(2)} was added to your recurring collection bill.` }),
            ]);
            return {
                status: 200,
                data: {
                    message: "Recurring pickup completed and added to monthly billing",
                    pickup,
                    user,
                    pricePerKg,
                    chargedAmount: amount,
                    walletBalance: user.wallet,
                    paymentDeferred: true,
                }
            };
        }
        const walletBalance = Number(user.wallet || 0);
        if (walletBalance < amount) {
            await notifyPickupEvent({ recipientId: user._id, pickupId: pickup._id, event: "payment_overdue", title: "Payment overdue", message: `Add ₹${Number((amount - walletBalance).toFixed(2))} to your wallet to complete payment for ${pickup.pickupId}.` });
            throw new ApiError(400, `Insufficient wallet balance. Required ₹${amount}, available ₹${walletBalance}`);
        }

        const newWalletBalance = Number((walletBalance - amount).toFixed(2));
        const debitResult = await User.updateOne(
            { _id: user._id },
            { $set: { wallet: newWalletBalance } },
            { runValidators: true }
        );
        if (debitResult.matchedCount !== 1) {
            throw new ApiError(500, "Customer wallet debit failed");
        }
        const updatedUser = await User.findById(user._id);
        if (!updatedUser || Number(updatedUser.wallet) !== newWalletBalance) {
            throw new ApiError(500, "Customer wallet debit could not be verified");
        }
        pickup.amount = amount;
        pickup.status = "completed";
        pickup.paymentStatus = "paid";
        await pickup.save();
        await Promise.all([
            notifyPickupEvent({ recipientId: user._id, pickupId: pickup._id, event: "pickup_completed", title: "Pickup completed", message: `${pickup.pickupId} was completed successfully.` }),
            notifyPickupEvent({ recipientId: user._id, pickupId: pickup._id, event: "bill_generated", title: "Bill generated", message: `A bill of ₹${amount.toFixed(2)} was generated for ${pickup.pickupId}.` }),
            notifyPickupEvent({ recipientId: user._id, pickupId: pickup._id, event: "payment_successful", title: "Payment successful", message: `₹${amount.toFixed(2)} was paid from your wallet.` }),
        ]);
        return {
            status: 200,
            data: {
                message: "Pickup completed",
                pickup,
                user: updatedUser,
                pricePerKg,
                chargedAmount: amount,
                walletBalance: updatedUser.wallet
            }
        }

    } catch (error) {
        throw error;

    }
}
// export const getPickupbyUser = async (id) =>{
//     try {
//          const pickups = await Pickup.findById)








//     } catch (error) {
        
//     }
// } 


