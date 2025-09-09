// services/nav/navCalculationService.js - Fixed NAV calculation service
const NAV = require('../../models/NAV');
const CryptoPrice = require('../../models/CryptoPrice');

class NAVCalculationService {
    constructor() {
        // Fund configurations with true inception NAV (for monthly baseline only)
        this.fundConfigs = {
            'CDTGR': {
                inceptionNAV: 120,
                composition: { 'BTC': 0.60, 'ETH': 0.25, 'SOL': 0.15 }
            },
            'CDTBAL': {
                inceptionNAV: 100,
                composition: { 'BTC': 0.30, 'ETH': 0.30, 'AVAX': 0.20, 'LINK': 0.20 }
            },
            'CDTPIO': {
                inceptionNAV: 90,
                composition: { 'DOGE': 0.50, 'MANA': 0.35, 'AVAX': 0.15 }
            },
            'CDTARC': {
                inceptionNAV: 150,
                composition: { 'BTC': 0.40, 'ETH': 0.25, 'SOL': 0.20, 'LINK': 0.15 }
            }
        };
        
        this.monthlyInceptionDate = null;
        this.monthlyInceptionPrices = {};
        this.granularityBaselines = {};
    }

    // Get all unique crypto symbols across all funds
    getAllRequiredCryptos() {
        const cryptos = new Set();
        Object.values(this.fundConfigs).forEach(config => {
            Object.keys(config.composition).forEach(crypto => cryptos.add(crypto));
        });
        return Array.from(cryptos);
    }

    // Find monthly inception date and prices (true baseline)
    async initializeMonthlyBaseline() {
        try {
            console.log('=== Initializing Monthly Baseline ===');
            
            const requiredCryptos = this.getAllRequiredCryptos();
            console.log(`Required cryptos: ${requiredCryptos.join(', ')}`);

            // Find earliest date where all cryptos have monthly data
            let latestEarliestDate = null;
            
            for (const crypto of requiredCryptos) {
                const earliestRecord = await CryptoPrice.findOne({
                    symbol: crypto,
                    granularity: 'monthly',
                    price: { $gt: 0 }
                }).sort({ date: 1 });

                if (!earliestRecord) {
                    throw new Error(`No monthly data for ${crypto}`);
                }

                if (!latestEarliestDate || earliestRecord.date > latestEarliestDate) {
                    latestEarliestDate = earliestRecord.date;
                }
            }

            this.monthlyInceptionDate = latestEarliestDate;
            console.log(`Monthly inception date: ${this.monthlyInceptionDate.toDateString()}`);

            // Get inception prices from monthly data
            this.monthlyInceptionPrices = {};
            for (const crypto of requiredCryptos) {
                const priceRecord = await CryptoPrice.findOne({
                    symbol: crypto,
                    date: this.monthlyInceptionDate,
                    granularity: 'monthly'
                });

                if (!priceRecord) {
                    throw new Error(`No monthly price for ${crypto} on ${this.monthlyInceptionDate.toDateString()}`);
                }

                this.monthlyInceptionPrices[crypto] = priceRecord.price;
                console.log(`${crypto}: $${priceRecord.price.toFixed(4)}`);
            }

            // Store monthly baseline - FIXED: store just the NAV numbers
            const monthlyBaselineNAVs = {};
            Object.entries(this.fundConfigs).forEach(([symbol, config]) => {
                monthlyBaselineNAVs[symbol] = config.inceptionNAV;
            });

            this.granularityBaselines.monthly = {
                inceptionDate: this.monthlyInceptionDate,
                inceptionPrices: { ...this.monthlyInceptionPrices },
                baselineNAVs: monthlyBaselineNAVs
            };

            console.log('Monthly baseline established');
            return true;

        } catch (error) {
            console.error('Error initializing monthly baseline:', error);
            throw error;
        }
    }

