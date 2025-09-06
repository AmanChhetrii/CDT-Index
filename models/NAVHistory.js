const mongoose = require('mongoose');

const navHistorySchema = new mongoose.Schema({
    fundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fund',
        required: true
    },
    fundSymbol: {
        type: String,
        required: true,
        uppercase: true
    },
    date: {
        type: Date,
        required: true
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
    totalAssets: {
        type: Number,
        default: 0
    },
    
    // Performance metrics
    totalReturn: {
        type: Number,
        default: 0
    },
    totalReturnPercent: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
navHistorySchema.index({ fundId: 1, date: -1 });
navHistorySchema.index({ fundSymbol: 1, date: -1 });
navHistorySchema.index({ date: -1 });

// Virtual for formatted NAV
navHistorySchema.virtual('formattedNAV').get(function() {
    return '$' + this.nav.toFixed(4);
});

// Static method to add NAV history entry
navHistorySchema.statics.addNAVEntry = async function(fundId, fundSymbol, nav, date = new Date()) {
    try {
        // Get previous NAV for comparison
        const previousEntry = await this.findOne({ 
            fundId, 
            date: { $lt: date } 
        }).sort({ date: -1 });
        
        let dailyChange = 0;
        let dailyChangePercent = 0;
        
        if (previousEntry) {
            dailyChange = nav - previousEntry.nav;
            dailyChangePercent = (dailyChange / previousEntry.nav) * 100;
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
            totalReturnPercent
        });
        
    } catch (error) {
        console.error('Error adding NAV history entry:', error);
        throw error;
    }
};

// Static method to get NAV history for charts
navHistorySchema.statics.getChartData = function(fundId, timeframe = '1M') {
    const now = new Date();
    let startDate;
    
    switch (timeframe) {
        case '1M':
            startDate = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
            break;
        case '3M':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        case '6M':
            startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
            break;
        case '1Y':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
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
navHistorySchema.statics.getPerformanceSummary = async function(fundId) {
    try {
        const latestEntry = await this.findOne({ fundId }).sort({ date: -1 });
        
        if (!latestEntry) {
            return {
                currentNAV: 0,
                totalReturn: 0,
                totalReturnPercent: 0,
                dailyChange: 0,
                dailyChangePercent: 0
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
                const periodReturnPercent = (periodReturn / periodEntry.nav) * 100;
                
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

// Static method to bulk insert historical NAV data
navHistorySchema.statics.bulkInsertNAVHistory = function(dataArray) {
    return this.insertMany(dataArray, { ordered: false });
};

module.exports = mongoose.model('NAVHistory', navHistorySchema);