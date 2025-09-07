// test/viewNAVData.js - Terminal NAV data viewer
const NAV = require('../models/NAV');
const mongoose = require('mongoose');

class NAVDataViewer {
    constructor() {
        this.fundNames = {
            'CDTGR': 'CDT Growth Fund',
            'CDTBAL': 'CDT Balanced Fund', 
            'CDTPIO': 'CDT Pioneer Fund',
            'CDTARC': 'CDT Archer Fund'
        };
    }

    // Display data in a formatted table
    displayTable(data, title) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`${title.toUpperCase().padStart(40 + title.length/2).padEnd(80)}`);
        console.log(`${'='.repeat(80)}`);

        if (data.length === 0) {
            console.log('No data found for the specified criteria.');
            return;
        }

        // Table header
        console.log('Date'.padEnd(12) + 
                   'NAV'.padStart(10) + 
                   'Daily Chg'.padStart(12) + 
                   'Daily %'.padStart(10) + 
                   'Total Ret'.padStart(12) + 
                   'Total %'.padStart(10));
        console.log('-'.repeat(80));

        // Table rows
        data.forEach(record => {
            const date = record.date.toISOString().split('T')[0];
            const nav = `$${record.nav.toFixed(2)}`;
            const dailyChange = record.dailyChange >= 0 ? 
                `+$${record.dailyChange.toFixed(2)}` : 
                `-$${Math.abs(record.dailyChange).toFixed(2)}`;
            const dailyChangePercent = record.dailyChangePercent >= 0 ? 
                `+${record.dailyChangePercent.toFixed(2)}%` : 
                `${record.dailyChangePercent.toFixed(2)}%`;
            const totalReturn = record.totalReturn >= 0 ? 
                `+$${record.totalReturn.toFixed(2)}` : 
                `-$${Math.abs(record.totalReturn).toFixed(2)}`;
            const totalReturnPercent = record.totalReturnPercent >= 0 ? 
                `+${record.totalReturnPercent.toFixed(2)}%` : 
                `${record.totalReturnPercent.toFixed(2)}%`;

            console.log(date.padEnd(12) + 
                       nav.padStart(10) + 
                       dailyChange.padStart(12) + 
                       dailyChangePercent.padStart(10) + 
                       totalReturn.padStart(12) + 
                       totalReturnPercent.padStart(10));
        });

        // Summary statistics
        this.displaySummaryStats(data);
    }

    // Display summary statistics
    displaySummaryStats(data) {
        if (data.length === 0) return;

        const navValues = data.map(d => d.nav);
        const dailyChanges = data.map(d => d.dailyChangePercent).filter(d => d !== 0);
        
        const minNAV = Math.min(...navValues);
        const maxNAV = Math.max(...navValues);
        const currentNAV = navValues[navValues.length - 1];
        const avgDailyChange = dailyChanges.length > 0 ? 
            dailyChanges.reduce((sum, val) => sum + val, 0) / dailyChanges.length : 0;

        console.log('\n' + '-'.repeat(80));
        console.log('SUMMARY STATISTICS');
        console.log('-'.repeat(80));
        console.log(`Records Count: ${data.length}`);
        console.log(`Current NAV: $${currentNAV.toFixed(2)}`);
        console.log(`Min NAV: $${minNAV.toFixed(2)}`);
        console.log(`Max NAV: $${maxNAV.toFixed(2)}`);
        console.log(`Avg Daily Change: ${avgDailyChange.toFixed(2)}%`);
        console.log(`Total Return: ${data[data.length - 1].totalReturnPercent.toFixed(2)}%`);
    }

    // Get NAV data with filters
    async getNAVData(fundSymbol = null, granularity = null, limit = null, sortOrder = -1) {
        try {
            const query = {};
            
            if (fundSymbol) {
                query.fundSymbol = fundSymbol.toUpperCase();
            }
            
            if (granularity) {
                query.granularity = granularity.toLowerCase();
            }

            let mongoQuery = NAV.find(query).sort({ date: sortOrder });
            
            if (limit) {
                mongoQuery = mongoQuery.limit(limit);
            }

            return await mongoQuery;

        } catch (error) {
            console.error('Error fetching NAV data:', error);
            throw error;
        }
    }

    // Display fund overview
    async displayFundOverview() {
        console.log('\n' + '='.repeat(100));
        console.log('FUND OVERVIEW - ALL FUNDS & GRANULARITIES');
        console.log('='.repeat(100));

        const granularities = ['daily', 'weekly', 'monthly'];
        const fundSymbols = Object.keys(this.fundNames);

        for (const granularity of granularities) {
            console.log(`\n${granularity.toUpperCase()} DATA:`);
            console.log('-'.repeat(90));
            console.log('Fund'.padEnd(12) + 
                       'Records'.padStart(8) + 
                       'Current NAV'.padStart(12) + 
                       'Min NAV'.padStart(10) + 
                       'Max NAV'.padStart(10) + 
                       'Total Return'.padStart(13) + 
                       'Date Range'.padStart(25));
            console.log('-'.repeat(90));

            for (const fundSymbol of fundSymbols) {
                const data = await this.getNAVData(fundSymbol, granularity);
                
                if (data.length > 0) {
                    const navValues = data.map(d => d.nav);
                    const minNAV = Math.min(...navValues);
                    const maxNAV = Math.max(...navValues);
                    const currentNAV = data[0].nav; // Latest (sorted desc)
                    const totalReturn = data[0].totalReturnPercent;
                    const dateRange = `${data[data.length - 1].date.toISOString().split('T')[0]} to ${data[0].date.toISOString().split('T')[0]}`;

                    console.log(fundSymbol.padEnd(12) + 
                               data.length.toString().padStart(8) + 
                               `$${currentNAV.toFixed(2)}`.padStart(12) + 
                               `$${minNAV.toFixed(2)}`.padStart(10) + 
                               `$${maxNAV.toFixed(2)}`.padStart(10) + 
                               `${totalReturn.toFixed(2)}%`.padStart(13) + 
                               dateRange.padStart(25));
                } else {
                    console.log(fundSymbol.padEnd(12) + 'No data'.padStart(50));
                }
            }
        }
    }

    // Interactive menu
    async showMenu() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

        try {
            while (true) {
                console.log('\n' + '='.repeat(60));
                console.log('NAV DATA VIEWER - MENU OPTIONS');
                console.log('='.repeat(60));
                console.log('1. View fund overview (all funds & granularities)');
                console.log('2. View specific fund data');
                console.log('3. Compare funds (same granularity)');
                console.log('4. View latest NAV values');
                console.log('5. View performance summary');
                console.log('6. Exit');
                console.log('='.repeat(60));

                const choice = await question('Select an option (1-6): ');

                switch (choice) {
                    case '1':
                        await this.displayFundOverview();
                        break;

                    case '2':
                        await this.viewSpecificFund(question);
                        break;

                    case '3':
                        await this.compareFunds(question);
                        break;

                    case '4':
                        await this.viewLatestNAV();
                        break;

                    case '5':
                        await this.viewPerformanceSummary();
                        break;

                    case '6':
                        console.log('Goodbye!');
                        rl.close();
                        return;

                    default:
                        console.log('Invalid option. Please select 1-6.');
                }
            }
        } catch (error) {
            console.error('Menu error:', error);
            rl.close();
        }
    }

    // View specific fund data
    async viewSpecificFund(question) {
        console.log('\nAvailable funds:');
        Object.entries(this.fundNames).forEach(([symbol, name]) => {
            console.log(`  ${symbol} - ${name}`);
        });

        const fundSymbol = await question('Enter fund symbol (e.g., CDTGR): ');
        const granularity = await question('Enter granularity (daily/weekly/monthly): ');
        const limitStr = await question('Enter number of records to show (press enter for all): ');
        const limit = limitStr ? parseInt(limitStr) : null;

        if (!Object.keys(this.fundNames).includes(fundSymbol.toUpperCase())) {
            console.log('Invalid fund symbol!');
            return;
        }

        if (!['daily', 'weekly', 'monthly'].includes(granularity.toLowerCase())) {
            console.log('Invalid granularity!');
            return;
        }

        const data = await this.getNAVData(fundSymbol, granularity, limit);
        const title = `${this.fundNames[fundSymbol.toUpperCase()]} (${fundSymbol.toUpperCase()}) - ${granularity.toUpperCase()} Data`;
        this.displayTable(data, title);
    }

    // Compare funds
    async compareFunds(question) {
        const granularity = await question('Enter granularity for comparison (daily/weekly/monthly): ');
        
        if (!['daily', 'weekly', 'monthly'].includes(granularity.toLowerCase())) {
            console.log('Invalid granularity!');
            return;
        }

        console.log(`\n${'='.repeat(100)}`);
        console.log(`FUND COMPARISON - ${granularity.toUpperCase()} DATA`);
        console.log(`${'='.repeat(100)}`);

        console.log('Fund'.padEnd(10) + 
                   'Current NAV'.padStart(12) + 
                   'Total Return'.padStart(13) + 
                   'Best Day'.padStart(10) + 
                   'Worst Day'.padStart(11) + 
                   'Volatility'.padStart(11) + 
                   'Records'.padStart(9));
        console.log('-'.repeat(100));

        for (const fundSymbol of Object.keys(this.fundNames)) {
            const data = await this.getNAVData(fundSymbol, granularity);
            
            if (data.length > 0) {
                const dailyChanges = data.map(d => d.dailyChangePercent).filter(d => d !== 0);
                const currentNAV = data[0].nav;
                const totalReturn = data[0].totalReturnPercent;
                const bestDay = dailyChanges.length > 0 ? Math.max(...dailyChanges) : 0;
                const worstDay = dailyChanges.length > 0 ? Math.min(...dailyChanges) : 0;
                const volatility = dailyChanges.length > 0 ? 
                    Math.sqrt(dailyChanges.map(x => Math.pow(x - (dailyChanges.reduce((a,b) => a + b, 0) / dailyChanges.length), 2)).reduce((a,b) => a + b, 0) / dailyChanges.length) : 0;

                console.log(fundSymbol.padEnd(10) + 
                           `$${currentNAV.toFixed(2)}`.padStart(12) + 
                           `${totalReturn.toFixed(2)}%`.padStart(13) + 
                           `${bestDay.toFixed(2)}%`.padStart(10) + 
                           `${worstDay.toFixed(2)}%`.padStart(11) + 
                           `${volatility.toFixed(2)}%`.padStart(11) + 
                           data.length.toString().padStart(9));
            }
        }
    }

    // View latest NAV values
    async viewLatestNAV() {
        console.log('\n' + '='.repeat(80));
        console.log('LATEST NAV VALUES');
        console.log('='.repeat(80));

        const granularities = ['daily', 'weekly', 'monthly'];

        for (const granularity of granularities) {
            console.log(`\n${granularity.toUpperCase()} - Latest Values:`);
            console.log('-'.repeat(60));
            console.log('Fund'.padEnd(10) + 
                       'NAV'.padStart(10) + 
                       'Daily Change'.padStart(13) + 
                       'Total Return'.padStart(13) + 
                       'Date'.padStart(12));
            console.log('-'.repeat(60));

            for (const fundSymbol of Object.keys(this.fundNames)) {
                const data = await this.getNAVData(fundSymbol, granularity, 1);
                
                if (data.length > 0) {
                    const record = data[0];
                    const dailyChange = record.dailyChangePercent >= 0 ? 
                        `+${record.dailyChangePercent.toFixed(2)}%` : 
                        `${record.dailyChangePercent.toFixed(2)}%`;
                    const totalReturn = record.totalReturnPercent >= 0 ? 
                        `+${record.totalReturnPercent.toFixed(2)}%` : 
                        `${record.totalReturnPercent.toFixed(2)}%`;

                    console.log(fundSymbol.padEnd(10) + 
                               `$${record.nav.toFixed(2)}`.padStart(10) + 
                               dailyChange.padStart(13) + 
                               totalReturn.padStart(13) + 
                               record.date.toISOString().split('T')[0].padStart(12));
                } else {
                    console.log(fundSymbol.padEnd(10) + 'No data'.padStart(35));
                }
            }
        }
    }

    // View performance summary
    async viewPerformanceSummary() {
        console.log('\n' + '='.repeat(100));
        console.log('PERFORMANCE SUMMARY - ALL FUNDS');
        console.log('='.repeat(100));

        console.log('Fund'.padEnd(10) + 
                   'Inception NAV'.padStart(13) + 
                   'Current Daily'.padStart(13) + 
                   'Current Weekly'.padStart(15) + 
                   'Current Monthly'.padStart(16) + 
                   'Best Performance'.padStart(16));
        console.log('-'.repeat(100));

        const inceptionNAVs = {
            'CDTGR': 120,
            'CDTBAL': 100, 
            'CDTPIO': 90,
            'CDTARC': 150
        };

        for (const fundSymbol of Object.keys(this.fundNames)) {
            const dailyData = await this.getNAVData(fundSymbol, 'daily', 1);
            const weeklyData = await this.getNAVData(fundSymbol, 'weekly', 1);
            const monthlyData = await this.getNAVData(fundSymbol, 'monthly', 1);

            const dailyNAV = dailyData.length > 0 ? `$${dailyData[0].nav.toFixed(2)}` : 'N/A';
            const weeklyNAV = weeklyData.length > 0 ? `$${weeklyData[0].nav.toFixed(2)}` : 'N/A';
            const monthlyNAV = monthlyData.length > 0 ? `$${monthlyData[0].nav.toFixed(2)}` : 'N/A';

            // Find best performance across all granularities
            const allData = [
                ...(dailyData.length > 0 ? [dailyData[0].totalReturnPercent] : []),
                ...(weeklyData.length > 0 ? [weeklyData[0].totalReturnPercent] : []),
                ...(monthlyData.length > 0 ? [monthlyData[0].totalReturnPercent] : [])
            ];
            const bestPerformance = allData.length > 0 ? `${Math.max(...allData).toFixed(2)}%` : 'N/A';

            console.log(fundSymbol.padEnd(10) + 
                       `$${inceptionNAVs[fundSymbol]}`.padStart(13) + 
                       dailyNAV.padStart(13) + 
                       weeklyNAV.padStart(15) + 
                       monthlyNAV.padStart(16) + 
                       bestPerformance.padStart(16));
        }
    }
}

