// services/navCalculationService.js - Fund NAV calculation and management
const Fund = require('../models/Fund');
const FundNAV = require('../models/FundNAV');
const CryptoPrice = require('../models/CryptoPrice');
const cryptoDataService = require('./cryptoDataService');

class NAVCalculationService {
    constructor() {
        this.batchSize = 100; // Process dates in batches for better performance
    }

    // Calculate NAV for all funds for a specific date
    async calculateNAVForDate(date) {
        try {
            console.log(`Calculating NAV for all funds on ${date.toISOString().split('T')[0]}...`);
            
            const funds = await Fund.getActiveFunds();
            const results = [];
            
            // Get price changes for this date
            const priceChanges = await cryptoDataService.getPriceChanges(date);
            const absolutePrices = await cryptoDataService.getPricesForDate(date);
            
            for (const fund of funds) {
                try {
                    const result = await this.calculateFundNAV(fund, date, priceChanges, absolutePrices);
                    results.push(result);
                } catch (error) {
                    console.error(`Error calculating NAV for ${fund.symbol}:`, error);
                    results.push({
                        fundSymbol: fund.symbol,
                        success: false,
                        error: error.message
                    });
                }
            }
            
            console.log(`NAV calculation completed for ${results.length} funds`);
            return results;
            
        } catch (error) {
            console.error('Error calculating NAV for date:', error);
            throw error;
        }
    }

    // Calculate NAV for a specific fund
    async calculateFundNAV(fund, date, priceChanges = null, absolutePrices = null) {
        try {
            // Get the most recent NAV for this fund
            const previousNAV = await FundNAV.findOne({
                fundId: fund._id,
                date: { $lt: date }
            }).sort({ date: -1 });
            
            let currentNAV;
            let weightedChange = 0;
            
            if (!previousNAV) {
                // This is the first NAV calculation, use inception NAV
                currentNAV = fund.inceptionNAV;
                console.log(`First NAV calculation for ${fund.symbol}: $${currentNAV.toFixed(4)}`);
            } else {
                // Calculate NAV based on price changes
                if (!priceChanges) {
                    priceChanges = await cryptoDataService.getPriceChanges(date);
                }
                
                // Calculate weighted change
                let validChanges = 0;
                for (const coin of fund.composition) {
                    const change = priceChanges[coin.symbol];
                    if (typeof change === 'number' && !isNaN(change)) {
                        weightedChange += change * coin.weight;
                        validChanges++;
                    }
                }
                
                if (validChanges !== fund.composition.length) {
                    throw new Error(`Incomplete price data for ${fund.symbol}: only ${validChanges}/${fund.composition.length} coins have data`);
                }
                
                // Apply weighted change to previous NAV
                currentNAV = previousNAV.nav * (1 + weightedChange / 100);
                currentNAV = Math.max(currentNAV, 0.01); // Prevent negative NAV
            }
            
            // Get absolute prices for audit trail
            if (!absolutePrices) {
                absolutePrices = await cryptoDataService.getPricesForDate(date);
            }
            
            // Filter prices to only include fund components
            const fundPrices = {};
            fund.composition.forEach(coin => {
                if (absolutePrices[coin.symbol]) {
                    fundPrices[coin.symbol] = absolutePrices[coin.symbol];
                }
            });
            
            // Save NAV entry
            const navEntry = await FundNAV.addNAVEntry(
                fund._id,
                fund.symbol,
                currentNAV,
                date,
                fundPrices,
                weightedChange
            );
            
            // Update fund's current NAV
            fund.currentNAV = currentNAV;
            await fund.save();
            
            console.log(`${fund.symbol}: $${currentNAV.toFixed(4)} (${weightedChange > 0 ? '+' : ''}${weightedChange.toFixed(2)}%)`);
            
            return {
                fundSymbol: fund.symbol,
                success: true,
                nav: currentNAV,
                weightedChange,
                navEntry
            };
            
        } catch (error) {
            console.error(`Error calculating NAV for ${fund.symbol}:`, error);
            throw error;
        }
    }

