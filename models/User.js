// models/User.js - Updated with premium subscription fields
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const portfolioSchema = new mongoose.Schema({
    // Cash management
    cashBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    totalDeposited: {
        type: Number,
        default: 0,
        min: 0
    },
    totalWithdrawn: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Investment tracking
    totalInvestmentValue: {
        type: Number,
        default: 0,
        min: 0
    },
    totalUnitsOwned: {
        type: Number,
        default: 0,
        min: 0
    },
    totalInvestedAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Performance metrics
    totalProfitLoss: {
        type: Number,
        default: 0
    },
    totalReturnPercentage: {
        type: Number,
        default: 0
    },
    dayChange: {
        type: Number,
        default: 0
    },
    dayChangePercentage: {
        type: Number,
        default: 0
    },
    
    // Portfolio statistics
    numberOfFundsOwned: {
        type: Number,
        default: 0,
        min: 0
    },
    averageHoldingPeriod: {
        type: Number,
        default: 0
    },
    
    // Risk metrics
    portfolioRiskLevel: {
        type: String,
        enum: ['Conservative', 'Moderate', 'Aggressive', 'Mixed'],
        default: 'Conservative'
    },
    
    // Timestamps
    firstInvestmentDate: {
        type: Date,
        default: null
    },
    lastTransactionDate: {
        type: Date,
        default: null
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    profilePhoto: {
    type: String,
    default: null
     },
    // PREMIUM SUBSCRIPTION FIELDS
    isPremium: {
        type: Boolean,
        default: false
    },
    subscriptionType: {
        type: String,
        enum: ['free', '6_months', '1_year', 'lifetime'],
        default: 'free'
    },
    subscriptionStartDate: {
        type: Date,
        default: null
    },
    subscriptionExpiresAt: {
        type: Date,
        default: null
    },
    subscriptionPurchaseAmount: {
        type: Number,
        default: 0
    },
    
    // Portfolio management
    portfolio: {
        type: portfolioSchema,
        default: () => ({})
    },
    
    // Fund holdings embedded in user
    holdings: [{
        fundSymbol: {
            type: String,
            required: true,
            uppercase: true
        },
        fundName: {
            type: String,
            required: true
        },
        units: {
            type: Number,
            required: true,
            min: 0
        },
        totalInvested: {
            type: Number,
            required: true,
            min: 0
        },
        averageBuyPrice: {
            type: Number,
            required: true,
            min: 0
        },
        currentNAV: {
            type: Number,
            default: 0
        },
        currentValue: {
            type: Number,
            default: 0
        },
        profitLoss: {
            type: Number,
            default: 0
        },
        profitLossPercentage: {
            type: Number,
            default: 0
        },
        dayChange: {
            type: Number,
            default: 0
        },
        dayChangePercentage: {
            type: Number,
            default: 0
        },
        firstPurchaseDate: {
            type: Date,
            required: true
        },
        lastTransactionDate: {
            type: Date,
            default: Date.now
        }
    }],
    
    // User preferences
    preferences: {
        defaultCurrency: {
            type: String,
            default: 'USD'
        },
        riskTolerance: {
            type: String,
            enum: ['Conservative', 'Moderate', 'Aggressive'],
            default: 'Moderate'
        },
        investmentGoals: [{
            type: String,
            enum: ['Growth', 'Income', 'Capital Preservation', 'Diversification']
        }],
        notificationSettings: {
            emailAlerts: { type: Boolean, default: true },
            performanceUpdates: { type: Boolean, default: true },
            marketNews: { type: Boolean, default: false }
        }
    }
}, {
    timestamps: true
});

// Indexes for portfolio queries
userSchema.index({ 'portfolio.totalInvestmentValue': -1 });
userSchema.index({ 'portfolio.totalReturnPercentage': -1 });
userSchema.index({ 'portfolio.lastTransactionDate': -1 });
userSchema.index({ isPremium: 1 }); // Index for premium status
userSchema.index({ subscriptionExpiresAt: 1 }); // Index for expiry checks

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Get full name virtual
userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Portfolio virtuals
userSchema.virtual('portfolio.totalPortfolioValue').get(function() {
    return this.portfolio.cashBalance + this.portfolio.totalInvestmentValue;
});

userSchema.virtual('portfolio.netDeposits').get(function() {
    return this.portfolio.totalDeposited - this.portfolio.totalWithdrawn;
});

userSchema.virtual('portfolio.formattedCashBalance').get(function() {
    return '$' + this.portfolio.cashBalance.toFixed(2);
});

userSchema.virtual('portfolio.formattedTotalValue').get(function() {
    return '$' + (this.portfolio.cashBalance + this.portfolio.totalInvestmentValue).toFixed(2);
});

// PREMIUM SUBSCRIPTION METHODS - ADDED

// Check if subscription is still active
userSchema.methods.isSubscriptionActive = function() {
    if (this.subscriptionType === 'lifetime') {
        return this.isPremium;
    }
    
    if (this.subscriptionExpiresAt && this.isPremium) {
        return new Date() < this.subscriptionExpiresAt;
    }
    
    return false;
};

// Activate premium subscription
userSchema.methods.activatePremium = function(planType, amount) {
    this.isPremium = true;
    this.subscriptionType = planType;
    this.subscriptionStartDate = new Date();
    this.subscriptionPurchaseAmount = amount;
    
    // Set expiry date (except for lifetime)
    if (planType === '6_months') {
        this.subscriptionExpiresAt = new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000);
    } else if (planType === '1_year') {
        this.subscriptionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    } else if (planType === 'lifetime') {
        this.subscriptionExpiresAt = null; // Never expires
    }
    
    return this.save();
};

