import express from "express";
import { uploadCustomers, getCustomers ,updateCustomer,deleteCustomer} from "../controllers/customer.controller.js";
import multer from "multer";
const router = express.Router();
const upload = multer({ dest: "uploads/" });

// POST /api/customers/upload
router.post("/upload", upload.single("file"), uploadCustomers);
router.put("/:id", updateCustomer);
// GET /api/customers
router.get("/", getCustomers);
router.delete('/:id', deleteCustomer);
router.put("/customers/:id", updateCustomer);

export default router;
