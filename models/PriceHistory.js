const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
    cryptoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CryptoAsset',
        required: true
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true
    },
    date: {
        type: Date,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    volume: {
        type: Number,
        default: 0,
        min: 0
    },
    marketCap: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Data granularity for efficient chart queries
    granularity: {
        type: String,
        required: true,
        enum: ['daily', 'weekly', 'monthly']
    },
    
    // TTL field - MongoDB will automatically delete documents based on this
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false // We're managing dates manually
});

// Single TTL index with conditional logic
// We'll use the longest TTL (2 years) and handle cleanup programmatically if needed
priceHistorySchema.index({ 
    createdAt: 1 
}, { 
    expireAfterSeconds: 2 * 365 * 24 * 60 * 60  // 2 years for all data
});

// Compound indexes for efficient chart queries
priceHistorySchema.index({ symbol: 1, granularity: 1, date: -1 });
priceHistorySchema.index({ cryptoId: 1, granularity: 1, date: -1 });
priceHistorySchema.index({ date: -1, granularity: 1 });

// Virtual for price change
priceHistorySchema.virtual('formattedPrice').get(function() {
    return this.price < 1 
        ? this.price.toFixed(6)
        : this.price.toFixed(2);
});

// Static method to get chart data for specific timeframes
priceHistorySchema.statics.getChartData = function(symbol, timeframe) {
    const now = new Date();
    let startDate, granularity;
    
    switch (timeframe) {
        case '1M':
            startDate = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
            granularity = 'daily';
            break;
        case '6M':
            startDate = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
            granularity = 'weekly';
            break;
        case '1Y':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            granularity = 'weekly';
            break;
        case '5Y':
            startDate = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
            granularity = 'monthly';
            break;
        case 'ALL':
            startDate = new Date('2018-01-01');
            granularity = 'monthly';
            break;
        default:
            startDate = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
            granularity = 'daily';
    }
    
    return this.find({
        symbol,
        granularity,
        date: { $gte: startDate }
    }).sort({ date: 1 }).select('date price volume');
};

// Static method to add price data
priceHistorySchema.statics.addPriceData = function(cryptoId, symbol, price, granularity, date = new Date(), volume = 0, marketCap = 0) {
    return this.create({
        cryptoId,
        symbol: symbol.toUpperCase(),
        date,
        price,
        volume,
        marketCap,
        granularity
    });
};

// Static method to get latest price for a crypto
priceHistorySchema.statics.getLatestPrice = function(symbol) {
    return this.findOne({ symbol: symbol.toUpperCase() })
        .sort({ date: -1 })
        .select('price date');
};

// Static method to bulk insert historical data
priceHistorySchema.statics.bulkInsertHistoricalData = function(dataArray) {
    return this.insertMany(dataArray, { ordered: false });
};

// Static method to calculate price change percentage
priceHistorySchema.statics.getPriceChange = async function(symbol, days = 1) {
    const latest = await this.findOne({ symbol })
        .sort({ date: -1 });
        
    const previous = await this.findOne({ 
        symbol,
        date: { $lte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
    }).sort({ date: -1 });
    
    if (!latest || !previous) return null;
    
    const change = latest.price - previous.price;
    const changePercent = (change / previous.price) * 100;
    
    return {
        current: latest.price,
        previous: previous.price,
        change,
        changePercent,
        days
    };
};

module.exports = mongoose.model('PriceHistory', priceHistorySchema);