// models/NAV.js - Fund NAV history storage (mirrors CryptoPrice structure)
const mongoose = require('mongoose');

const navSchema = new mongoose.Schema({
    fundSymbol: {
        type: String,
        required: true,
        uppercase: true,
        index: true,
        enum: ['CDTGR', 'CDTBAL', 'CDTPIO', 'CDTARC']
    },
    date: {
        type: Date,
        required: true,
        index: true
    },
    nav: {
        type: Number,
        required: true,
        min: 0
    },
    dailyChange: {
        type: Number,
        default: 0
    },
    dailyChangePercent: {
        type: Number,
        default: 0
    },
    totalReturn: {
        type: Number,
        default: 0
    },
    totalReturnPercent: {
        type: Number,
        default: 0
    },
    granularity: {
        type: String,
        required: true,
        enum: ['daily', 'weekly', 'monthly'],
        index: true
    },
    source: {
        type: String,
        default: 'calculated',
        enum: ['calculated', 'weekly_sample', 'monthly_sample']
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
navSchema.index({ fundSymbol: 1, granularity: 1, date: -1 });
navSchema.index({ date: -1, granularity: 1 });
navSchema.index({ fundSymbol: 1, date: -1 });

// Unique constraint to prevent duplicate entries
navSchema.index({ fundSymbol: 1, date: 1, granularity: 1 }, { unique: true });

// Virtual for formatted NAV display
navSchema.virtual('formattedNAV').get(function() {
    return '$' + this.nav.toFixed(4);
});

// Virtual for formatted returns
navSchema.virtual('formattedTotalReturn').get(function() {
    const sign = this.totalReturn >= 0 ? '+' : '';
    return sign + this.totalReturn.toFixed(2);
});

// Virtual for formatted daily change
navSchema.virtual('formattedDailyChange').get(function() {
    const sign = this.dailyChange >= 0 ? '+' : '';
    return sign + this.dailyChange.toFixed(4);
});

// Static method to get chart data for specific timeframes
navSchema.statics.getChartData = function(fundSymbol, timeframe) {
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
        fundSymbol: fundSymbol.toUpperCase(),
        granularity,
        date: { $gte: startDate }
    }).sort({ date: 1 }).select('date nav dailyChangePercent totalReturnPercent');
};

// Static method to bulk insert NAV data
navSchema.statics.bulkInsertNAVData = function(dataArray) {
    return this.insertMany(dataArray, { 
        ordered: false,
        rawResult: true 
    });
};

// Static method to get latest NAV for a fund
navSchema.statics.getLatestNAV = function(fundSymbol, granularity = 'daily') {
    return this.findOne({ 
        fundSymbol: fundSymbol.toUpperCase(),
        granularity 
    }).sort({ date: -1 }).select('nav date totalReturnPercent');
};

// Static method to get fund performance summary
navSchema.statics.getPerformanceSummary = async function(fundSymbol) {
    try {
        const latestEntry = await this.findOne({ 
            fundSymbol: fundSymbol.toUpperCase(),
            granularity: 'daily'
        }).sort({ date: -1 });
        
        if (!latestEntry) {
            return {
                currentNAV: 0,
                totalReturn: 0,
                totalReturnPercent: 0,
                dailyChange: 0,
                dailyChangePercent: 0,
                lastUpdated: null
            };
        }
        
        return {
            currentNAV: latestEntry.nav,
            totalReturn: latestEntry.totalReturn,
            totalReturnPercent: latestEntry.totalReturnPercent,
            dailyChange: latestEntry.dailyChange,
            dailyChangePercent: latestEntry.dailyChangePercent,
            lastUpdated: latestEntry.date
        };
        
    } catch (error) {
        console.error('Error getting performance summary:', error);
        throw error;
    }
};

// Static method to delete old daily data (rolling window maintenance)
navSchema.statics.deleteOldDailyData = function(daysToKeep = 90) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    return this.deleteMany({
        granularity: 'daily',
        date: { $lt: cutoffDate }
    });
};

// Static method to check data gaps for a fund
navSchema.statics.checkDataGaps = async function(fundSymbol, granularity, startDate, endDate) {
    const existingDates = await this.find({
        fundSymbol: fundSymbol.toUpperCase(),
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

// Instance method to get display data
navSchema.methods.getDisplayData = function() {
    return {
        fundSymbol: this.fundSymbol,
        date: this.date,
        nav: this.formattedNAV,
        dailyChange: this.formattedDailyChange,
        dailyChangePercent: this.dailyChangePercent.toFixed(2),
        totalReturn: this.formattedTotalReturn,
        totalReturnPercent: this.totalReturnPercent.toFixed(2),
        granularity: this.granularity
    };
};

module.exports = mongoose.models.NAV || mongoose.model('NAV', navSchema);