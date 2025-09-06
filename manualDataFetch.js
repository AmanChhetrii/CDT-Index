// manualDataFetch.js - Run daily data management tasks manually
require('dotenv').config();
const mongoose = require('mongoose');
const CryptoAsset = require('./models/CryptoAsset');
const CryptoPrice = require('./models/CryptoPrice');

if (!global.fetch) {
    global.fetch = require('node-fetch');
}

class ManualDataFetch {
    async run() {
        try {
            console.log('=== Starting Manual Daily Data Management ===');
            console.log('Timestamp:', new Date().toLocaleString());
            
            // Step 1: Always fetch current prices
            await this.fetchDailyPrices();
            
            // Step 2: Always cleanup old data
            await this.cleanupOldDailyData();
            
            // Step 3: Check for missed weekly sampling (Tuesday or catch-up)
            const needsWeeklySampling = await this.checkNeedsWeeklySampling();
            if (needsWeeklySampling) {
                console.log('Weekly sampling needed - running now...');
                await this.sampleWeeklyData();
            } else {
                console.log('Weekly sampling not needed today');
            }
            
            // Step 4: Check for missed monthly sampling (1st or catch-up)
            const needsMonthlySampling = await this.checkNeedsMonthlySampling();
            if (needsMonthlySampling) {
                console.log('Monthly sampling needed - running now...');
                await this.sampleMonthlyData();
            } else {
                console.log('Monthly sampling not needed today');
            }
            
            console.log('=== Manual Daily Tasks Completed Successfully ===');
            
        } catch (error) {
            console.error('Manual daily tasks failed:', error);
            throw error;
        }
    }

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

    async cleanupOldDailyData() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago

        const deleteResult = await CryptoPrice.deleteMany({
            granularity: 'daily',
            date: { $lt: cutoffDate }
        });

        console.log(`Cleaned up ${deleteResult.deletedCount} old daily records (older than 90 days)`);
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

        console.log(`Weekly sampling completed: ${sampledCount} records created`);
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

        console.log(`Monthly sampling completed: ${sampledCount} records created`);
    }

    // Get summary of what will happen before running
    async preview() {
        const today = new Date();
        const cryptos = await CryptoAsset.getActiveCryptos();
        const needsWeekly = await this.checkNeedsWeeklySampling();
        const needsMonthly = await this.checkNeedsMonthlySampling();
        
        console.log('=== Manual Data Fetch Preview ===');
        console.log(`Date: ${today.toDateString()}`);
        console.log(`Day of week: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()]}`);
        console.log(`Cryptocurrencies to fetch: ${cryptos.length}`);
        console.log(`Weekly sampling needed: ${needsWeekly ? 'YES' : 'NO'}`);
        console.log(`Monthly sampling needed: ${needsMonthly ? 'YES' : 'NO'}`);
        console.log('==================================');
    }
}

async function main() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const dataFetch = new ManualDataFetch();
        
        // Check if user wants preview
        if (process.argv[2] === 'preview') {
            await dataFetch.preview();
        } else {
            // Run the actual data fetch
            await dataFetch.run();
        }

        await mongoose.disconnect();
        console.log('Database connection closed');
        
    } catch (error) {
        console.error('Manual data fetch failed:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
} 
