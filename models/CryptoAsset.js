const mongoose = require('mongoose');

const cryptoAssetSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
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
        default: 0
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
    // API-specific data
    apiId: {
        type: String, // CoinGecko ID like "bitcoin", "ethereum"
        required: true,
        unique: true
    }
}, {
    timestamps: true
});


// Virtual for formatted price
cryptoAssetSchema.virtual('formattedPrice').get(function() {
    return this.currentPrice < 1 
        ? this.currentPrice.toFixed(6)
        : this.currentPrice.toFixed(2);
});

// Static method to get active cryptos
cryptoAssetSchema.statics.getActiveCryptos = function() {
    return this.find({ isActive: true }).sort({ rank: 1 });
};

// Instance method to update price
cryptoAssetSchema.methods.updatePrice = function(newPrice, marketCap = null, volume = null) {
    const oldPrice = this.currentPrice;
    this.currentPrice = newPrice;
    this.priceChange24h = newPrice - oldPrice;
    this.priceChangePercentage24h = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;
    
    if (marketCap) this.marketCap = marketCap;
    if (volume) this.volume24h = volume;
    
    this.lastUpdated = new Date();
    return this.save();
};

module.exports = mongoose.model('CryptoAsset', cryptoAssetSchema);