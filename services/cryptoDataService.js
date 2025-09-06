// services/cryptoDataService.js - Cryptocurrency data fetching and management
const CryptoAsset = require('../models/CryptoAsset');
const CryptoPrice = require('../models/CryptoPrice');

class CryptoDataService {
    constructor() {
        this.primaryAPI = 'coingecko';
        this.baseUrls = {
            coingecko: 'https://api.coingecko.com/api/v3',
            coinmarketcap: 'https://pro-api.coinmarketcap.com/v1',
            cryptocompare: 'https://min-api.cryptocompare.com/data/v2'
        };
        this.apiKey = process.env.CRYPTO_API_KEY;
        this.retryDelay = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
        
        // Ensure fetch is available
        if (!global.fetch) {
            global.fetch = require('node-fetch');
        }
    }

    // Main method to fetch current prices for all active cryptocurrencies
    async fetchCurrentPrices() {
        try {
            console.log('Fetching current cryptocurrency prices...');
            
            const cryptos = await CryptoAsset.getActiveCryptos();
            if (cryptos.length === 0) {
                throw new Error('No active cryptocurrencies found in database');
            }
            
            let priceData;
            
            // Try primary API first
            try {
                priceData = await this.fetchFromCoinGecko(cryptos);
                console.log(`Successfully fetched prices from CoinGecko for ${cryptos.length} cryptocurrencies`);
            } catch (error) {
                console.warn('CoinGecko API failed, trying alternative...', error.message);
                
                // Try alternative API
                try {
                    priceData = await this.fetchFromCryptoCompare(cryptos);
                    console.log(`Successfully fetched prices from CryptoCompare for ${cryptos.length} cryptocurrencies`);
                } catch (altError) {
                    console.error('Both APIs failed:', altError.message);
                    throw new Error('All API sources failed. Will retry in 6 hours.');
                }
            }
            
            // Update database with new prices
            await this.updateCryptoPrices(priceData);
            
            // Store daily price data
            await this.storeDailyPriceData(priceData);
            
            console.log('Price update completed successfully');
            return priceData;
            
        } catch (error) {
            console.error('Error fetching current prices:', error);
            
            // Schedule retry after 6 hours
            console.log('Scheduling retry in 6 hours...');
            setTimeout(() => {
                this.fetchCurrentPrices();
            }, this.retryDelay);
            
            throw error;
        }
    }

    // Fetch prices from CoinGecko API
    async fetchFromCoinGecko(cryptos) {
        const apiIds = cryptos.map(crypto => crypto.apiId).join(',');
        const url = `${this.baseUrls.coingecko}/simple/price?ids=${apiIds}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;
        
        console.log('CoinGecko API Request:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`CoinGecko API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Convert CoinGecko response to standard format
        const priceData = [];
        cryptos.forEach(crypto => {
            const coinData = data[crypto.apiId];
            if (coinData) {
                priceData.push({
                    symbol: crypto.symbol,
                    price: coinData.usd,
                    marketCap: coinData.usd_market_cap || 0,
                    volume24h: coinData.usd_24h_vol || 0,
                    priceChange24h: coinData.usd_24h_change || 0,
                    source: 'coingecko'
                });
            }
        });
        
        return priceData;
    }

