// models/Transaction.js - Separate transaction tracking
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    // User identification (from session)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    // Transaction basics
    transactionType: {
        type: String,
        required: true,
        enum: ['DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL'],
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    
    // Fund transaction details (null for cash transactions)
    fundSymbol: {
        type: String,
        sparse: true,
        uppercase: true
    },
    fundName: {
        type: String,
        sparse: true,
        trim: true
    },
    navPriceAtTransaction: {
        type: Number,
        sparse: true,
        min: 0
    },
    units: {
        type: Number,
        sparse: true,
        min: 0
    },
    totalValue: {
        type: Number,
        sparse: true,
        min: 0
    },
    
    // Fund composition snapshot at transaction time
    fundComposition: [{
        symbol: {
            type: String,
            uppercase: true
        },
        name: String,
        weight: {
            type: Number,
            min: 0,
            max: 1
        },
        priceAtTransaction: {
            type: Number,
            min: 0
        }
    }],
    
    // Fund risk and metadata at transaction time
    fundRiskLevel: {
        type: String,
        enum: ['Moderate', 'Balanced', 'High']
    },
    fundInceptionNAV: {
        type: Number,
        min: 0
    },
    fundTotalReturnAtTransaction: {
        type: Number
    },
    
    // Transaction context
    transactionDate: {
        type: Date,
        default: Date.now,
        index: true
    },
    balanceAfter: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Transaction metadata
    referenceId: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
        default: 'COMPLETED',
        index: true
    },
    fees: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Market context at transaction time
    marketCondition: {
        type: String,
        enum: ['BULL', 'BEAR', 'SIDEWAYS', 'VOLATILE'],
        default: 'SIDEWAYS'
    },
    
    // Performance tracking (calculated later)
    performanceMetrics: {
        holdingPeriodDays: {
            type: Number,
            default: 0
        },
        currentValueFromThisTransaction: {
            type: Number,
            default: 0
        },
        profitLossFromThisTransaction: {
            type: Number,
            default: 0
        },
        profitLossPercentage: {
            type: Number,
            default: 0
        },
        annualizedReturn: {
            type: Number,
            default: 0
        },
        lastPerformanceUpdate: {
            type: Date,
            default: Date.now
        }
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
transactionSchema.index({ userId: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, transactionType: 1, transactionDate: -1 });
transactionSchema.index({ fundSymbol: 1, transactionDate: -1 });
transactionSchema.index({ transactionDate: -1 });
transactionSchema.index({ referenceId: 1 });

// Virtual for formatted amount display
transactionSchema.virtual('formattedAmount').get(function() {
    return '$' + this.amount.toFixed(2);
});

// Virtual for transaction direction
transactionSchema.virtual('transactionDirection').get(function() {
    return ['DEPOSIT', 'BUY'].includes(this.transactionType) ? 'IN' : 'OUT';
});

// Virtual for is fund transaction
transactionSchema.virtual('isFundTransaction').get(function() {
    return ['BUY', 'SELL'].includes(this.transactionType);
});

// Pre-save middleware to generate reference ID
transactionSchema.pre('save', function(next) {
    if (!this.referenceId) {
        const prefix = this.transactionType.substring(0, 3);
        const timestamp = Date.now().toString().slice(-8);
        const userId = this.userId.toString().slice(-4);
        this.referenceId = `${prefix}_${timestamp}_${userId}`;
    }
    next();
});

// Static method to get user transaction history
transactionSchema.statics.getUserTransactions = function(userId, limit = 50) {
    return this.find({ userId })
        .sort({ transactionDate: -1 })
        .limit(limit)
        .lean();
};

// Static method to get fund-specific transactions
transactionSchema.statics.getFundTransactions = function(userId, fundSymbol) {
    return this.find({ 
        userId, 
        fundSymbol: fundSymbol.toUpperCase(),
        transactionType: { $in: ['BUY', 'SELL'] }
    }).sort({ transactionDate: -1 }).lean();
};

// Static method to get transaction summary
transactionSchema.statics.getTransactionSummary = async function(userId, timeframe = '1Y') {
    const now = new Date();
    let startDate;
    
    switch (timeframe.toUpperCase()) {
        case '1M':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case '6M':
            startDate = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
            break;
        case '1Y':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
        case 'ALL':
            startDate = new Date('2020-01-01');
            break;
        default:
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }
    
    return this.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                transactionDate: { $gte: startDate },
                status: 'COMPLETED'
            }
        },
        {
            $group: {
                _id: '$transactionType',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
                avgAmount: { $avg: '$amount' }
            }
        }
    ]);
};

