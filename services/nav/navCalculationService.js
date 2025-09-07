// services/nav/navCalculationService.js - Enhanced NAV calculation service
const NAV = require('../../models/NAV');
const CryptoPrice = require('../../models/CryptoPrice');

class NAVCalculationService {
    constructor() {
        // Fund configurations with inception NAVs and compositions
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
        
        this.inceptionPrices = {};
        this.inceptionDate = null;
    }

    // Initialize inception data from oldest monthly crypto prices in database
    async initializeInceptionData() {
        try {
            // Find oldest monthly crypto price date
            const oldestPrice = await CryptoPrice.findOne({
                granularity: 'monthly'
            }).sort({ date: 1 });

            if (!oldestPrice) {
                throw new Error('No monthly crypto price data found in database');
            }

            this.inceptionDate = oldestPrice.date;
            console.log(`Global inception date: ${this.inceptionDate.toDateString()}`);

            // Get inception prices for all cryptos from that date
            const inceptionPrices = await this.getCryptoPricesForSpecificDate(this.inceptionDate, 'monthly');
            
            if (Object.keys(inceptionPrices).length === 0) {
                throw new Error(`No inception prices found for ${this.inceptionDate.toDateString()}`);
            }

            // Handle zero prices at inception by finding first non-zero price for each crypto
            await this.handleInceptionZeroPrices(inceptionPrices);

            this.inceptionPrices = inceptionPrices;
            
            console.log('Final inception prices:');
            Object.entries(this.inceptionPrices).forEach(([crypto, price]) => {
                console.log(`  ${crypto}: $${price}`);
            });

            console.log('Inception data initialized successfully');
            return { inceptionDate: this.inceptionDate, inceptionPrices: this.inceptionPrices };

        } catch (error) {
            console.error('Error initializing inception data:', error);
            throw error;
        }
    }

    // Handle zero prices at inception by finding first non-zero price
    async handleInceptionZeroPrices(inceptionPrices) {
        const zeroPriceCryptos = Object.entries(inceptionPrices)
            .filter(([crypto, price]) => price === 0 || price === null || price === undefined)
            .map(([crypto]) => crypto);

        if (zeroPriceCryptos.length === 0) return;

        console.log(`Found zero-price cryptos at inception: ${zeroPriceCryptos.join(', ')}`);
        console.log('Searching for first non-zero prices...');

        for (const crypto of zeroPriceCryptos) {
            try {
                // Find first non-zero price for this crypto across all granularities
                const firstNonZeroPrice = await CryptoPrice.findOne({
                    symbol: crypto,
                    price: { $gt: 0 }
                }).sort({ date: 1 });

                if (firstNonZeroPrice) {
                    inceptionPrices[crypto] = firstNonZeroPrice.price;
                    console.log(`  ${crypto}: Using first non-zero price $${firstNonZeroPrice.price} from ${firstNonZeroPrice.date.toDateString()}`);
                } else {
                    console.warn(`  ${crypto}: No non-zero price found in database`);
                    // Keep as 0 - will be handled in redistribution logic
                }
            } catch (error) {
                console.error(`Error finding first non-zero price for ${crypto}:`, error);
            }
        }
    }