// Deactivate expired subscription
userSchema.methods.deactivatePremium = function() {
    this.isPremium = false;
    this.subscriptionType = 'free';
    // Keep purchase history but mark as inactive
    return this.save();
};

// Get subscription info
userSchema.methods.getSubscriptionInfo = function() {
    return {
        isPremium: this.isSubscriptionActive(),
        subscriptionType: this.subscriptionType,
        startDate: this.subscriptionStartDate,
        expiresAt: this.subscriptionExpiresAt,
        purchaseAmount: this.subscriptionPurchaseAmount,
        isActive: this.isSubscriptionActive(),
        daysRemaining: this.subscriptionExpiresAt ? 
            Math.max(0, Math.ceil((this.subscriptionExpiresAt - new Date()) / (1000 * 60 * 60 * 24))) : 
            (this.subscriptionType === 'lifetime' ? 'Lifetime' : 0)
    };
};

// EXISTING PORTFOLIO METHODS

userSchema.methods.updateCashBalance = function(amount, type = 'ADD') {
    if (type === 'ADD') {
        this.portfolio.cashBalance += amount;
        if (amount > 0) this.portfolio.totalDeposited += amount;
    } else if (type === 'SUBTRACT') {
        if (this.portfolio.cashBalance >= amount) {
            this.portfolio.cashBalance -= amount;
            this.portfolio.totalWithdrawn += amount;
        } else {
            throw new Error('Insufficient cash balance');
        }
    }
    this.portfolio.lastUpdated = new Date();
    return this.portfolio.cashBalance;
};

userSchema.methods.updateInvestmentValue = function(newTotalValue) {
    const previousValue = this.portfolio.totalInvestmentValue;
    this.portfolio.totalInvestmentValue = newTotalValue;
    this.portfolio.dayChange = newTotalValue - previousValue;
    
    if (previousValue > 0) {
        this.portfolio.dayChangePercentage = (this.portfolio.dayChange / previousValue) * 100;
    }
    
    // Calculate total P&L
    this.portfolio.totalProfitLoss = newTotalValue - this.portfolio.totalInvestedAmount;
    
    if (this.portfolio.totalInvestedAmount > 0) {
        this.portfolio.totalReturnPercentage = (this.portfolio.totalProfitLoss / this.portfolio.totalInvestedAmount) * 100;
    }
    
    this.portfolio.lastUpdated = new Date();
    return this.save();
};

