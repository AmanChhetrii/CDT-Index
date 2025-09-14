// models/ROI.js - Simple daily portfolio value storage
const mongoose = require('mongoose');

const roiSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    date: {
        type: Date,
        required: true,
        index: true
    },
    totalPortfolioValue: {
        type: Number,
        required: true,
        min: 0
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
roiSchema.index({ userId: 1, date: -1 });

// Unique constraint to prevent duplicate entries per user per day
roiSchema.index({ userId: 1, date: 1 }, { unique: true });

// Static method to get user's ROI history
roiSchema.statics.getUserROIHistory = function(userId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    return this.find({ 
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate }
    })
    .sort({ date: 1 })
    .lean();
};

// Static method to create daily snapshot
roiSchema.statics.createDailySnapshot = function(userId, totalValue) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.create({
        userId: new mongoose.Types.ObjectId(userId),
        date: today,
        totalPortfolioValue: totalValue
    });
};

module.exports = mongoose.model('ROI', roiSchema);