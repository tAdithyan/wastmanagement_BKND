import ApiResponse from "../utils/apiResponse.js";
import { getWastePrices, upsertWastePrice } from "../services/wastePrice.service.js";

export const getWastePricesController = async (_req, res, next) => {
  try {
    const prices = await getWastePrices();
    res.status(200).json(new ApiResponse(200, prices, "Waste prices fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const upsertWastePriceController = async (req, res, next) => {
  try {
    const price = await upsertWastePrice(req.params.category, req.body.pricePerKg);
    res.status(200).json(new ApiResponse(200, price, "Waste price saved successfully"));
  } catch (error) {
    next(error);
  }
};
