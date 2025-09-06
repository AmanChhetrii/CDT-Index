const CryptoAsset = require('../models/CryptoAsset');
const PriceHistory = require('../models/PriceHistory');
const Fund = require('../models/Fund');

class CryptoApiService {
    constructor() {
        this.baseUrl = 'https://api.coingecko.com/api/v3';
        this.apiKey = process.env.CRYPTO_API_KEY;
        
        // Add fetch polyfill for older Node versions
        if (!global.fetch) {
            global.fetch = require('node-fetch');
        }
    }

    async fetchCurrentPrices() {
        try {
            console.log('Fetching current crypto prices...');
            
            const cryptos = await CryptoAsset.find({ isActive: true });
            if (cryptos.length === 0) {
                throw new Error('No crypto assets found in database');
            }
            
            const apiIds = cryptos.map(crypto => crypto.apiId).join(',');
            const url = this.baseUrl + '/simple/price?ids=' + apiIds + '&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true';
            
            console.log('API Request URL:', url);
            
            // Use dynamic import for fetch if not available
            const fetch = global.fetch || (await import('node-fetch')).default;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('API request failed: ' + response.status + ' ' + response.statusText);
            }
            
            const data = await response.json();
            console.log('Received price data for ' + Object.keys(data).length + ' cryptocurrencies');
            
            // Update database with new prices
            for (const crypto of cryptos) {
                const priceData = data[crypto.apiId];
                if (priceData) {
                    await crypto.updatePrice(
                        priceData.usd,
                        priceData.usd_market_cap || crypto.marketCap,
                        priceData.usd_24h_vol || crypto.volume24h
                    );
                    console.log('Updated ' + crypto.symbol + ': $' + priceData.usd);
                }
            }
            
            console.log('Updated crypto prices in database');
            return data;
            
        } catch (error) {
            console.error('Error fetching crypto prices:', error);
            throw error;
        }
    }

    async updateAllFundNAVs() {
        try {
            console.log('Updating fund NAV values...');
            
            const funds = await Fund.find({ isActive: true });
            
            for (const fund of funds) {
                try {
                    await fund.calculateNAV();
                    console.log('Updated NAV for ' + fund.name + ': $' + fund.currentNAV.toFixed(4));
                } catch (error) {
                    console.error('Failed to update NAV for ' + fund.name + ':', error);
                }
            }
            
            console.log('All fund NAVs updated');
            
        } catch (error) {
            console.error('Error updating fund NAVs:', error);
            throw error;
        }
    }
}

module.exports = new CryptoApiService();