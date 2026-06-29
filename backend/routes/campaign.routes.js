import express from "express";
import { createCampaign, getCampaigns, getCampaignStats } from "../controllers/campaign.controller.js";

const router = express.Router();

// POST /api/campaigns
router.post("/", createCampaign);

// GET /api/campaigns
router.get("/", getCampaigns);

// GET /api/campaigns/:id/stats
router.get("/:id/stats", getCampaignStats);

// PUT /api/campaigns/:id/send
router.put("/:id/send", (req, res) => res.json({ message: 'Campaign sent' }));

export default router;
