// services/chartService.js - Chart data processing and business logic
const NAV = require('../models/NAV');

class ChartService {
    
    /**
     * Get chart data for a specific fund and timeframe
     * @param {string} fundSymbol - Fund symbol (e.g., 'CDTGR')
     * @param {string} timeframe - Timeframe ('1M', '3M', '6M', '1Y', '3Y', 'ALL')
     * @returns {Array} Chart data points
     */
    static async getFundChartData(fundSymbol, timeframe) {
        try {
            const granularity = this.getGranularityForTimeframe(timeframe);
            const startDate = this.getStartDateForTimeframe(timeframe);
            
            const chartData = await NAV.find({
                fundSymbol: fundSymbol.toUpperCase(),
                granularity,
                date: { $gte: startDate }
            }).sort({ date: 1 }).select('date nav dailyChangePercent totalReturnPercent');
            
            return chartData.map(item => ({
                date: item.date,
                nav: item.nav,
                change: item.dailyChangePercent || 0,
                totalReturn: item.totalReturnPercent || 0
            }));
        } catch (error) {
            throw new Error(`Failed to get chart data for ${fundSymbol}: ${error.message}`);
        }
    }

    /**
     * Determine granularity based on timeframe
     * Industry standard: shorter timeframes use more granular data
     * @param {string} timeframe 
     * @returns {string} granularity
     */
    static getGranularityForTimeframe(timeframe) {
        switch (timeframe.toUpperCase()) {
            case '1M':
            case '3M':
                return 'daily';
            case '6M':
            case '1Y':
                return 'weekly';
            case '3Y':
            case 'ALL':
                return 'monthly';
            default:
                return 'daily';
        }
    }

    /**
     * Calculate start date based on timeframe
     * @param {string} timeframe 
     * @returns {Date} start date
     */
    static getStartDateForTimeframe(timeframe) {
        const now = new Date();
        
        switch (timeframe.toUpperCase()) {
            case '1M':
                return new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
            case '3M':
                return new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000);
            case '6M':
                return new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
            case '1Y':
                return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            case '3Y':
                return new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000);
            case 'ALL':
                return new Date('2020-01-01'); // Your fund inception start
            default:
                return new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
        }
    }

    /**
     * Get supported timeframes with their configurations
     * @returns {Array} timeframe configurations
     */
    static getSupportedTimeframes() {
        return [
            { 
                code: '1M', 
                label: '1 Month', 
                granularity: 'daily',
                description: 'Daily NAV prices for last 30 days'
            },
            { 
                code: '3M', 
                label: '3 Months', 
                granularity: 'daily',
                description: 'Daily NAV prices for last 90 days'
            },
            { 
                code: '6M', 
                label: '6 Months', 
                granularity: 'weekly',
                description: 'Weekly NAV prices for last 6 months'
            },
            { 
                code: '1Y', 
                label: '1 Year', 
                granularity: 'weekly',
                description: 'Weekly NAV prices for last year'
            },
            { 
                code: '3Y', 
                label: '3 Years', 
                granularity: 'monthly',
                description: 'Monthly NAV prices for last 3 years'
            },
            { 
                code: 'ALL', 
                label: 'All Time', 
                granularity: 'monthly',
                description: 'Monthly NAV prices since inception'
            }
        ];
    }

    /**
     * Validate if timeframe is supported
     * @param {string} timeframe 
     * @returns {boolean}
     */
    static isValidTimeframe(timeframe) {
        const supportedTimeframes = this.getSupportedTimeframes().map(tf => tf.code);
        return supportedTimeframes.includes(timeframe.toUpperCase());
    }

    /**
     * Get chart data with performance calculations
     * @param {string} fundSymbol 
     * @param {string} timeframe 
     * @returns {Object} chart data with performance metrics
     */
    static async getChartDataWithPerformance(fundSymbol, timeframe) {
        try {
            const chartData = await this.getFundChartData(fundSymbol, timeframe);
            
            if (chartData.length === 0) {
                return {
                    data: [],
                    performance: {
                        periodReturn: 0,
                        periodReturnPercent: 0,
                        volatility: 0,
                        dataPoints: 0
                    }
                };
            }

            // Calculate period performance
            const firstPoint = chartData[0];
            const lastPoint = chartData[chartData.length - 1];
            const periodReturn = lastPoint.nav - firstPoint.nav;
            const periodReturnPercent = ((lastPoint.nav - firstPoint.nav) / firstPoint.nav) * 100;
            
            // Calculate volatility (standard deviation of daily changes)
            const changes = chartData.slice(1).map((point, index) => {
                const prevPoint = chartData[index];
                return ((point.nav - prevPoint.nav) / prevPoint.nav) * 100;
            });
            
            const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
            const variance = changes.reduce((sum, change) => sum + Math.pow(change - avgChange, 2), 0) / changes.length;
            const volatility = Math.sqrt(variance);

            return {
                data: chartData,
                performance: {
                    periodReturn: parseFloat(periodReturn.toFixed(4)),
                    periodReturnPercent: parseFloat(periodReturnPercent.toFixed(2)),
                    volatility: parseFloat(volatility.toFixed(2)),
                    dataPoints: chartData.length,
                    timeframe: timeframe,
                    granularity: this.getGranularityForTimeframe(timeframe)
                }
            };
        } catch (error) {
            throw new Error(`Failed to get chart data with performance: ${error.message}`);
        }
    }

    /**
     * Get chart data for multiple funds (comparison)
     * @param {Array} fundSymbols 
     * @param {string} timeframe 
     * @returns {Object} chart data for multiple funds
     */
    static async getMultipleFundsChartData(fundSymbols, timeframe) {
        try {
            const chartsData = {};
            
            for (const symbol of fundSymbols) {
                chartsData[symbol] = await this.getFundChartData(symbol, timeframe);
            }
            
            return chartsData;
        } catch (error) {
            throw new Error(`Failed to get multiple funds chart data: ${error.message}`);
        }
    }
}

module.exports = ChartService;