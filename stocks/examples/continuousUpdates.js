const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api/timeseries';

async function continuousRealTimeUpdates() {
  console.log('🔄 Starting Continuous Real-Time Updates');
  console.log('==========================================');
  console.log('🌐 Open your browser to: http://localhost:3000');
  console.log('📡 Watch the dashboard update in real-time!');
  console.log('⏹️  Press Ctrl+C to stop\n');

  const products = ['PROD001', 'PROD002', 'PROD003'];
  const reasons = ['restock', 'sale', 'adjustment'];
  
  let updateCount = 0;
  
  const generateUpdate = async () => {
    try {
      const productId = products[Math.floor(Math.random() * products.length)];
      const reason = reasons[Math.floor(Math.random() * reasons.length)];
      
      // Generate realistic change amounts based on reason
      let change;
      switch (reason) {
        case 'restock':
          change = Math.floor(Math.random() * 50) + 20; // 20-70
          break;
        case 'sale':
          change = -(Math.floor(Math.random() * 20) + 5); // -5 to -25
          break;
        case 'adjustment':
          change = Math.floor(Math.random() * 20) - 10; // -10 to +10
          break;
      }
      
      const response = await axios.post(`${API_BASE_URL}/record`, {
        productId: productId,
        change: change,
        reason: reason,
        timestamp: new Date().toISOString()
      });
      
      updateCount++;
      console.log(`[${updateCount}] 📝 ${productId}: ${change > 0 ? '+' : ''}${change} (${reason}) → Stock: ${response.data.data.stockLevel}`);
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  };

  // Generate updates every 3-5 seconds
  const scheduleNextUpdate = () => {
    const delay = Math.floor(Math.random() * 2000) + 3000; // 3-5 seconds
    setTimeout(async () => {
      await generateUpdate();
      scheduleNextUpdate();
    }, delay);
  };

  // Start the continuous updates
  scheduleNextUpdate();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping continuous updates...');
  console.log('✅ Demo completed!');
  process.exit(0);
});

// Run the continuous demo
if (require.main === module) {
  continuousRealTimeUpdates().catch(console.error);
}

module.exports = continuousRealTimeUpdates;
