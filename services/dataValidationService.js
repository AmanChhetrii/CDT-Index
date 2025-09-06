// services/dataValidationService.js - Data integrity validation and gap detection
const CryptoAsset = require('../models/CryptoAsset');
const CryptoPrice = require('../models/CryptoPrice');
const Fund = require('../models/Fund');
const FundNAV = require('../models/FundNAV');

class DataValidationService {
    constructor() {
        this.requiredGranularities = ['daily', 'weekly', 'monthly'];
        this.expectedStartDate = new Date('2018-01-01');
    }

    // Comprehensive data validation for the entire system
    async validateSystemData() {
        try {
            console.log('Starting comprehensive system data validation...');
            
            const validationResults = {
                cryptoAssets: await this.validateCryptoAssets(),
                priceData: await this.validatePriceData(),
                fundData: await this.validateFundData(),
                navData: await this.validateNAVData(),
                dataGaps: await this.detectDataGaps()
            };
            
            // Generate validation summary
            const summary = this.generateValidationSummary(validationResults);
            console.log('\n=== Data Validation Summary ===');
            console.log(summary);
            
            return validationResults;
            
        } catch (error) {
            console.error('Error during system validation:', error);
            throw error;
        }
    }

    // Validate cryptocurrency assets
    async validateCryptoAssets() {
        try {
            const cryptos = await CryptoAsset.find({});
            const validation = {
                totalCount: cryptos.length,
                activeCount: 0,
                errors: [],
                warnings: []
            };
            
            const expectedSymbols = ['BTC', 'ETH', 'SOL', 'AVAX', 'DOGE', 'MANA', 'LINK'];
            const foundSymbols = [];
            
            for (const crypto of cryptos) {
                if (crypto.isActive) {
                    validation.activeCount++;
                    foundSymbols.push(crypto.symbol);
                }
                
                // Validate individual crypto data
                if (!crypto.symbol || !crypto.name || !crypto.apiId) {
                    validation.errors.push(`${crypto.symbol || 'Unknown'}: Missing required fields`);
                }
                
                if (crypto.currentPrice <= 0) {
                    validation.warnings.push(`${crypto.symbol}: Invalid current price (${crypto.currentPrice})`);
                }
                
                if (crypto.rank <= 0) {
                    validation.warnings.push(`${crypto.symbol}: Invalid rank (${crypto.rank})`);
                }
            }
            
            // Check for missing expected cryptocurrencies
            const missingCryptos = expectedSymbols.filter(symbol => !foundSymbols.includes(symbol));
            if (missingCryptos.length > 0) {
                validation.errors.push(`Missing cryptocurrencies: ${missingCryptos.join(', ')}`);
            }
            
            // Check for unexpected cryptocurrencies
            const unexpectedCryptos = foundSymbols.filter(symbol => !expectedSymbols.includes(symbol));
            if (unexpectedCryptos.length > 0) {
                validation.warnings.push(`Unexpected cryptocurrencies: ${unexpectedCryptos.join(', ')}`);
            }
            
            return validation;
            
        } catch (error) {
            console.error('Error validating crypto assets:', error);
            throw error;
        }
    }

    // Validate price data completeness and quality
    async validatePriceData() {
        try {
            const validation = {
                totalRecords: 0,
                granularityBreakdown: {},
                errors: [],
                warnings: [],
                coverage: {}
            };
            
            // Get total record count
            validation.totalRecords = await CryptoPrice.countDocuments();
            
            // Breakdown by granularity
            for (const granularity of this.requiredGranularities) {
                validation.granularityBreakdown[granularity] = await CryptoPrice.countDocuments({ granularity });
            }
            
            // Check coverage for each cryptocurrency
            const cryptos = await CryptoAsset.getActiveCryptos();
            
            for (const crypto of cryptos) {
                validation.coverage[crypto.symbol] = {};
                
                for (const granularity of this.requiredGranularities) {
                    const count = await CryptoPrice.countDocuments({
                        symbol: crypto.symbol,
                        granularity
                    });
                    
                    validation.coverage[crypto.symbol][granularity] = count;
                    
                    // Validate minimum expected records
                    const expectedMin = this.getExpectedRecordCount(granularity);
                    if (count < expectedMin) {
                        validation.warnings.push(
                            `${crypto.symbol} ${granularity}: Only ${count} records (expected ~${expectedMin})`
                        );
                    }
                }
                
                // Check for any data at all
                const totalRecords = Object.values(validation.coverage[crypto.symbol]).reduce((sum, count) => sum + count, 0);
                if (totalRecords === 0) {
                    validation.errors.push(`${crypto.symbol}: No price data found`);
                }
            }
            
            return validation;
            
        } catch (error) {
            console.error('Error validating price data:', error);
            throw error;
        }
    }

