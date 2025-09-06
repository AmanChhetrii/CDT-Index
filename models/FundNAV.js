// models/FundNAV.js - Fund NAV calculation and storage schema
const mongoose = require('mongoose');

const fundNAVSchema = new mongoose.Schema({
    fundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fund',
        required: true,
        index: true
    },
    fundSymbol: {
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
    // Store the underlying asset prices used for this calculation (audit trail)
    underlyingPrices: {
        type: Map,
        of: Number,
        default: new Map()
    },
    // Store the weighted change calculation for debugging
    weightedChange: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
fundNAVSchema.index({ fundId: 1, date: -1 });
fundNAVSchema.index({ fundSymbol: 1, date: -1 });
fundNAVSchema.index({ date: -1 });

// Unique constraint to prevent duplicate NAV entries for same fund/date
fundNAVSchema.index({ fundId: 1, date: 1 }, { unique: true });

// Virtual for formatted NAV display
fundNAVSchema.virtual('formattedNAV').get(function() {
    return '$' + this.nav.toFixed(4);
});

// Virtual for formatted returns
fundNAVSchema.virtual('formattedTotalReturn').get(function() {
    const sign = this.totalReturn >= 0 ? '+' : '';
    return sign + this.totalReturn.toFixed(2);
});

// Virtual for formatted daily change
fundNAVSchema.virtual('formattedDailyChange').get(function() {
    const sign = this.dailyChange >= 0 ? '+' : '';
    return sign + this.dailyChange.toFixed(4);
});

// Static method to add NAV entry with all calculations
fundNAVSchema.statics.addNAVEntry = async function(fundId, fundSymbol, nav, date, underlyingPrices = {}, weightedChange = 0) {
    try {
        // Get previous NAV for daily change calculation
        const previousEntry = await this.findOne({ 
            fundId, 
            date: { $lt: date } 
        }).sort({ date: -1 });
        
        let dailyChange = 0;
        let dailyChangePercent = 0;
        
        if (previousEntry) {
            dailyChange = nav - previousEntry.nav;
            dailyChangePercent = previousEntry.nav > 0 ? (dailyChange / previousEntry.nav) * 100 : 0;
        }
        
        // Get fund inception NAV for total return calculation
        const Fund = mongoose.model('Fund');
        const fund = await Fund.findById(fundId);
        
        let totalReturn = 0;
        let totalReturnPercent = 0;
        
        if (fund && fund.inceptionNAV > 0) {
            totalReturn = nav - fund.inceptionNAV;
            totalReturnPercent = (totalReturn / fund.inceptionNAV) * 100;
        }
        
        return this.create({
            fundId,
            fundSymbol: fundSymbol.toUpperCase(),
            date,
            nav,
            dailyChange,
            dailyChangePercent,
            totalReturn,
            totalReturnPercent,
            underlyingPrices: new Map(Object.entries(underlyingPrices)),
            weightedChange
        });
        
    } catch (error) {
        console.error('Error adding NAV entry:', error);
        throw error;
    }
};

// Static method to get NAV chart data for different timeframes
fundNAVSchema.statics.getChartData = function(fundId, timeframe = '1M') {
    const now = new Date();
    let startDate;
    
    switch (timeframe.toUpperCase()) {
        case '1M':
            startDate = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
            break;
        case '6M':
            startDate = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
            break;
        case '1Y':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
        case '5Y':
            startDate = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
            break;
        case 'ALL':
            startDate = new Date('2018-01-01');
            break;
        default:
            startDate = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
    }
    
    return this.find({
        fundId,
        date: { $gte: startDate }
    }).sort({ date: 1 }).select('date nav dailyChangePercent totalReturnPercent');
};

// Static method to get fund performance summary
fundNAVSchema.statics.getPerformanceSummary = async function(fundId) {
    try {
        const latestEntry = await this.findOne({ fundId }).sort({ date: -1 });
        
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
        
        // Get performance for different periods
        const periods = {
            '1D': 1,
            '1W': 7,
            '1M': 30,
            '3M': 90,
            '1Y': 365
        };
        
        const performance = {
            currentNAV: latestEntry.nav,
            totalReturn: latestEntry.totalReturn,
            totalReturnPercent: latestEntry.totalReturnPercent,
            dailyChange: latestEntry.dailyChange,
            dailyChangePercent: latestEntry.dailyChangePercent,
            lastUpdated: latestEntry.date,
            periods: {}
        };
        
        for (const [period, days] of Object.entries(periods)) {
            const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            const periodEntry = await this.findOne({
                fundId,
                date: { $gte: startDate }
            }).sort({ date: 1 });
            
            if (periodEntry) {
                const periodReturn = latestEntry.nav - periodEntry.nav;
                const periodReturnPercent = periodEntry.nav > 0 ? (periodReturn / periodEntry.nav) * 100 : 0;
                
                performance.periods[period] = {
                    return: periodReturn,
                    returnPercent: periodReturnPercent
                };
            }
        }
        
        return performance;
        
    } catch (error) {
        console.error('Error getting performance summary:', error);
        throw error;
    }
};

// Static method to bulk insert NAV history data
fundNAVSchema.statics.bulkInsertNAVHistory = function(dataArray) {
    return this.insertMany(dataArray, { 
        ordered: false,
        rawResult: true 
    });
};

// Static method to get latest NAV for a fund
fundNAVSchema.statics.getLatestNAV = function(fundId) {
    return this.findOne({ fundId }).sort({ date: -1 }).select('nav date totalReturnPercent');
};

// Static method to calculate NAV statistics for a period
fundNAVSchema.statics.getNAVStatistics = function(fundId, startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                fundId: new mongoose.Types.ObjectId(fundId),
                date: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: null,
                minNAV: { $min: '$nav' },
                maxNAV: { $max: '$nav' },
                avgNAV: { $avg: '$nav' },
                count: { $sum: 1 },
                totalVolatility: { $stdDevPop: '$dailyChangePercent' }
            }
        }
    ]);
};

// Instance method to get display data
fundNAVSchema.methods.getDisplayData = function() {
    return {
        date: this.date,
        nav: this.formattedNAV,
        dailyChange: this.formattedDailyChange,
        dailyChangePercent: this.dailyChangePercent.toFixed(2),
        totalReturn: this.formattedTotalReturn,
        totalReturnPercent: this.totalReturnPercent.toFixed(2),
        underlyingPrices: Object.fromEntries(this.underlyingPrices)
    };
};

module.exports = mongoose.models.FundNAV || mongoose.model('FundNAV', fundNAVSchema);