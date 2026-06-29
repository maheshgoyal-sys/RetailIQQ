import express from "express";
import { runMlSegmentation, getSegments, getSegmentSummary } from "../controllers/segment.controller.js";

const router = express.Router();

// POST /api/segments/run-ml
router.post("/run-ml", runMlSegmentation);

// GET /api/segments/summary
router.get("/summary", getSegmentSummary);

// GET /api/segments
router.get("/", getSegments);

export default router;
