import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getLeads = async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      include: {
        customer: { include: { segment: true } },
        campaign: true
      },
      orderBy: { score: 'desc' }
    });
    
    // Map to frontend expected format
    const formatted = leads.map(l => ({
      id: l.id,
      customerName: `${l.customer?.first_name || ''} ${l.customer?.last_name || ''}`.trim() || l.customer?.customer_id,
      email: l.customer?.email || 'N/A',
      segmentId: l.customer?.segment_id || '',
      segmentName: l.customer?.segment?.name || 'New Customer',
      status: l.status.toLowerCase(),
      leadScore: l.score,
      campaign: l.campaign?.name || 'N/A'
    }));
    
    res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Server error fetching leads' });
  }
};

export const updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const lead = await prisma.lead.update({
      where: { id },
      data: { status }
    });
    
    res.status(200).json(lead);
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Server error updating lead' });
  }
};
