const mongoose = require('mongoose');

const compositionSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true
    },
    name: {
        type: String,
        required: true
    },
    weight: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    }
}, { _id: false });

const fundSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    symbol: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    
    // Marketing content
    summary: {
        type: String,
        required: true,
        maxlength: 200
    },
    description: {
        type: String,
        required: true,
        maxlength: 1000
    },
    riskLevel: {
        type: String,
        required: true,
        enum: ['High Growth Potential', 'Stable with Upside', 'Future-Oriented Potential', 'Dynamic & Diverse']
    },
    riskIcon: {
        type: String,
        required: true
    },
    investorType: {
        type: String,
        required: true,
        maxlength: 300
    },
    
    // Fund composition
    composition: [compositionSchema],
    
    // Performance tracking
    currentNAV: {
        type: Number,
        required: true,
        min: 0
    },
    inceptionNAV: {
        type: Number,
        required: true,
        min: 0
    },
    inceptionDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    totalAssets: {
        type: Number,
        default: 0,
        min: 0
    },
    totalShares: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Fund management
    minimumInvestment: {
        type: Number,
        default: 100,
        min: 1
    },
    isActive: {
        type: Boolean,
        default: true
    },
    
    // Display settings
    featured: {
        type: Boolean,
        default: false
    },
    displayOrder: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Pre-save validation to ensure weights sum to 1
fundSchema.pre('save', function(next) {
    const totalWeight = this.composition.reduce((sum, coin) => sum + coin.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.001) {
        return next(new Error('Fund composition weights must sum to 100%. Current total: ' + (totalWeight * 100).toFixed(2) + '%'));
    }
    next();
});

// Virtual for total weight validation
fundSchema.virtual('totalWeight').get(function() {
    return this.composition.reduce((sum, coin) => sum + coin.weight, 0);
});

// Virtual for performance since inception
fundSchema.virtual('totalReturn').get(function() {
    if (this.inceptionNAV <= 0) return 0;
    return ((this.currentNAV - this.inceptionNAV) / this.inceptionNAV) * 100;
});

// Static method to get active funds
fundSchema.statics.getActiveFunds = function() {
    return this.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
};

// Static method to get featured funds
fundSchema.statics.getFeaturedFunds = function() {
    return this.find({ isActive: true, featured: true }).sort({ displayOrder: 1 });
};

// Instance method to calculate NAV based on percentage changes
fundSchema.methods.calculateNAVFromChanges = async function(priceChanges) {
    try {
        let weightedChange = 0;
        
        for (const coin of this.composition) {
            const change = priceChanges[coin.symbol] || 0;
            weightedChange += change * coin.weight;
        }
        
        // Apply percentage change to current NAV
        this.currentNAV = this.currentNAV * (1 + weightedChange / 100);
        
        return this.save();
    } catch (error) {
        console.error('Error calculating NAV for ' + this.name + ':', error);
        throw error;
    }
};

// Instance method to calculate NAV from absolute prices (for historical setup)
fundSchema.methods.calculateNAVFromPrices = async function(previousPrices, currentPrices) {
    try {
        const CryptoAsset = mongoose.model('CryptoAsset');
        let weightedChange = 0;
        
        for (const coin of this.composition) {
            const prevPrice = previousPrices[coin.symbol];
            const currPrice = currentPrices[coin.symbol];
            
            if (prevPrice && currPrice && prevPrice > 0) {
                const change = ((currPrice - prevPrice) / prevPrice) * 100;
                weightedChange += change * coin.weight;
            }
        }
        
        // Apply percentage change to current NAV
        const newNAV = this.currentNAV * (1 + weightedChange / 100);
        this.currentNAV = Math.max(newNAV, 0.01); // Prevent negative NAV
        
        return this.save();
    } catch (error) {
        console.error('Error calculating NAV for ' + this.name + ':', error);
        throw error;
    }
};

// Instance method to reset to inception values
fundSchema.methods.resetToInception = function() {
    this.currentNAV = this.inceptionNAV;
    return this.save();
};

// Instance method to get fund performance
fundSchema.methods.getPerformance = function(days = 30) {
    return {
        fundId: this._id,
        symbol: this.symbol,
        currentNAV: this.currentNAV,
        inceptionNAV: this.inceptionNAV,
        totalReturn: this.totalReturn,
        period: days + 'd'
    };
};

module.exports = mongoose.model('Fund', fundSchema);