    // Fetch prices from CryptoCompare API (fallback)
    async fetchFromCryptoCompare(cryptos) {
        const symbols = cryptos.map(crypto => crypto.symbol).join(',');
        const url = `${this.baseUrls.cryptocompare}/pricemultifull?fsyms=${symbols}&tsyms=USD`;
        
        console.log('CryptoCompare API Request:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`CryptoCompare API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Convert CryptoCompare response to standard format
        const priceData = [];
        cryptos.forEach(crypto => {
            const coinData = data.RAW && data.RAW[crypto.symbol] && data.RAW[crypto.symbol].USD;
            if (coinData) {
                priceData.push({
                    symbol: crypto.symbol,
                    price: coinData.PRICE,
                    marketCap: coinData.MKTCAP || 0,
                    volume24h: coinData.VOLUME24HOUR || 0,
                    priceChange24h: coinData.CHANGEPCT24HOUR || 0,
                    source: 'cryptocompare'
                });
            }
        });
        
        return priceData;
    }

    // Update cryptocurrency prices in database
    async updateCryptoPrices(priceData) {
        try {
            const bulkUpdates = priceData.map(data => ({
                symbol: data.symbol,
                price: data.price,
                marketCap: data.marketCap,
                volume24h: data.volume24h,
                priceChange24h: data.priceChange24h,
                priceChangePercentage24h: data.priceChange24h
            }));
            
            await CryptoAsset.bulkUpdatePrices(bulkUpdates);
            console.log(`Updated prices for ${bulkUpdates.length} cryptocurrencies in database`);
            
        } catch (error) {
            console.error('Error updating crypto prices:', error);
            throw error;
        }
    }

    // Store daily price data for chart usage
    async storeDailyPriceData(priceData) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize to start of day
            
            const dailyPriceRecords = priceData.map(data => ({
                symbol: data.symbol,
                date: today,
                price: data.price,
                volume: data.volume24h,
                marketCap: data.marketCap,
                granularity: 'daily',
                source: data.source
            }));
            
            // Use upsert logic to prevent duplicates
            for (const record of dailyPriceRecords) {
                await CryptoPrice.findOneAndUpdate(
                    {
                        symbol: record.symbol,
                        date: record.date,
                        granularity: 'daily'
                    },
                    record,
                    { upsert: true, new: true }
                );
            }
            
            console.log(`Stored daily price data for ${dailyPriceRecords.length} cryptocurrencies`);
            
        } catch (error) {
            console.error('Error storing daily price data:', error);
            throw error;
        }
    }

    // Fetch historical data for initial setup
    async fetchHistoricalData(symbol, apiId, days, granularity) {
        try {
            let data;
            
            // Try CoinGecko first for historical data
            try {
                data = await this.fetchHistoricalFromCoinGecko(apiId, days);
            } catch (error) {
                console.warn(`CoinGecko historical data failed for ${symbol}, trying alternative...`);
                data = await this.fetchHistoricalFromCryptoCompare(symbol, days);
            }
            
            return this.processHistoricalData(data, symbol, granularity);
            
        } catch (error) {
            console.error(`Error fetching historical data for ${symbol}:`, error);
            throw error;
        }
    }

    // Fetch historical data from CoinGecko
    async fetchHistoricalFromCoinGecko(apiId, days) {
        const url = `${this.baseUrls.coingecko}/coins/${apiId}/market_chart?vs_currency=usd&days=${days}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`CoinGecko historical API failed: ${response.status}`);
        }
        
        return response.json();
    }

    // Fetch historical data from CryptoCompare (fallback) - FIXED VERSION
    async fetchHistoricalFromCryptoCompare(symbol, days) {
        // CryptoCompare uses different endpoint structure
        const limit = Math.min(days, 2000); // API limit
        const url = `${this.baseUrls.cryptocompare}/histoday?fsym=${symbol}&tsym=USD&limit=${limit}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`CryptoCompare historical API failed: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Add validation before accessing nested properties
        if (!data.Data || !data.Data.Data || !Array.isArray(data.Data.Data)) {
            console.log('CryptoCompare response structure:', JSON.stringify(data, null, 2));
            throw new Error(`Invalid CryptoCompare API response for ${symbol}`);
        }
        
        // Convert to CoinGecko-like format
        return {
            prices: data.Data.Data.map(d => [d.time * 1000, d.close]),
            total_volumes: data.Data.Data.map(d => [d.time * 1000, d.volumeto])
        };
    }

    // Process historical data based on granularity
    processHistoricalData(data, symbol, granularity) {
        if (!data.prices || !Array.isArray(data.prices)) {
            throw new Error(`No price data available for ${symbol}`);
        }
        
        const priceData = [];
        let sampleRate = 1;
        
        // Adjust sampling based on granularity
        switch (granularity) {
            case 'weekly':
                sampleRate = 7;
                break;
            case 'monthly':
                sampleRate = 30;
                break;
            case 'daily':
            default:
                sampleRate = 1;
                break;
        }
        
        for (let i = 0; i < data.prices.length; i += sampleRate) {
            const timestamp = data.prices[i][0];
            const price = data.prices[i][1];
            const volume = data.total_volumes && data.total_volumes[i] ? data.total_volumes[i][1] : 0;
            
            priceData.push({
                symbol: symbol,
                date: new Date(timestamp),
                price: price,
                volume: volume,
                granularity: granularity,
                source: 'historical_import'
            });
        }
        
        return priceData;
    }

    // Clean up old daily data (rolling window maintenance)
    async cleanupOldDailyData(daysToKeep = 30) {
        try {
            const result = await CryptoPrice.deleteOldDailyData(daysToKeep);
            console.log(`Cleaned up old daily data: ${result.deletedCount} records removed`);
            return result;
        } catch (error) {
            console.error('Error cleaning up old daily data:', error);
            throw error;
        }
    }

    // Sample daily data for weekly/monthly storage
    async sampleDataForGranularity() {
        try {
            const today = new Date();
            
            // Check if today is Tuesday for weekly sampling
            if (today.getDay() === 2) { // Tuesday = 2
                await this.sampleWeeklyData();
            }
            
            // Check if today is the 1st of the month for monthly sampling
            if (today.getDate() === 1) {
                await this.sampleMonthlyData();
            }
            
        } catch (error) {
            console.error('Error sampling data for granularity:', error);
            throw error;
        }
    }

    // Sample today's daily data for weekly storage
    async sampleWeeklyData() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const cryptos = await CryptoAsset.getActiveCryptos();
            
            for (const crypto of cryptos) {
                const dailyPrice = await CryptoPrice.findOne({
                    symbol: crypto.symbol,
                    date: today,
                    granularity: 'daily'
                });
                
                if (dailyPrice) {
                    const weeklyRecord = {
                        symbol: crypto.symbol,
                        date: today,
                        price: dailyPrice.price,
                        volume: dailyPrice.volume,
                        marketCap: dailyPrice.marketCap,
                        granularity: 'weekly',
                        source: dailyPrice.source
                    };
                    
                    await CryptoPrice.findOneAndUpdate(
                        {
                            symbol: crypto.symbol,
                            date: today,
                            granularity: 'weekly'
                        },
                        weeklyRecord,
                        { upsert: true, new: true }
                    );
                }
            }
            
            console.log('Weekly data sampling completed');
            
        } catch (error) {
            console.error('Error sampling weekly data:', error);
            throw error;
        }
    }

    // Sample today's daily data for monthly storage
    async sampleMonthlyData() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const cryptos = await CryptoAsset.getActiveCryptos();
            
            for (const crypto of cryptos) {
                const dailyPrice = await CryptoPrice.findOne({
                    symbol: crypto.symbol,
                    date: today,
                    granularity: 'daily'
                });
                
                if (dailyPrice) {
                    const monthlyRecord = {
                        symbol: crypto.symbol,
                        date: today,
                        price: dailyPrice.price,
                        volume: dailyPrice.volume,
                        marketCap: dailyPrice.marketCap,
                        granularity: 'monthly',
                        source: dailyPrice.source
                    };
                    
                    await CryptoPrice.findOneAndUpdate(
                        {
                            symbol: crypto.symbol,
                            date: today,
                            granularity: 'monthly'
                        },
                        monthlyRecord,
                        { upsert: true, new: true }
                    );
                }
            }
            
            console.log('Monthly data sampling completed');
            
        } catch (error) {
            console.error('Error sampling monthly data:', error);
            throw error;
        }
    }

    // Validate API response data
    validatePriceData(priceData) {
        const errors = [];
        
        if (!Array.isArray(priceData) || priceData.length === 0) {
            errors.push('No price data received');
            return errors;
        }
        
        priceData.forEach((data, index) => {
            if (!data.symbol || !data.price) {
                errors.push(`Missing symbol or price for entry ${index}`);
            }
            
            if (typeof data.price !== 'number' || data.price <= 0) {
                errors.push(`Invalid price for ${data.symbol}: ${data.price}`);
            }
            
            if (data.marketCap && (typeof data.marketCap !== 'number' || data.marketCap < 0)) {
                errors.push(`Invalid market cap for ${data.symbol}: ${data.marketCap}`);
            }
        });
        
        return errors;
    }

    // Get price changes for NAV calculations
    async getPriceChanges(date) {
        try {
            const cryptos = await CryptoAsset.getActiveCryptos();
            const priceChanges = {};
            
            for (const crypto of cryptos) {
                // Get current price
                const currentPrice = await CryptoPrice.findOne({
                    symbol: crypto.symbol,
                    date: { $lte: date },
                    granularity: 'daily'
                }).sort({ date: -1 });
                
                // Get previous day price
                const previousDay = new Date(date.getTime() - 24 * 60 * 60 * 1000);
                const previousPrice = await CryptoPrice.findOne({
                    symbol: crypto.symbol,
                    date: { $lte: previousDay },
                    granularity: 'daily'
                }).sort({ date: -1 });
                
                if (currentPrice && previousPrice && previousPrice.price > 0) {
                    const change = ((currentPrice.price - previousPrice.price) / previousPrice.price) * 100;
                    priceChanges[crypto.symbol] = change;
                }
            }
            
            return priceChanges;
            
        } catch (error) {
            console.error('Error calculating price changes:', error);
            throw error;
        }
    }

    // Get absolute prices for a specific date
    async getPricesForDate(date) {
        try {
            const cryptos = await CryptoAsset.getActiveCryptos();
            const prices = {};
            
            for (const crypto of cryptos) {
                const priceData = await CryptoPrice.findOne({
                    symbol: crypto.symbol,
                    date: { $lte: date },
                    granularity: 'daily'
                }).sort({ date: -1 });
                
                if (priceData) {
                    prices[crypto.symbol] = priceData.price;
                }
            }
            
            return prices;
            
        } catch (error) {
            console.error('Error getting prices for date:', error);
            throw error;
        }
    }

    // Rate limiting helper
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new CryptoDataService();