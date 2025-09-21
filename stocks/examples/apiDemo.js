const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/stocks';

// Example usage of the Stock Tracking API
async function demonstrateAPI() {
  try {
    console.log('🚀 Stock Tracking System API Demo\n');

    // 1. Record some stock changes
    console.log('1. Recording stock changes...');
    
    const stockChanges = [
      { productId: 'PROD001', change: 100, reason: 'restock' },
      { productId: 'PROD001', change: -15, reason: 'sale' },
      { productId: 'PROD001', change: -8, reason: 'sale' },
      { productId: 'PROD001', change: 50, reason: 'restock' },
      { productId: 'PROD001', change: -12, reason: 'sale' },
      { productId: 'PROD001', change: -5, reason: 'sale' },
      { productId: 'PROD001', change: 30, reason: 'restock' }
    ];

    for (const change of stockChanges) {
      const response = await axios.post(`${BASE_URL}/update`, change);
      console.log(`   Recorded: ${change.change} units (${change.reason}) - Stock Level: ${response.data.data.stockLevel}`);
    }

    // 2. Get current stock level
    console.log('\n2. Getting current stock level...');
    const currentResponse = await axios.get(`${BASE_URL}/current?productId=PROD001`);
    console.log(`   Current stock level: ${currentResponse.data.data.currentStockLevel}`);

    // 3. Get historical data
    console.log('\n3. Getting historical data (daily aggregation)...');
    const historyResponse = await axios.get(`${BASE_URL}/history?productId=PROD001&period=daily`);
    console.log(`   Found ${historyResponse.data.data.length} daily records`);
    
    if (historyResponse.data.data.length > 0) {
      console.log('   Sample daily data:');
      historyResponse.data.data.slice(0, 3).forEach(record => {
        console.log(`     Date: ${record.date.split('T')[0]}, Avg Stock: ${record.avgStockLevel.toFixed(2)}, Total Change: ${record.totalChange}`);
      });
    }

    // 4. Get trend analysis
    console.log('\n4. Getting trend analysis...');
    const trendResponse = await axios.get(`${BASE_URL}/trend?productId=PROD001&period=daily&window=3`);
    console.log(`   Trend: ${trendResponse.data.trend}`);
    console.log(`   Moving average window: ${trendResponse.data.window}`);
    
    if (trendResponse.data.movingAverage.length > 0) {
      const validAverages = trendResponse.data.movingAverage.filter(avg => avg !== null);
      if (validAverages.length > 0) {
        console.log(`   Latest moving average: ${validAverages[validAverages.length - 1]}`);
      }
    }

    // 5. Analyze restocking pattern
    console.log('\n5. Analyzing restocking pattern...');
    const patternResponse = await axios.get(`${BASE_URL}/restock-pattern?productId=PROD001`);
    console.log(`   Pattern type: ${patternResponse.data.pattern}`);
    console.log(`   Average interval: ${patternResponse.data.averageInterval ? patternResponse.data.averageInterval.toFixed(2) + ' days' : 'N/A'}`);
    console.log(`   Confidence: ${(patternResponse.data.confidence * 100).toFixed(1)}%`);
    
    if (patternResponse.data.nextPredictedRestock) {
      console.log(`   Next predicted restock: ${new Date(patternResponse.data.nextPredictedRestock).toLocaleDateString()}`);
    }

    console.log('\n✅ API demonstration completed successfully!');

  } catch (error) {
    console.error('❌ Error during API demonstration:', error.response?.data || error.message);
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateAPI();
}

module.exports = demonstrateAPI;
