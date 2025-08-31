const express = require('express');
const path = require('path');
const mongoose = require('mongoose');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const landingRoutes = require('./routes/landing');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');

app.use('/', landingRoutes);
app.use('/', authRoutes);
app.use('/', dashboardRoutes);

// MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/cdtindex')
  .then(function() { console.log("MongoDB connected"); })
  .catch(function(err) { console.error(err); });

// Start server
const PORT = 3000;
app.listen(PORT, function() {
  console.log(`Server running at http://localhost:${PORT}`);
});
