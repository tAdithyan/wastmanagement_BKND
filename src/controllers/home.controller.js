import Pickup from "../models/pickup.modal.js";
import User from "../models/user.model.js";
import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";

export const getCustomerHomepageData = async (req, res, next) => {
    try {
        const customerId = req.user?._id;

        if (!customerId) {
            return res.status(401).json(
                new ApiResponse(
                    401,
                    null,
                    "Unauthorized user"
                )
            );
        }

        // Get pickups except cancelled and failed
        const pickups = await Pickup.find({
            customerId,
            status: {
                $nin: ["cancelled", "failed"]
            }
        });

        // Total billed amount
        const totalBilled = pickups.reduce(
            (sum, pickup) =>
                sum + (pickup.amount || 0),
            0
        );

        // Get customer data
        const user = await User.findById(customerId);

        const walletAmount = user?.wallet ?? 0;

        // Total number of valid pickups
        const totalPickups = pickups.length;

        // Total collected weight
        const totalWeight = pickups.reduce(
            (sum, pickup) =>
                sum + (pickup.weight || 0),
            0
        );

        // Average pickup weight
        const avgPickups =
            totalPickups > 0
                ? totalWeight / totalPickups
                : 0;

        // Latest 5 pickups
        const recentCollections = [...pickups]
            .sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
            )
            .slice(0, 5);

        const responseData = {
            totalBilled,
            totalPickups,
            walletAmount,
            totalWeight,
            avgPickups,
            recentCollections,
        };

        return res.status(200).json(
            new ApiResponse(
                200,
                responseData,
                "Homepage data fetched successfully"
            )
        );
    } catch (error) {
        next(error);
    }
};
