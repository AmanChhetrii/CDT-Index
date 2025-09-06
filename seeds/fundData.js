const mongoose = require('mongoose');
const Fund = require('../models/Fund');
const CryptoAsset = require('../models/CryptoAsset');

const fundData = [
    {
        name: "CDT Growth Index",
        symbol: "CDTGR",
        slug: "growth-index",
        summary: "High-growth index with Bitcoin as the foundation.",
        description: "The CDT Growth Index is designed for investors who want to maximize potential upside while keeping Bitcoin as the strong anchor of their portfolio. With 60% allocated to Bitcoin for stability, the remaining share is spread across fast-growing altcoins like Ethereum, Solana, Avalanche, and Polygon. This balance makes it a powerful choice for those who want the security of BTC along with exposure to coins that have historically delivered rapid gains.",
        riskLevel: "High Growth Potential",
        riskIcon: "High Risk",
        investorType: "Perfect for growth-oriented investors who are comfortable with short-term volatility in pursuit of long-term gains.",
        composition: [
            { symbol: "BTC", name: "Bitcoin", weight: 0.60 },
            { symbol: "ETH", name: "Ethereum", weight: 0.15 },
            { symbol: "SOL", name: "Solana", weight: 0.10 },
            { symbol: "AVAX", name: "Avalanche", weight: 0.08 },
            { symbol: "MATIC", name: "Polygon", weight: 0.07 }
        ],
        currentNAV: 115.00,
        inceptionNAV: 115.00,
        inceptionDate: new Date('2023-01-01'),
        featured: true,
        displayOrder: 1
    },
    {
        name: "CDT Balanced Index",
        symbol: "CDTBAL",
        slug: "balanced-index",
        summary: "A steady, diversified mix of large and mid-cap coins.",
        description: "The CDT Balanced Index offers the best of both worlds, the strength of leading cryptocurrencies like Bitcoin and Ethereum, along with the innovation of mid-cap projects such as Cardano and Polkadot. With each coin equally weighted, it provides smooth diversification across different ecosystems. This index is a reliable option for investors who want stable growth with moderate risk, making it an ideal starting point for newcomers and steady performers alike.",
        riskLevel: "Stable with Upside",
        riskIcon: "Medium Risk",
        investorType: "Designed for long-term investors who want a balanced mix of safety and performance.",
        composition: [
            { symbol: "BTC", name: "Bitcoin", weight: 0.20 },
            { symbol: "ETH", name: "Ethereum", weight: 0.20 },
            { symbol: "BNB", name: "Binance Coin", weight: 0.20 },
            { symbol: "ADA", name: "Cardano", weight: 0.20 },
            { symbol: "DOT", name: "Polkadot", weight: 0.20 }
        ],
        currentNAV: 100.00,
        inceptionNAV: 100.00,
        inceptionDate: new Date('2023-01-01'),
        featured: true,
        displayOrder: 2
    },
    {
        name: "CDT Pioneer Index",
        symbol: "CDTPIO",
        slug: "pioneer-index",
        summary: "An innovation-driven index targeting future leaders.",
        description: "The CDT Pioneer Index focuses on trailblazing projects shaping the next generation of blockchain technology. From Chainlink's real-world data solutions, to Aptos and Sui's advanced Layer-1 designs, Arbitrum's Layer-2 scaling, and Decentraland's metaverse expansion, this index is all about betting on tomorrow's winners. Though these projects come with higher volatility, they also carry the potential for exponential growth as adoption increases.",
        riskLevel: "Future-Oriented Potential",
        riskIcon: "Very High Risk",
        investorType: "Ideal for forward-thinking investors who want exposure to cutting-edge blockchain innovations.",
        composition: [
            { symbol: "LINK", name: "Chainlink", weight: 0.20 },
            { symbol: "APT", name: "Aptos", weight: 0.20 },
            { symbol: "ARB", name: "Arbitrum", weight: 0.20 },
            { symbol: "SUI", name: "Sui", weight: 0.20 },
            { symbol: "MANA", name: "Decentraland", weight: 0.20 }
        ],
        currentNAV: 52.00,
        inceptionNAV: 52.00,
        inceptionDate: new Date('2023-01-01'),
        featured: false,
        displayOrder: 3
    },
    {
        name: "CDT AmanRC Index",
        symbol: "CDTARC",
        slug: "amanrc-index",
        summary: "A signature index with a unique, diversified mix.",
        description: "The CDT AmanRC Index blends stability, utility, and community-driven momentum into a single portfolio. Anchored by Bitcoin and Ethereum for long-term security, it also includes Solana for speed and ecosystem growth, XRP for banking and global payment adoption, and Dogecoin for its unparalleled community strength and viral potential. This index reflects a well-rounded yet distinctive investment approach, mixing trust, technology, and trends.",
        riskLevel: "Dynamic & Diverse",
        riskIcon: "Moderate Risk",
        investorType: "Perfect for investors who want diversified exposure and a personalized, signature portfolio.",
        composition: [
            { symbol: "BTC", name: "Bitcoin", weight: 0.35 },
            { symbol: "ETH", name: "Ethereum", weight: 0.25 },
            { symbol: "SOL", name: "Solana", weight: 0.15 },
            { symbol: "XRP", name: "XRP", weight: 0.15 },
            { symbol: "DOGE", name: "Dogecoin", weight: 0.10 }
        ],
        currentNAV: 100.00,
        inceptionNAV: 100.00,
        inceptionDate: new Date('2023-01-01'),
        featured: true,
        displayOrder: 4
    }
];

