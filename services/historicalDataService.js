const CryptoAsset = require('../models/CryptoAsset');
const PriceHistory = require('../models/PriceHistory');
const Fund = require('../models/Fund');
const NAVHistory = require('../models/NAVHistory');

class HistoricalDataService {
    constructor() {
        this.baseUrl = 'https://api.coingecko.com/api/v3';
        this.apiKey = process.env.CRYPTO_API_KEY;
        
        if (!global.fetch) {
            global.fetch = require('node-fetch');
        }
    }

    async importCompleteHistoricalData() {
        try {
            console.log('Starting complete historical data import...');
            
            // Step 1: Import historical crypto prices
            await this.importHistoricalCryptoPrices();
            
            // Step 2: Calculate historical fund NAVs
            await this.calculateHistoricalFundNAVs();
            
            console.log('Complete historical data import finished!');
            
        } catch (error) {
            console.error('Historical data import failed:', error);
            throw error;
        }
    }

    async importHistoricalCryptoPrices() {
        try {
            console.log('Importing historical crypto prices...');
            
            const cryptos = await CryptoAsset.find({ isActive: true });
            
            for (const crypto of cryptos) {
                console.log('Processing ' + crypto.name + ' (' + crypto.symbol + ')...');
                
                try {
                    // Import different time periods
                    await this.importCryptoHistoricalData(crypto, 'max', 'monthly');
                    await new Promise(resolve => setTimeout(resolve, 2500)); // Increased to 2.5 seconds

                    await this.importCryptoHistoricalData(crypto, 730, 'weekly');
                    await new Promise(resolve => setTimeout(resolve, 2500));

                    await this.importCryptoHistoricalData(crypto, 90, 'daily');
                    await new Promise(resolve => setTimeout(resolve, 2500));
                    
                    console.log('Completed historical data for ' + crypto.symbol);
                    
                } catch (error) {
                    console.error('Failed to import data for ' + crypto.symbol + ':', error);
                    continue;
                }
            }
            
            console.log('Historical crypto price import completed!');
            
        } catch (error) {
            console.error('Error importing historical crypto prices:', error);
            throw error;
        }
    }

