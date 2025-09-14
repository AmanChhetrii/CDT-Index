// services/fundService.js - Business logic for fund operations
const Fund = require('../models/Fund');
const NAV = require('../models/NAV');

class FundService {
    
    /**
     * Get all active funds with latest NAV data
     */
    static async getAllActiveFunds() {
        try {
            const funds = await Fund.find({ isActive: true }).sort({ displayOrder: 1 });
            
            const fundsWithNAV = await Promise.all(funds.map(async (fund) => {
                const latestNAV = await NAV.findOne({
                    fundSymbol: fund.symbol,
                    granularity: 'daily'
                }).sort({ date: -1 });
                
                return {
                    symbol: fund.symbol,
                    name: fund.name,
                    summary: fund.summary,
                    currentNAV: latestNAV ? latestNAV.nav : fund.currentNAV,
                    inceptionNAV: fund.inceptionNAV,
                    totalReturn: latestNAV ? latestNAV.totalReturnPercent : 0,
                    dailyChange: latestNAV ? latestNAV.dailyChangePercent : 0,
                    riskLevel: fund.riskLevel,
                    composition: fund.composition
                };
            }));

            return fundsWithNAV;
        } catch (error) {
            throw new Error(`Failed to get active funds: ${error.message}`);
        }
    }

    /**
     * Get complete fund details by symbol
     */
    static async getFundDetails(symbol) {
        try {
            const fund = await Fund.findOne({ 
                symbol: symbol.toUpperCase(), 
                isActive: true 
            });
            
            if (!fund) {
                throw new Error('Fund not found');
            }
            
            const latestNAV = await NAV.findOne({
                fundSymbol: fund.symbol,
                granularity: 'daily'
            }).sort({ date: -1 });
            
            return {
                symbol: fund.symbol,
                name: fund.name,
                slug: fund.slug,
                summary: fund.summary,
                description: fund.description,
                riskLevel: fund.riskLevel,
                riskIcon: fund.riskIcon,
                composition: fund.composition,
                currentNAV: latestNAV ? latestNAV.nav : fund.currentNAV,
                inceptionNAV: fund.inceptionNAV,
                inceptionDate: fund.inceptionDate,
                totalReturn: latestNAV ? latestNAV.totalReturnPercent : 0,
                dailyChange: latestNAV ? latestNAV.dailyChangePercent : 0,
                dailyChangeAmount: latestNAV ? latestNAV.dailyChange : 0,
                isActive: fund.isActive,
                featured: fund.featured,
                displayOrder: fund.displayOrder,
                createdAt: fund.createdAt,
                updatedAt: fund.updatedAt
            };
        } catch (error) {
            throw new Error(`Failed to get fund details: ${error.message}`);
        }
    }

    /**
     * Get fund by symbol (basic info)
     */
    static async getFundBySymbol(symbol) {
        try {
            const fund = await Fund.findOne({ 
                symbol: symbol.toUpperCase(), 
                isActive: true 
            });
            
            if (!fund) {
                throw new Error('Fund not found');
            }
            
            return fund;
        } catch (error) {
            throw new Error(`Failed to get fund: ${error.message}`);
        }
    }

    /**
     * Get fund performance metrics
     */
    static async getFundPerformance(symbol) {
        try {
            const latestNAV = await NAV.findOne({
                fundSymbol: symbol.toUpperCase(),
                granularity: 'daily'
            }).sort({ date: -1 });
            
            if (!latestNAV) {
                return {
                    currentNAV: 0,
                    totalReturn: 0,
                    totalReturnPercent: 0,
                    dailyChange: 0,
                    dailyChangePercent: 0,
                    lastUpdated: null
                };
            }
            
            return {
                currentNAV: latestNAV.nav,
                totalReturn: latestNAV.totalReturn,
                totalReturnPercent: latestNAV.totalReturnPercent,
                dailyChange: latestNAV.dailyChange,
                dailyChangePercent: latestNAV.dailyChangePercent,
                lastUpdated: latestNAV.date
            };
        } catch (error) {
            throw new Error(`Failed to get fund performance: ${error.message}`);
        }
    }

    /**
     * Get fund composition with current weights
     */
    static async getFundComposition(symbol) {
        try {
            const fund = await this.getFundBySymbol(symbol);
            return fund.composition;
        } catch (error) {
            throw new Error(`Failed to get fund composition: ${error.message}`);
        }
    }
}

module.exports = FundService;