// Main execution function
async function main() {
    try {
        require('dotenv').config();
        
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected successfully!');

        const viewer = new NAVDataViewer();

        // Check if command line arguments are provided
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            // Interactive mode
            await viewer.showMenu();
        } else {
            // Command line mode
            const [fundSymbol, granularity, limit] = args;
            
            if (fundSymbol === 'overview') {
                await viewer.displayFundOverview();
            } else if (fundSymbol === 'latest') {
                await viewer.viewLatestNAV();
            } else if (fundSymbol === 'summary') {
                await viewer.viewPerformanceSummary();
            } else {
                const data = await viewer.getNAVData(
                    fundSymbol, 
                    granularity, 
                    limit ? parseInt(limit) : null
                );
                const title = `${fundSymbol.toUpperCase()} - ${granularity ? granularity.toUpperCase() : 'ALL'} Data`;
                viewer.displayTable(data, title);
            }
        }

        await mongoose.disconnect();
        console.log('\nDatabase connection closed.');

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Help function
function showHelp() {
    console.log(`
NAV Data Viewer Usage:

Interactive Mode:
  node test/viewNAVData.js

Command Line Mode:
  node test/viewNAVData.js [fund] [granularity] [limit]
  node test/viewNAVData.js overview
  node test/viewNAVData.js latest  
  node test/viewNAVData.js summary

Examples:
  node test/viewNAVData.js CDTGR daily 10
  node test/viewNAVData.js CDTBAL weekly
  node test/viewNAVData.js overview
  node test/viewNAVData.js latest

Available Funds: CDTGR, CDTBAL, CDTPIO, CDTARC
Available Granularities: daily, weekly, monthly
    `);
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
}

// Run the main function
if (require.main === module) {
    main();
}

module.exports = NAVDataViewer;