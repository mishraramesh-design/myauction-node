module.exports = {
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: '24h'
  },
  tender: {
    maxItemsPerTender: parseInt(process.env.MAX_ITEMS_PER_TENDER) || 2,
    biddingSystem: 'TWO_PACKET',
    tenderType: 'OPEN_TENDER',
    evaluationCriteria: 'TOTAL_VALUE_WISE'
  },
  encryption: {
    algorithm: 'aes-256-cbc',
    key: process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-change-this-in-prod'
  }
};
