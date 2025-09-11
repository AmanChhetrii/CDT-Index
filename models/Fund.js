// models/Fund.js - Updated fund schema for new 7-crypto approach
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
        trim: true,
        index: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    summary: {
        type: String,
        required: true,
        maxlength: 300
    },
    description: {
        type: String,
        required: true,
        maxlength: 1500
    },
    riskLevel: {
        type: String,
        required: true,
        enum: ['Moderate', 'Balanced', 'High', 'Moderate']
    },
    riskIcon: {
        type: String,
        required: true
    },
    composition: [compositionSchema],
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
    isActive: {
        type: Boolean,
        default: true
    },
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

// Indexes for performance
fundSchema.index({ symbol: 1, isActive: 1 });
fundSchema.index({ featured: 1, displayOrder: 1 });
fundSchema.index({ displayOrder: 1 });

// Pre-save validation to ensure weights sum to 1 (100%)
fundSchema.pre('save', function(next) {
    const totalWeight = this.composition.reduce((sum, coin) => sum + coin.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.001) {
        return next(new Error(`Fund composition weights must sum to 100%. Current total: ${(totalWeight * 100).toFixed(2)}%`));
    }
    next();
});

// Virtual for total return calculation
fundSchema.virtual('totalReturn').get(function() {
    if (this.inceptionNAV <= 0) return 0;
    return ((this.currentNAV - this.inceptionNAV) / this.inceptionNAV) * 100;
});

// Virtual for total weight validation
fundSchema.virtual('totalWeight').get(function() {
    return this.composition.reduce((sum, coin) => sum + coin.weight, 0);
});

// Virtual for composition symbols (for quick access)
fundSchema.virtual('compositionSymbols').get(function() {
    return this.composition.map(coin => coin.symbol);
});

// Virtual for formatted NAV
fundSchema.virtual('formattedNAV').get(function() {
    return '$' + this.currentNAV.toFixed(4);
});

// Static method to get active funds
fundSchema.statics.getActiveFunds = function() {
    return this.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
};

// Static method to get featured funds
fundSchema.statics.getFeaturedFunds = function() {
    return this.find({ isActive: true, featured: true }).sort({ displayOrder: 1 });
};

// Static method to get fund by symbol
fundSchema.statics.getBySymbol = function(symbol) {
    return this.findOne({ 
        symbol: symbol.toUpperCase(), 
        isActive: true 
    });
};

// Static method to get all unique cryptocurrency symbols used across funds
fundSchema.statics.getAllRequiredCryptos = async function() {
    const funds = await this.find({ isActive: true });
    const cryptoSet = new Set();
    
    funds.forEach(fund => {
        fund.composition.forEach(coin => {
            cryptoSet.add(coin.symbol);
        });
    });
    
    return Array.from(cryptoSet);
};

// Instance method to calculate NAV from cryptocurrency price changes
fundSchema.methods.calculateNAVFromPriceChanges = function(priceChanges) {
    let weightedChange = 0;
    let validChanges = 0;
    
    for (const coin of this.composition) {
        const change = priceChanges[coin.symbol];
        if (typeof change === 'number' && !isNaN(change)) {
            weightedChange += change * coin.weight;
            validChanges++;
        }
    }
    
    // Only update NAV if we have price changes for all components
    if (validChanges === this.composition.length) {
        const newNAV = this.currentNAV * (1 + weightedChange / 100);
        this.currentNAV = Math.max(newNAV, 0.01); // Prevent negative NAV
        return { success: true, newNAV: this.currentNAV, weightedChange };
    }
    
    return { success: false, message: 'Incomplete price data' };
};

// Instance method to calculate NAV from absolute prices
fundSchema.methods.calculateNAVFromPrices = function(currentPrices, previousPrices) {
    const priceChanges = {};
    let validChanges = 0;
    
    for (const coin of this.composition) {
        const currentPrice = currentPrices[coin.symbol];
        const previousPrice = previousPrices[coin.symbol];
        
        if (currentPrice && previousPrice && previousPrice > 0) {
            priceChanges[coin.symbol] = ((currentPrice - previousPrice) / previousPrice) * 100;
            validChanges++;
        }
    }
    
    if (validChanges === this.composition.length) {
        return this.calculateNAVFromPriceChanges(priceChanges);
    }
    
    return { success: false, message: 'Incomplete price data for NAV calculation' };
};

// Instance method to reset to inception values
fundSchema.methods.resetToInception = function() {
    this.currentNAV = this.inceptionNAV;
    return this.save();
};

// Instance method to get fund performance summary
fundSchema.methods.getPerformanceSummary = function() {
    return {
        fundId: this._id,
        symbol: this.symbol,
        name: this.name,
        currentNAV: this.currentNAV,
        inceptionNAV: this.inceptionNAV,
        totalReturn: this.totalReturn,
        riskLevel: this.riskLevel,
        composition: this.composition
    };
};

// Instance method to validate fund composition
fundSchema.methods.validateComposition = async function() {
    const CryptoAsset = mongoose.model('CryptoAsset');
    const errors = [];
    
    // Check if all cryptocurrencies exist in the database
    for (const coin of this.composition) {
        const crypto = await CryptoAsset.findOne({ 
            symbol: coin.symbol, 
            isActive: true 
        });
        if (!crypto) {
            errors.push(`Cryptocurrency ${coin.symbol} not found or inactive`);
        }
    }
    
    // Check weight sum
    const totalWeight = this.composition.reduce((sum, coin) => sum + coin.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.001) {
        errors.push(`Composition weights must sum to 100%. Current: ${(totalWeight * 100).toFixed(2)}%`);
    }
    
    return errors;
};

// Instance method to get display data for frontend
fundSchema.methods.getDisplayData = function() {
    return {
        id: this._id,
        name: this.name,
        symbol: this.symbol,
        slug: this.slug,
        summary: this.summary,
        description: this.description,
        riskLevel: this.riskLevel,
        riskIcon: this.riskIcon,
        currentNAV: this.formattedNAV,
        totalReturn: this.totalReturn.toFixed(2),
        composition: this.composition,
        featured: this.featured
    };
};

module.exports = mongoose.models.Fund || mongoose.model('Fund', fundSchema);