    async importCryptoHistoricalData(crypto, days, granularity) {
        try {
            const url = this.baseUrl + '/coins/' + crypto.apiId + '/market_chart?vs_currency=usd&days=' + days;
            
            const fetch = global.fetch || (await import('node-fetch')).default;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('API request failed: ' + response.status);
            }
            
            const data = await response.json();
            
            if (!data.prices || !Array.isArray(data.prices)) {
                console.warn('No price data available for ' + crypto.symbol + ' (' + granularity + ')');
                return;
            }

            const priceData = [];
            let sampleRate = 1;
            
            if (granularity === 'weekly') sampleRate = 7;
            if (granularity === 'monthly') sampleRate = 30;
            
            for (let i = 0; i < data.prices.length; i += sampleRate) {
                const timestamp = data.prices[i][0];
                const price = data.prices[i][1];
                const volume = data.total_volumes && data.total_volumes[i] ? data.total_volumes[i][1] : 0;
                
                priceData.push({
                    cryptoId: crypto._id,
                    symbol: crypto.symbol,
                    date: new Date(timestamp),
                    price: price,
                    volume: volume,
                    granularity: granularity
                });
            }
            
            if (priceData.length > 0) {
                await PriceHistory.bulkInsertHistoricalData(priceData);
                console.log('Stored ' + priceData.length + ' ' + granularity + ' data points for ' + crypto.symbol);
            }
            
        } catch (error) {
            console.error('Error importing ' + granularity + ' data for ' + crypto.symbol + ':', error);
        }
    }

    async calculateHistoricalFundNAVs() {
        try {
            console.log('Calculating historical fund NAVs...');
            
            const funds = await Fund.find({ isActive: true });
            
            // Get all unique dates from price history
            const dates = await PriceHistory.distinct('date');
            const sortedDates = dates.sort((a, b) => new Date(a) - new Date(b));
            
            console.log('Processing ' + sortedDates.length + ' historical dates...');
            
            for (const fund of funds) {
                console.log('Calculating NAV history for ' + fund.name + '...');
                
                let previousPrices = {};
                let currentNAV = fund.inceptionNAV;
                
                for (let i = 0; i < sortedDates.length; i++) {
                    const date = sortedDates[i];
                    
                    try {
                        // Get prices for this date
                        const currentPrices = await this.getPricesForDate(date, fund.composition);
                        
                        if (i > 0 && Object.keys(previousPrices).length > 0) {
                            // Calculate percentage changes
                            let weightedChange = 0;
                            let hasValidData = false;
                            
                            for (const coin of fund.composition) {
                                const prevPrice = previousPrices[coin.symbol];
                                const currPrice = currentPrices[coin.symbol];
                                
                                if (prevPrice && currPrice && prevPrice > 0) {
                                    const change = ((currPrice - prevPrice) / prevPrice) * 100;
                                    weightedChange += change * coin.weight;
                                    hasValidData = true;
                                }
                            }
                            
                            if (hasValidData) {
                                // Apply percentage change to current NAV
                                currentNAV = currentNAV * (1 + weightedChange / 100);
                                currentNAV = Math.max(currentNAV, 0.01); // Prevent negative NAV
                            }
                        }
                        
                        // Store NAV history entry
                        await NAVHistory.addNAVEntry(fund._id, fund.symbol, currentNAV, date);
                        
                        previousPrices = currentPrices;
                        
                    } catch (error) {
                        console.error('Error processing date ' + date + ' for fund ' + fund.symbol + ':', error);
                        continue;
                    }
                    
                    // Progress indicator
                    if (i % 100 === 0) {
                        console.log('Processed ' + i + '/' + sortedDates.length + ' dates for ' + fund.symbol);
                    }
                }
                
                // Update fund's current NAV
                fund.currentNAV = currentNAV;
                await fund.save();
                
                console.log('Completed NAV history for ' + fund.name + ' - Final NAV: ' + currentNAV.toFixed(4));
            }
            
            console.log('Historical fund NAV calculation completed!');
            
        } catch (error) {
            console.error('Error calculating historical fund NAVs:', error);
            throw error;
        }
    }

    async getPricesForDate(date, composition) {
        try {
            const prices = {};
            
            for (const coin of composition) {
                const priceData = await PriceHistory.findOne({
                    symbol: coin.symbol,
                    date: { $lte: date }
                }).sort({ date: -1 });
                
                if (priceData) {
                    prices[coin.symbol] = priceData.price;
                }
            }
            
            return prices;
            
        } catch (error) {
            console.error('Error getting prices for date ' + date + ':', error);
            return {};
        }
    }

    async updateDailyNAVs() {
        try {
            console.log('Updating daily NAVs based on current prices...');
            
            const funds = await Fund.find({ isActive: true });
            const today = new Date();
            
            // Get yesterday's prices for comparison
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            
            for (const fund of funds) {
                try {
                    const currentPrices = {};
                    const previousPrices = {};
                    
                    // Get current and previous prices
                    for (const coin of fund.composition) {
                        const crypto = await CryptoAsset.findOne({ symbol: coin.symbol });
                        if (crypto) {
                            currentPrices[coin.symbol] = crypto.currentPrice;
                        }
                        
                        const prevPriceData = await PriceHistory.findOne({
                            symbol: coin.symbol,
                            date: { $lte: yesterday }
                        }).sort({ date: -1 });
                        
                        if (prevPriceData) {
                            previousPrices[coin.symbol] = prevPriceData.price;
                        }
                    }
                    
                    // Calculate percentage change
                    let weightedChange = 0;
                    let hasValidData = false;
                    
                    for (const coin of fund.composition) {
                        const prevPrice = previousPrices[coin.symbol];
                        const currPrice = currentPrices[coin.symbol];
                        
                        if (prevPrice && currPrice && prevPrice > 0) {
                            const change = ((currPrice - prevPrice) / prevPrice) * 100;
                            weightedChange += change * coin.weight;
                            hasValidData = true;
                        }
                    }
                    
                    if (hasValidData) {
                        // Apply change to fund NAV
                        const newNAV = fund.currentNAV * (1 + weightedChange / 100);
                        fund.currentNAV = Math.max(newNAV, 0.01);
                        await fund.save();
                        
                        // Add NAV history entry
                        await NAVHistory.addNAVEntry(fund._id, fund.symbol, fund.currentNAV, today);
                        
                        console.log('Updated ' + fund.symbol + ' NAV: ' + fund.currentNAV.toFixed(4) + ' (' + (weightedChange > 0 ? '+' : '') + weightedChange.toFixed(2) + '%)');
                    }
                    
                } catch (error) {
                    console.error('Error updating NAV for ' + fund.name + ':', error);
                }
            }
            
            console.log('Daily NAV update completed!');
            
        } catch (error) {
            console.error('Error updating daily NAVs:', error);
            throw error;
        }
    }

    async resetFundsToInception() {
        try {
            console.log('Resetting all funds to inception values...');
            
            const funds = await Fund.find({ isActive: true });
            
            for (const fund of funds) {
                fund.currentNAV = fund.inceptionNAV;
                await fund.save();
                console.log('Reset ' + fund.name + ' to inception NAV: ' + fund.inceptionNAV.toFixed(2));
            }
            
            // Clear existing NAV history
            await NAVHistory.deleteMany({});
            console.log('Cleared existing NAV history');
            
            console.log('Fund reset completed!');
            
        } catch (error) {
            console.error('Error resetting funds:', error);
            throw error;
        }
    }

    async getQuickHistoricalSample() {
        try {
            console.log('Importing sample historical data for testing...');
            
            const cryptos = await CryptoAsset.find({ isActive: true });
            
            for (const crypto of cryptos) {
                console.log('Getting sample data for ' + crypto.symbol + '...');
                
                try {
                    await this.importCryptoHistoricalData(crypto, 30, 'daily');
                    await new Promise(resolve => setTimeout(resolve, 2000)); 
                } catch (error) {
                    console.error('Error getting sample data for ' + crypto.symbol + ':', error);
                }
            }
            
            console.log('Sample historical data imported!');
            
            // Calculate sample NAVs
            await this.calculateHistoricalFundNAVs();
            
        } catch (error) {
            console.error('Error importing sample data:', error);
            throw error;
        }
    }
}

module.exports = new HistoricalDataService();