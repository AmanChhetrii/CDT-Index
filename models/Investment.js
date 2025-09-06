const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fund',
        required: true
    },
    
    // Investment details
    amountInvested: {
        type: Number,
        required: true,
        min: 0
    },
    sharesOwned: {
        type: Number,
        required: true,
        min: 0
    },
    purchaseNAV: {
        type: Number,
        required: true,
        min: 0
    },
    purchaseDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    
    // Current status (calculated fields)
    currentValue: {
        type: Number,
        default: 0,
        min: 0
    },
    totalReturn: {
        type: Number,
        default: 0
    },
    returnPercentage: {
        type: Number,
        default: 0
    },
    
    // Investment status
    isActive: {
        type: Boolean,
        default: true
    },
    exitDate: {
        type: Date
    },
    exitNAV: {
        type: Number
    },
    exitAmount: {
        type: Number
    }
}, {
    timestamps: true
});

// Compound index for efficient user portfolio queries
investmentSchema.index({ userId: 1, isActive: 1 });
investmentSchema.index({ fundId: 1, isActive: 1 });
investmentSchema.index({ userId: 1, fundId: 1 });

// Virtual for days held
investmentSchema.virtual('daysHeld').get(function() {
    const endDate = this.exitDate || new Date();
    const diffTime = Math.abs(endDate - this.purchaseDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance method to update current value based on fund's current NAV
investmentSchema.methods.updateCurrentValue = async function() {
    const Fund = mongoose.model('Fund');
    const fund = await Fund.findById(this.fundId);
    
    if (fund) {
        this.currentValue = this.sharesOwned * fund.currentNAV;
        this.totalReturn = this.currentValue - this.amountInvested;
        this.returnPercentage = this.amountInvested > 0 
            ? (this.totalReturn / this.amountInvested) * 100 
            : 0;
        
        return this.save();
    }
    
    throw new Error('Fund not found');
};

// Instance method to exit investment
investmentSchema.methods.exitInvestment = async function(exitNAV) {
    this.isActive = false;
    this.exitDate = new Date();
    this.exitNAV = exitNAV;
    this.exitAmount = this.sharesOwned * exitNAV;
    
    // Final return calculation
    this.totalReturn = this.exitAmount - this.amountInvested;
    this.returnPercentage = this.amountInvested > 0 
        ? (this.totalReturn / this.amountInvested) * 100 
        : 0;
    
    return this.save();
};

// Static method to get user's portfolio
investmentSchema.statics.getUserPortfolio = function(userId, activeOnly = true) {
    const query = { userId };
    if (activeOnly) query.isActive = true;
    
    return this.find(query)
        .populate('fundId', 'name symbol currentNAV')
        .sort({ purchaseDate: -1 });
};

// Static method to get fund's total investments
investmentSchema.statics.getFundInvestments = function(fundId, activeOnly = true) {
    const query = { fundId };
    if (activeOnly) query.isActive = true;
    
    return this.find(query)
        .populate('userId', 'firstName lastName email')
        .sort({ purchaseDate: -1 });
};

// Static method to calculate total portfolio value for user
investmentSchema.statics.getUserPortfolioValue = async function(userId) {
    const investments = await this.find({ userId, isActive: true });
    
    let totalInvested = 0;
    let totalCurrentValue = 0;
    
    for (const investment of investments) {
        await investment.updateCurrentValue();
        totalInvested += investment.amountInvested;
        totalCurrentValue += investment.currentValue;
    }
    
    const totalReturn = totalCurrentValue - totalInvested;
    const returnPercentage = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
    
    return {
        totalInvested,
        totalCurrentValue,
        totalReturn,
        returnPercentage,
        investmentCount: investments.length
    };
};

module.exports = mongoose.model('Investment', investmentSchema);
