// services/walletService.js - Complete working version
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ROI = require('../models/ROI');
const Fund = require('../models/Fund');
const mongoose = require('mongoose');

class WalletService {
    
    /**
     * Get user's complete portfolio data
     */
    static async getUserPortfolio(userId) {
        try {
            const user = await User.findById(userId)
                .select('firstName lastName email portfolio holdings')
                .lean();
                
            if (!user) {
                throw new Error('User not found');
            }
            
            // Initialize portfolio if empty
            if (!user.portfolio) {
                await User.findByIdAndUpdate(userId, {
                    portfolio: {
                        cashBalance: 0,
                        totalDeposited: 0,
                        totalWithdrawn: 0,
                        totalInvestmentValue: 0,
                        totalProfitLoss: 0,
                        totalReturnPercentage: 0,
                        numberOfFundsOwned: 0,
                        lastUpdated: new Date()
                    }
                });
                user.portfolio = {
                    cashBalance: 0,
                    totalDeposited: 0,
                    totalWithdrawn: 0,
                    totalInvestmentValue: 0,
                    totalProfitLoss: 0,
                    totalReturnPercentage: 0,
                    numberOfFundsOwned: 0
                };
            }
            
            return {
                user: {
                    id: user._id,
                    name: `${user.firstName} ${user.lastName}`,
                    email: user.email
                },
                portfolio: {
                    cashBalance: user.portfolio.cashBalance || 0,
                    totalDeposited: user.portfolio.totalDeposited || 0,
                    totalWithdrawn: user.portfolio.totalWithdrawn || 0,
                    totalInvestmentValue: user.portfolio.totalInvestmentValue || 0,
                    totalPortfolioValue: (user.portfolio.cashBalance || 0) + (user.portfolio.totalInvestmentValue || 0),
                    totalProfitLoss: user.portfolio.totalProfitLoss || 0,
                    totalReturnPercentage: user.portfolio.totalReturnPercentage || 0,
                    numberOfFundsOwned: user.portfolio.numberOfFundsOwned || 0,
                    dayChange: user.portfolio.dayChange || 0,
                    dayChangePercentage: user.portfolio.dayChangePercentage || 0,
                    netDeposits: (user.portfolio.totalDeposited || 0) - (user.portfolio.totalWithdrawn || 0),
                    lastUpdated: user.portfolio.lastUpdated
                },
                holdings: user.holdings || []
            };
        } catch (error) {
            console.error('WalletService.getUserPortfolio error:', error);
            throw error;
        }
    }
    
    /**
     * Process cash deposit with proper referenceId
     */
    static async depositCash(userId, amount, description = 'Cash Deposit') {
        // Input validation
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            throw new Error('Invalid deposit amount. Amount must be greater than 0');
        }
        
        if (amount > 100000) {
            throw new Error('Deposit amount too large. Maximum deposit is $100,000');
        }
        
