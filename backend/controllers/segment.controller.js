import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

export const runMlSegmentation = async (req, res) => {
  try {
    const { algorithm, k, features } = req.body;

    // 1. Fetch all customers
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        customer_id: true,
        total_spent: true,
        total_orders: true,
      }
    });

    if (customers.length === 0) {
      return res.status(400).json({ error: "No customers found to segment" });
    }

    // 2. Format data for ML service
    const mlPayload = customers.map(c => ({
      id: c.id,
      totalSpend: c.total_spent,
      purchaseCount: c.total_orders
    }));

    // 3. Call ML Service
    const mlResponse = await axios.post(`${ML_SERVICE_URL}/ml/segment`, mlPayload);
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
    console.error("Error running ML segmentation:", error);
    res.status(500).json({ error: "Failed to run segmentation" });
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

