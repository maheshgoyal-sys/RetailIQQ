import express from "express";
import { getLeads, updateLeadStatus } from "../controllers/lead.controller.js";

const router = express.Router();

// GET /api/leads
router.get("/", getLeads);

// PATCH /api/leads/:id
router.patch("/:id", updateLeadStatus);

export default router;
