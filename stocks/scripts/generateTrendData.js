const mongoose = require('mongoose');
const StockLevel = require('../models/StockLevel');
const Product = require('../models/Product');
const Shelf = require('../models/Shelf');
require('dotenv').config({ path: './config.env' });

async function generateTrendData() {
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

    // Generate trend data for each product
    for (const product of products) {
      const shelf = shelves.find(s => s._id); // Use any shelf
      if (!shelf) continue;

      console.log(`📊 Generating trend data for ${product.name}...`);

      // Generate 30 days of data with different trends
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() - 30); // Start 30 days ago
      
      const stockRecords = [];
      
      for (let day = 0; day < 30; day++) {
        const currentDate = new Date(baseDate);
        currentDate.setDate(baseDate.getDate() + day);
        
        // Create 2-4 records per day (morning, afternoon, evening)
        const recordsPerDay = Math.floor(Math.random() * 3) + 2;
        
        for (let record = 0; record < recordsPerDay; record++) {
          const recordTime = new Date(currentDate);
          recordTime.setHours(8 + (record * 4) + Math.floor(Math.random() * 2)); // 8am, 12pm, 4pm, 8pm
          recordTime.setMinutes(Math.floor(Math.random() * 60));
          
          // Create different trend patterns
          let stockPercentage;
          const dayProgress = day / 30;
          
          if (product.name === 'Banana') {
            // Decreasing trend (going out of stock)
            stockPercentage = Math.max(5, 80 - (dayProgress * 70) + (Math.random() * 10 - 5));
          } else if (product.name === 'Milk') {
            // Stable trend with some variation
            stockPercentage = 50 + (Math.random() * 20 - 10) + Math.sin(dayProgress * Math.PI * 4) * 10;
          } else if (product.name === 'Bread') {
            // Increasing trend (being restocked)
            stockPercentage = Math.min(95, 20 + (dayProgress * 60) + (Math.random() * 10 - 5));
          } else {
            // Random trend
            stockPercentage = 30 + (Math.random() * 40) + Math.sin(dayProgress * Math.PI * 2) * 15;
          }
          
          // Ensure stock percentage is within valid range
          stockPercentage = Math.max(0, Math.min(100, stockPercentage));
          
          stockRecords.push({
            shelfId: shelf._id,
            productId: product._id,
            stockPercentage: Math.round(stockPercentage),
            stockCount: Math.round(stockPercentage * shelf.capacity / 100),
            detectionMethod: 'computer_vision',
            confidence: 0.7 + (Math.random() * 0.3), // 70-100% confidence
            timestamp: recordTime,
            tags: ['trend_generation', 'automated']
          });
        }
      }
      
      // Insert all records for this product
      await StockLevel.insertMany(stockRecords);
      console.log(`✅ Generated ${stockRecords.length} records for ${product.name}`);
    }

    console.log('\n🎉 Trend data generation completed!');
    console.log('📈 You can now test trend analysis with realistic data patterns:');
    console.log('   • Banana: Decreasing trend (going out of stock)');
    console.log('   • Milk: Stable trend with seasonal variation');
    console.log('   • Bread: Increasing trend (being restocked)');
    console.log('   • Broccoli: Random trend with cycles');

  } catch (error) {
    console.error('❌ Error generating trend data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  generateTrendData();
}

module.exports = generateTrendData;
