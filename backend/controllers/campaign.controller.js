import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createCampaign = async (req, res) => {
  try {
    const { name, type, content, segmentId } = req.body;

    // Create the campaign
    const campaign = await prisma.campaign.create({
      data: {
        name,
        type,
        content,
        status: 'Sent'
      }
    });

    // Get all customers in this segment
    let customers = [];
    if (segmentId === 'ALL') {
      customers = await prisma.customer.findMany();
    } else {
      customers = await prisma.customer.findMany({
        where: { segment_id: segmentId }
      });
    }

    if (customers.length === 0) {
      return res.status(400).json({ error: 'No customers found for this segment.' });
    }

    // Simulate sending emails and generating leads/stats
    const emailLogs = [];
    const leads = [];
    const statuses = ['Delivered', 'Opened', 'Clicked', 'Bounced', 'Unsubscribed'];
    
    for (const customer of customers) {
      if (!customer.email) continue;

      // Randomly assign a status to mock real-world email behavior
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      
      emailLogs.push({
        campaign_id: campaign.id,
        recipient: customer.email,
        status: randomStatus,
        openedAt: ['Opened', 'Clicked'].includes(randomStatus) ? new Date() : null,
        clickedAt: randomStatus === 'Clicked' ? new Date() : null
      });

      // If user clicked, generate a lead
      if (randomStatus === 'Clicked') {
        leads.push({
          customer_id: customer.id,
          campaign_id: campaign.id,
          score: Math.floor(Math.random() * 40) + 60, // Score between 60 and 99
          status: 'New'
        });
      }
    }

    // Batch insert logs and leads
    if (emailLogs.length > 0) {
      await prisma.emailLog.createMany({ data: emailLogs });
    }
    
    if (leads.length > 0) {
      await prisma.lead.createMany({ data: leads });
    }

    res.status(201).json({ 
      message: 'Campaign launched successfully.', 
      campaign,
      stats: {
        totalTargeted: customers.length,
        leadsGenerated: leads.length
      }
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Server error creating campaign' });
  }
};

export const getCampaigns = async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { leads: true, emailLogs: true }
        }
      }
    });

    // Map to frontend expected format
    const formatted = campaigns.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      targetSegment: 'Segment target', // Mock or fetch real segment name if available
      status: c.status || 'Sent',
      sentDate: c.createdAt.toISOString().split('T')[0],
      openRate: '24%', // Mock
      clickRate: '12%', // Mock
      conversions: c._count.leads
    }));
    
    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const getCampaignStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Group email logs by status
    const stats = await prisma.emailLog.groupBy({
      by: ['status'],
      where: { campaign_id: id },
      _count: {
        _all: true
      }
    });

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
