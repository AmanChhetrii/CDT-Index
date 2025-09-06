const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fund',
        default: null // null for wallet transactions (deposit/withdrawal)
    },
    
    // Transaction details
    type: {
        type: String,
        required: true,
        enum: ['deposit', 'withdrawal', 'fund_buy', 'fund_sell']
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Fund-specific fields (for fund_buy/fund_sell)
    shares: {
        type: Number,
        default: null,
        min: 0
    },
    navAtTransaction: {
        type: Number,
        default: null,
        min: 0
    },
    
    // Transaction status and timing
    status: {
        type: String,
        required: true,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    processingStartedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    },
    failureReason: {
        type: String
    },
    
    // Additional metadata
    description: {
        type: String,
        default: ''
    },
    balanceBefore: {
        type: Number,
        default: 0
    },
    balanceAfter: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, type: 1, status: 1 });
transactionSchema.index({ fundId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, processingStartedAt: 1 });

// Virtual for processing duration
transactionSchema.virtual('processingDuration').get(function() {
    if (this.completedAt) {
        return this.completedAt - this.processingStartedAt;
    }
    return Date.now() - this.processingStartedAt;
});

// Virtual for formatted amount
transactionSchema.virtual('formattedAmount').get(function() {
    return `$${this.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
});

// Pre-save middleware to set description based on transaction type
transactionSchema.pre('save', function(next) {
    if (!this.description) {
        switch (this.type) {
            case 'deposit':
                this.description = `Wallet deposit of ${this.formattedAmount}`;
                break;
            case 'withdrawal':
                this.description = `Wallet withdrawal of ${this.formattedAmount}`;
                break;
            case 'fund_buy':
                this.description = `Purchased ${this.shares?.toFixed(4)} shares at NAV $${this.navAtTransaction?.toFixed(2)}`;
                break;
            case 'fund_sell':
                this.description = `Sold ${this.shares?.toFixed(4)} shares at NAV $${this.navAtTransaction?.toFixed(2)}`;
                break;
        }
    }
    next();
});

// Instance method to complete transaction
transactionSchema.methods.complete = function() {
    this.status = 'completed';
    this.completedAt = new Date();
    return this.save();
};

// Instance method to fail transaction
transactionSchema.methods.fail = function(reason) {
    this.status = 'failed';
    this.failureReason = reason;
    this.completedAt = new Date();
    return this.save();
};

// Static method to get user's transaction history
transactionSchema.statics.getUserTransactions = function(userId, limit = 50, type = null) {
    const query = { userId };
    if (type) query.type = type;
    
    return this.find(query)
        .populate('fundId', 'name symbol')
        .sort({ createdAt: -1 })
        .limit(limit);
};

// Static method to get pending transactions (for processing)
transactionSchema.statics.getPendingTransactions = function() {
    return this.find({ 
        status: 'pending',
        processingStartedAt: { 
            $lte: new Date(Date.now() - 15 * 1000) // 15 seconds ago
        }
    });
};

// Static method to get fund transaction summary
transactionSchema.statics.getFundTransactionSummary = async function(fundId) {
    const summary = await this.aggregate([
        { $match: { fundId: mongoose.Types.ObjectId(fundId), status: 'completed' } },
        {
            $group: {
                _id: '$type',
                totalAmount: { $sum: '$amount' },
                totalShares: { $sum: '$shares' },
                transactionCount: { $sum: 1 }
            }
        }
    ]);
    
    return summary.reduce((acc, item) => {
        acc[item._id] = {
            totalAmount: item.totalAmount,
            totalShares: item.totalShares || 0,
            count: item.transactionCount
        };
        return acc;
    }, {});
};

// Static method to create fund purchase transaction
transactionSchema.statics.createFundPurchase = function(userId, fundId, amount, shares, nav, balanceBefore, balanceAfter) {
    return this.create({
        userId,
        fundId,
        type: 'fund_buy',
        amount,
        shares,
        navAtTransaction: nav,
        balanceBefore,
        balanceAfter,
        status: 'pending'
    });
};

// Static method to create fund sale transaction
transactionSchema.statics.createFundSale = function(userId, fundId, amount, shares, nav, balanceBefore, balanceAfter) {
    return this.create({
        userId,
        fundId,
        type: 'fund_sell',
        amount,
        shares,
        navAtTransaction: nav,
        balanceBefore,
        balanceAfter,
        status: 'pending'
    });
};

module.exports = mongoose.model('Transaction', transactionSchema);