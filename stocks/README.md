# Stock Tracking System

A comprehensive time-series stock tracking system built with Node.js, Express, and MongoDB. This system provides real-time stock level tracking, historical data analysis, trend detection, and restocking pattern recognition.

## Features

- **Real-time Stock Tracking**: Record stock changes with automatic level calculation
- **Historical Data Analysis**: Aggregate data by daily, weekly, monthly, and quarterly periods
- **Trend Analysis**: Moving average calculations and trend detection
- **Pattern Recognition**: Detect restocking cycles and predict next restock dates
- **RESTful API**: Complete API endpoints for all functionality
- **Comprehensive Testing**: Unit tests for all features

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: MongoDB with Mongoose ODM
- **Testing**: Jest + Supertest
- **Validation**: Express-validator

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd stocks
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp config.env.example config.env
   # Edit config.env with your MongoDB connection string
   ```

4. **Start MongoDB**
   ```bash
   # Make sure MongoDB is running on your system
   mongod
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Stock Management

- `POST /api/stocks/update` - Record a stock change
- `GET /api/stocks/current?productId=123` - Get current stock level

### Historical Data

- `GET /api/stocks/history?productId=123&from=2025-01-01&to=2025-03-01&period=daily` - Get historical data

### Analysis

- `GET /api/stocks/trend?productId=123&period=weekly&window=7` - Get trend analysis
- `GET /api/stocks/restock-pattern?productId=123` - Analyze restocking patterns

## API Usage Examples

### Record a Stock Change
```bash
curl -X POST http://localhost:3000/api/stocks/update \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PROD001",
    "change": 50,
    "reason": "restock"
  }'
```

### Get Historical Data
```bash
curl "http://localhost:3000/api/stocks/history?productId=PROD001&from=2025-01-01&to=2025-03-01&period=daily"
```

### Get Trend Analysis
```bash
curl "http://localhost:3000/api/stocks/trend?productId=PROD001&period=weekly&window=7"
```

### Analyze Restocking Pattern
```bash
curl "http://localhost:3000/api/stocks/restock-pattern?productId=PROD001"
```

## Database Schema

### StockHistory Model
```javascript
{
  productId: String,      // Product identifier
  timestamp: Date,        // When the change occurred
  change: Number,         // Positive for restock, negative for sales
  stockLevel: Number,     // Resulting stock level after change
  reason: String          // "restock", "sale", or "adjustment"
}
```

**Indexes:**
- Single index on `productId`
- Single index on `timestamp`
- Compound index on `productId` and `timestamp` for efficient queries

## Testing

Run the test suite:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## Data Aggregation Periods

The system supports multiple aggregation periods:

- **Daily**: Groups data by day
- **Weekly**: Groups data by week
- **Monthly**: Groups data by month
- **Quarterly**: Groups data by quarter

Each aggregation includes:
- Average stock level
- Minimum stock level
- Maximum stock level
- Total change amount
- Record count

## Trend Analysis

The trend analysis feature provides:

- **Moving Average**: Calculates moving average over specified window
- **Trend Direction**: Determines if stock is increasing, decreasing, or stable
- **Confidence Metrics**: Provides confidence levels for predictions

## Pattern Recognition

The restocking pattern analysis includes:

- **Pattern Type**: Regular, irregular, or insufficient data
- **Average Interval**: Average days between restocks
- **Next Predicted Restock**: Estimated next restock date
- **Confidence Score**: Reliability of the prediction

## Performance Considerations

- **Indexes**: Optimized database indexes for fast queries
- **Aggregation Pipelines**: Efficient MongoDB aggregation for large datasets
- **Pagination**: Built-in support for handling large result sets
- **Caching**: Ready for Redis integration for frequently accessed data

## Error Handling

- Comprehensive input validation
- Graceful error responses
- Database connection error handling
- Edge case management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details