userSchema.methods.recordTransaction = function(type, amount, fundSymbol = null) {
    this.portfolio.lastTransactionDate = new Date();
    
    if (type === 'BUY' && fundSymbol) {
        this.portfolio.totalInvestedAmount += amount;
        if (!this.portfolio.firstInvestmentDate) {
            this.portfolio.firstInvestmentDate = new Date();
        }
    } else if (type === 'SELL' && fundSymbol) {
        // Handled by specific sell logic
    }
    
    this.portfolio.lastUpdated = new Date();
    return this.save();
};

userSchema.methods.updatePortfolioStats = function(holdingsData) {
    // Update number of funds owned
    this.portfolio.numberOfFundsOwned = holdingsData.length;
    
    // Calculate portfolio risk level based on holdings
    if (holdingsData.length === 0) {
        this.portfolio.portfolioRiskLevel = 'Conservative';
    } else {
        const riskLevels = holdingsData.map(h => h.fundRiskLevel || 'Moderate');
        const riskCounts = riskLevels.reduce((acc, level) => {
            acc[level] = (acc[level] || 0) + 1;
            return acc;
        }, {});
        
        // Determine dominant risk level
        const dominantRisk = Object.keys(riskCounts).reduce((a, b) => 
            riskCounts[a] > riskCounts[b] ? a : b
        );
        this.portfolio.portfolioRiskLevel = riskCounts.High > 0 ? 'Aggressive' : dominantRisk;
    }
    
    this.portfolio.lastUpdated = new Date();
    return this.save();
};

// Static method to get users with portfolios
userSchema.statics.getUsersWithInvestments = function() {
    return this.find({ 
        'portfolio.totalInvestmentValue': { $gt: 0 } 
    }).sort({ 'portfolio.totalInvestmentValue': -1 });
};

// Static method to get portfolio overview
userSchema.statics.getPortfolioOverview = function(userId) {
    return this.findById(userId)
        .select('firstName lastName email portfolio')
        .lean();
};

// Method to get portfolio summary for dashboard
userSchema.methods.getPortfolioSummary = function() {
    return {
        userId: this._id,
        userName: this.fullName,
        cashBalance: this.portfolio.cashBalance,
        investmentValue: this.portfolio.totalInvestmentValue,
        totalPortfolioValue: this.portfolio.totalPortfolioValue,
        totalProfitLoss: this.portfolio.totalProfitLoss,
        totalReturnPercentage: this.portfolio.totalReturnPercentage,
        dayChange: this.portfolio.dayChange,
        dayChangePercentage: this.portfolio.dayChangePercentage,
        numberOfFunds: this.portfolio.numberOfFundsOwned,
        riskLevel: this.portfolio.portfolioRiskLevel,
        firstInvestmentDate: this.portfolio.firstInvestmentDate,
        lastTransactionDate: this.portfolio.lastTransactionDate,
        lastUpdated: this.portfolio.lastUpdated
    };
};

// Method to validate sufficient funds for transaction
userSchema.methods.canAffordTransaction = function(amount) {
    return this.portfolio.cashBalance >= amount;
};

// Method to initialize portfolio for new users
userSchema.methods.initializePortfolio = function() {
    if (!this.portfolio || Object.keys(this.portfolio).length === 0) {
        this.portfolio = {
            cashBalance: 0,
            totalDeposited: 0,
            totalWithdrawn: 0,
            totalInvestmentValue: 0,
            totalUnitsOwned: 0,
            totalInvestedAmount: 0,
            totalProfitLoss: 0,
            totalReturnPercentage: 0,
            dayChange: 0,
            dayChangePercentage: 0,
            numberOfFundsOwned: 0,
            averageHoldingPeriod: 0,
            portfolioRiskLevel: 'Conservative',
            firstInvestmentDate: null,
            lastTransactionDate: null,
            lastUpdated: new Date()
        };
    }
    return this.save();
};

module.exports = mongoose.model('User', userSchema);