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
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      customer_id,
      first_name,
      last_name,
      email,
      phone,
      total_orders,
      total_spent,
      average_order_value,
      last_order_amount,
      city,
      state,
      loyalty_points
    } = req.body;

    // Check customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id }
    });

    if (!existingCustomer) {
      return res.status(404).json({
        error: "Customer not found"
      });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        customer_id,
        first_name,
        last_name,
        email,
        phone,
        total_orders: Number(total_orders) || 0,
        total_spent: Number(total_spent) || 0,
        average_order_value: Number(average_order_value) || 0,
        last_order_amount: Number(last_order_amount) || 0,
        city,
        state,
        loyalty_points: Number(loyalty_points) || 0
      }
    });

    res.status(200).json({
      message: "Customer updated successfully",
      customer: updatedCustomer
    });

  } catch (error) {
    console.error("Update Error:", error);

    res.status(500).json( {
      error: error.message
    });
  }
};
export const getCustomers = async (req, res) => {
  try {
    const {
      page = 0,
      size = 100,
      search = '',
      city = '',
      gender = '', // not in schema, kept for API compat, ignored in filtering
      segment = ''
    } = req.query;

    const pageNum = parseInt(page) || 0;
    const pageSize = parseInt(size) || 100;

    // Build dynamic where clause
    const where = {};

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (city) {
      where.city = { equals: city, mode: 'insensitive' };
    }

    if (segment) {
      // segment is a relation -> filter via the related Segment's name
      where.segment = {
        name: { equals: segment, mode: 'insensitive' }
      };
    }

    const [customers, totalElements] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: { segment: true },
        orderBy: { total_spent: 'desc' },
        skip: pageNum * pageSize,
        take: pageSize
      }),
      prisma.customer.count({ where })
    ]);

    // Map to frontend expected format
    const formatted = customers.map(c => ({
      id: c.id,
      customer_id: c.customer_id,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.customer_id,
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      email: c.email || '',
      phone: c.phone || '',
      city: c.city || 'Unknown',
      state: c.state || '',
      totalSpend: c.total_spent,
      purchaseCount: c.total_orders,
      total_orders: c.total_orders,
      total_spent: c.total_spent,
      average_order_value: c.average_order_value,
      last_order_amount: c.last_order_amount,
      loyalty_points: c.loyalty_points,
      lastPurchaseDate: c.last_purchase_date ? c.last_purchase_date.toISOString().split('T')[0] : null,
      segment: c.segment ? c.segment.name : 'New Customer'
    }));

    res.status(200).json({
      content: formatted,
      totalPages: Math.max(1, Math.ceil(totalElements / pageSize)),
      totalElements,
      size: pageSize,
      number: pageNum
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
export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { segment: true }
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const formatted = {
      id: customer.id,
      customer_id: customer.customer_id,
      name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.customer_id,
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      city: customer.city || 'Unknown',
      state: customer.state || '',
      totalSpend: customer.total_spent,
      purchaseCount: customer.total_orders,
      total_orders: customer.total_orders,
      total_spent: customer.total_spent,
      average_order_value: customer.average_order_value,
      last_order_amount: customer.last_order_amount,
      loyalty_points: customer.loyalty_points,
      lastPurchaseDate: customer.last_purchase_date
        ? customer.last_purchase_date.toISOString().split('T')[0]
        : null,
      segment: customer.segment ? customer.segment.name : 'New Customer'
    };

    res.status(200).json(formatted);
  } catch (error) {
    console.error("Get Customer By Id Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const existingCustomer = await prisma.customer.findUnique({
      where: { id }
    });

    if (!existingCustomer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    await prisma.customer.delete({
      where: { id }
    });

    res.status(200).json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("Delete Customer Error:", error);
    res.status(500).json({ error: error.message });
  }
};