    // Redistribute composition when crypto has zero price
    redistributeComposition(fundSymbol, currentPrices, inceptionPrices) {
        const config = this.fundConfigs[fundSymbol];
        const adjustedComposition = { ...config.composition };
        
        // Find cryptos with zero or missing prices
        const zeroPriceCryptos = [];
        let totalZeroWeight = 0;

        for (const [crypto, weight] of Object.entries(adjustedComposition)) {
            const currentPrice = currentPrices[crypto];
            const inceptionPrice = inceptionPrices[crypto];
            
            if (!currentPrice || currentPrice <= 0 || !inceptionPrice || inceptionPrice <= 0) {
                zeroPriceCryptos.push(crypto);
                totalZeroWeight += weight;
                adjustedComposition[crypto] = 0; // Set to 0 weight
            }
        }

        // If no zero-price cryptos, return original composition
        if (zeroPriceCryptos.length === 0) {
            return adjustedComposition;
        }

        console.log(`Redistributing weights for ${fundSymbol}: ${zeroPriceCryptos.join(', ')} have zero/missing prices`);

        // Find valid cryptos to redistribute weight to
        const validCryptos = Object.entries(adjustedComposition)
            .filter(([crypto, weight]) => 
                weight > 0 && 
                currentPrices[crypto] > 0 && 
                inceptionPrices[crypto] > 0
            );

        if (validCryptos.length === 0) {
            throw new Error(`No valid cryptos available for ${fundSymbol} redistribution`);
        }

        // Redistribute proportionally among valid cryptos
        const totalValidWeight = validCryptos.reduce((sum, [crypto, weight]) => sum + weight, 0);
        
        for (const [crypto, originalWeight] of validCryptos) {
            const redistributionRatio = originalWeight / totalValidWeight;
            const additionalWeight = totalZeroWeight * redistributionRatio;
            adjustedComposition[crypto] = originalWeight + additionalWeight;
        }

        // Log the redistribution
        console.log('  Adjusted composition:');
        Object.entries(adjustedComposition).forEach(([crypto, weight]) => {
            if (weight > 0) {
                console.log(`    ${crypto}: ${(weight * 100).toFixed(1)}% (original: ${(config.composition[crypto] * 100).toFixed(1)}%)`);
            }
        });

        return adjustedComposition;
    }

    // Calculate NAV with zero-price handling
    calculateNAV(fundSymbol, currentPrices) {
        const config = this.fundConfigs[fundSymbol];
        if (!config) {
            throw new Error(`Unknown fund symbol: ${fundSymbol}`);
        }

        // Get adjusted composition handling zero prices
        const adjustedComposition = this.redistributeComposition(fundSymbol, currentPrices, this.inceptionPrices);

        let weightedSum = 0;
        let totalWeight = 0;

        // Calculate weighted sum of price ratios
        for (const [crypto, weight] of Object.entries(adjustedComposition)) {
            if (weight <= 0) continue;

            const currentPrice = currentPrices[crypto];
            const inceptionPrice = this.inceptionPrices[crypto];

            if (!currentPrice || currentPrice <= 0 || !inceptionPrice || inceptionPrice <= 0) {
                console.warn(`Skipping ${crypto} in ${fundSymbol}: current=$${currentPrice}, inception=$${inceptionPrice}`);
                continue;
            }

            const priceRatio = currentPrice / inceptionPrice;
            weightedSum += weight * priceRatio;
            totalWeight += weight;
        }

        // Verify we have valid weights
        if (totalWeight === 0) {
            throw new Error(`No valid crypto prices available for ${fundSymbol}`);
        }

        // Normalize if total weight doesn't equal 1 (due to redistribution)
        if (Math.abs(totalWeight - 1.0) > 0.001) {
            weightedSum = weightedSum / totalWeight;
        }

        return config.inceptionNAV * weightedSum;
    }