const cryptoData = [
    { symbol: "BTC", name: "Bitcoin", apiId: "bitcoin", rank: 1 },
    { symbol: "ETH", name: "Ethereum", apiId: "ethereum", rank: 2 },
    { symbol: "SOL", name: "Solana", apiId: "solana", rank: 5 },
    { symbol: "AVAX", name: "Avalanche", apiId: "avalanche-2", rank: 8 },
    { symbol: "MATIC", name: "Polygon", apiId: "matic-network", rank: 15 },
    { symbol: "BNB", name: "Binance Coin", apiId: "binancecoin", rank: 4 },
    { symbol: "ADA", name: "Cardano", apiId: "cardano", rank: 9 },
    { symbol: "DOT", name: "Polkadot", apiId: "polkadot", rank: 12 },
    { symbol: "LINK", name: "Chainlink", apiId: "chainlink", rank: 18 },
    { symbol: "APT", name: "Aptos", apiId: "aptos", rank: 25 },
    { symbol: "ARB", name: "Arbitrum", apiId: "arbitrum", rank: 30 },
    { symbol: "SUI", name: "Sui", apiId: "sui", rank: 35 },
    { symbol: "MANA", name: "Decentraland", apiId: "decentraland", rank: 45 },
    { symbol: "XRP", name: "XRP", apiId: "ripple", rank: 3 },
    { symbol: "DOGE", name: "Dogecoin", apiId: "dogecoin", rank: 10 }
];

async function seedDatabase() {
    try {
        console.log('Starting database seeding...');
        
        // Clear existing data
        await Fund.deleteMany({});
        await CryptoAsset.deleteMany({});
        console.log('Cleared existing data');
        
        // Seed crypto assets with placeholder prices
        const cryptos = await CryptoAsset.insertMany(
            cryptoData.map(crypto => ({
                ...crypto,
                currentPrice: 100,
                marketCap: 1000000000,
                volume24h: 1000000,
                lastUpdated: new Date()
            }))
        );
        console.log('Seeded ' + cryptos.length + ' crypto assets');
        
        // Seed funds with correct initial NAVs
        const funds = await Fund.insertMany(fundData);
        console.log('Seeded ' + funds.length + ' funds');
        
        console.log('Database seeding completed successfully!');
        console.log('\nFunds created with initial NAVs:');
        funds.forEach(fund => {
            console.log('- ' + fund.name + ' (' + fund.symbol + '): $' + fund.currentNAV.toFixed(2));
        });
        
        return { funds, cryptos };
        
    } catch (error) {
        console.error('Error seeding database:', error);
        throw error;
    }
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
            console.log('Seeding complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Seeding failed:', error);
            process.exit(1);
        });
}

module.exports = { seedDatabase, fundData, cryptoData };