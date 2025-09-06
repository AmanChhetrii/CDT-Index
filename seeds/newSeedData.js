// seeds/newSeedData.js - Complete seed data for redesigned system
const mongoose = require('mongoose');
const Fund = require('../models/Fund');
const CryptoAsset = require('../models/CryptoAsset');

// Fund data with finalized 7-crypto compositions
const fundData = [
    {
        name: "CDT Growth Index",
        symbol: "CDTGR",
        slug: "growth-index",
        summary: "Conservative growth strategy anchored by Bitcoin's stability with exposure to Ethereum and Solana's innovation.",
        description: "The CDT Growth Index provides investors with a balanced approach to cryptocurrency growth, featuring a dominant 60% Bitcoin allocation for stability and downside protection. The remaining allocation is strategically divided between Ethereum (25%) for smart contract ecosystem exposure and Solana (15%) for high-speed blockchain innovation. This composition makes it ideal for investors seeking steady appreciation with reduced volatility compared to pure altcoin strategies, while still capturing growth from the leading decentralized platforms.",
        riskLevel: "Conservative Growth",
        riskIcon: "Medium Risk",
        composition: [
            { symbol: "BTC", name: "Bitcoin", weight: 0.60 },
            { symbol: "ETH", name: "Ethereum", weight: 0.25 },
            { symbol: "SOL", name: "Solana", weight: 0.15 }
        ],
        currentNAV: 100.00,
        inceptionNAV: 100.00,
        inceptionDate: new Date('2023-01-01'),
        featured: true,
        displayOrder: 1
    },
    {
        name: "CDT Balanced Index",
        symbol: "CDTBAL",
        slug: "balanced-index",
        summary: "Equal-weighted diversification across established cryptocurrencies for stable long-term growth.",
        description: "The CDT Balanced Index offers broad exposure to the cryptocurrency market through a carefully curated selection of established digital assets. With equal weightings between Bitcoin and Ethereum as foundational assets, plus strategic allocations to Avalanche's scalable ecosystem and Chainlink's oracle infrastructure, this fund provides steady diversification across multiple blockchain use cases. The balanced approach reduces concentration risk while maintaining exposure to both store-of-value and utility-driven cryptocurrencies, making it suitable for investors seeking steady portfolio growth with moderate risk exposure.",
        riskLevel: "Stable Growth",
        riskIcon: "Medium Risk",
        composition: [
            { symbol: "BTC", name: "Bitcoin", weight: 0.30 },
            { symbol: "ETH", name: "Ethereum", weight: 0.30 },
            { symbol: "AVAX", name: "Avalanche", weight: 0.20 },
            { symbol: "LINK", name: "Chainlink", weight: 0.20 }
        ],
        currentNAV: 120.00,
        inceptionNAV: 120.00,
        inceptionDate: new Date('2023-01-01'),
        featured: true,
        displayOrder: 2
    },
    {
        name: "CDT Pioneer Index",
        symbol: "CDTPIO",
        slug: "pioneer-index",
        summary: "High-risk alternative cryptocurrency exposure focused on community-driven and metaverse projects.",
        description: "The CDT Pioneer Index targets the most speculative and innovative segments of the cryptocurrency market, with no traditional safe-haven allocations. Dominated by Dogecoin (50%) for its massive community adoption and viral potential, complemented by Decentraland (35%) for metaverse and virtual real estate exposure, and rounded out with Avalanche (15%) for its developer-friendly ecosystem. This fund is designed for risk-tolerant investors who want maximum exposure to alternative cryptocurrency narratives and are comfortable with significant volatility in pursuit of potentially explosive returns from emerging trends.",
        riskLevel: "High Risk Alternative",
        riskIcon: "Very High Risk",
        composition: [
            { symbol: "DOGE", name: "Dogecoin", weight: 0.50 },
            { symbol: "MANA", name: "Decentraland", weight: 0.35 },
            { symbol: "AVAX", name: "Avalanche", weight: 0.15 }
        ],
        currentNAV: 90.00,
        inceptionNAV: 90.00,
        inceptionDate: new Date('2023-01-01'),
        featured: false,
        displayOrder: 3
    },
    {
        name: "CDT AmanRC Index",
        symbol: "CDTARC",
        slug: "amanrc-index",
        summary: "Premium signature fund combining Bitcoin's stability with innovative blockchain infrastructure projects.",
        description: "The CDT AmanRC Index represents a sophisticated approach to cryptocurrency investment, blending proven digital assets with cutting-edge blockchain technology. Anchored by a substantial Bitcoin allocation (40%) for stability and store-of-value characteristics, the fund strategically incorporates Ethereum (25%) for smart contract platform exposure, Solana (20%) for high-throughput blockchain innovation, and Chainlink (15%) for decentralized oracle infrastructure. This premium composition offers investors a curated selection that balances security with growth potential, making it suitable for those seeking a signature investment approach that captures both established value and technological advancement.",
        riskLevel: "Premium Diversified",
        riskIcon: "Moderate Risk",
        composition: [
            { symbol: "BTC", name: "Bitcoin", weight: 0.40 },
            { symbol: "ETH", name: "Ethereum", weight: 0.25 },
            { symbol: "SOL", name: "Solana", weight: 0.20 },
            { symbol: "LINK", name: "Chainlink", weight: 0.15 }
        ],
        currentNAV: 150.00,
        inceptionNAV: 150.00,
        inceptionDate: new Date('2023-01-01'),
        featured: true,
        displayOrder: 4
    }
];

