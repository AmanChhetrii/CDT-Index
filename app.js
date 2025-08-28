const express = require('express');
const path = require('path');
const mongoose = require('mongoose');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files (css, js, img, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine as ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
  res.render('index'); // views/index.ejs
});

app.get('/about-us', (req, res) => {
  res.render('about-us');
});

app.get('/blog', (req, res) => {
  res.render('blog');
});

app.get('/contact', (req, res) => {
  res.render('contact');
});

app.get('/elements', (req, res) => {
  res.render('elements');
});

// Connect MongoDB (optional for now)
mongoose.connect('mongodb://127.0.0.1:27017/cdtindex')
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
