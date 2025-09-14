// services/investmentService.js - Fund investment management
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Fund = require('../models/Fund');
const mongoose = require('mongoose');

class InvestmentService {
    
    /**
     * Process fund investment
     * @param {string} userId - User ID
     * @param {string} fundSymbol - Fund symbol to invest in
     * @param {number} amount - Investment amount in USD
     * @param {number} navPrice - Current NAV price per unit
     * @returns {Object} Investment result
     */
    static async investInFund(userId, fundSymbol, amount, navPrice) {
        try {
            console.log(`Processing fund investment: ${fundSymbol}, $${amount} for user ${userId}`);
            
            // Input validation
            if (!amount || typeof amount !== 'number' || amount < 1) {
                throw new Error('Invalid investment amount. Minimum investment is $1');
            }
            
            if (!navPrice || navPrice <= 0) {
                throw new Error('Invalid NAV price');
            }
            
            // Get user and fund data
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            const fund = await Fund.findOne({ symbol: fundSymbol.toUpperCase(), isActive: true });
            if (!fund) {
                throw new Error('Fund not found or inactive');
            }
            
            // Check wallet balance
            const currentBalance = user.portfolio?.cashBalance || 0;
            if (currentBalance < amount) {
                throw new Error(`Insufficient funds. Available: $${currentBalance.toFixed(2)}, Required: $${amount.toFixed(2)}`);
            }
            
            // Calculate units to purchase
            const units = amount / navPrice;
            
            console.log(`Investment calculation: $${amount} ÷ $${navPrice} = ${units.toFixed(4)} units`);
            
            // Update user cash balance
            user.portfolio.cashBalance = currentBalance - amount;
            user.portfolio.totalWithdrawn = (user.portfolio.totalWithdrawn || 0) + amount;
            
            // Update investment tracking
            user.portfolio.totalInvestedAmount = (user.portfolio.totalInvestedAmount || 0) + amount;
            user.portfolio.totalInvestmentValue = (user.portfolio.totalInvestmentValue || 0) + amount;
            
            // Set first investment date if this is first investment
            if (!user.portfolio.firstInvestmentDate) {
                user.portfolio.firstInvestmentDate = new Date();
            }
            user.portfolio.lastTransactionDate = new Date();
            user.portfolio.lastUpdated = new Date();
            
            // Find existing holding or create new one
            let existingHolding = user.holdings.find(h => h.fundSymbol === fundSymbol.toUpperCase());
            
            if (existingHolding) {
                // Update existing holding
                const newTotalInvested = existingHolding.totalInvested + amount;
                const newTotalUnits = existingHolding.units + units;
                
                existingHolding.units = newTotalUnits;
                existingHolding.totalInvested = newTotalInvested;
                existingHolding.averageBuyPrice = newTotalInvested / newTotalUnits;
                existingHolding.currentNAV = navPrice;
                existingHolding.currentValue = newTotalUnits * navPrice;
                existingHolding.profitLoss = existingHolding.currentValue - newTotalInvested;
                existingHolding.profitLossPercentage = newTotalInvested > 0 
                    ? (existingHolding.profitLoss / newTotalInvested) * 100 
                    : 0;
                existingHolding.lastTransactionDate = new Date();
                
                console.log(`Updated existing holding: ${newTotalUnits.toFixed(4)} units, avg price $${existingHolding.averageBuyPrice.toFixed(4)}`);
            } else {
                // Create new holding
                const newHolding = {
                    fundSymbol: fundSymbol.toUpperCase(),
                    fundName: fund.name,
                    units: units,
                    totalInvested: amount,
                    averageBuyPrice: navPrice,
                    currentNAV: navPrice,
                    currentValue: amount,
                    profitLoss: 0,
                    profitLossPercentage: 0,
                    dayChange: 0,
                    dayChangePercentage: 0,
                    firstPurchaseDate: new Date(),
                    lastTransactionDate: new Date()
                };
                
                user.holdings.push(newHolding);
                console.log(`Created new holding: ${units.toFixed(4)} units at $${navPrice.toFixed(4)}`);
            }
            
            // Update portfolio statistics
            user.portfolio.numberOfFundsOwned = user.holdings.length;
            
            await user.save();
            console.log(`User portfolio updated successfully`);
            
            // Create transaction record
            const referenceId = `BUY_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const transaction = await Transaction.create({
                userId: userId,
                transactionType: 'BUY',
                amount: amount,
                description: `Purchased ${units.toFixed(4)} units of ${fund.name}`,
                fundSymbol: fundSymbol.toUpperCase(),
                fundName: fund.name,
                navPriceAtTransaction: navPrice,
                units: units,
                totalValue: amount,
                balanceAfter: user.portfolio.cashBalance,
                status: 'COMPLETED',
                referenceId: referenceId,
                
                // Fund composition snapshot
                fundComposition: fund.composition.map(comp => ({
                    symbol: comp.symbol,
                    name: comp.name,
                    weight: comp.weight,
                    priceAtTransaction: 0 // Could be enhanced to include actual crypto prices
                })),
                fundRiskLevel: fund.riskLevel,
                fundInceptionNAV: fund.inceptionNAV,
                fundTotalReturnAtTransaction: this.calculateFundReturn(fund.currentNAV, fund.inceptionNAV)
            });
            
            console.log(`Investment transaction created: ${transaction._id}`);
            
            return {
                success: true,
                message: `Successfully invested $${amount.toFixed(2)} in ${fund.name}`,
                investment: {
                    fundSymbol: fundSymbol.toUpperCase(),
                    fundName: fund.name,
                    amount: amount,
                    units: units,
                    navPrice: navPrice,
                    newBalance: user.portfolio.cashBalance,
                    transactionId: transaction._id,
                    referenceId: referenceId
                }
            };
            
        } catch (error) {
            console.error('InvestmentService.investInFund error:', error);
            throw error;
        }
    }
    
    /**
     * Sell fund units
     * @param {string} userId - User ID
     * @param {string} fundSymbol - Fund symbol to sell
     * @param {number} units - Number of units to sell
     * @returns {Object} Sale result
     */
    static async sellFundUnits(userId, fundSymbol, units) {
        try {
            console.log(`Processing fund sale: ${units} units of ${fundSymbol} for user ${userId}`);
            
            if (!units || units <= 0) {
                throw new Error('Invalid number of units to sell');
            }
            
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            const fund = await Fund.findOne({ symbol: fundSymbol.toUpperCase(), isActive: true });
            if (!fund) {
                throw new Error('Fund not found or inactive');
            }
            
            // Find user's holding
            const holding = user.holdings.find(h => h.fundSymbol === fundSymbol.toUpperCase());
            if (!holding) {
                throw new Error('You do not own units in this fund');
            }
            
            if (holding.units < units) {
                throw new Error(`Insufficient units. You own ${holding.units.toFixed(4)} units, trying to sell ${units.toFixed(4)}`);
            }
            
            // Calculate sale proceeds
            const currentNAV = fund.currentNAV;
            const saleAmount = units * currentNAV;
            
            console.log(`Sale calculation: ${units} units × $${currentNAV} = $${saleAmount.toFixed(2)}`);
            
            // Update user cash balance
            user.portfolio.cashBalance = (user.portfolio.cashBalance || 0) + saleAmount;
            user.portfolio.totalDeposited = (user.portfolio.totalDeposited || 0) + saleAmount;
            
            // Update investment tracking
            const soldPortion = units / holding.units;
            const reducedInvestment = holding.totalInvested * soldPortion;
            
            user.portfolio.totalInvestedAmount = (user.portfolio.totalInvestedAmount || 0) - reducedInvestment;
            user.portfolio.totalInvestmentValue = (user.portfolio.totalInvestmentValue || 0) - saleAmount;
            
            // Calculate realized profit/loss
            const realizedPL = saleAmount - reducedInvestment;
            
            // Update holding
            if (holding.units === units) {
                // Selling all units - remove holding
                user.holdings = user.holdings.filter(h => h.fundSymbol !== fundSymbol.toUpperCase());
                console.log(`Completely sold holding in ${fundSymbol}`);
            } else {
                // Partial sale - update holding
                holding.units -= units;
                holding.totalInvested -= reducedInvestment;
                holding.currentNAV = currentNAV;
                holding.currentValue = holding.units * currentNAV;
                holding.profitLoss = holding.currentValue - holding.totalInvested;
                holding.profitLossPercentage = holding.totalInvested > 0 
                    ? (holding.profitLoss / holding.totalInvested) * 100 
                    : 0;
                holding.lastTransactionDate = new Date();
                
                console.log(`Partially sold holding: ${holding.units.toFixed(4)} units remaining`);
            }
            
            // Update portfolio statistics
            user.portfolio.numberOfFundsOwned = user.holdings.length;
            user.portfolio.lastTransactionDate = new Date();
            user.portfolio.lastUpdated = new Date();
            
            await user.save();
            console.log(`User portfolio updated after sale`);
            
            // Create transaction record
            const referenceId = `SELL_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const transaction = await Transaction.create({
                userId: userId,
                transactionType: 'SELL',
                amount: saleAmount,
                description: `Sold ${units.toFixed(4)} units of ${fund.name}`,
                fundSymbol: fundSymbol.toUpperCase(),
                fundName: fund.name,
                navPriceAtTransaction: currentNAV,
                units: units,
                totalValue: saleAmount,
                balanceAfter: user.portfolio.cashBalance,
                status: 'COMPLETED',
                referenceId: referenceId,
                
                // Fund composition snapshot
                fundComposition: fund.composition.map(comp => ({
                    symbol: comp.symbol,
                    name: comp.name,
                    weight: comp.weight,
                    priceAtTransaction: 0
                })),
                fundRiskLevel: fund.riskLevel
            });
            
            console.log(`Sale transaction created: ${transaction._id}`);
            
            return {
                success: true,
                message: `Successfully sold ${units.toFixed(4)} units of ${fund.name} for $${saleAmount.toFixed(2)}`,
                sale: {
                    fundSymbol: fundSymbol.toUpperCase(),
                    fundName: fund.name,
                    units: units,
                    navPrice: currentNAV,
                    saleAmount: saleAmount,
                    realizedPL: realizedPL,
                    newBalance: user.portfolio.cashBalance,
                    transactionId: transaction._id,
                    referenceId: referenceId
                }
            };
            
        } catch (error) {
            console.error('InvestmentService.sellFundUnits error:', error);
            throw error;
        }
    }
    