// Static method to create deposit transaction
transactionSchema.statics.createDeposit = function(userId, amount, description = 'Cash Deposit') {
    return this.create({
        userId,
        transactionType: 'DEPOSIT',
        amount,
        description,
        balanceAfter: 0 // Will be updated by service
    });
};

// Static method to create withdrawal transaction
transactionSchema.statics.createWithdrawal = function(userId, amount, balanceAfter, description = 'Cash Withdrawal') {
    return this.create({
        userId,
        transactionType: 'WITHDRAWAL',
        amount,
        description,
        balanceAfter
    });
};

// Static method to create fund purchase transaction
transactionSchema.statics.createFundPurchase = function(transactionData) {
    const {
        userId,
        amount,
        fundSymbol,
        fundName,
        navPrice,
        units,
        fundComposition,
        fundRiskLevel,
        fundInceptionNAV,
        fundTotalReturn,
        balanceAfter
    } = transactionData;
    
    return this.create({
        userId,
        transactionType: 'BUY',
        amount,
        description: `Purchased ${units.toFixed(4)} units of ${fundName}`,
        fundSymbol,
        fundName,
        navPriceAtTransaction: navPrice,
        units,
        totalValue: amount,
        fundComposition,
        fundRiskLevel,
        fundInceptionNAV,
        fundTotalReturnAtTransaction: fundTotalReturn,
        balanceAfter
    });
};

// Static method to create fund sale transaction
transactionSchema.statics.createFundSale = function(transactionData) {
    const {
        userId,
        amount,
        fundSymbol,
        fundName,
        navPrice,
        units,
        fundComposition,
        fundRiskLevel,
        balanceAfter
    } = transactionData;
    
    return this.create({
        userId,
        transactionType: 'SELL',
        amount,
        description: `Sold ${units.toFixed(4)} units of ${fundName}`,
        fundSymbol,
        fundName,
        navPriceAtTransaction: navPrice,
        units,
        totalValue: amount,
        fundComposition,
        fundRiskLevel,
        balanceAfter
    });
};

// Instance method to update performance metrics
transactionSchema.methods.updatePerformanceMetrics = function(currentNAV, currentUnits = 0) {
    if (this.transactionType === 'BUY' && this.navPriceAtTransaction > 0) {
        const holdingPeriodDays = Math.floor((Date.now() - this.transactionDate.getTime()) / (1000 * 60 * 60 * 24));
        const currentValueFromThisTransaction = currentUnits > 0 ? (this.units * currentNAV) : 0;
        const profitLossFromThisTransaction = currentValueFromThisTransaction - this.totalValue;
        const profitLossPercentage = this.totalValue > 0 ? (profitLossFromThisTransaction / this.totalValue) * 100 : 0;
        
        let annualizedReturn = 0;
        if (holdingPeriodDays > 0 && this.totalValue > 0) {
            const totalReturn = profitLossFromThisTransaction / this.totalValue;
            annualizedReturn = (Math.pow(1 + totalReturn, 365 / holdingPeriodDays) - 1) * 100;
        }
        
        this.performanceMetrics = {
            holdingPeriodDays,
            currentValueFromThisTransaction,
            profitLossFromThisTransaction,
            profitLossPercentage,
            annualizedReturn,
            lastPerformanceUpdate: new Date()
        };
        
        return this.save();
    }
};

// Instance method to get display data
transactionSchema.methods.getDisplayData = function() {
    return {
        id: this._id,
        type: this.transactionType,
        amount: this.formattedAmount,
        description: this.description,
        date: this.transactionDate,
        fundSymbol: this.fundSymbol,
        fundName: this.fundName,
        navPrice: this.navPriceAtTransaction ? '$' + this.navPriceAtTransaction.toFixed(4) : null,
        units: this.units ? this.units.toFixed(4) : null,
        balanceAfter: '$' + this.balanceAfter.toFixed(2),
        referenceId: this.referenceId,
        status: this.status,
        direction: this.transactionDirection,
        isFundTransaction: this.isFundTransaction
    };
};

module.exports = mongoose.model('Transaction', transactionSchema);