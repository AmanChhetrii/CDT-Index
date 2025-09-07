# CDT Index - Complete Knowledge Transfer Document (Updated)

## Project Overview

**Project Name:** CDT Index  
**Type:** Crypto Index Fund Investment Platform  
**Description:** A web platform where users can invest in cryptocurrency index funds  
**Database:** MongoDB (`cdtindex`)  
**Current Status:** Backend complete with automated crypto price fetching and NAV calculations

---

## Technology Stack

### Backend
- **Framework:** Node.js with Express.js
- **Template Engine:** EJS
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** Session-based with bcryptjs password hashing
- **Session Storage:** MongoDB sessions via connect-mongo
- **APIs:** CryptoCompare API for crypto price data
- **Automation:** Node-cron for scheduled tasks

### Frontend
- **UI Framework:** Custom Bootstrap templates + Kaiadmin dashboard
- **Design:** Glassmorphism with particle.js effects
- **Styling:** Modern dark theme with gradient accents
- **Dashboard:** Professional admin template with charts and widgets

### Dependencies
```json
{
  "bcryptjs": "Password hashing",
  "connect-flash": "Flash messages", 
  "connect-mongo": "MongoDB session store",
  "dotenv": "Environment variables",
  "ejs": "Template engine",
  "express": "Web framework",
  "express-session": "Session management",
  "mongoose": "MongoDB ODM",
  "node-fetch": "API requests",
  "node-cron": "Task scheduling"
}
```

---

## Current Project Structure

```
cdt-index/
├── app.js                     # Main Express server
├── package.json               # Dependencies & scripts
├── .env                       # Environment variables
├── startAutomation.js         # Automated system starter
├── manualDataFetch.js         # Manual crypto+NAV fetch script
├── testNAVData.js            # NAV data testing script
│
├── models/                    # Database schemas
│   ├── User.js               # User authentication model
│   ├── Fund.js               # Investment fund model
│   ├── CryptoAsset.js        # Cryptocurrency asset model
│   ├── CryptoPrice.js        # Crypto price history (daily/weekly/monthly)
│   └── NAV.js                # Fund NAV history (daily/weekly/monthly)
│
├── middleware/                # Custom middleware
│   └── auth.js               # Authentication middleware
│
├── routes/                    # Route handlers
│   ├── landing.js            # Landing page routes
│   ├── auth.js               # Authentication routes
│   └── dashboard.js          # Protected dashboard routes
│
├── services/                  # Business logic services
│   ├── automaticScheduler.js # Automated crypto+NAV fetching (2 PM IST daily)
│   └── nav/
│       └── navCalculationService.js # Historical NAV processing
│
├── test/                      # Testing and diagnostics
│   ├── databaseDiagnostic.js # Database inspection tool
│   ├── testInceptionPrices.js # NAV calculation testing
│   └── debugSpecificDate.js  # Date-specific debugging
│
├── views/                     # EJS templates
│   ├── landing/              # Public pages (glassmorphism design)
│   ├── auth/                 # Authentication pages
│   └── dashboard/            # Protected dashboard (Kaiadmin template)
│
└── public/                   # Static assets
    ├── css/, js/, img/       # Landing page assets
    └── dashboard/            # Kaiadmin dashboard assets
        ├── css/, js/, fonts/, img/
```

---

## Database Schema (Current Implementation)

### CryptoAssets Collection
```javascript
{
  _id: ObjectId,
  symbol: String,               // "BTC", "ETH", etc.
  name: String,                 // "Bitcoin", "Ethereum"
  currentPrice: Number,         // Live price in USD
  marketCap: Number,            // Market capitalization
  rank: Number,                 // Market ranking
  volume24h: Number,            // 24h trading volume
  priceChange24h: Number,       // 24h price change
  priceChangePercentage24h: Number, // 24h change %
  lastUpdated: Date,
  isActive: Boolean,            // Default: true
  apiId: String                 // For API compatibility
}
```

### CryptoPrice Collection (Price History)
```javascript
{
  _id: ObjectId,
  symbol: String,               // "BTC", "ETH", etc.
  date: Date,                   // Price date (normalized to 00:00:00)
  price: Number,                // USD price
  volume: Number,               // Trading volume
  marketCap: Number,            // Market cap
  granularity: String,          // "daily", "weekly", "monthly"
  source: String                // "cryptocompare_auto", "cryptocompare_manual"
}
```

### Funds Collection
```javascript
{
  _id: ObjectId,
  name: String,                 // "CDT Growth Index"
  symbol: String,               // "CDTGR"
  slug: String,                 // "cdt-growth-index"
  summary: String,              // Short description
  description: String,          // Full description
  riskLevel: String,            // "Conservative Growth", "Stable Growth", etc.
  riskIcon: String,             // Icon class
  composition: [{               // Fund holdings
    symbol: String,             // "BTC"
    name: String,               // "Bitcoin"
    weight: Number              // 0.60 (60%)
  }],
  currentNAV: Number,           // Current Net Asset Value
  inceptionNAV: Number,         // Starting NAV
  inceptionDate: Date,          // Fund start date
  isActive: Boolean,            // Fund status
  featured: Boolean,            // Featured on homepage
  displayOrder: Number          // Sort order
}
```

