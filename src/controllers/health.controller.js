import ApiResponse from "../utils/apiResponse.js";

export const getHealthStatus = (req, res) => {
  const healthData = {
    status: "UP",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  };

  return res
    .status(200)
    .json(new ApiResponse(200, healthData, "Service is healthy"));
};
