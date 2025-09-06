// models/CryptoAsset.js - Updated for 7 cryptocurrencies

const mongoose = require('mongoose');

const cryptoAssetSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    currentPrice: {
        type: Number,
        required: true,
        min: 0
    },
    marketCap: {
        type: Number,
        required: true,
        min: 0
    },
    rank: {
        type: Number,
        required: true,
        min: 1
    },
    volume24h: {
        type: Number,
        default: 0,
        min: 0
    },
    priceChange24h: {
        type: Number,
        default: 0
    },
    priceChangePercentage24h: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // CoinGecko API identifier
    apiId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    }
}, {
    timestamps: true
});

// Indexes for performance
cryptoAssetSchema.index({ symbol: 1, isActive: 1 });
cryptoAssetSchema.index({ rank: 1 });

// Virtual for formatted price display
cryptoAssetSchema.virtual('formattedPrice').get(function() {
    return this.currentPrice < 1 
        ? this.currentPrice.toFixed(6)
        : this.currentPrice.toFixed(2);
});

// Virtual for price change direction
cryptoAssetSchema.virtual('priceDirection').get(function() {
    if (this.priceChange24h > 0) return 'up';
    if (this.priceChange24h < 0) return 'down';
    return 'neutral';
});

// Static method to get all active cryptocurrencies
cryptoAssetSchema.statics.getActiveCryptos = function() {
    return this.find({ isActive: true }).sort({ rank: 1 });
};

// Static method to get crypto by symbol
cryptoAssetSchema.statics.getBySymbol = function(symbol) {
    return this.findOne({ 
        symbol: symbol.toUpperCase(), 
        isActive: true 
    });
};

// Static method to bulk update prices
cryptoAssetSchema.statics.bulkUpdatePrices = function(priceUpdates) {
    const bulkOps = priceUpdates.map(update => ({
        updateOne: {
            filter: { symbol: update.symbol.toUpperCase() },
            update: {
                $set: {
                    currentPrice: update.price,
                    marketCap: update.marketCap || 0,
                    volume24h: update.volume24h || 0,
                    priceChange24h: update.priceChange24h || 0,
                    priceChangePercentage24h: update.priceChangePercentage24h || 0,
                    lastUpdated: new Date()
                }
            }
        }
    }));
    
    return this.bulkWrite(bulkOps);
};

// Instance method to update price with change calculation
cryptoAssetSchema.methods.updatePrice = function(newPrice, marketCap = null, volume = null) {
    const oldPrice = this.currentPrice;
    
    this.currentPrice = newPrice;
    this.priceChange24h = newPrice - oldPrice;
    this.priceChangePercentage24h = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;
    
    if (marketCap !== null) this.marketCap = marketCap;
    if (volume !== null) this.volume24h = volume;
    
    this.lastUpdated = new Date();
    
    return this.save();
};

// Instance method to get display data
cryptoAssetSchema.methods.getDisplayData = function() {
    return {
        symbol: this.symbol,
        name: this.name,
        price: this.formattedPrice,
        change24h: this.priceChangePercentage24h.toFixed(2),
        direction: this.priceDirection,
        marketCap: this.marketCap,
        volume: this.volume24h,
        lastUpdated: this.lastUpdated
    };
};

module.exports = mongoose.models.CryptoAsset || mongoose.model('CryptoAsset', cryptoAssetSchema);