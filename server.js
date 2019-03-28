const express = require('express'),
    flash = require('express-flash'),
    mongoose = require('mongoose'),
    bodyParser = require('body-parser'),
    passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    session = require('express-session'),
    app = express(),
    router = express.Router(),
    path = require('path'),
    port = app.get(process.env.port) || 2020;
const { User, Update } = require('./model/db/schema');
// const Update = require('./model/db/schema');

mongoose.connect('mongodb://localhost:27017/communiteam', { useNewUrlParser: true, useCreateIndex: true, useFindAndModify: false });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/public')));
app.set('view engine', 'ejs');

app.use(session({
    secret: 'communiteamBlandUnencryptedSecret',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

passport.serializeUser(function(user, done) {
    done(null, user.id)
})

passport.deserializeUser((id, done) => {
    User.findById(id, function(err, user) {
        // console.log(err)
        done(err, user)
    })
})

//handle passpport sign-up
passport.use('local-register', new LocalStrategy({ usernameField: 'email', passwordField: 'password', passReqToCallback: true },
    function(req, email, password, done) {
        User.findOne({ email }, function(err, user) {
            if (err) return done(err);
            if (user) return done(null, false, console.log('Email is taken'));
            else {
                var user = new User()
                user.email = email;
                user.password = password;
                user.firstName = req.body.firstName;
                user.lastName = req.body.lastName;
                user.state = req.body.state;
                user.save(function(err) {
                    if (err) console.log(err)
                    else {
                        done(null, user)
                        console.log(user)
                    }
                })
            }
        })
    }
));

//handle passpport login
passport.use('local-login', new LocalStrategy({ usernameField: 'email', passwordField: 'password', passReqToCallback: true },
    function(req, email, password, done) {
        User.findOne({ email }, function(err, user) {
            console.log(user.correctPassword(password))
            if (err) return done(err)
            else if (!user) return done(null, false, console.log('user does not exist'))
            else if (!user.correctPassword(password)) return done(null, false, console.log('Invalid password'))
            else return done(null, user)
        })
    }
));

app.get(['/', '/home'], (req, res) => {
    res.render('home');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.get('/login', (req, res) => {
    res.render('login')
});

app.get('/admin-register', (req, res) => {
    res.render('adminRegisteration');
});

app.get('/dashboard', isLoggedIn, (req, res) => {
    console.log(req.user)
    res.render('dashboard');
});

app.get('/profile', isLoggedIn, (req, res) => {
    res.render('profile', {
        user: req.user,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        state: req.user.state,
        role: req.user.role
    });
});

app.get('/update', isLoggedIn, (req, res) => {
    res.render('update');
});

app.get('/payment', isLoggedIn, (req, res) => {
    res.render('payment');
});

app.get('/general', isLoggedIn, (req, res) => {
    res.render('general');
});

app.get('/adminPost', isLoggedIn, isAdmin, (req, res) => {
    res.render('adminPost')
})

app.post('/register',
    passport.authenticate('local-register', {
        failureRedirect: '/',
        successRedirect: '/dashboard',
        failureFlash: true
    })
);

app.post('/login',
    passport.authenticate('local-login', {
        failureRedirect: '/',
        successRedirect: '/dashboard',
        failureFlash: true
    })
);

app.post('/createAdmin', isLoggedIn, (req, res) => {
    let potentialAdmin = req.body.potentialAdmin;
    let userRoleArray = User.schema.path('role').enumValues;
    User.findOneAndUpdate({ email: potentialAdmin }, { $set: { role: userRoleArray[1] } }, { new: true }, (err, user) => {
        if (err) console.log(err)
        else if (!user) {
            console.log("Email not found! Only existing users can become admins!")
            res.redirect('back')
        } else {
            console.log(`${potentialAdmin} now has admin rights`)
            res.redirect('back')
        }
    })
});

app.post('/createAdminPost', isAdmin, (req, res) => {
    let title = req.body.title;
    let content = req.body.content;
    let amount = req.body.amount;
    let id = req.user._id;
    let email = req.user.email;
    let updateAuthor = { id, email }
    let update = new Update({ title, content, amount, updateAuthor });
    update.save().then((newUpdate) => {
        console.log(newUpdate);
        res.redirect('/profile')
    }, (err) => {
        console.log(err)
    })
})

app.post('/removeAdminBadge', isLoggedIn, (req, res) => {
    let potentialUser = req.body.potentialUser;
    let userRoleArray = User.schema.path('role').enumValues;
    User.findOneAndUpdate({ email: potentialUser }, { $set: { role: userRoleArray[0] } }, { new: true }, (err, user) => {
        if (err) console.log(err)
        else if (!user) {
            console.log(`${potentialUser} is no longer an admin`)
            res.redirect('back')
        } else {
            console.log("Email not found! Only existing admins can become users!")
        }
    });
});

app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/login')
});

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) return next()
    res.redirect('/login');
}

function isAdmin(req, res, next) {
    if (req.user.role === 'admin') return next()
    res.send(req.user);
}

app.listen(port, () => {
    console.log(`listening on ${port}`)
});

// app.get('/update', isLoggedIn, (req, res) => {
//     User.findOne({role: 'admin', group: req.user.group, }, (err, user) => {
//         user.posts
//     })
// });