### NAV Collection (Fund NAV History)
```javascript
{
  _id: ObjectId,
  fundSymbol: String,           // "CDTGR", "CDTBAL", "CDTPIO", "CDTARC"
  date: Date,                   // NAV date (normalized to 00:00:00)
  nav: Number,                  // Net Asset Value
  dailyChange: Number,          // Change from previous day
  dailyChangePercent: Number,   // % change from previous day
  totalReturn: Number,          // Total return since inception
  totalReturnPercent: Number,   // % return since inception
  granularity: String,          // "daily", "weekly", "monthly"
  source: String                // "auto_calculated", "manual_calculated", "weekly_sample", "monthly_sample"
}
```

### Users Collection
```javascript
{
  _id: ObjectId,
  firstName: String,            // Required, trimmed
  lastName: String,             // Required, trimmed
  email: String,                // Required, unique, lowercase
  password: String,             // Hashed with bcrypt
  isVerified: Boolean,          // Default: false
  createdAt: Date,              // Auto timestamp
  updatedAt: Date               // Auto timestamp
}
```

---

## Current Fund Configurations

### 4 Active Index Funds

| Fund | Symbol | Inception NAV | Risk Level | Composition |
|------|--------|---------------|------------|-------------|
| **CDT Growth Index** | CDTGR | $120 | Conservative Growth | BTC 60%, ETH 25%, SOL 15% |
| **CDT Balanced Index** | CDTBAL | $100 | Stable Growth | BTC 30%, ETH 30%, AVAX 20%, LINK 20% |
| **CDT Pioneer Index** | CDTPIO | $90 | High Risk Alternative | DOGE 50%, MANA 35%, AVAX 15% |
| **CDT AmanRC Index** | CDTARC | $150 | Premium Diversified | BTC 40%, ETH 25%, SOL 20%, LINK 15% |

### 7 Supported Cryptocurrencies
- **BTC** (Bitcoin)
- **ETH** (Ethereum)
- **SOL** (Solana)
- **AVAX** (Avalanche)
- **DOGE** (Dogecoin)
- **LINK** (Chainlink)
- **MANA** (Decentraland)

---

## Automated Data Management System

### Core Automation Features

**Main Scheduler:** `services/automaticScheduler.js`
- **Schedule:** Daily at 2:00 PM IST
- **Integrated Workflow:** Crypto prices → NAV calculation → Data management

**Manual Alternative:** `manualDataFetch.js`
- Same functionality as automated system
- Run on-demand for testing/backup

### Daily Workflow (Automated)
1. **Fetch Crypto Prices** (7 API calls to CryptoCompare)
2. **Initialize NAV Data** (get inception prices from oldest monthly data)
3. **Calculate Fund NAVs** (4 fund calculations using price ratios)
4. **Data Cleanup** (remove crypto prices older than 90 days)
5. **Conditional Sampling:**
   - **Tuesday:** Sample daily data → weekly granularity
   - **1st of month:** Sample daily data → monthly granularity
6. **NAV Cleanup** (remove NAV data older than 90 days)

### NAV Calculation Logic

**Formula:** `NAV(t) = Inception NAV × Σ wi × Pi(t)/Pi(0)`

**Substitution Rules** (for zero-price scenarios):
- **CDTGR:** If SOL = $0 → use ETH
- **CDTBAL:** If AVAX = $0 → use BTC  
- **CDTPIO:** If AVAX = $0 → use DOGE
- **CDTARC:** If SOL = $0 → use ETH

**Inception Date:** March 16, 2020 (oldest monthly crypto data)

### Data Granularity System
- **Daily:** 90-day rolling window (current + 89 historical days)
- **Weekly:** Permanent storage (sampled from daily data)
- **Monthly:** Permanent storage (sampled from daily data)

---

## API Integration

### CryptoCompare API
- **Base URL:** `https://min-api.cryptocompare.com/data/v2`
- **Endpoint:** `/histoday?fsym={SYMBOL}&tsym=USD&limit=1`
- **Rate Limiting:** 2-second delays between requests
- **Sources:** 'cryptocompare_auto' (automated), 'cryptocompare_manual' (manual)

### Downtime Resilience
- **Missed Tuesday:** Weekly sampling catches up on Wednesday/Thursday
- **Missed 1st:** Monthly sampling catches up on 2nd/3rd
- **API Failures:** Error logging with system continuation

---

## Current Functionality Status

### ✅ Completed Systems

**Authentication & Security:**
- User registration/login with bcrypt password hashing
- Session-based authentication with MongoDB storage
- Route protection middleware
- Flash message system

**Data Collection & Management:**
- Real-time crypto price fetching (7 cryptocurrencies)
- Historical price data (daily/weekly/monthly granularity)
- 90-day rolling window for daily data
- Automated weekly/monthly sampling

