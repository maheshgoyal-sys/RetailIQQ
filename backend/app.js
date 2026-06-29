import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";

const app = express();

// Middleware
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174"], // Vite default ports
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
import customerRoutes from "./routes/customer.routes.js";
import segmentRoutes from "./routes/segment.routes.js";
import campaignRoutes from "./routes/campaign.routes.js";
import leadRoutes from "./routes/lead.routes.js";

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/segments", segmentRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/leads", leadRoutes);
// Base route for testing
app.get("/", (req, res) => {
  res.send("RetailIQ Backend API is running");
});

export default app;
