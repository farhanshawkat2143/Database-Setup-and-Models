const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api/timeseries';

async function demonstrateRealTimeUpdates() {
  console.log('🚀 Real-Time Stock Updates Demo');
  console.log('=====================================\n');

  const products = ['PROD001', 'PROD002', 'PROD003'];
  
  // Function to record a stock change
  async function recordStockChange(productId, change, reason) {
    try {
      const response = await axios.post(`${API_BASE_URL}/record`, {
        productId: productId,
        change: change,
        reason: reason,
        timestamp: new Date().toISOString()
      });
      
      console.log(`📝 Recorded: ${productId} ${change > 0 ? '+' : ''}${change} (${reason})`);
      console.log(`   New Stock Level: ${response.data.data.stockLevel}`);
      console.log(`   Velocity: ${response.data.data.velocity}`);
      console.log(`   Acceleration: ${response.data.data.acceleration}`);
      console.log(`   Timestamp: ${new Date(response.data.data.timestamp).toLocaleTimeString()}`);
      console.log('');
      
      return response.data.data;
    } catch (error) {
      console.error(`❌ Error recording change for ${productId}:`, error.message);
    }
  }

  // Function to get current stock level
  async function getCurrentStock(productId) {
    try {
      const response = await axios.get(`http://localhost:3000/api/stocks/current?productId=${productId}`);
      return response.data.data.currentStockLevel;
    } catch (error) {
      console.error(`❌ Error getting current stock for ${productId}:`, error.message);
      return 0;
    }
  }

  console.log('📊 Current Stock Levels:');
  for (const productId of products) {
    const currentStock = await getCurrentStock(productId);
    console.log(`   ${productId}: ${currentStock}`);
  }
  console.log('');

  // Simulate real-time updates
  console.log('🔄 Simulating Real-Time Updates...\n');

  // Update 1: Restock PROD001
  await recordStockChange('PROD001', 30, 'restock');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

  // Update 2: Sale from PROD002
  await recordStockChange('PROD002', -10, 'sale');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

  // Update 3: Adjustment to PROD003
  await recordStockChange('PROD003', 15, 'adjustment');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

  // Update 4: Another sale from PROD001
  await recordStockChange('PROD001', -25, 'sale');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

  // Update 5: Restock PROD002
  await recordStockChange('PROD002', 40, 'restock');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

  console.log('📊 Final Stock Levels:');
  for (const productId of products) {
    const currentStock = await getCurrentStock(productId);
    console.log(`   ${productId}: ${currentStock}`);
  }

  console.log('\n✅ Real-time updates completed!');
  console.log('🌐 Check your frontend dashboard at http://localhost:3000');
  console.log('📡 Real-time updates should appear automatically if SSE is connected');
  console.log('\n📋 What to look for on the frontend:');
  console.log('   • Current stock level cards should update automatically');
  console.log('   • Toast notifications should appear for each update');
  console.log('   • Real-time indicator should show "Live" status');
  console.log('   • Charts should update with new data points');
}

// Run the demonstration
if (require.main === module) {
  demonstrateRealTimeUpdates().catch(console.error);
}

module.exports = demonstrateRealTimeUpdates;