**NAV Calculation Engine:**
- Mathematical NAV calculation using price ratios
- Intelligent crypto substitution for zero-price scenarios
- Daily/weekly/monthly NAV history tracking
- Performance metrics (daily change, total return)

**Automation System:**
- Cron-based scheduling (2 PM IST daily)
- Integrated crypto + NAV workflow
- Manual backup system
- Downtime resilience and catch-up logic

**Database & Models:**
- Complete MongoDB schema with proper indexing
- 5 collections: Users, CryptoAssets, CryptoPrice, Funds, NAV
- Data validation and relationship management
- TTL indexes for automatic cleanup

**Testing & Diagnostics:**
- Database diagnostic tools
- NAV calculation testing
- Date-specific debugging utilities
- Data verification scripts

### 🚧 In Progress

**Frontend Development:**
- Landing pages with glassmorphism design
- Dashboard template integration (Kaiadmin)
- Authentication UI completed

### 📋 Next Phase Priorities

**Immediate (Frontend Enhancement):**
1. **API Endpoints Creation**
   ```
   GET  /api/funds              # Get all funds with current NAV
   GET  /api/funds/:symbol      # Get specific fund details
   GET  /api/funds/:symbol/nav  # Get fund NAV history (charts)
   GET  /api/crypto            # Get crypto price data
   GET  /api/performance       # Fund performance comparison
   ```

2. **Dashboard Implementation**
   - Fund performance overview
   - Interactive NAV charts (daily/weekly/monthly views)
   - Real-time fund data display
   - Fund comparison tools

3. **Fund Detail Pages**
   - Individual fund performance
   - Composition breakdowns
   - Historical performance charts
   - Risk metrics display

**Medium-term (Investment System):**
4. **User Investment Tracking**
   - Portfolio management interface
   - Investment history
   - Performance tracking per user
   - Buy/sell simulation (for portfolio demonstration)

5. **Advanced Analytics**
   - Volatility calculations
   - Sharpe ratios and risk metrics
   - Correlation analysis
   - Market comparison tools

**Long-term (Production Features):**
6. **Admin Panel**
   - System health monitoring
   - Data collection status
   - Manual override capabilities
   - Fund management interface

7. **Enhanced User Experience**
   - Email notifications for significant movements
   - Mobile responsiveness
   - Performance optimization
   - Advanced charting libraries

---

## File Structure Reference

### Core Application Files
- **Main Server:** `app.js`
- **Automation Starter:** `startAutomation.js`
- **Manual Data Fetch:** `manualDataFetch.js`
- **Environment Config:** `.env`

### Data Management
- **Automated System:** `services/automaticScheduler.js`
- **Historical Processing:** `services/nav/navCalculationService.js`
- **NAV Testing:** `testNAVData.js`

### Database Models
- **Users:** `models/User.js`
- **Funds:** `models/Fund.js`
- **Crypto Assets:** `models/CryptoAsset.js`
- **Price History:** `models/CryptoPrice.js`
- **NAV History:** `models/NAV.js`

### Testing & Diagnostics
- **Database Inspector:** `test/databaseDiagnostic.js`
- **NAV Tester:** `test/testInceptionPrices.js`
- **Date Debugger:** `test/debugSpecificDate.js`

---

## Deployment Requirements

### Environment Variables
```env
MONGODB_URI=mongodb://127.0.0.1:27017/cdtindex
SESSION_SECRET=your-super-secret-session-key
PORT=3000
CRYPTO_API_KEY=optional-cryptocompare-key
```

### Production Considerations
- **24/7 Server:** Cloud deployment required for automation
- **Database:** MongoDB Atlas or dedicated MongoDB instance
- **Monitoring:** System health checks and alerting
- **Security:** HTTPS, CSRF protection, rate limiting
- **Backup:** Automated database backups

### Current Run Commands
```bash
# Manual data fetch
node manualDataFetch.js              # Run once
node manualDataFetch.js preview      # Preview mode

# Automated system
node startAutomation.js              # Start 24/7 automation
node startAutomation.js test         # Test run

# Testing/Diagnostics
node testNAVData.js summary          # NAV data overview
node testNAVData.js latest CDTGR     # Latest fund NAV
node test/databaseDiagnostic.js      # Database inspection

# Development server
node app.js                          # Start web application
```

---

## Technical Architecture Summary

**Data Flow:**
```
CryptoCompare API → CryptoPrice Collection → NAV Calculation → NAV Collection
                                ↓
                         User Dashboard Display
```

**Automation Flow:**
```
Cron Scheduler (2 PM IST) → Fetch Prices → Calculate NAVs → Sample Data → Cleanup
```

**Storage Strategy:**
```
Daily Data: 90-day rolling window (efficient for current operations)
Weekly/Monthly: Permanent storage (efficient for long-term charts)
```

This system provides a complete, production-ready backend for a cryptocurrency index fund platform with automated data management, accurate NAV calculations, and comprehensive historical tracking.