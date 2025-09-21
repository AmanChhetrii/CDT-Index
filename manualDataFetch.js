// manualDataFetch.js - Manual data fetch with NAV calculation followed by ROI calculation
require('dotenv').config();
const mongoose = require('mongoose');
const CryptoAsset = require('./models/CryptoAsset');
const CryptoPrice = require('./models/CryptoPrice');
const NAV = require('./models/NAV');
const User = require('./models/User');
const ROI = require('./models/ROI');

if (!global.fetch) {
    global.fetch = require('node-fetch');
}

class CombinedDataProcessor {
    constructor() {
        // Fund configurations for NAV calculation
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

    async run() {
        try {
            console.log('=== Starting Combined Data Processing ===');
            console.log('Timestamp:', new Date().toLocaleString());
            
            // PHASE 1: COMPLETE ALL NAV-RELATED TASKS
            console.log('\n--- PHASE 1: NAV PROCESSING ---');
            
            // Step 1: Always fetch current crypto prices
            await this.fetchDailyPrices();
            
            // Step 2: Initialize NAV calculation data (once per run)
            await this.initializeNAVData();
            
            // Step 3: Calculate today's NAV for all funds
            await this.calculateTodayNAV();
            
            // Step 4: Always cleanup old data
            await this.cleanupOldDailyData();
            
            // Step 5: Check for missed weekly sampling (Tuesday or catch-up)
            const needsWeeklySampling = await this.checkNeedsWeeklySampling();
            if (needsWeeklySampling) {
                console.log('Weekly sampling needed - running now...');
                await this.sampleWeeklyData();
                await this.sampleWeeklyNAV();
            } else {
                console.log('Weekly sampling not needed today');
            }
            
            // Step 6: Check for missed monthly sampling (1st or catch-up)
            const needsMonthlySampling = await this.checkNeedsMonthlySampling();
            if (needsMonthlySampling) {
                console.log('Monthly sampling needed - running now...');
                await this.sampleMonthlyData();
                await this.sampleMonthlyNAV();
            } else {
                console.log('Monthly sampling not needed today');
            }
            
            // Step 7: Cleanup old NAV data
            await this.cleanupOldDailyNAV();
            
            console.log('--- PHASE 1 COMPLETED: All NAV calculations finished ---');
            
            // PHASE 2: ROI CALCULATIONS (only after NAV is complete)
            console.log('\n--- PHASE 2: ROI PROCESSING ---');
            await this.saveTodaysROIForAllUsers();
            
            console.log('\n=== Combined Data Processing Completed Successfully ===');
            
        } catch (error) {
            console.error('Combined data processing failed:', error);
            throw error;
        }
    }

    // NAV-related methods (unchanged from original)
    async fetchDailyPrices() {
        const cryptos = await CryptoAsset.getActiveCryptos();
        let successCount = 0;

        console.log(`Fetching prices for ${cryptos.length} cryptocurrencies...`);

        for (const crypto of cryptos) {
            try {
                const url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${crypto.symbol}&tsym=USD&limit=1`;
                
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`API failed: ${response.status}`);
                }

                const data = await response.json();
                if (!data.Data || !data.Data.Data || data.Data.Data.length === 0) {
                    throw new Error('Invalid API response');
                }

                const latestData = data.Data.Data[data.Data.Data.length - 1];
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const priceRecord = {
                    symbol: crypto.symbol,
                    date: today,
                    price: latestData.close,
                    volume: latestData.volumeto || 0,
                    marketCap: 0,
                    granularity: 'daily',
                    source: 'cryptocompare_manual'
                };

                // Upsert to prevent duplicates
                await CryptoPrice.findOneAndUpdate(
                    {
                        symbol: crypto.symbol,
                        date: today,
                        granularity: 'daily'
                    },
                    priceRecord,
                    { upsert: true, new: true }
                );

                console.log(`${crypto.symbol}: $${latestData.close} saved`);
                successCount++;

                // Small delay between API calls
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                console.error(`Failed to fetch ${crypto.symbol}:`, error.message);
            }
        }

        console.log(`Daily price fetch completed: ${successCount}/${cryptos.length} successful`);
    }

    // FIXED: Proper inception data initialization
    async initializeNAVData() {
        try {
            // Find oldest monthly crypto price date for inception
            const oldestPrice = await CryptoPrice.findOne({
                granularity: 'monthly'
            }).sort({ date: 1 });

            this.inceptionDate = oldestPrice.date;
            
            // Get inception prices from the oldest date
            const inceptionPrices = await this.getCryptoPricesForDate(this.inceptionDate, 'monthly');
            
            // Handle cryptos that didn't exist at inception
            const allCryptos = ['BTC', 'ETH', 'SOL', 'AVAX', 'DOGE', 'LINK', 'MANA'];
            for (const crypto of allCryptos) {
                if (!inceptionPrices[crypto] || inceptionPrices[crypto] <= 0) {
                    inceptionPrices[crypto] = 0; // Mark as didn't exist
                    console.log(`${crypto}: Not available at inception (will substitute)`);
                } else {
                    console.log(`${crypto}: $${inceptionPrices[crypto]} at inception`);
                }
            }
            
            this.inceptionPrices = inceptionPrices;
            console.log(`NAV inception date: ${this.inceptionDate.toDateString()}`);

        } catch (error) {
            console.error('Error initializing NAV data:', error);
            throw error;
        }
    }

    async getCryptoPricesForDate(date, granularity) {
        try {
            const prices = {};
            const priceRecords = await CryptoPrice.find({
                date: date,
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

    // FIXED: Proper NAV calculation with correct substitution logic
    calculateNAV(fundSymbol, currentPrices) {
        const config = this.fundConfigs[fundSymbol];
        if (!config) {
            throw new Error(`Unknown fund symbol: ${fundSymbol}`);
        }

        const substitutionRules = {
            'CDTGR': { 'SOL': 'ETH' },
            'CDTBAL': { 'AVAX': 'BTC' },
            'CDTPIO': { 'AVAX': 'DOGE' },
            'CDTARC': { 'SOL': 'ETH' }
        };

        const adjustedComposition = { ...config.composition };
        const substitutions = [];

        // Check each crypto in the fund
        for (const [crypto, originalWeight] of Object.entries(config.composition)) {
            const currentPrice = currentPrices[crypto];
            const inceptionPrice = this.inceptionPrices[crypto];
            
            // Case 1: Crypto didn't exist at inception (inception price = 0) - always substitute
            if (!inceptionPrice || inceptionPrice <= 0) {
                const substitute = substitutionRules[fundSymbol]?.[crypto];
                if (substitute && currentPrices[substitute] > 0 && this.inceptionPrices[substitute] > 0) {
                    adjustedComposition[substitute] += originalWeight;
                    delete adjustedComposition[crypto];
                    substitutions.push(`${crypto} → ${substitute} (not launched)`);
                } else {
                    throw new Error(`Cannot substitute ${crypto} in ${fundSymbol} - substitute unavailable`);
                }
            }
            // Case 2: Crypto exists but current price is missing - substitute for this date only
            else if (!currentPrice || currentPrice <= 0) {
                const substitute = substitutionRules[fundSymbol]?.[crypto];
                if (substitute && currentPrices[substitute] > 0 && this.inceptionPrices[substitute] > 0) {
                    adjustedComposition[substitute] += originalWeight;
                    delete adjustedComposition[crypto];
                    substitutions.push(`${crypto} → ${substitute} (price missing)`);
                } else {
                    throw new Error(`Cannot substitute ${crypto} in ${fundSymbol} - substitute unavailable`);
                }
            }
            // Case 3: Valid crypto with both inception and current price - use normally
        }

        // Log substitutions
        if (substitutions.length > 0) {
            console.log(`  ${fundSymbol}: ${substitutions.join(', ')}`);
        }

        // Calculate weighted sum of price ratios
        let weightedSum = 0;
        let totalWeight = 0;

        for (const [crypto, weight] of Object.entries(adjustedComposition)) {
            const currentPrice = currentPrices[crypto];
            const inceptionPrice = this.inceptionPrices[crypto];

            if (currentPrice > 0 && inceptionPrice > 0) {
                const priceRatio = currentPrice / inceptionPrice;
                weightedSum += weight * priceRatio;
                totalWeight += weight;
            }
        }

        if (totalWeight === 0) {
            throw new Error(`No valid cryptos for ${fundSymbol} calculation`);
        }

        // Normalize if weights don't add to 1 due to exclusions
        if (Math.abs(totalWeight - 1.0) > 0.001) {
            weightedSum = weightedSum / totalWeight;
        }

        return config.inceptionNAV * weightedSum;
    }

    async calculateTodayNAV() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            console.log(`Calculating NAV for ${today.toDateString()}...`);

            // Get today's crypto prices
            const cryptoPrices = await this.getTodaysCryptoPrices();
            
            if (Object.keys(cryptoPrices).length === 0) {
                throw new Error('No crypto price data available for NAV calculation');
            }

            let successCount = 0;

            // Calculate NAV for each fund
            for (const fundSymbol of Object.keys(this.fundConfigs)) {
                try {
                    const nav = this.calculateNAV(fundSymbol, cryptoPrices);
                    
                    // Get previous NAV for daily change calculation
                    const previousNAV = await this.getPreviousNAV(fundSymbol, today, 'daily');
                    
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
                        date: today,
                        nav,
                        dailyChange,
                        dailyChangePercent,
                        totalReturn,
                        totalReturnPercent,
                        granularity: 'daily',
                        source: 'manual_calculated'
                    };

                    // Upsert to prevent duplicates
                    await NAV.findOneAndUpdate(
                        {
                            fundSymbol,
                            date: today,
                            granularity: 'daily'
                        },
                        navRecord,
                        { upsert: true, new: true }
                    );

                    console.log(`${fundSymbol}: NAV = $${nav.toFixed(4)} (${dailyChangePercent >= 0 ? '+' : ''}${dailyChangePercent.toFixed(2)}%)`);
                    successCount++;

                } catch (error) {
                    console.error(`Failed to calculate NAV for ${fundSymbol}:`, error.message);
                }
            }

            console.log(`Daily NAV calculation completed: ${successCount}/${Object.keys(this.fundConfigs).length} successful`);

        } catch (error) {
            console.error('Error calculating today\'s NAV:', error);
            throw error;
        }
    }

    async getTodaysCryptoPrices() {
        try {
            const prices = {};
            const allCryptos = ['BTC', 'ETH', 'SOL', 'AVAX', 'DOGE', 'LINK', 'MANA'];

            for (const crypto of allCryptos) {
                // Get the most recent daily price
                const latestDaily = await CryptoPrice.findOne({
                    symbol: crypto,
                    granularity: 'daily'
                }).sort({ date: -1 });

                if (latestDaily) {
                    prices[crypto] = latestDaily.price;
                }
            }

            return prices;

        } catch (error) {
            console.error('Error getting today\'s crypto prices:', error);
            throw error;
        }
    }

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

    async cleanupOldDailyData() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago

        const deleteResult = await CryptoPrice.deleteMany({
            granularity: 'daily',
            date: { $lt: cutoffDate }
        });

        console.log(`Cleaned up ${deleteResult.deletedCount} old daily crypto price records (older than 90 days)`);
    }

    async cleanupOldDailyNAV() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago

        const deleteResult = await NAV.deleteMany({
            granularity: 'daily',
            date: { $lt: cutoffDate }
        });

        console.log(`Cleaned up ${deleteResult.deletedCount} old daily NAV records (older than 90 days)`);
    }

    async checkNeedsWeeklySampling() {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday...
        
        // Check if today is Tuesday
        if (dayOfWeek === 2) {
            return true;
        }
        
        // Check if we missed weekly sampling (catch-up logic)
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        
        // Find the most recent weekly sampling
        const lastWeeklySample = await CryptoPrice.findOne({
            granularity: 'weekly'
        }).sort({ date: -1 });
        
        // If no weekly sample exists or last sample is older than a week, we need to sample
        if (!lastWeeklySample || lastWeeklySample.date < lastWeek) {
            console.log('Missed weekly sampling detected - catching up...');
            return true;
        }
        
        return false;
    }

    async checkNeedsMonthlySampling() {
        const today = new Date();
        const dayOfMonth = today.getDate();
        
        // Check if today is the 1st of the month
        if (dayOfMonth === 1) {
            return true;
        }
        
        // Check if we missed monthly sampling (catch-up logic)
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        
        // Find the most recent monthly sampling
        const lastMonthlySample = await CryptoPrice.findOne({
            granularity: 'monthly'
        }).sort({ date: -1 });
        
        // If no monthly sample exists or last sample is older than a month, we need to sample
        if (!lastMonthlySample || lastMonthlySample.date < lastMonth) {
            console.log('Missed monthly sampling detected - catching up...');
            return true;
        }
        
        return false;
    }

    async sampleWeeklyData() {
        const cryptos = await CryptoAsset.getActiveCryptos();
        let sampledCount = 0;

        for (const crypto of cryptos) {
            try {
                // Get the most recent daily record
                const latestDaily = await CryptoPrice.findOne({
                    symbol: crypto.symbol,
                    granularity: 'daily'
                }).sort({ date: -1 });

                if (latestDaily) {
                    const weeklyRecord = {
                        symbol: crypto.symbol,
                        date: latestDaily.date,
                        price: latestDaily.price,
                        volume: latestDaily.volume,
                        marketCap: latestDaily.marketCap,
                        granularity: 'weekly',
                        source: 'daily_sample'
                    };

                    await CryptoPrice.findOneAndUpdate(
                        {
                            symbol: crypto.symbol,
                            date: latestDaily.date,
                            granularity: 'weekly'
                        },
                        weeklyRecord,
                        { upsert: true, new: true }
                    );

                    sampledCount++;
                }
            } catch (error) {
                console.error(`Failed to sample weekly data for ${crypto.symbol}:`, error.message);
            }
        }

        console.log(`Weekly crypto price sampling completed: ${sampledCount} records created`);
    }

    async sampleMonthlyData() {
        const cryptos = await CryptoAsset.getActiveCryptos();
        let sampledCount = 0;

        for (const crypto of cryptos) {
            try {
                // Get the most recent daily record
                const latestDaily = await CryptoPrice.findOne({
                    symbol: crypto.symbol,
                    granularity: 'daily'
                }).sort({ date: -1 });

                if (latestDaily) {
                    const monthlyRecord = {
                        symbol: crypto.symbol,
                        date: latestDaily.date,
                        price: latestDaily.price,
                        volume: latestDaily.volume,
                        marketCap: latestDaily.marketCap,
                        granularity: 'monthly',
                        source: 'daily_sample'
                    };

                    await CryptoPrice.findOneAndUpdate(
                        {
                            symbol: crypto.symbol,
                            date: latestDaily.date,
                            granularity: 'monthly'
                        },
                        monthlyRecord,
                        { upsert: true, new: true }
                    );

                    sampledCount++;
                }
            } catch (error) {
                console.error(`Failed to sample monthly data for ${crypto.symbol}:`, error.message);
            }
        }

        console.log(`Monthly crypto price sampling completed: ${sampledCount} records created`);
    }

    async sampleWeeklyNAV() {
        try {
            let sampledCount = 0;

            for (const fundSymbol of Object.keys(this.fundConfigs)) {
                try {
                    // Get the most recent daily NAV
                    const latestDaily = await NAV.findOne({
                        fundSymbol,
                        granularity: 'daily'
                    }).sort({ date: -1 });

                    if (latestDaily) {
                        const weeklyRecord = {
                            fundSymbol,
                            date: latestDaily.date,
                            nav: latestDaily.nav,
                            dailyChange: latestDaily.dailyChange,
                            dailyChangePercent: latestDaily.dailyChangePercent,
                            totalReturn: latestDaily.totalReturn,
                            totalReturnPercent: latestDaily.totalReturnPercent,
                            granularity: 'weekly',
                            source: 'weekly_sample'
                        };

                        await NAV.findOneAndUpdate(
                            {
                                fundSymbol,
                                date: latestDaily.date,
                                granularity: 'weekly'
                            },
                            weeklyRecord,
                            { upsert: true, new: true }
                        );

                        sampledCount++;
                    }
                } catch (error) {
                    console.error(`Failed to sample weekly NAV for ${fundSymbol}:`, error.message);
                }
            }

            console.log(`Weekly NAV sampling completed: ${sampledCount} records created`);

        } catch (error) {
            console.error('Error in weekly NAV sampling:', error);
            throw error;
        }
    }

    async sampleMonthlyNAV() {
        try {
            let sampledCount = 0;

            for (const fundSymbol of Object.keys(this.fundConfigs)) {
                try {
                    // Get the most recent daily NAV
                    const latestDaily = await NAV.findOne({
                        fundSymbol,
                        granularity: 'daily'
                    }).sort({ date: -1 });

                    if (latestDaily) {
                        const monthlyRecord = {
                            fundSymbol,
                            date: latestDaily.date,
                            nav: latestDaily.nav,
                            dailyChange: latestDaily.dailyChange,
                            dailyChangePercent: latestDaily.dailyChangePercent,
                            totalReturn: latestDaily.totalReturn,
                            totalReturnPercent: latestDaily.totalReturnPercent,
                            granularity: 'monthly',
                            source: 'monthly_sample'
                        };

                        await NAV.findOneAndUpdate(
                            {
                                fundSymbol,
                                date: latestDaily.date,
                                granularity: 'monthly'
                            },
                            monthlyRecord,
                            { upsert: true, new: true }
                        );

                        sampledCount++;
                    }
                } catch (error) {
                    console.error(`Failed to sample monthly NAV for ${fundSymbol}:`, error.message);
                }
            }

            console.log(`Monthly NAV sampling completed: ${sampledCount} records created`);

        } catch (error) {
            console.error('Error in monthly NAV sampling:', error);
            throw error;
        }
    }

    // ROI-related method (unchanged from original)
    async saveTodaysROIForAllUsers() {
        try {
            // Get current date and time
            const today = new Date();
            
            console.log(`Saving ROI data for ${today.toString()}`);
            
            // Find all users with portfolio data or holdings
            const users = await User.find({
                $or: [
                    { 'portfolio.totalInvestmentValue': { $gt: 0 } },
                    { 'portfolio.cashBalance': { $gt: 0 } },
                    { 'holdings.0': { $exists: true } }
                ]
            }).select('_id firstName lastName portfolio holdings');

            console.log(`Found ${users.length} users with portfolio data`);

            let saved = 0;
            let skipped = 0;
            let errors = 0;

            for (const user of users) {
                try {
                    const userId = new mongoose.Types.ObjectId(user._id);
                    
                    // Calculate current market value of fund holdings
                    let currentFundValue = 0;
                    
                    if (user.holdings && user.holdings.length > 0) {
                        console.log(`Calculating fund values for ${user.firstName} ${user.lastName} (${user.holdings.length} funds)`);
                        
                        for (const holding of user.holdings) {
                            try {
                                // Get current NAV for this fund
                                const currentNAV = await NAV.findOne({
                                    fundSymbol: holding.fundSymbol,
                                    granularity: 'daily'
                                }).sort({ date: -1 }).lean();
                                
                                if (currentNAV && currentNAV.nav > 0) {
                                    const fundValue = holding.units * currentNAV.nav;
                                    currentFundValue += fundValue;
                                    console.log(`  ${holding.fundSymbol}: ${holding.units} units × $${currentNAV.nav} = $${fundValue.toFixed(2)}`);
                                } else {
                                    console.log(`  ${holding.fundSymbol}: No current NAV found`);
                                }
                            } catch (navError) {
                                console.error(`  Error getting NAV for ${holding.fundSymbol}:`, navError.message);
                            }
                        }
                    } else {
                        console.log(`${user.firstName} ${user.lastName} has no fund holdings`);
                    }
                    
                    // Portfolio Value = ONLY current fund market value (no cash)
                    const portfolio = user.portfolio || {};
                    const cashBalance = portfolio.cashBalance || 0;
                    const totalValue = currentFundValue;
                    
                    console.log(`${user.firstName} ${user.lastName}: Cash ${cashBalance} (excluded) + Funds ${currentFundValue.toFixed(2)} = Portfolio ${totalValue.toFixed(2)}`);
                    
                    // Only save if total value is greater than 0
                    if (totalValue > 0) {
                        // Save ROI record with current timestamp
                        await ROI.create({
                            userId: userId,
                            date: today,
                            totalPortfolioValue: totalValue
                        });
                        
                        console.log(`✓ Saved ROI for ${user.firstName} ${user.lastName}: $${totalValue.toFixed(2)}`);
                        saved++;
                    } else {
                        console.log(`⚠ Skipped ${user.firstName} ${user.lastName}: Zero portfolio value`);
                        skipped++;
                    }
                    
                } catch (userError) {
                    console.error(`Error processing ${user.firstName} ${user.lastName}:`, userError.message);
                    errors++;
                }
            }
            
            console.log('\n=== ROI Summary ===');
            console.log(`Saved: ${saved}`);
            console.log(`Skipped: ${skipped}`);
            console.log(`Errors: ${errors}`);
            
            if (saved > 0) {
                console.log('ROI data saved successfully!');
            }
            
        } catch (error) {
            console.error('ROI calculation error:', error);
            throw error;
        }
    }

    // Get summary of what will happen before running
    async preview() {
        const today = new Date();
        const cryptos = await CryptoAsset.getActiveCryptos();
        const needsWeekly = await this.checkNeedsWeeklySampling();
        const needsMonthly = await this.checkNeedsMonthlySampling();
        
        const users = await User.find({
            $or: [
                { 'portfolio.totalInvestmentValue': { $gt: 0 } },
                { 'portfolio.cashBalance': { $gt: 0 } },
                { 'holdings.0': { $exists: true } }
            ]
        }).select('_id');
        
        console.log('=== Combined Data Processing Preview ===');
        console.log(`Date: ${today.toDateString()}`);
        console.log(`Day of week: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()]}`);
        console.log('');
        console.log('PHASE 1 - NAV Processing:');
        console.log(`  Cryptocurrencies to fetch: ${cryptos.length}`);
        console.log(`  Funds to calculate NAV: ${Object.keys(this.fundConfigs).length}`);
        console.log(`  Weekly sampling needed: ${needsWeekly ? 'YES' : 'NO'}`);
        console.log(`  Monthly sampling needed: ${needsMonthly ? 'YES' : 'NO'}`);
        console.log('');
        console.log('PHASE 2 - ROI Processing:');
        console.log(`  Users with portfolios: ${users.length}`);
        console.log('==========================================');
    }
}

async function main() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const processor = new CombinedDataProcessor();
        
        // Check if user wants preview
        if (process.argv[2] === 'preview') {
            await processor.preview();
        } else {
            // Run the combined processing
            await processor.run();
        }

        await mongoose.disconnect();
        console.log('Database connection closed');
        
    } catch (error) {
        console.error('Combined data processing failed:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}