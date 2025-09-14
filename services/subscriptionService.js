// services/subscriptionService.js - Premium subscription management
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

class SubscriptionService {
    
    /**
     * Get user's subscription information
     * @param {string} userId - User ID
     * @returns {Object} Subscription details
     */
    static async getUserSubscription(userId) {
        try {
            const user = await User.findById(userId)
                .select('isPremium subscriptionType subscriptionStartDate subscriptionExpiresAt subscriptionPurchaseAmount')
                .lean();
                
            if (!user) {
                throw new Error('User not found');
            }
            
            // Calculate if subscription is still active
            const isActive = this.isSubscriptionActive(user);
            
            return {
                isPremium: isActive,
                subscriptionType: user.subscriptionType || 'free',
                startDate: user.subscriptionStartDate,
                expiresAt: user.subscriptionExpiresAt,
                purchaseAmount: user.subscriptionPurchaseAmount || 0,
                isActive: isActive,
                daysRemaining: this.calculateDaysRemaining(user)
            };
            
        } catch (error) {
            console.error('SubscriptionService.getUserSubscription error:', error);
            throw error;
        }
    }
    
    /**
     * Purchase premium subscription
     * @param {string} userId - User ID
     * @param {string} planType - Plan type (6_months, 1_year, lifetime)
     * @param {number} amount - Purchase amount
     * @returns {Object} Purchase result
     */
    static async purchasePremium(userId, planType, amount) {
        try {
            console.log(`Processing premium purchase: ${planType} for $${amount} by user ${userId}`);
            
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            // Check if already has active premium
            if (this.isSubscriptionActive(user)) {
                throw new Error('You already have an active premium subscription');
            }
            
            // Validate plan type
            if (!['6_months', '1_year', 'lifetime'].includes(planType)) {
                throw new Error('Invalid subscription plan type');
            }
            
            // Check wallet balance
            const currentBalance = user.portfolio?.cashBalance || 0;
            if (currentBalance < amount) {
                throw new Error(`Insufficient funds. Available: $${currentBalance.toFixed(2)}, Required: $${amount.toFixed(2)}`);
            }
            
            // Deduct from wallet
            user.portfolio.cashBalance = currentBalance - amount;
            user.portfolio.totalWithdrawn = (user.portfolio.totalWithdrawn || 0) + amount;
            user.portfolio.lastUpdated = new Date();
            
            // Activate premium subscription
            user.isPremium = true;
            user.subscriptionType = planType;
            user.subscriptionStartDate = new Date();
            user.subscriptionPurchaseAmount = amount;
            
            // Set expiry date
            if (planType === '6_months') {
                user.subscriptionExpiresAt = new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000);
            } else if (planType === '1_year') {
                user.subscriptionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
            } else if (planType === 'lifetime') {
                user.subscriptionExpiresAt = null; // Never expires
            }
            
            await user.save();
            console.log(`Premium subscription activated for user ${userId}`);
            
            // Create transaction record
            const referenceId = `SUB_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const transaction = await Transaction.create({
                userId: userId,
                transactionType: 'WITHDRAWAL',
                amount: amount,
                description: `Premium subscription - ${this.getPlanDisplayName(planType)}`,
                balanceAfter: user.portfolio.cashBalance,
                status: 'COMPLETED',
                referenceId: referenceId
            });
            
            console.log(`Subscription transaction created: ${transaction._id}`);
            
            return {
                success: true,
                message: `${this.getPlanDisplayName(planType)} activated successfully`,
                newBalance: user.portfolio.cashBalance,
                transactionId: transaction._id,
                subscriptionInfo: {
                    type: planType,
                    startDate: user.subscriptionStartDate,
                    expiresAt: user.subscriptionExpiresAt,
                    amount: amount
                }
            };
            
        } catch (error) {
            console.error('SubscriptionService.purchasePremium error:', error);
            throw error;
        }
    }
    
    /**
     * Check if user's subscription is still active
     * @param {Object} user - User object or user data
     * @returns {boolean} True if subscription is active
     */
    static isSubscriptionActive(user) {
        if (!user.isPremium) return false;
        
        if (user.subscriptionType === 'lifetime') {
            return true;
        }
        
        if (user.subscriptionExpiresAt) {
            return new Date() < new Date(user.subscriptionExpiresAt);
        }
        
        return false;
    }
    
    /**
     * Calculate days remaining in subscription
     * @param {Object} user - User object
     * @returns {string|number} Days remaining or 'Lifetime'
     */
    static calculateDaysRemaining(user) {
        if (!this.isSubscriptionActive(user)) {
            return 0;
        }
        
        if (user.subscriptionType === 'lifetime') {
            return 'Lifetime';
        }
        
        if (user.subscriptionExpiresAt) {
            const msRemaining = new Date(user.subscriptionExpiresAt) - new Date();
            return Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
        }
        
        return 0;
    }
    
    /**
     * Get display name for plan type
     * @param {string} planType - Plan type
     * @returns {string} Display name
     */
    static getPlanDisplayName(planType) {
        const names = {
            '6_months': '6 Months Premium',
            '1_year': '1 Year Premium',
            'lifetime': 'Lifetime Premium'
        };
        return names[planType] || 'Premium Plan';
    }
    
    /**
     * Deactivate expired subscriptions (for automated cleanup)
     * @returns {Object} Cleanup results
     */
    static async deactivateExpiredSubscriptions() {
        try {
            const now = new Date();
            
            const result = await User.updateMany(
                {
                    isPremium: true,
                    subscriptionType: { $ne: 'lifetime' },
                    subscriptionExpiresAt: { $lt: now }
                },
                {
                    $set: {
                        isPremium: false,
                        subscriptionType: 'free'
                    }
                }
            );
            
            console.log(`Deactivated ${result.modifiedCount} expired subscriptions`);
            
            return {
                success: true,
                deactivatedCount: result.modifiedCount
            };
            
        } catch (error) {
            console.error('SubscriptionService.deactivateExpiredSubscriptions error:', error);
            throw error;
        }
    }
    
    /**
     * Get subscription statistics
     * @returns {Object} Subscription stats
     */
    static async getSubscriptionStats() {
        try {
            const stats = await User.aggregate([
                {
                    $group: {
                        _id: '$subscriptionType',
                        count: { $sum: 1 },
                        totalRevenue: { $sum: '$subscriptionPurchaseAmount' }
                    }
                }
            ]);
            
            const activeSubscriptions = await User.countDocuments({
                isPremium: true,
                $or: [
                    { subscriptionType: 'lifetime' },
                    { subscriptionExpiresAt: { $gt: new Date() } }
                ]
            });
            
            return {
                stats,
                activeSubscriptions,
                generatedAt: new Date()
            };
            
        } catch (error) {
            console.error('SubscriptionService.getSubscriptionStats error:', error);
            throw error;
        }
    }
    
    /**
     * Extend existing subscription
     * @param {string} userId - User ID
     * @param {string} planType - New plan type
     * @param {number} amount - Purchase amount
     * @returns {Object} Extension result
     */
    static async extendSubscription(userId, planType, amount) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            // Check wallet balance
            const currentBalance = user.portfolio?.cashBalance || 0;
            if (currentBalance < amount) {
                throw new Error('Insufficient funds');
            }
            
            // Deduct from wallet
            user.portfolio.cashBalance = currentBalance - amount;
            user.portfolio.totalWithdrawn = (user.portfolio.totalWithdrawn || 0) + amount;
            
            // Extend or upgrade subscription
            const currentExpiry = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : new Date();
            const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
            
            if (planType === '6_months') {
                user.subscriptionExpiresAt = new Date(baseDate.getTime() + 6 * 30 * 24 * 60 * 60 * 1000);
            } else if (planType === '1_year') {
                user.subscriptionExpiresAt = new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000);
            } else if (planType === 'lifetime') {
                user.subscriptionExpiresAt = null;
            }
            
            user.isPremium = true;
            user.subscriptionType = planType;
            user.subscriptionPurchaseAmount += amount;
            
            await user.save();
            
            // Create transaction
            const referenceId = `EXT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            await Transaction.create({
                userId: userId,
                transactionType: 'WITHDRAWAL',
                amount: amount,
                description: `Subscription extension - ${this.getPlanDisplayName(planType)}`,
                balanceAfter: user.portfolio.cashBalance,
                status: 'COMPLETED',
                referenceId: referenceId
            });
            
            return {
                success: true,
                message: 'Subscription extended successfully',
                newBalance: user.portfolio.cashBalance,
                newExpiryDate: user.subscriptionExpiresAt
            };
            
        } catch (error) {
            console.error('SubscriptionService.extendSubscription error:', error);
            throw error;
        }
    }
}

module.exports = SubscriptionService;