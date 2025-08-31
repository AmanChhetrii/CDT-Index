CDT-Index/
│
├── app.js                 # Main Express app
├── package.json
│
├── routes/                # Route handlers
│   ├── landing.js
│   ├── auth.js
│   └── dashboard.js
│
├── views/                 # EJS templates
│   ├── landing/           # Landing pages
│   │   ├── index.ejs
│   │   ├── about.ejs
│   │   └── contact.ejs
│   │
│   ├── auth/              # Auth pages
│   │   ├── login.ejs
│   │   └── signup.ejs
│   │
│   └── dashboard/         # Dashboard pages
│       ├── index.ejs      # Main dashboard (converted from template index.html)
│       ├── settings.ejs   # (if your template has more pages, add here)
│       └── profile.ejs
│
├── public/                # Static files (accessible in browser)
│   ├── css/               # Landing CSS
│   ├── js/                # Landing JS
│   ├── images/            # Landing images
│   │
│   └── dashboard/         # Dashboard assets from template
│       ├── css/
│       ├── js/
│       ├── fonts/
│       └── images/
│
└── node_modules/


**improvements in landing site-- Header & footer 
                                 Services page-- Fund names , cards , Details , Methods , etc.
                                 analysis page-- either to be merged into the home and services page or to be made dedicatedly, 
                                 faq ( minor css issue to be fixed) ,tnc file to be uploaded , 