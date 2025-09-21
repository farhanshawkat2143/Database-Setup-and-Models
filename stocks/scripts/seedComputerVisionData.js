const mongoose = require('mongoose');
const User = require('../models/User');
const Camera = require('../models/Camera');
const Shelf = require('../models/Shelf');
const Product = require('../models/Product');
const Image = require('../models/Image');
const StockLevel = require('../models/StockLevel');
const Alert = require('../models/Alert');
require('dotenv').config({ path: './config.env' });

async function seedComputerVisionData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stock-tracking');
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Camera.deleteMany({}),
      Shelf.deleteMany({}),
      Product.deleteMany({}),
      Image.deleteMany({}),
      StockLevel.deleteMany({}),
      Alert.deleteMany({})
    ]);
    console.log('🗑️ Cleared existing data');

    // 1. Create Users
    console.log('👥 Creating users...');
    const users = await User.insertMany([
      {
        username: 'admin',
        email: 'admin@stocktracking.com',
        password_hash: 'admin123', // Will be hashed automatically
        role: 'admin'
      },
      {
        username: 'manager1',
        email: 'manager@stocktracking.com',
        password_hash: 'manager123',
        role: 'manager'
      },
      {
        username: 'staff1',
        email: 'staff@stocktracking.com',
        password_hash: 'staff123',
        role: 'staff'
      }
    ]);
    console.log(`✅ Created ${users.length} users`);

    // 2. Create Cameras
    console.log('📹 Creating cameras...');
    const cameras = await Camera.insertMany([
      {
        name: 'Camera A1',
        location: 'Aisle 1 - Fresh Produce',
        rtspUrl: 'rtsp://192.168.1.100:554/stream1',
        status: 'online',
        resolution: { width: 1920, height: 1080 },
        fps: 30
      },
      {
        name: 'Camera A2',
        location: 'Aisle 2 - Dairy Products',
        rtspUrl: 'rtsp://192.168.1.101:554/stream1',
        status: 'online',
        resolution: { width: 1920, height: 1080 },
        fps: 30
      },
      {
        name: 'Camera A3',
        location: 'Aisle 3 - Bakery',
        rtspUrl: 'rtsp://192.168.1.102:554/stream1',
        status: 'offline',
        resolution: { width: 1920, height: 1080 },
        fps: 30
      }
    ]);
    console.log(`✅ Created ${cameras.length} cameras`);

    // 3. Create Shelves
    console.log('📦 Creating shelves...');
    const shelves = await Shelf.insertMany([
      {
        shelfName: 'Shelf A1-1',
        cameraId: cameras[0]._id,
        locationDescription: 'Top shelf - Fresh fruits',
        coordinates: { x: 1, y: 1, z: 2 },
        dimensions: { width: 120, height: 40, depth: 60 },
        capacity: 50
      },
      {
        shelfName: 'Shelf A1-2',
        cameraId: cameras[0]._id,
        locationDescription: 'Middle shelf - Fresh vegetables',
        coordinates: { x: 1, y: 1, z: 1 },
        dimensions: { width: 120, height: 40, depth: 60 },
        capacity: 50
      },
      {
        shelfName: 'Shelf A2-1',
        cameraId: cameras[1]._id,
        locationDescription: 'Top shelf - Milk products',
        coordinates: { x: 2, y: 1, z: 2 },
        dimensions: { width: 120, height: 40, depth: 60 },
        capacity: 30
      },
      {
        shelfName: 'Shelf A3-1',
        cameraId: cameras[2]._id,
        locationDescription: 'Bakery display',
        coordinates: { x: 3, y: 1, z: 1 },
        dimensions: { width: 120, height: 40, depth: 60 },
        capacity: 40
      }
    ]);
    console.log(`✅ Created ${shelves.length} shelves`);

    // 4. Create Products
    console.log('🛍️ Creating products...');
    const products = await Product.insertMany([
      {
        name: 'Banana',
        category: 'Fruit',
        imageUrl: '/images/banana.jpg',
        description: 'Fresh yellow bananas',
        sku: 'FRUIT-BAN-001',
        barcode: '1234567890123',
        unit: 'kg',
        minStockLevel: 10,
        maxStockLevel: 50
      },
      {
        name: 'Broccoli',
        category: 'Vegetable',
        imageUrl: '/images/broccoli.jpg',
        description: 'Fresh green broccoli',
        sku: 'VEG-BRO-001',
        barcode: '1234567890124',
        unit: 'piece',
        minStockLevel: 5,
        maxStockLevel: 30
      },
      {
        name: 'Milk',
        category: 'Dairy',
        imageUrl: '/images/milk.jpg',
        description: 'Fresh whole milk',
        sku: 'DAIRY-MIL-001',
        barcode: '1234567890125',
        unit: 'liter',
        minStockLevel: 8,
        maxStockLevel: 25
      },
      {
        name: 'Bread',
        category: 'Bakery',
        imageUrl: '/images/bread.jpg',
        description: 'Fresh white bread',
        sku: 'BAKE-BRE-001',
        barcode: '1234567890126',
        unit: 'piece',
        minStockLevel: 5,
        maxStockLevel: 20
      }
    ]);
    console.log(`✅ Created ${products.length} products`);

    // 5. Create Images
    console.log('📸 Creating images...');
    const images = [];
    const baseDate = new Date();
    
    for (let i = 0; i < 20; i++) {
      const shelf = shelves[i % shelves.length];
      const product = products[i % products.length];
      
      images.push({
        shelfId: shelf._id,
        productId: product._id,
        filename: `image_${i + 1}.jpg`,
        originalFilename: `shelf_${shelf.shelfName}_${product.name}_${i + 1}.jpg`,
        filePath: `/uploads/images/image_${i + 1}.jpg`,
        fileSize: Math.floor(Math.random() * 5000000) + 1000000, // 1-6MB
        mimeType: 'image/jpeg',
        dimensions: { width: 1920, height: 1080 },
        uploadTime: new Date(baseDate.getTime() - (i * 60 * 60 * 1000)), // Hourly intervals
        processed: Math.random() > 0.3, // 70% processed
        processingStatus: Math.random() > 0.3 ? 'completed' : 'pending',
        processingResults: Math.random() > 0.3 ? {
          detectedStockLevel: Math.floor(Math.random() * 100),
          confidence: Math.random(),
          boundingBoxes: [{
            x: Math.floor(Math.random() * 100),
            y: Math.floor(Math.random() * 100),
            width: Math.floor(Math.random() * 200) + 50,
            height: Math.floor(Math.random() * 200) + 50,
            confidence: Math.random()
          }]
        } : null,
        tags: ['computer_vision', 'stock_detection']
      });
    }
    
    const savedImages = await Image.insertMany(images);
    console.log(`✅ Created ${savedImages.length} images`);

    // 6. Create Stock Levels
    console.log('📊 Creating stock levels...');
    const stockLevels = [];
    
    for (let i = 0; i < 100; i++) {
      const shelf = shelves[i % shelves.length];
      const product = products[i % products.length];
      const image = savedImages[i % savedImages.length];
      
      const stockPercentage = Math.floor(Math.random() * 100);
      const timestamp = new Date(baseDate.getTime() - (i * 30 * 60 * 1000)); // 30-minute intervals
      
      stockLevels.push({
        shelfId: shelf._id,
        productId: product._id,
        stockPercentage: stockPercentage,
        stockCount: Math.floor(stockPercentage * shelf.capacity / 100),
        detectionMethod: 'computer_vision',
        confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
        imageId: image._id,
        timestamp: timestamp,
        tags: ['cv_detection', 'automated']
      });
    }
    
    const savedStockLevels = await StockLevel.insertMany(stockLevels);
    console.log(`✅ Created ${savedStockLevels.length} stock levels`);

    // 7. Create Alerts
    console.log('🚨 Creating alerts...');
    const alerts = [];
    
    // Find low stock levels
    const lowStockLevels = savedStockLevels.filter(sl => sl.stockPercentage < 20);
    
    for (const stockLevel of lowStockLevels.slice(0, 10)) {
      const product = products.find(p => p._id.equals(stockLevel.productId));
      const shelf = shelves.find(s => s._id.equals(stockLevel.shelfId));
      
      alerts.push({
        stockId: stockLevel._id,
        alertType: stockLevel.stockPercentage === 0 ? 'out_of_stock' : 'low_stock',
        message: `${product.name} on ${shelf.shelfName} is at ${stockLevel.stockPercentage}% (${stockLevel.stockCount} units)`,
        severity: stockLevel.stockPercentage === 0 ? 'critical' : 'high',
        metadata: {
          shelfName: shelf.shelfName,
          productName: product.name,
          stockPercentage: stockLevel.stockPercentage,
          stockCount: stockLevel.stockCount
        },
        tags: ['low_stock', 'computer_vision']
      });
    }
    
    // Add some system alerts
    alerts.push({
      stockId: null,
      alertType: 'camera_offline',
      message: 'Camera A3 is offline - Bakery monitoring unavailable',
      severity: 'medium',
      metadata: {
        cameraName: 'Camera A3',
        location: 'Aisle 3 - Bakery'
      },
      tags: ['system', 'camera']
    });
    
    const savedAlerts = await Alert.insertMany(alerts);
    console.log(`✅ Created ${savedAlerts.length} alerts`);

    console.log('\n🎉 Computer Vision Data Seeding Completed!');
    console.log('==========================================');
    console.log(`👥 Users: ${users.length}`);
    console.log(`📹 Cameras: ${cameras.length}`);
    console.log(`📦 Shelves: ${shelves.length}`);
    console.log(`🛍️ Products: ${products.length}`);
    console.log(`📸 Images: ${savedImages.length}`);
    console.log(`📊 Stock Levels: ${savedStockLevels.length}`);
    console.log(`🚨 Alerts: ${savedAlerts.length}`);
    
    console.log('\n📋 Sample Data Created:');
    console.log('• Admin user: admin/admin123');
    console.log('• Manager user: manager1/manager123');
    console.log('• Staff user: staff1/staff123');
    console.log('• 3 cameras (2 online, 1 offline)');
    console.log('• 4 shelves with different products');
    console.log('• 4 products (Banana, Broccoli, Milk, Bread)');
    console.log('• 20 images with processing results');
    console.log('• 100 stock level records');
    console.log('• Multiple alerts for low stock and system issues');

  } catch (error) {
    console.error('❌ Error seeding computer vision data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  seedComputerVisionData();
}

module.exports = seedComputerVisionData;