    // Validate fund data and compositions
    async validateFundData() {
        try {
            const validation = {
                totalFunds: 0,
                activeFunds: 0,
                errors: [],
                warnings: [],
                compositions: {}
            };
            
            const funds = await Fund.find({});
            validation.totalFunds = funds.length;
            
            const expectedFunds = ['CDTGR', 'CDTBAL', 'CDTPIO', 'CDTARC'];
            const foundFunds = [];
            
            for (const fund of funds) {
                if (fund.isActive) {
                    validation.activeFunds++;
                    foundFunds.push(fund.symbol);
                }
                
                // Validate fund composition
                const compositionErrors = await fund.validateComposition();
                if (compositionErrors.length > 0) {
                    validation.errors.push(`${fund.symbol}: ${compositionErrors.join(', ')}`);
                }
                
                // Store composition for reference
                validation.compositions[fund.symbol] = fund.composition.map(c => ({
                    symbol: c.symbol,
                    weight: (c.weight * 100).toFixed(1) + '%'
                }));
                
                // Validate NAV values
                if (fund.currentNAV <= 0 || fund.inceptionNAV <= 0) {
                    validation.errors.push(`${fund.symbol}: Invalid NAV values`);
                }
                
                if (fund.currentNAV < fund.inceptionNAV * 0.1) {
                    validation.warnings.push(`${fund.symbol}: Current NAV significantly below inception`);
                }
            }
            
            // Check for missing expected funds
            const missingFunds = expectedFunds.filter(symbol => !foundFunds.includes(symbol));
            if (missingFunds.length > 0) {
                validation.errors.push(`Missing funds: ${missingFunds.join(', ')}`);
            }
            
            return validation;
            
        } catch (error) {
            console.error('Error validating fund data:', error);
            throw error;
        }
    }

    // Validate NAV calculation data
    async validateNAVData() {
        try {
            const validation = {
                totalRecords: 0,
                fundBreakdown: {},
                errors: [],
                warnings: [],
                dateRange: {}
            };
            
            validation.totalRecords = await FundNAV.countDocuments();
            
            const funds = await Fund.getActiveFunds();
            
            for (const fund of funds) {
                const navCount = await FundNAV.countDocuments({ fundId: fund._id });
                validation.fundBreakdown[fund.symbol] = navCount;
                
                if (navCount === 0) {
                    validation.errors.push(`${fund.symbol}: No NAV history found`);
                    continue;
                }
                
                // Get date range for this fund
                const dateRange = await FundNAV.aggregate([
                    { $match: { fundId: fund._id } },
                    {
                        $group: {
                            _id: null,
                            minDate: { $min: '$date' },
                            maxDate: { $max: '$date' },
                            avgNAV: { $avg: '$nav' }
                        }
                    }
                ]);
                
                if (dateRange.length > 0) {
                    validation.dateRange[fund.symbol] = {
                        start: dateRange[0].minDate,
                        end: dateRange[0].maxDate,
                        avgNAV: dateRange[0].avgNAV.toFixed(4)
                    };
                }
                
                // Validate NAV progression (no negative values)
                const negativeNAVs = await FundNAV.countDocuments({
                    fundId: fund._id,
                    nav: { $lte: 0 }
                });
                
                if (negativeNAVs > 0) {
                    validation.errors.push(`${fund.symbol}: ${negativeNAVs} negative NAV entries found`);
                }
                
                // Check for unrealistic NAV changes (>50% in one day)
                const extremeChanges = await FundNAV.countDocuments({
                    fundId: fund._id,
                    $or: [
                        { dailyChangePercent: { $gt: 50 } },
                        { dailyChangePercent: { $lt: -50 } }
                    ]
                });
                
                if (extremeChanges > 0) {
                    validation.warnings.push(`${fund.symbol}: ${extremeChanges} extreme daily changes (>50%)`);
                }
            }
            
            return validation;
            
        } catch (error) {
            console.error('Error validating NAV data:', error);
            throw error;
        }
    }

    // Detect data gaps across all cryptocurrencies and granularities
    async detectDataGaps() {
        try {
            const gaps = {
                cryptoGaps: {},
                totalGaps: 0,
                summary: []
            };
            
            const cryptos = await CryptoAsset.getActiveCryptos();
            const endDate = new Date();
            
            for (const crypto of cryptos) {
                gaps.cryptoGaps[crypto.symbol] = {};
                
                for (const granularity of this.requiredGranularities) {
                    const cryptoGaps = await CryptoPrice.checkDataGaps(
                        crypto.symbol,
                        granularity,
                        this.expectedStartDate,
                        endDate
                    );
                    
                    gaps.cryptoGaps[crypto.symbol][granularity] = cryptoGaps.length;
                    gaps.totalGaps += cryptoGaps.length;
                    
                    if (cryptoGaps.length > 0) {
                        gaps.summary.push({
                            symbol: crypto.symbol,
                            granularity,
                            gapCount: cryptoGaps.length,
                            firstGap: cryptoGaps[0],
                            lastGap: cryptoGaps[cryptoGaps.length - 1]
                        });
                    }
                }
            }
            
            return gaps;
            
        } catch (error) {
            console.error('Error detecting data gaps:', error);
            throw error;
        }
    }