        try {
            console.log(`Processing deposit: $${amount} for user ${userId}`);
            
            // Get current user
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            // Initialize portfolio if needed
            if (!user.portfolio) {
                user.portfolio = {
                    cashBalance: 0,
                    totalDeposited: 0,
                    totalWithdrawn: 0,
                    totalInvestmentValue: 0,
                    totalProfitLoss: 0,
                    totalReturnPercentage: 0,
                    numberOfFundsOwned: 0,
                    lastUpdated: new Date()
                };
            }
            
            // Update cash balance and totals
            const previousBalance = user.portfolio.cashBalance || 0;
            user.portfolio.cashBalance = previousBalance + amount;
            user.portfolio.totalDeposited = (user.portfolio.totalDeposited || 0) + amount;
            user.portfolio.lastUpdated = new Date();
            
            console.log(`Updated balance: ${previousBalance} -> ${user.portfolio.cashBalance}`);
            
            await user.save();
            
            // Generate unique reference ID
            const referenceId = `DEP_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            
            console.log(`Creating transaction with referenceId: ${referenceId}`);
            
            // Create transaction record
            const transaction = await Transaction.create({
                userId: userId,
                transactionType: 'DEPOSIT',
                amount: amount,
                description: description,
                balanceAfter: user.portfolio.cashBalance,
                status: 'COMPLETED',
                referenceId: referenceId
            });
            
            console.log(`Transaction created successfully: ${transaction._id}`);
            
            return {
                success: true,
                transactionId: transaction._id,
                newBalance: user.portfolio.cashBalance,
                amount: amount,
                previousBalance: previousBalance,
                referenceId: referenceId
            };
            
        } catch (error) {
            console.error('WalletService.depositCash error:', error);
            throw error;
        }
    }
    
    /**
     * Process cash withdrawal with proper referenceId
     */
    static async withdrawCash(userId, amount, description = 'Cash Withdrawal') {
        // Input validation
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            throw new Error('Invalid withdrawal amount. Amount must be greater than 0');
        }
        
        try {
            console.log(`Processing withdrawal: $${amount} for user ${userId}`);
            
            // Get current user
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            const currentBalance = user.portfolio?.cashBalance || 0;
            
            // Check sufficient funds
            if (currentBalance < amount) {
                throw new Error(`Insufficient funds. Available balance: $${currentBalance.toFixed(2)}, Requested: $${amount.toFixed(2)}`);
            }
            
            // Update cash balance and totals
            user.portfolio.cashBalance = currentBalance - amount;
            user.portfolio.totalWithdrawn = (user.portfolio.totalWithdrawn || 0) + amount;
            user.portfolio.lastUpdated = new Date();
            
            console.log(`Updated balance: ${currentBalance} -> ${user.portfolio.cashBalance}`);
            
            await user.save();
            
            // Generate unique reference ID
            const referenceId = `WTH_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            
            console.log(`Creating withdrawal transaction with referenceId: ${referenceId}`);
            
            // Create transaction record
            const transaction = await Transaction.create({
                userId: userId,
                transactionType: 'WITHDRAWAL',
                amount: amount,
                description: description,
                balanceAfter: user.portfolio.cashBalance,
                status: 'COMPLETED',
                referenceId: referenceId
            });
            
            console.log(`Withdrawal transaction created successfully: ${transaction._id}`);
            
            return {
                success: true,
                transactionId: transaction._id,
                newBalance: user.portfolio.cashBalance,
                amount: amount,
                previousBalance: currentBalance,
                referenceId: referenceId
            };
            
        } catch (error) {
            console.error('WalletService.withdrawCash error:', error);
            throw error;
        }
    }
    
    /**
     * Get user's transaction history with pagination
     */
    static async getUserTransactions(userId, options = {}) {
        try {
            const page = Math.max(1, options.page || 1);
            const limit = Math.min(50, Math.max(1, options.limit || 20));
            const skip = (page - 1) * limit;
            
            console.log(`Fetching transactions for user ${userId}, page ${page}, limit ${limit}`);
            
            // Build filter
            const filter = { userId: new mongoose.Types.ObjectId(userId) };
            if (options.type && ['DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL'].includes(options.type)) {
                filter.transactionType = options.type;
            }
            
            // Get transactions with pagination
            const transactions = await Transaction.find(filter)
                .sort({ transactionDate: -1 })
                .skip(skip)
                .limit(limit)
                .lean();
            
            console.log(`Found ${transactions.length} transactions for user ${userId}`);
            
            // Get total count for pagination
            const totalTransactions = await Transaction.countDocuments(filter);
            const totalPages = Math.ceil(totalTransactions / limit);
            
            // Format transactions for display
            const formattedTransactions = transactions.map(tx => ({
                id: tx._id,
                type: tx.transactionType,
                amount: tx.amount,
                formattedAmount: '$' + tx.amount.toFixed(2),
                description: tx.description,
                date: tx.transactionDate,
                balanceAfter: tx.balanceAfter,
                formattedBalanceAfter: '$' + tx.balanceAfter.toFixed(2),
                referenceId: tx.referenceId,
                status: tx.status,
                fundSymbol: tx.fundSymbol,
                fundName: tx.fundName,
                units: tx.units,
                navPrice: tx.navPriceAtTransaction,
                direction: ['DEPOSIT', 'BUY'].includes(tx.transactionType) ? 'IN' : 'OUT'
            }));
            
            return {
                transactions: formattedTransactions,
                pagination: {
                    page,
                    limit,
                    totalTransactions,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            };
            
        } catch (error) {
            console.error('WalletService.getUserTransactions error:', error);
            throw error;
        }
    }
    
    /**
     * Get user's ROI history for charting
     */
    static async getROIHistory(userId, days = 30) {
        try {
            if (days > 365) {
                throw new Error('Maximum history period is 365 days');
            }
            
            const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            
            const roiData = await ROI.find({
                userId: new mongoose.Types.ObjectId(userId),
                date: { $gte: startDate }
            })
            .sort({ date: 1 })
            .select('date totalPortfolioValue')
            .lean();
            
            // Calculate daily changes
            const chartData = roiData.map((item, index) => {
                let change = 0;
                let changePercent = 0;
                
                if (index > 0) {
                    const previousValue = roiData[index - 1].totalPortfolioValue;
                    change = item.totalPortfolioValue - previousValue;
                    changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;
                }
                
                return {
                    date: item.date,
                    value: item.totalPortfolioValue,
                    formattedValue: '$' + item.totalPortfolioValue.toFixed(2),
                    change: change,
                    changePercent: changePercent.toFixed(2)
                };
            });
            
            return chartData;
            
        } catch (error) {
            console.error('WalletService.getROIHistory error:', error);
            throw error;
        }
    }
    
    /**
     * Get wallet summary for dashboard
     */
    static async getWalletSummary(userId) {
        try {
            const portfolio = await this.getUserPortfolio(userId);
            
            // Get recent transactions count
            const recentTransactions = await Transaction.countDocuments({
                userId: new mongoose.Types.ObjectId(userId),
                transactionDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            });
            
            // Get latest ROI entry
            const latestROI = await ROI.findOne({
                userId: new mongoose.Types.ObjectId(userId)
            }).sort({ date: -1 }).lean();
            
            return {
                totalPortfolioValue: portfolio.portfolio.totalPortfolioValue,
                cashBalance: portfolio.portfolio.cashBalance,
                investmentValue: portfolio.portfolio.totalInvestmentValue,
                totalProfitLoss: portfolio.portfolio.totalProfitLoss,
                totalReturnPercentage: portfolio.portfolio.totalReturnPercentage,
                dayChange: portfolio.portfolio.dayChange,
                dayChangePercentage: portfolio.portfolio.dayChangePercentage,
                numberOfFunds: portfolio.portfolio.numberOfFundsOwned,
                recentTransactionsCount: recentTransactions,
                netDeposits: portfolio.portfolio.netDeposits,
                lastROIDate: latestROI?.date || null,
                lastUpdated: portfolio.portfolio.lastUpdated
            };
            
        } catch (error) {
            console.error('WalletService.getWalletSummary error:', error);
            throw error;
        }
    }
    
    /**
     * Create daily ROI snapshot
     */
    static async createROISnapshot(userId) {
        try {
            const portfolio = await this.getUserPortfolio(userId);
            const totalValue = portfolio.portfolio.totalPortfolioValue;
            
            const snapshot = await ROI.createDailySnapshot(userId, totalValue);
            
            return {
                date: snapshot.date,
                totalPortfolioValue: snapshot.totalPortfolioValue,
                formattedValue: '$' + totalValue.toFixed(2)
            };
            
        } catch (error) {
            console.error('WalletService.createROISnapshot error:', error);
            throw error;
        }
    }
}

module.exports = WalletService;