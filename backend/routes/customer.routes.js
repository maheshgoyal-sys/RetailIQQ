import express from "express";
import { uploadCustomers, getCustomers } from "../controllers/customer.controller.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// POST /api/customers/upload
router.post("/upload", upload.single("file"), uploadCustomers);

// GET /api/customers
router.get("/", getCustomers);

export default router;
