// config/scheduler.js - Configuration for automated task scheduling
module.exports = {
    // Scheduler settings
    enabled: process.env.SCHEDULER_ENABLED === 'true' || false,
    timezone: process.env.TIMEZONE || 'UTC',
    
    // Task schedules (cron-like expressions)
    schedules: {
        dailyPriceUpdate: {
            expression: '0 6 * * *', // 6 AM daily
            enabled: true,
            description: 'Fetch current crypto prices and update NAVs'
        },
        weeklyDataSampling: {
            expression: '0 7 * * 2', // 7 AM every Tuesday
            enabled: true,
            description: 'Sample daily data for weekly storage'
        },
        monthlyDataSampling: {
            expression: '0 8 1 * *', // 8 AM on 1st of each month
            enabled: true,
            description: 'Sample daily data for monthly storage'
        },
        dailyCleanup: {
            expression: '0 2 * * *', // 2 AM daily
            enabled: true,
            description: 'Clean up old daily data (30-day rolling window)'
        },
        healthCheck: {
            expression: '0 */6 * * *', // Every 6 hours
            enabled: true,
            description: 'System health validation check'
        }
    },
    
    // Retry configuration
    retry: {
        maxAttempts: 3,
        delayMs: 6 * 60 * 60 * 1000, // 6 hours
        criticalTasks: ['dailyPriceUpdate'] // Tasks that should retry on failure
    },
    
    // API rate limiting
    rateLimiting: {
        delayBetweenCryptos: 3000, // 3 seconds between crypto API calls
        delayBetweenGranularities: 2000, // 2 seconds between granularity imports
        maxConcurrentRequests: 1 // Process one at a time to respect API limits
    },
    
    // Data retention policies
    dataRetention: {
        dailyPriceData: 30, // Keep 30 days of daily data
        logFiles: 7, // Keep logs for 7 days
        tempFiles: 1 // Clean temp files after 1 day
    },
    
    // Notification settings (for future implementation)
    notifications: {
        enabled: false,
        onError: true,
        onSuccess: false,
        channels: ['console'] // 'email', 'slack', 'console'
    }
};