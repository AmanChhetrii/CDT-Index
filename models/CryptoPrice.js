// models/CryptoPrice.js - Raw cryptocurrency price data storage
const mongoose = require('mongoose');

const cryptoPriceSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        index: true
    },
    date: {
        type: Date,
        required: true,
        index: true
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
    granularity: {
        type: String,
        required: true,
        enum: ['daily', 'weekly', 'monthly'],
        index: true
    },
    source: {
        type: String,
        default: 'coingecko',
        enum: ['coingecko', 'coinmarketcap', 'cryptocompare']
    }
}, {
    timestamps: true
});

// Compound indexes for efficient chart queries
cryptoPriceSchema.index({ symbol: 1, granularity: 1, date: -1 });
cryptoPriceSchema.index({ date: -1, granularity: 1 });
cryptoPriceSchema.index({ symbol: 1, date: -1 });

// Unique constraint to prevent duplicate entries
cryptoPriceSchema.index({ symbol: 1, date: 1, granularity: 1 }, { unique: true });

// Static method to get chart data for specific timeframes
cryptoPriceSchema.statics.getChartData = function(symbol, timeframe) {
    const now = new Date();
    let startDate, granularity;
    
    switch (timeframe.toUpperCase()) {
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
        symbol: symbol.toUpperCase(),
        granularity,
        date: { $gte: startDate }
    }).sort({ date: 1 }).select('date price volume');
};

// Static method to bulk insert price data
cryptoPriceSchema.statics.bulkInsertPriceData = function(dataArray) {
    return this.insertMany(dataArray, { 
        ordered: false,
        rawResult: true 
    });
};

// Static method to get latest price for a cryptocurrency
cryptoPriceSchema.statics.getLatestPrice = function(symbol, granularity = 'daily') {
    return this.findOne({ 
        symbol: symbol.toUpperCase(),
        granularity 
    }).sort({ date: -1 }).select('price date');
};

// Static method to check data gaps for a cryptocurrency
cryptoPriceSchema.statics.checkDataGaps = async function(symbol, granularity, startDate, endDate) {
    const existingDates = await this.find({
        symbol: symbol.toUpperCase(),
        granularity,
        date: { $gte: startDate, $lte: endDate }
    }).distinct('date').sort();
    
    const gaps = [];
    let expectedDate = new Date(startDate);
    
    // Calculate expected interval based on granularity
    let interval;
    switch (granularity) {
        case 'daily':
            interval = 24 * 60 * 60 * 1000; // 1 day
            break;
        case 'weekly':
            interval = 7 * 24 * 60 * 60 * 1000; // 7 days
            break;
        case 'monthly':
            interval = 30 * 24 * 60 * 60 * 1000; // 30 days (approximate)
            break;
    }
    
    while (expectedDate <= endDate) {
        const foundDate = existingDates.find(date => 
            Math.abs(date.getTime() - expectedDate.getTime()) < interval / 2
        );
        
        if (!foundDate) {
            gaps.push(new Date(expectedDate));
        }
        
        expectedDate = new Date(expectedDate.getTime() + interval);
    }
    
    return gaps;
};

// Static method to delete old daily data (rolling window)
cryptoPriceSchema.statics.deleteOldDailyData = function(daysToKeep = 30) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    return this.deleteMany({
        granularity: 'daily',
        date: { $lt: cutoffDate }
    });
};

module.exports = mongoose.models.CryptoPrice || mongoose.model('CryptoPrice', cryptoPriceSchema);