    // Calculate NAV using given baseline prices and NAV
    calculateNAVWithBaseline(fundSymbol, currentPrices, baselinePrices, baselineNAV) {
        const config = this.fundConfigs[fundSymbol];
        if (!config) {
            throw new Error(`Unknown fund: ${fundSymbol}`);
        }

        // Validate we have all required data
        const missingCurrentPrices = [];
        const missingBaselinePrices = [];
        
        for (const crypto of Object.keys(config.composition)) {
            if (!currentPrices[crypto] || currentPrices[crypto] <= 0) {
                missingCurrentPrices.push(crypto);
            }
            if (!baselinePrices[crypto] || baselinePrices[crypto] <= 0) {
                missingBaselinePrices.push(crypto);
            }
        }

        if (missingCurrentPrices.length > 0) {
            throw new Error(`Missing current prices: ${missingCurrentPrices.join(', ')}`);
        }
        if (missingBaselinePrices.length > 0) {
            throw new Error(`Missing baseline prices: ${missingBaselinePrices.join(', ')}`);
        }

        // Calculate weighted sum
        let weightedSum = 0;
        for (const [crypto, weight] of Object.entries(config.composition)) {
            const currentPrice = currentPrices[crypto];
            const baselinePrice = baselinePrices[crypto];
            const priceRatio = currentPrice / baselinePrice;
            weightedSum += weight * priceRatio;
        }

        return baselineNAV * weightedSum;
    }

    // Get earliest date for granularity where ALL required cryptos have data
    async getEarliestCompleteDate(granularity) {
        try {
            const requiredCryptos = this.getAllRequiredCryptos();
            let latestEarliestDate = null;

            for (const crypto of requiredCryptos) {
                const earliestRecord = await CryptoPrice.findOne({
                    symbol: crypto,
                    granularity: granularity,
                    price: { $gt: 0 }
                }).sort({ date: 1 });

                if (!earliestRecord) {
                    return null; // This granularity doesn't have data for this crypto
                }

                if (!latestEarliestDate || earliestRecord.date > latestEarliestDate) {
                    latestEarliestDate = earliestRecord.date;
                }
            }

            return latestEarliestDate;

        } catch (error) {
            console.error(`Error finding earliest complete date for ${granularity}:`, error);
            return null;
        }
    }

    // Initialize baseline for a specific granularity
    async initializeGranularityBaseline(granularity) {
        try {
            console.log(`\n=== Initializing ${granularity.toUpperCase()} Baseline ===`);

            if (granularity === 'monthly') {
                // Already handled
                return this.granularityBaselines.monthly;
            }

            // Ensure monthly baseline is established first
            if (!this.monthlyInceptionPrices || Object.keys(this.monthlyInceptionPrices).length === 0) {
                throw new Error('Monthly baseline must be established first');
            }

            // Find earliest complete date for this granularity
            const earliestDate = await this.getEarliestCompleteDate(granularity);
            if (!earliestDate) {
                throw new Error(`No complete ${granularity} data available`);
            }

            console.log(`Earliest ${granularity} date: ${earliestDate.toDateString()}`);

            // Get crypto prices for this date
            const startPrices = await this.getCryptoPricesForSpecificDate(earliestDate, granularity);
            if (Object.keys(startPrices).length === 0) {
                throw new Error(`No ${granularity} prices on start date`);
            }

            // Calculate baseline NAVs for this granularity
            const baselineNAVs = {};
            for (const fundSymbol of Object.keys(this.fundConfigs)) {
                try {
                    const calculatedNAV = this.calculateNAVWithBaseline(
                        fundSymbol,
                        startPrices,
                        this.monthlyInceptionPrices,
                        this.fundConfigs[fundSymbol].inceptionNAV
                    );
                    baselineNAVs[fundSymbol] = calculatedNAV;
                    console.log(`${fundSymbol}: Baseline NAV = $${calculatedNAV.toFixed(4)}`);
                } catch (error) {
                    console.warn(`Could not calculate baseline for ${fundSymbol}: ${error.message}`);
                }
            }

            // Store baseline
            this.granularityBaselines[granularity] = {
                inceptionDate: earliestDate,
                inceptionPrices: { ...startPrices },
                baselineNAVs: baselineNAVs
            };

            console.log(`${granularity.toUpperCase()} baseline established with ${Object.keys(baselineNAVs).length} funds`);
            return this.granularityBaselines[granularity];

        } catch (error) {
            console.error(`Error initializing ${granularity} baseline:`, error);
            throw error;
        }
    }