    // Calculate historical NAVs for all funds
    async calculateHistoricalNAVs() {
        try {
            console.log('Starting historical NAV calculations...');
            
            // Get all unique dates from price history, sorted chronologically
            const dates = await CryptoPrice.distinct('date', { granularity: 'daily' });
            const sortedDates = dates.sort((a, b) => new Date(a) - new Date(b));
            
            console.log(`Processing ${sortedDates.length} historical dates...`);
            
            let processedCount = 0;
            const batchSize = this.batchSize;
            
            // Process dates in batches to avoid memory issues
            for (let i = 0; i < sortedDates.length; i += batchSize) {
                const batch = sortedDates.slice(i, Math.min(i + batchSize, sortedDates.length));
                
                for (const date of batch) {
                    try {
                        await this.calculateNAVForDate(new Date(date));
                        processedCount++;
                        
                        // Progress indicator
                        if (processedCount % 50 === 0) {
                            console.log(`Processed ${processedCount}/${sortedDates.length} dates (${((processedCount/sortedDates.length)*100).toFixed(1)}%)`);
                        }
                        
                    } catch (error) {
                        console.error(`Error processing date ${date}:`, error.message);
                        continue; // Skip this date and continue
                    }
                }
                
                // Small delay between batches to prevent overwhelming the database
                await this.delay(100);
            }
            
            console.log(`Historical NAV calculation completed! Processed ${processedCount}/${sortedDates.length} dates`);
            
        } catch (error) {
            console.error('Error calculating historical NAVs:', error);
            throw error;
        }
    }

    // Update daily NAVs (for current day operations)
    async updateDailyNAVs() {
        try {
            console.log('Updating daily NAVs...');
            
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize to start of day
            
            const results = await this.calculateNAVForDate(today);
            
            // Log results
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);
            
            console.log(`Daily NAV update completed: ${successful.length} successful, ${failed.length} failed`);
            
            if (failed.length > 0) {
                console.warn('Failed NAV calculations:', failed);
            }
            
            return results;
            
        } catch (error) {
            console.error('Error updating daily NAVs:', error);
            throw error;
        }
    }

    // Reset all funds to inception values (for testing/reinitialization)
    async resetFundsToInception() {
        try {
            console.log('Resetting all funds to inception values...');
            
            const funds = await Fund.getActiveFunds();
            
            for (const fund of funds) {
                fund.currentNAV = fund.inceptionNAV;
                await fund.save();
                console.log(`Reset ${fund.symbol} to inception NAV: $${fund.inceptionNAV.toFixed(2)}`);
            }
            
            // Clear existing NAV history
            await FundNAV.deleteMany({});
            console.log('Cleared existing NAV history');
            
            console.log('Fund reset completed!');
            
        } catch (error) {
            console.error('Error resetting funds:', error);
            throw error;
        }
    }

    // Validate NAV calculations for a specific date
    async validateNAVCalculations(date) {
        try {
            console.log(`Validating NAV calculations for ${date.toISOString().split('T')[0]}...`);
            
            const funds = await Fund.getActiveFunds();
            const validationResults = [];
            
            for (const fund of funds) {
                const navEntry = await FundNAV.findOne({
                    fundId: fund._id,
                    date: date
                });
                
                if (!navEntry) {
                    validationResults.push({
                        fundSymbol: fund.symbol,
                        valid: false,
                        error: 'No NAV entry found for this date'
                    });
                    continue;
                }
                
                // Validate that all required prices are present
                const requiredSymbols = fund.composition.map(c => c.symbol);
                const availablePrices = Object.keys(navEntry.underlyingPrices.toObject());
                const missingPrices = requiredSymbols.filter(symbol => !availablePrices.includes(symbol));
                
                if (missingPrices.length > 0) {
                    validationResults.push({
                        fundSymbol: fund.symbol,
                        valid: false,
                        error: `Missing prices for: ${missingPrices.join(', ')}`
                    });
                    continue;
                }
                
                // Validate NAV is positive
                if (navEntry.nav <= 0) {
                    validationResults.push({
                        fundSymbol: fund.symbol,
                        valid: false,
                        error: `Invalid NAV: ${navEntry.nav}`
                    });
                    continue;
                }
                
                validationResults.push({
                    fundSymbol: fund.symbol,
                    valid: true,
                    nav: navEntry.nav,
                    weightedChange: navEntry.weightedChange
                });
            }
            
            const validCount = validationResults.filter(r => r.valid).length;
            console.log(`Validation completed: ${validCount}/${validationResults.length} funds valid`);
            
            return validationResults;
            
        } catch (error) {
            console.error('Error validating NAV calculations:', error);
            throw error;
        }
    }

    // Get performance summary for all funds
    async getPerformanceSummary() {
        try {
            const funds = await Fund.getActiveFunds();
            const summaries = [];
            
            for (const fund of funds) {
                const performance = await FundNAV.getPerformanceSummary(fund._id);
                summaries.push({
                    ...fund.getPerformanceSummary(),
                    ...performance
                });
            }
            
            return summaries;
            
        } catch (error) {
            console.error('Error getting performance summary:', error);
            throw error;
        }
    }

    // Utility method for delays
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new NAVCalculationService();