    /**
     * Get user's fund holdings
     * @param {string} userId - User ID
     * @returns {Object} User holdings data
     */
    static async getUserHoldings(userId) {
        try {
            const user = await User.findById(userId)
                .select('holdings portfolio')
                .lean();
                
            if (!user) {
                throw new Error('User not found');
            }
            
            // Get current fund data for price updates
            const fundSymbols = user.holdings?.map(h => h.fundSymbol) || [];
            const currentFunds = await Fund.find({ 
                symbol: { $in: fundSymbols }, 
                isActive: true 
            }).lean();
            
            // Update holdings with current prices
            const updatedHoldings = (user.holdings || []).map(holding => {
                const currentFund = currentFunds.find(f => f.symbol === holding.fundSymbol);
                if (currentFund) {
                    const currentValue = holding.units * currentFund.currentNAV;
                    const profitLoss = currentValue - holding.totalInvested;
                    const profitLossPercentage = holding.totalInvested > 0 
                        ? (profitLoss / holding.totalInvested) * 100 
                        : 0;
                    
                    return {
                        ...holding,
                        currentNAV: currentFund.currentNAV,
                        currentValue: currentValue,
                        profitLoss: profitLoss,
                        profitLossPercentage: profitLossPercentage,
                        fundTotalReturn: this.calculateFundReturn(currentFund.currentNAV, currentFund.inceptionNAV)
                    };
                }
                return holding;
            });
            
            return {
                holdings: updatedHoldings,
                summary: {
                    totalInvestmentValue: updatedHoldings.reduce((sum, h) => sum + (h.currentValue || 0), 0),
                    totalInvestedAmount: user.portfolio?.totalInvestedAmount || 0,
                    totalProfitLoss: user.portfolio?.totalProfitLoss || 0,
                    totalReturnPercentage: user.portfolio?.totalReturnPercentage || 0,
                    numberOfFunds: updatedHoldings.length
                }
            };
            
        } catch (error) {
            console.error('InvestmentService.getUserHoldings error:', error);
            throw error;
        }
    }
    
