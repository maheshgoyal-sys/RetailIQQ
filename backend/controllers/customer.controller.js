import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import csv from 'csv-parser';

const prisma = new PrismaClient();

export const uploadCustomers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          // Process and insert customers
          for (const row of results) {
            await prisma.customer.upsert({
              where: { customer_id: row.customer_id },
              update: {
                first_name: row.first_name,
                last_name: row.last_name,
                email: row.email,
                phone: row.phone,
                total_orders: parseInt(row.total_orders) || 0,
                total_spent: parseFloat(row.total_spent) || 0,
                average_order_value: parseFloat(row.average_order_value) || 0,
                last_order_amount: parseFloat(row.last_order_amount) || 0,
                city: row.city,
                state: row.state,
                loyalty_points: parseInt(row.loyalty_points) || 0,
              },
              create: {
                customer_id: row.customer_id,
                first_name: row.first_name,
                last_name: row.last_name,
                email: row.email,
                phone: row.phone,
                total_orders: parseInt(row.total_orders) || 0,
                total_spent: parseFloat(row.total_spent) || 0,
                average_order_value: parseFloat(row.average_order_value) || 0,
                last_order_amount: parseFloat(row.last_order_amount) || 0,
                city: row.city,
                state: row.state,
                loyalty_points: parseInt(row.loyalty_points) || 0,
              }
            });
          }
          
          // Delete temp file
          fs.unlinkSync(req.file.path);
          
          res.status(200).json({ message: `Successfully uploaded ${results.length} customers` });
        } catch (error) {
          console.error("Error processing CSV data:", error);
          res.status(500).json({ error: "Error saving customers to database" });
        }
      });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Server error during upload" });
  }
};

export const getCustomers = async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        segment: true
      },
      orderBy: {
        total_spent: 'desc'
      },
      take: 100 // Limit for now
    });
    
    // Map to frontend expected format
    const formatted = customers.map(c => ({
      id: c.id,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.customer_id,
      email: c.email || '',
      phone: c.phone || '',
      age: 30, // Mock age if not present
      gender: c.gender || 'Unknown',
      city: c.city || 'Unknown',
      totalSpend: c.total_spent,
      purchaseCount: c.total_orders,
      lastPurchaseDate: c.last_purchase_date ? c.last_purchase_date.toISOString().split('T')[0] : null,
      segment: c.segment ? c.segment.name : 'New Customer'
    }));

    res.status(200).json({
      content: formatted,
      totalPages: 1,
      totalElements: formatted.length,
      size: 100,
      number: 0
    });
  } catch (error) {
  console.error("========== DATABASE ERROR ==========");
  console.error(error);
  console.error("===================================");

  res.status(500).json({
    error: error.message,
    details: error
  });
}
};