    // Get crypto prices for a specific date and granularity
    async getCryptoPricesForSpecificDate(targetDate, granularity) {
        try {
            const prices = {};

            // Get all crypto price records for this exact date and granularity
            const priceRecords = await CryptoPrice.find({
                date: targetDate,
                granularity: granularity
            });

            // Convert to price map
            priceRecords.forEach(record => {
                prices[record.symbol] = record.price;
            });

            return prices;

        } catch (error) {
            console.error('Error getting crypto prices for specific date:', error);
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

    // Get all NAV data for available dates
    async getAllNAVData() {
        try {
            console.log('=== Retrieving All NAV Data ===');
            
            const results = {
                daily: {},
                weekly: {},
                monthly: {}
            };

            const granularities = ['daily', 'weekly', 'monthly'];

            for (const granularity of granularities) {
                console.log(`\nProcessing ${granularity} data...`);
                
                const availableDates = await this.getAvailableDates(granularity);
                console.log(`Found ${availableDates.length} ${granularity} dates`);

                results[granularity].dates = availableDates.map(date => date.toISOString().split('T')[0]);
                results[granularity].funds = {};

                // Initialize fund arrays
                for (const fundSymbol of Object.keys(this.fundConfigs)) {
                    results[granularity].funds[fundSymbol] = [];
                }

                // Process each date
                for (const date of availableDates) {
                    const cryptoPrices = await this.getCryptoPricesForSpecificDate(date, granularity);
                    
                    if (Object.keys(cryptoPrices).length === 0) {
                        console.warn(`No crypto prices for ${date.toDateString()}`);
                        // Add null values for all funds
                        for (const fundSymbol of Object.keys(this.fundConfigs)) {
                            results[granularity].funds[fundSymbol].push(null);
                        }
                        continue;
                    }

                    // Calculate NAV for each fund
                    for (const fundSymbol of Object.keys(this.fundConfigs)) {
                        try {
                            const nav = this.calculateNAV(fundSymbol, cryptoPrices);
                            results[granularity].funds[fundSymbol].push(nav);
                        } catch (error) {
                            console.error(`NAV calculation failed for ${fundSymbol} on ${date.toDateString()}: ${error.message}`);
                            results[granularity].funds[fundSymbol].push(null);
                        }
                    }
                }

                console.log(`${granularity} processing complete: ${availableDates.length} dates processed`);
            }

            return results;

        } catch (error) {
            console.error('Error getting all NAV data:', error);
            throw error;
        }
    }

    // Process all historical NAV data for all granularities (save to database)
    async processAllHistoricalNAV() {
        try {
            // Initialize inception data first
            await this.initializeInceptionData();

            console.log('Starting complete historical NAV processing...');

            const results = {
                daily: await this.processHistoricalNAVByGranularity('daily'),
                weekly: await this.processHistoricalNAVByGranularity('weekly'),
                monthly: await this.processHistoricalNAVByGranularity('monthly')
            };

            console.log('\n=== Processing Summary ===');
            console.log(`Daily: ${results.daily.processedDates} dates, ${results.daily.successfulCalculations} calculations`);
            console.log(`Weekly: ${results.weekly.processedDates} dates, ${results.weekly.successfulCalculations} calculations`);
            console.log(`Monthly: ${results.monthly.processedDates} dates, ${results.monthly.successfulCalculations} calculations`);
            console.log('Complete historical NAV processing finished');

            return results;

        } catch (error) {
            console.error('Error in complete historical NAV processing:', error);
            throw error;
        }
    }

    // Process historical NAV for specific granularity and save to database
    async processHistoricalNAVByGranularity(granularity) {
        try {
            console.log(`\n=== Processing ${granularity.toUpperCase()} NAV Data ===`);

            const availableDates = await this.getAvailableDates(granularity);
            console.log(`Found ${availableDates.length} dates with ${granularity} crypto price data`);

            let processedCount = 0;
            let successfulFunds = 0;

            // Process each date sequentially
            for (const date of availableDates) {
                try {
                    const cryptoPrices = await this.getCryptoPricesForSpecificDate(date, granularity);
                    
                    if (Object.keys(cryptoPrices).length === 0) {
                        console.warn(`No crypto prices found for ${date.toDateString()}`);
                        processedCount++;
                        continue;
                    }

                    // Try to calculate NAV for each fund
                    for (const fundSymbol of Object.keys(this.fundConfigs)) {
                        try {
                            const nav = this.calculateNAV(fundSymbol, cryptoPrices);
                            
                            // Get previous NAV for change calculation
                            const previousNAV = await this.getPreviousNAV(fundSymbol, date, granularity);
                            
                            let dailyChange = 0;
                            let dailyChangePercent = 0;
                            if (previousNAV) {
                                dailyChange = nav - previousNAV.nav;
                                dailyChangePercent = previousNAV.nav > 0 ? (dailyChange / previousNAV.nav) * 100 : 0;
                            }

                            // Calculate total return
                            const inceptionNAV = this.fundConfigs[fundSymbol].inceptionNAV;
                            const totalReturn = nav - inceptionNAV;
                            const totalReturnPercent = (totalReturn / inceptionNAV) * 100;

                            const navRecord = {
                                fundSymbol,
                                date: new Date(date),
                                nav,
                                dailyChange,
                                dailyChangePercent,
                                totalReturn,
                                totalReturnPercent,
                                granularity,
                                source: granularity === 'daily' ? 'calculated' : `${granularity}_sample`
                            };

                            // Save NAV record
                            await NAV.findOneAndUpdate(
                                {
                                    fundSymbol,
                                    date: new Date(date),
                                    granularity
                                },
                                navRecord,
                                { upsert: true, new: true }
                            );

                            successfulFunds++;

                        } catch (fundError) {
                            console.error(`Failed to calculate ${granularity} NAV for ${fundSymbol} on ${date.toDateString()}:`, fundError.message);
                        }
                    }

                    processedCount++;

                    // Progress update every 50 dates
                    if (processedCount % 50 === 0) {
                        console.log(`Processed ${processedCount}/${availableDates.length} ${granularity} dates...`);
                    }

                } catch (error) {
                    console.error(`Failed to process ${granularity} NAV for ${date.toDateString()}:`, error.message);
                    processedCount++;
                }
            }

            console.log(`${granularity.toUpperCase()} NAV processing completed: ${processedCount} dates processed, ${successfulFunds} fund calculations successful`);
            return { processedDates: processedCount, successfulCalculations: successfulFunds };

        } catch (error) {
            console.error(`Error processing ${granularity} NAV data:`, error);
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

    // Get processing summary
    async getProcessingSummary() {
        try {
            const summary = {
                daily: await CryptoPrice.countDocuments({ granularity: 'daily' }),
                weekly: await CryptoPrice.countDocuments({ granularity: 'weekly' }),
                monthly: await CryptoPrice.countDocuments({ granularity: 'monthly' }),
                funds: Object.keys(this.fundConfigs).length
            };

            const totalCalculations = (summary.daily + summary.weekly + summary.monthly) * summary.funds;

            console.log('=== NAV Processing Summary ===');
            console.log(`Funds to process: ${summary.funds} (${Object.keys(this.fundConfigs).join(', ')})`);
            console.log(`Daily price records: ${summary.daily}`);
            console.log(`Weekly price records: ${summary.weekly}`);
            console.log(`Monthly price records: ${summary.monthly}`);
            console.log(`Maximum possible NAV calculations: ${totalCalculations}`);
            console.log('===============================');

            return summary;

        } catch (error) {
            console.error('Error getting processing summary:', error);
            throw error;
        }
    }
}

const navService = new NAVCalculationService();

// Allow direct execution of this file
async function main() {
    try {
        require('dotenv').config();
        const mongoose = require('mongoose');
        
        console.log('Starting NAV calculation process...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Initialize inception data
        await navService.initializeInceptionData();

        // Get and display all NAV data
        console.log('\nRetrieving NAV data for all available dates...');
        const allNAVData = await navService.getAllNAVData();
        
        // Display results
        console.log('\n=== NAV Data Results ===');
        for (const [granularity, data] of Object.entries(allNAVData)) {
            console.log(`\n${granularity.toUpperCase()} Data (${data.dates.length} dates):`);
            console.log('Dates:', data.dates.slice(0, 5).join(', ') + (data.dates.length > 5 ? '...' : ''));
            
            for (const [fund, navValues] of Object.entries(data.funds)) {
                const validValues = navValues.filter(v => v !== null);
                if (validValues.length > 0) {
                    const firstNAV = validValues[0];
                    const lastNAV = validValues[validValues.length - 1];
                    const totalReturn = ((lastNAV - navService.fundConfigs[fund].inceptionNAV) / navService.fundConfigs[fund].inceptionNAV * 100).toFixed(2);
                    console.log(`  ${fund}: ${validValues.length} values, Range: $${firstNAV.toFixed(2)} - $${lastNAV.toFixed(2)} (${totalReturn}% total return)`);
                }
            }
        }

        // Optionally process and save to database
        console.log('\n=== Processing and Saving to Database ===');
        const processingResults = await navService.processAllHistoricalNAV();
        
        await mongoose.disconnect();
        console.log('Database connection closed');
        
    } catch (error) {
        console.error('NAV calculation failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = navService;