    /**
     * Calculate fund return percentage
     * @param {number} currentNAV - Current NAV
     * @param {number} inceptionNAV - Inception NAV
     * @returns {number} Return percentage
     */
    static calculateFundReturn(currentNAV, inceptionNAV) {
        if (!inceptionNAV || inceptionNAV <= 0) return 0;
        return ((currentNAV - inceptionNAV) / inceptionNAV) * 100;
    }
    
    /**
     * Update all user portfolios with current NAV prices (for automation)
     * @returns {Object} Update results
     */
    static async updateAllPortfolioValues() {
        try {
            const users = await User.find({ 
                'holdings.0': { $exists: true } 
            });
            
            const funds = await Fund.find({ isActive: true }).lean();
            let updatedCount = 0;
            const errors = [];
            
            for (const user of users) {
                try {
                    let totalInvestmentValue = 0;
                    
                    // Update each holding with current prices
                    user.holdings.forEach(holding => {
                        const currentFund = funds.find(f => f.symbol === holding.fundSymbol);
                        if (currentFund) {
                            holding.currentNAV = currentFund.currentNAV;
                            holding.currentValue = holding.units * currentFund.currentNAV;
                            holding.profitLoss = holding.currentValue - holding.totalInvested;
                            holding.profitLossPercentage = holding.totalInvested > 0 
                                ? (holding.profitLoss / holding.totalInvested) * 100 
                                : 0;
                            
                            totalInvestmentValue += holding.currentValue;
                        }
                    });
                    
                    // Update portfolio totals
                    const previousValue = user.portfolio.totalInvestmentValue || 0;
                    user.portfolio.totalInvestmentValue = totalInvestmentValue;
                    user.portfolio.dayChange = totalInvestmentValue - previousValue;
                    user.portfolio.dayChangePercentage = previousValue > 0 
                        ? (user.portfolio.dayChange / previousValue) * 100 
                        : 0;
                    user.portfolio.totalProfitLoss = totalInvestmentValue - (user.portfolio.totalInvestedAmount || 0);
                    user.portfolio.totalReturnPercentage = user.portfolio.totalInvestedAmount > 0 
                        ? (user.portfolio.totalProfitLoss / user.portfolio.totalInvestedAmount) * 100 
                        : 0;
                    user.portfolio.lastUpdated = new Date();
                    
                    await user.save();
                    updatedCount++;
                    
                } catch (error) {
                    errors.push({ userId: user._id, error: error.message });
                }
            }
            
            return {
                success: true,
                updatedCount,
                totalUsers: users.length,
                errors
            };
            
        } catch (error) {
            console.error('InvestmentService.updateAllPortfolioValues error:', error);
            throw error;
        }
    }
}

module.exports = InvestmentService;