const express = require('express'),
    app = express(),
    compression = require('compression'),
    bodyParser = require('body-parser'),
    favicon = require('serve-favicon'),
    path = require('path'),
    cloudinary = require('cloudinary'),
    flash = require('express-flash'),
    session = require('express-session');

// Local packages
const routes = require('./routes/routes'),
    passport = require('./config/passport');

require('dotenv').config();

let PORT = app.get(process.env.PORT) || 3000;

app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/public')));
// app.use(favicon(path.join(__dirname, "/public", "/images", "/favicon.ico"))); //Serve favicon
app.set('view engine', 'ejs');

app.use(session({
    secret: process.env.SESSIONSECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use('/', routes);

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

app.listen(PORT, () => {
    console.log(`listening on ${PORT}`)
});