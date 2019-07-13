const express = require('express'),
    app = express(),
    compression = require('compression'),
    bodyParser = require('body-parser'),
    favicon = require('serve-favicon'),
    path = require('path'),
    cloudinary = require('cloudinary'),
    flash = require('express-flash'),
    session = require('express-session'),
    methodOverride = require("method-override");

// Local packages
const routes = require('./routes/routes'),
    { mongoose } = require('./db/mongoose'),
    passport = require('./config/passport');

require('dotenv').config();

let PORT = app.get(process.env.PORT) || 3000;

app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/public')));
app.use(favicon(path.join(__dirname, "/public", "/images", "/favicon.ico"))); //Serve favicon
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
app.use(methodOverride("_method"))

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Clean up server when process exits
process.on('exit', (code) => {
    mongoose.disconnect();
    console.log('PROCESS IS EXITING WITH CODE ' + code);
});

// Handle server clean up in the event  of CTRL-C exit
process.on('SIGINT', (code) => {
    console.log('Ctrl-C was hit by server admin. EXITING WITH CODE ' + code);
    mongoose.disconnect();
    process.exit(2)
});

// Handle server clean up for uncaught errors
process.on('uncaughtException', (err) => {
    console.log(err.stack);
    mongoose.disconnect();
    process.exit(99)
});

app.listen(PORT, () => {
    console.log(`listening on ${PORT}`)
});