    // Calculate NAV for specific granularity using its baseline
    calculateNAV(fundSymbol, currentPrices, currentDate, granularity) {
        const baseline = this.granularityBaselines[granularity];
        if (!baseline) {
            throw new Error(`No baseline established for ${granularity}`);
        }

        if (!baseline.baselineNAVs[fundSymbol]) {
            throw new Error(`No baseline NAV for ${fundSymbol} in ${granularity}`);
        }

        // Skip if before this granularity's inception
        if (currentDate < baseline.inceptionDate) {
            return null;
        }

        return this.calculateNAVWithBaseline(
            fundSymbol,
            currentPrices,
            baseline.inceptionPrices,
            baseline.baselineNAVs[fundSymbol]
        );
    }

    // Get crypto prices for a specific date and granularity
    async getCryptoPricesForSpecificDate(targetDate, granularity) {
        try {
            const prices = {};
            const priceRecords = await CryptoPrice.find({
                date: targetDate,
                granularity: granularity
            });

            priceRecords.forEach(record => {
                prices[record.symbol] = record.price;
            });

            return prices;
        } catch (error) {
            console.error('Error getting crypto prices:', error);
            throw error;
        }
    }

    // Get all available dates for a granularity
    async getAvailableDates(granularity) {
        try {
            const dates = await CryptoPrice.distinct('date', { granularity });
            return dates.sort((a, b) => a - b);
        } catch (error) {
            console.error(`Error getting available ${granularity} dates:`, error);
            throw error;
        }
    }

    // Initialize all baselines
    async initializeAllBaselines() {
        try {
            console.log('=== Initializing All Granularity Baselines ===');
            
            // Monthly first (true inception)
            await this.initializeMonthlyBaseline();
            
            // Then weekly and daily
            const granularities = ['weekly', 'daily'];
            for (const granularity of granularities) {
                try {
                    await this.initializeGranularityBaseline(granularity);
                } catch (error) {
                    console.warn(`Could not initialize ${granularity} baseline: ${error.message}`);
                }
            }
            
            console.log('\n=== Baseline Initialization Complete ===');
            this.displayBaselineSummary();
            
            return this.granularityBaselines;

        } catch (error) {
            console.error('Error initializing baselines:', error);
            throw error;
        }
    }

    // Display baseline summary
    displayBaselineSummary() {
        console.log('\n=== Baseline Summary ===');
        
        for (const [granularity, baseline] of Object.entries(this.granularityBaselines)) {
            if (!baseline || !baseline.inceptionDate) continue;
            
            console.log(`\n${granularity.toUpperCase()}:`);
            console.log(`  Start Date: ${baseline.inceptionDate.toDateString()}`);
            console.log(`  Baseline NAVs:`);
            
            for (const [fund, nav] of Object.entries(baseline.baselineNAVs || {})) {
                console.log(`    ${fund}: $${nav.toFixed(4)}`);
            }
        }
    }

