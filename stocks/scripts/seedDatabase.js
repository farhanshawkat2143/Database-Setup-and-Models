const mongoose = require('mongoose');
const StockHistory = require('../models/StockHistory');
require('dotenv').config({ path: './config.env' });

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stock-tracking');
    console.log('Connected to MongoDB');

    // Clear existing data
    await StockHistory.deleteMany({});
    console.log('Cleared existing data');

    const products = ['PROD001', 'PROD002', 'PROD003'];
    const baseDate = new Date('2025-01-01');

    for (const productId of products) {
      console.log(`Seeding data for ${productId}...`);
      
      let currentStock = 100;
      const records = [];

      // Create 30 days of data
      for (let day = 0; day < 30; day++) {
        const date = new Date(baseDate.getTime() + (day * 24 * 60 * 60 * 1000));
        
        // Random events per day (0-3 events)
        const eventsPerDay = Math.floor(Math.random() * 4);
        
        for (let event = 0; event < eventsPerDay; event++) {
          const hour = Math.floor(Math.random() * 24);
          const timestamp = new Date(date.getTime() + (hour * 60 * 60 * 1000));
          
          let change, reason;
          const rand = Math.random();
          
          if (rand < 0.1) {
            // 10% chance of restock
            change = Math.floor(Math.random() * 50) + 20; // 20-70 units
            reason = 'restock';
          } else if (rand < 0.9) {
            // 80% chance of sale
            change = -(Math.floor(Math.random() * 10) + 1); // -1 to -10 units
            reason = 'sale';
          } else {
            // 10% chance of adjustment
            change = Math.floor(Math.random() * 20) - 10; // -10 to +10 units
            reason = 'adjustment';
          }
          
          currentStock = Math.max(0, currentStock + change);
          
          records.push({
            productId,
            timestamp,
            change,
            stockLevel: currentStock,
            reason
          });
        }
      }
      
      // Insert records for this product
      await StockHistory.insertMany(records);
      console.log(`Created ${records.length} records for ${productId}`);
    }

    console.log('Database seeded successfully!');
    console.log('Total records:', await StockHistory.countDocuments());
    
    // Show some sample data
    const sampleData = await StockHistory.find().limit(5).sort({ timestamp: 1 });
    console.log('\nSample data:');
    console.table(sampleData.map(record => ({
      productId: record.productId,
      timestamp: record.timestamp.toISOString().split('T')[0],
      change: record.change,
      stockLevel: record.stockLevel,
      reason: record.reason
    })));

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
