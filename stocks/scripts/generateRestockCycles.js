const mongoose = require('mongoose');
const StockLevel = require('../models/StockLevel');
const Product = require('../models/Product');
const Shelf = require('../models/Shelf');
require('dotenv').config({ path: './config.env' });

async function generateRestockCycles() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stock-tracking');
    console.log('✅ Connected to MongoDB');

    // Get products and shelves
    const products = await Product.find({ isActive: true });
    const shelves = await Shelf.find({ isActive: true });
    
    if (products.length === 0 || shelves.length === 0) {
      console.log('❌ No products or shelves found. Please seed the database first.');
      return;
    }

    console.log(`📦 Found ${products.length} products and ${shelves.length} shelves`);

    // Generate restocking cycle data for each product
    for (const product of products) {
      const shelf = shelves.find(s => s._id); // Use any shelf
      if (!shelf) continue;

      console.log(`🔄 Generating restocking cycles for ${product.name}...`);

      // Generate 60 days of data with clear restocking cycles
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() - 60); // Start 60 days ago
      
      const stockRecords = [];
      
      // Define restocking cycles for different products
      let restockCycle, minStock, maxStock;
      
      if (product.name === 'Banana') {
        restockCycle = 7; // Restock every 7 days
        minStock = 5;
        maxStock = 80;
      } else if (product.name === 'Milk') {
        restockCycle = 3; // Restock every 3 days
        minStock = 10;
        maxStock = 60;
      } else if (product.name === 'Bread') {
        restockCycle = 2; // Restock every 2 days
        minStock = 15;
        maxStock = 90;
      } else {
        restockCycle = 5; // Restock every 5 days
        minStock = 8;
        maxStock = 70;
      }
      
      for (let day = 0; day < 60; day++) {
        const currentDate = new Date(baseDate);
        currentDate.setDate(baseDate.getDate() + day);
        
        // Create 3-5 records per day
        const recordsPerDay = Math.floor(Math.random() * 3) + 3;
        
        for (let record = 0; record < recordsPerDay; record++) {
          const recordTime = new Date(currentDate);
          recordTime.setHours(6 + (record * 3) + Math.floor(Math.random() * 2)); // 6am, 9am, 12pm, 3pm, 6pm
          recordTime.setMinutes(Math.floor(Math.random() * 60));
          
          // Calculate stock level based on restocking cycle
          const dayInCycle = day % restockCycle;
          let stockPercentage;
          
          if (dayInCycle === 0) {
            // Restock day - high stock
            stockPercentage = maxStock + (Math.random() * 10 - 5);
          } else if (dayInCycle === restockCycle - 1) {
            // Day before restock - low stock
            stockPercentage = minStock + (Math.random() * 5);
          } else {
            // Normal consumption - gradual decrease
            const cycleProgress = dayInCycle / restockCycle;
            stockPercentage = maxStock - (cycleProgress * (maxStock - minStock)) + (Math.random() * 10 - 5);
          }
          
          // Add some daily variation
          const dailyVariation = Math.sin((day / 7) * Math.PI * 2) * 5; // Weekly pattern
          stockPercentage += dailyVariation;
          
          // Ensure stock percentage is within valid range
          stockPercentage = Math.max(0, Math.min(100, stockPercentage));
          
          stockRecords.push({
            shelfId: shelf._id,
            productId: product._id,
            stockPercentage: Math.round(stockPercentage),
            stockCount: Math.round(stockPercentage * shelf.capacity / 100),
            detectionMethod: 'computer_vision',
            confidence: 0.8 + (Math.random() * 0.2), // 80-100% confidence
            timestamp: recordTime,
            tags: ['restock_cycle', 'automated']
          });
        }
      }
      
      // Insert all records for this product
      await StockLevel.insertMany(stockRecords);
      console.log(`✅ Generated ${stockRecords.length} records for ${product.name} (${restockCycle}-day cycle)`);
    }

    console.log('\n🎉 Restocking cycle data generation completed!');
    console.log('🔄 Restocking cycles created:');
    console.log('   • Banana: 7-day cycle (weekly restocking)');
    console.log('   • Milk: 3-day cycle (every 3 days)');
    console.log('   • Bread: 2-day cycle (every 2 days)');
    console.log('   • Broccoli: 5-day cycle (every 5 days)');
    console.log('\n📊 You can now test restock pattern analysis with clear cycles!');

  } catch (error) {
    console.error('❌ Error generating restocking cycles:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  generateRestockCycles();
}

module.exports = generateRestockCycles;
