import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";
import routes from "./routes/index.js";
import authRoutes from "./routes/auth.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import ApiError from "./utils/apiError.js";
import { protect } from "./middlewares/auth.middleware.js";


const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration
app.use(cors());

// HTTP request logging
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Body parsers
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// Prevent browsers from showing a stale Swagger specification after routes change.
app.use(["/api-docs", "/api-docs.json"], (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Swagger UI Documentation route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Swagger JSON spec route (for tools / import into Postman)
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", routes);

// Handle unknown API endpoints (404)
app.use((req, res, next) => {
  next(new ApiError(404, `Cannot ${req.method} ${req.originalUrl} - Endpoint not found`));
});

// Global Error Handler
app.use(errorHandler);

export default app;