    // Process historical NAV for specific granularity
    async processHistoricalNAVByGranularity(granularity) {
        try {
            console.log(`\n=== Processing ${granularity.toUpperCase()} NAV Data ===`);

            const baseline = this.granularityBaselines[granularity];
            if (!baseline) {
                console.warn(`No baseline for ${granularity}, skipping`);
                return { processedDates: 0, successfulCalculations: 0 };
            }

            const availableDates = await this.getAvailableDates(granularity);
            const validDates = availableDates.filter(date => date >= baseline.inceptionDate);
            
            console.log(`Processing ${validDates.length}/${availableDates.length} dates (post-baseline)`);

            let processedCount = 0;
            let successfulFunds = 0;

            for (const date of validDates) {
                try {
                    const cryptoPrices = await this.getCryptoPricesForSpecificDate(date, granularity);
                    
                    if (Object.keys(cryptoPrices).length === 0) {
                        processedCount++;
                        continue;
                    }

                    for (const fundSymbol of Object.keys(this.fundConfigs)) {
                        try {
                            const nav = this.calculateNAV(fundSymbol, cryptoPrices, date, granularity);
                            
                            if (nav === null) continue;
                            
                            // Get previous NAV for change calculation
                            const previousNAV = await this.getPreviousNAV(fundSymbol, date, granularity);
                            
                            let dailyChange = 0;
                            let dailyChangePercent = 0;
                            if (previousNAV) {
                                dailyChange = nav - previousNAV.nav;
                                dailyChangePercent = previousNAV.nav > 0 ? (dailyChange / previousNAV.nav) * 100 : 0;
                            }

                            // Calculate total return from this granularity's baseline
                            const baselineNAV = baseline.baselineNAVs[fundSymbol];
                            const totalReturn = nav - baselineNAV;
                            const totalReturnPercent = (totalReturn / baselineNAV) * 100;

                            const navRecord = {
                                fundSymbol,
                                date: new Date(date),
                                nav,
                                dailyChange,
                                dailyChangePercent,
                                totalReturn,
                                totalReturnPercent,
                                granularity,
                                source: 'calculated'
                            };

                            await NAV.replaceOne(
                                { fundSymbol, date: new Date(date), granularity },
                                navRecord,
                                { upsert: true }
                            );

                            successfulFunds++;

                        } catch (fundError) {
                            if (!fundError.message.includes('Missing')) {
                                console.error(`${fundSymbol} on ${date.toDateString()}: ${fundError.message}`);
                            }
                        }
                    }

                    processedCount++;
                    if (processedCount % 25 === 0) {
                        console.log(`Processed ${processedCount}/${validDates.length} ${granularity} dates...`);
                    }

                } catch (error) {
                    console.error(`Date ${date.toDateString()}: ${error.message}`);
                    processedCount++;
                }
            }

            console.log(`${granularity.toUpperCase()} complete: ${processedCount} dates, ${successfulFunds} calculations`);
            return { processedDates: processedCount, successfulCalculations: successfulFunds };

        } catch (error) {
            console.error(`Error processing ${granularity}:`, error);
            return { processedDates: 0, successfulCalculations: 0 };
        }
    }

    // Process all historical NAV data
    async processAllHistoricalNAV() {
        try {
            await this.initializeAllBaselines();

            console.log('\n=== Processing Historical NAV Data ===');

            const results = {};
            const granularities = ['monthly', 'weekly', 'daily'];
            
            for (const granularity of granularities) {
                results[granularity] = await this.processHistoricalNAVByGranularity(granularity);
            }

            console.log('\n=== Processing Complete ===');
            Object.entries(results).forEach(([granularity, result]) => {
                console.log(`${granularity}: ${result.processedDates} dates, ${result.successfulCalculations} calculations`);
            });

            return results;

        } catch (error) {
            console.error('Error in processAllHistoricalNAV:', error);
            throw error;
        }
    }

    // Get previous NAV for change calculation
    async getPreviousNAV(fundSymbol, date, granularity) {
        try {
            return await NAV.findOne({
                fundSymbol,
                date: { $lt: date },
                granularity
            }).sort({ date: -1 });
        } catch (error) {
            return null;
        }
    }

    // Clear all NAV data
    async clearNAVData() {
        console.log('Clearing all existing NAV data...');
        const result = await NAV.deleteMany({});
        console.log(`Deleted ${result.deletedCount} NAV records\n`);
        return result.deletedCount;
    }

    // Show latest NAV values
    async showLatestNAV() {
        console.log('\n=== Latest NAV Values ===');
        
        for (const fundSymbol of Object.keys(this.fundConfigs)) {
            const latestNAV = await NAV.findOne({
                fundSymbol,
                granularity: 'daily'
            }).sort({ date: -1 });
            
            if (latestNAV) {
                const change = latestNAV.dailyChangePercent >= 0 ? 
                    `+${latestNAV.dailyChangePercent.toFixed(2)}%` : 
                    `${latestNAV.dailyChangePercent.toFixed(2)}%`;
                    
                console.log(`${fundSymbol}: $${latestNAV.nav.toFixed(4)} (${change}) - Total Return: ${latestNAV.totalReturnPercent.toFixed(2)}%`);
            } else {
                console.log(`${fundSymbol}: No daily NAV data found`);
            }
        }
    }
}

const navService = new NAVCalculationService();

// Main execution
async function main() {
    try {
        require('dotenv').config();
        const mongoose = require('mongoose');
        
        console.log('Starting fixed NAV calculation...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        await navService.clearNAVData();
        const results = await navService.processAllHistoricalNAV();
        await navService.showLatestNAV();
        
        await mongoose.disconnect();
        console.log('\nNAV calculation completed successfully');
        
    } catch (error) {
        console.error('NAV calculation failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = navService;