    // Check if system is ready for NAV calculations
    async validateSystemReadiness() {
        try {
            const readiness = {
                ready: true,
                blockers: [],
                warnings: []
            };
            
            // Check if all required cryptocurrencies have data
            const cryptos = await CryptoAsset.getActiveCryptos();
            if (cryptos.length !== 7) {
                readiness.ready = false;
                readiness.blockers.push(`Expected 7 cryptocurrencies, found ${cryptos.length}`);
            }
            
            // Check if all funds are properly configured
            const funds = await Fund.getActiveFunds();
            if (funds.length !== 4) {
                readiness.ready = false;
                readiness.blockers.push(`Expected 4 funds, found ${funds.length}`);
            }
            
            // Check for minimum price data
            for (const crypto of cryptos) {
                const dailyCount = await CryptoPrice.countDocuments({
                    symbol: crypto.symbol,
                    granularity: 'daily'
                });
                
                if (dailyCount < 30) {
                    readiness.ready = false;
                    readiness.blockers.push(`${crypto.symbol}: Insufficient daily data (${dailyCount} records)`);
                }
            }
            
            // Check fund compositions
            for (const fund of funds) {
                const errors = await fund.validateComposition();
                if (errors.length > 0) {
                    readiness.ready = false;
                    readiness.blockers.push(`${fund.symbol}: ${errors.join(', ')}`);
                }
            }
            
            return readiness;
            
        } catch (error) {
            console.error('Error validating system readiness:', error);
            throw error;
        }
    }

    // Generate human-readable validation summary
    generateValidationSummary(validationResults) {
        let summary = '';
        
        // Crypto Assets Summary
        summary += `Cryptocurrency Assets: ${validationResults.cryptoAssets.activeCount}/${validationResults.cryptoAssets.totalCount} active\n`;
        if (validationResults.cryptoAssets.errors.length > 0) {
            summary += `  Errors: ${validationResults.cryptoAssets.errors.length}\n`;
        }
        
        // Price Data Summary
        summary += `Price Data: ${validationResults.priceData.totalRecords} total records\n`;
        Object.entries(validationResults.priceData.granularityBreakdown).forEach(([granularity, count]) => {
            summary += `  ${granularity}: ${count} records\n`;
        });
        
        // Fund Data Summary
        summary += `Funds: ${validationResults.fundData.activeFunds}/${validationResults.fundData.totalFunds} active\n`;
        
        // NAV Data Summary
        summary += `NAV Records: ${validationResults.navData.totalRecords} total\n`;
        Object.entries(validationResults.navData.fundBreakdown).forEach(([fund, count]) => {
            summary += `  ${fund}: ${count} records\n`;
        });
        
        // Data Gaps Summary
        summary += `Data Gaps: ${validationResults.dataGaps.totalGaps} total gaps found\n`;
        if (validationResults.dataGaps.summary.length > 0) {
            summary += `  Most significant gaps:\n`;
            validationResults.dataGaps.summary
                .sort((a, b) => b.gapCount - a.gapCount)
                .slice(0, 5)
                .forEach(gap => {
                    summary += `    ${gap.symbol} ${gap.granularity}: ${gap.gapCount} gaps\n`;
                });
        }
        
        // Overall Status
        const totalErrors = [
            ...validationResults.cryptoAssets.errors,
            ...validationResults.priceData.errors,
            ...validationResults.fundData.errors,
            ...validationResults.navData.errors
        ].length;
        
        if (totalErrors === 0) {
            summary += `\nOverall Status: ✅ SYSTEM HEALTHY\n`;
        } else {
            summary += `\nOverall Status: ❌ ${totalErrors} CRITICAL ERRORS FOUND\n`;
        }
        
        return summary;
    }

    // Get expected record count for validation
    getExpectedRecordCount(granularity) {
        const now = new Date();
        const startDate = this.expectedStartDate;
        const daysDiff = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
        
        switch (granularity) {
            case 'daily':
                return Math.min(daysDiff, 90); // Only keep 90 days for daily
            case 'weekly':
                return Math.floor(daysDiff / 7);
            case 'monthly':
                return Math.floor(daysDiff / 30);
            default:
                return 0;
        }
    }

    // Repair data gaps by fetching missing data
    async repairDataGaps(cryptoSymbol, granularity) {
        try {
            console.log(`Repairing data gaps for ${cryptoSymbol} (${granularity})...`);
            
            const crypto = await CryptoAsset.findOne({ symbol: cryptoSymbol });
            if (!crypto) {
                throw new Error(`Cryptocurrency ${cryptoSymbol} not found`);
            }
            
            const gaps = await CryptoPrice.checkDataGaps(
                cryptoSymbol,
                granularity,
                this.expectedStartDate,
                new Date()
            );
            
            if (gaps.length === 0) {
                console.log(`No gaps found for ${cryptoSymbol} (${granularity})`);
                return 0;
            }
            
            console.log(`Found ${gaps.length} gaps for ${cryptoSymbol} (${granularity})`);
            
            // This would require integration with cryptoDataService
            // For now, just return the gap count
            return gaps.length;
            
        } catch (error) {
            console.error(`Error repairing gaps for ${cryptoSymbol}:`, error);
            throw error;
        }
    }
}

module.exports = new DataValidationService();