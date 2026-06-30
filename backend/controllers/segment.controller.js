import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

export const runMlSegmentation = async (req, res) => {
  try {
    const { algorithm, k, features } = req.body;

    if (!features || features.length === 0) {
      return res.status(400).json({ error: "No features selected" });
    }

    // 1. Fetch all customers with every field the ML service might need
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        customer_id: true,
        total_spent: true,
        total_orders: true,
        average_order_value: true,
        last_order_amount: true,
        loyalty_points: true,
        city: true,
        state: true,
      }
    });

    if (customers.length === 0) {
      return res.status(400).json({ error: "No customers found to segment" });
    }

    // 2. Format data for ML service — keep field names matching `features` keys exactly
    //    (total_spent, total_orders, average_order_value, last_order_amount, loyalty_points, city, state)
    const mlCustomers = customers.map(c => ({
      id: c.id,
      total_spent: c.total_spent ?? 0,
      total_orders: c.total_orders ?? 0,
      average_order_value: c.average_order_value ?? 0,
      last_order_amount: c.last_order_amount ?? 0,
      loyalty_points: c.loyalty_points ?? 0,
      city: c.city || 'Unknown',
      state: c.state || 'Unknown',
    }));

    // 3. Call ML Service with the new payload shape: { k, features, customers }
    const mlResponse = await axios.post(`${ML_SERVICE_URL}/ml/segment`, {
      k: k || 5,
      features,
      customers: mlCustomers,
    });

    const segmentMapping = mlResponse.data; // { "customer_id_uuid": "Segment Name" }

    // 4. Update database with results
    const uniqueSegments = [...new Set(Object.values(segmentMapping))];

    // Ensure segment records exist
    const segmentMap = {};
    for (const segmentName of uniqueSegments) {
      let segment = await prisma.segment.findUnique({ where: { name: segmentName } });
      if (!segment) {
        segment = await prisma.segment.create({
          data: { name: segmentName, type: 'ML' }
        });
      }
      segmentMap[segmentName] = segment.id;
    }

    // Update customers
    let updateCount = 0;
    for (const [customerId, segmentName] of Object.entries(segmentMapping)) {
      const segmentId = segmentMap[segmentName];
      if (segmentId) {
        await prisma.customer.update({
          where: { id: customerId },
          data: { segment_id: segmentId }
        });
        updateCount++;
      }
    }

    res.status(200).json({
      message: `Successfully segmented ${updateCount} customers into ${uniqueSegments.length} segments.`,
      segments: uniqueSegments
    });

  } catch (error) {
    console.error("Error running ML segmentation:", error?.response?.data || error.message);
    res.status(500).json({
      error: "Failed to run segmentation",
      details: error?.response?.data?.error || error.message
    });
  }
};

export const getSegments = async (req, res) => {
  try {
    const segments = await prisma.segment.findMany({
      include: {
        _count: {
          select: { customers: true }
        }
      }
    });

    // Map to frontend expectation
    const formatted = segments.map(seg => ({
      id: seg.id,
      segmentName: seg.name,
      size: seg._count.customers,
      avgSpend: 15000, // Mock for demo
      purchaseFrequency: 12, // Mock for demo
      lastPurchaseAvg: '15 days ago',
      campaignTip: 'Send targeted offer',
      color: 'indigo'
    }));

    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

export const getSegmentSummary = async (req, res) => {
  try {
    const totalCustomers = await prisma.customer.count();

    const segments = await prisma.segment.findMany({
      include: {
        _count: {
          select: { customers: true }
        }
      }
    });

    const formattedSegments = segments.map(seg => ({
      name: seg.name,
      size: seg._count.customers,
      avgSpend: 15000 // Mock for demo
    }));

    res.status(200).json({
      totalCustomers,
      segmentCount: segments.length,
      segments: formattedSegments
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};