// Cryptocurrency data for 7 selected assets
const cryptoData = [
    { 
        symbol: "BTC", 
        name: "Bitcoin", 
        apiId: "bitcoin", 
        rank: 1,
        currentPrice: 45000,
        marketCap: 900000000000,
        volume24h: 25000000000
    },
    { 
        symbol: "ETH", 
        name: "Ethereum", 
        apiId: "ethereum", 
        rank: 2,
        currentPrice: 2800,
        marketCap: 350000000000,
        volume24h: 15000000000
    },
    { 
        symbol: "SOL", 
        name: "Solana", 
        apiId: "solana", 
        rank: 5,
        currentPrice: 95,
        marketCap: 45000000000,
        volume24h: 2500000000
    },
    { 
        symbol: "AVAX", 
        name: "Avalanche", 
        apiId: "avalanche-2", 
        rank: 8,
        currentPrice: 35,
        marketCap: 15000000000,
        volume24h: 800000000
    },
    { 
        symbol: "DOGE", 
        name: "Dogecoin", 
        apiId: "dogecoin", 
        rank: 10,
        currentPrice: 0.08,
        marketCap: 12000000000,
        volume24h: 600000000
    },
    { 
        symbol: "MANA", 
        name: "Decentraland", 
        apiId: "decentraland", 
        rank: 45,
        currentPrice: 0.45,
        marketCap: 850000000,
        volume24h: 85000000
    },
    { 
        symbol: "LINK", 
        name: "Chainlink", 
        apiId: "chainlink", 
        rank: 18,
        currentPrice: 18.50,
        marketCap: 11000000000,
        volume24h: 450000000
    }
];

async function seedDatabase() {
    try {
        console.log('Starting database seeding for redesigned system...');
        
        // Clear existing data completely
        console.log('Clearing existing collections...');
        await Fund.deleteMany({});
        await CryptoAsset.deleteMany({});
        
        // Also clear price and NAV collections if they exist
        try {
            const CryptoPrice = require('../models/CryptoPrice');
            const FundNAV = require('../models/FundNAV');
            await CryptoPrice.deleteMany({});
            await FundNAV.deleteMany({});
            console.log('Cleared existing price and NAV data');
        } catch (error) {
            console.log('Price/NAV collections not found or already empty');
        }
        
        console.log('All existing data cleared successfully');
        
        // Seed cryptocurrency assets
        console.log('Seeding cryptocurrency assets...');
        const cryptos = await CryptoAsset.insertMany(
            cryptoData.map(crypto => ({
                ...crypto,
                lastUpdated: new Date(),
                isActive: true
            }))
        );
        console.log(`Seeded ${cryptos.length} cryptocurrency assets`);
        
        // Seed funds with new compositions
        console.log('Seeding investment funds...');
        const funds = await Fund.insertMany(fundData.map(fund => ({
            ...fund,
            isActive: true
        })));
        console.log(`Seeded ${funds.length} investment funds`);
        
        // Validation: Check that all fund compositions reference existing cryptos
        console.log('\nValidating fund compositions...');
        for (const fund of funds) {
            const validationErrors = await fund.validateComposition();
            if (validationErrors.length > 0) {
                console.error(`Validation errors for ${fund.symbol}:`, validationErrors);
            } else {
                console.log(`✅ ${fund.symbol} composition validated successfully`);
            }
        }
        
        // Display seeded data summary
        console.log('\n=== Database Seeding Complete ===');
        console.log('\nCryptocurrency Assets:');
        cryptos.forEach(crypto => {
            console.log(`- ${crypto.symbol} (${crypto.name}): $${crypto.currentPrice.toLocaleString()}`);
        });
        
        console.log('\nInvestment Funds:');
        funds.forEach(fund => {
            const compositionStr = fund.composition
                .map(c => `${c.symbol} ${(c.weight * 100).toFixed(0)}%`)
                .join(', ');
            console.log(`- ${fund.symbol}: $${fund.currentNAV.toFixed(2)} NAV | ${compositionStr}`);
        });
        
        console.log('\nNext Steps:');
        console.log('1. Run historical data import script');
        console.log('2. Validate data completeness');
        console.log('3. Calculate initial NAV history');
        console.log('4. Set up daily update scheduler');
        
        return { funds, cryptos };
        
    } catch (error) {
        console.error('Error seeding database:', error);
        throw error;
    }
}

// Get required cryptocurrency symbols across all funds
function getRequiredCryptoSymbols() {
    const cryptoSet = new Set();
    fundData.forEach(fund => {
        fund.composition.forEach(coin => {
            cryptoSet.add(coin.symbol);
        });
    });
    return Array.from(cryptoSet);
}

// Get fund composition mapping for easy reference
function getFundCompositionMap() {
    const compositionMap = {};
    fundData.forEach(fund => {
        compositionMap[fund.symbol] = fund.composition;
    });
    return compositionMap;
}

// Run seeding if this file is executed directly
if (require.main === module) {
    require('dotenv').config();
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cdtindex')
        .then(() => {
            console.log('Connected to MongoDB');
            return seedDatabase();
        })
        .then(() => {
            console.log('Seeding completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Seeding failed:', error);
            process.exit(1);
        });
}

module.exports = { 
    seedDatabase, 
    fundData, 
    cryptoData, 
    getRequiredCryptoSymbols, 
    getFundCompositionMap 
};