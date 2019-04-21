const express = require('express'),
    flash = require('express-flash'),
    mongoose = require('mongoose'),
    bodyParser = require('body-parser'),
    passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    session = require('express-session'),
    uuidv4 = require('uuid/v4'),
    app = express(),
    router = express.Router(),
    path = require('path'),
    port = app.get(process.env.port) || 2020;
const { User, Update, Community } = require('./model/db/schema');

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
    res.render('dashboard');
});

app.get('/profile', isLoggedIn, (req, res) => {
    res.render('profile', {
        user: req.user
    });
});

// Block is commented out because we're now searching a collection for update and not user documents.
// We'll use populate user with update whenever we need to retrieve the content a particular user posted.
// app.get('/update', isLoggedIn, (req, res) => {
//     let communityId = req.user.communityId;
//     User.findOne({ role: 'admin', communityId }).populate('updates').exec((err, user) => {
//         res.render('update', { user });
//     });
// });

app.get('/update', isLoggedIn, (req, res) => {
    let communityId = req.user.communityId;
    if (communityId === null) console.log('You must join a community to view updates'), res.redirect('/profile');
    else {
        Update.find({ communityId }).then((updates) => {
            res.render('update', { updates })
        }).catch((err) => {
            console.log(err)
        })
    }
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
        if (err) console.log(err);
        else if (!user) {
            console.log("Email not found! Only existing users can become admins!");
            res.redirect('back');
        } else {
            if (user.communityId === null) {
                let communityIdStorage = generateCommunityID();

                //check if communityId is Unique. Save it alongside its email.
                Community.findOne({ communityId: communityIdStorage }, (err, community) => {
                    if (community) console.log(`${community} exists. Make user admin again`), res.redirect('back')
                    else {
                        let newCommunity = new Community();
                        newCommunity.communityId = communityIdStorage;
                        newCommunity.communityCount = 1;
                        newCommunity.presentCommunityCount = newCommunity.communityCount
                        newCommunity.communityMembersEmail.push({ email: potentialAdmin })
                        newCommunity.save();

                        //save admin's newly generated communityId.
                        user.communityId = communityIdStorage;
                        user.houseId = newCommunity.communityCount;
                        user.save()
                        console.log(`${potentialAdmin} now has admin rights. CommunityID generated`);
                        res.redirect('back')
                    }
                })
            } else {
                console.log(`${potentialAdmin} now has admin rights. Already has communityID`);
                res.redirect('back')
            }
        }
    })
});

app.post('/addCommunityUsers', isLoggedIn, isAdmin, (req, res) => {
    let communityId = req.user.communityId
    let email = req.body.communityUser.toLowerCase();
    Community.findOne({ communityId, communityMembersEmail: { $elemMatch: { email } } }, (err, communityUser) => {
        if (!communityUser) {
            Community.findOne({ communityId }).then((community) => {
                community.communityMembersEmail.push({ email })
                community.save().then((doc) => {
                    console.log(`${email} added to community list!`)
                    res.redirect('back')
                }).catch((err) => {
                    console.log(err)
                    res.redirect('back')
                })
            }).catch((err) => {
                console.log(err)
            })
        } else if (err) {
            console.log(err)
        } else {
            console.log('User already exists in the community!')
        }
    })
});

app.post('/joinCommunity', isLoggedIn, (req, res) => {
    let communityId = req.body.communityId.toLowerCase();
    let email = req.user.email;

    //ensure user provides an existing community and admin has added them to the community list.
    Community.findOne({ communityId, communityMembersEmail: { $elemMatch: { email } } }, (err, community) => {
        if (err) console.log(err)
        else if (community) {
            //update total number of users who have joined community (community count) and the ones that presently remain
            community.communityCount = community.communityCount + 1;
            community.presentCommunityCount = community.presentCommunityCount + 1;
            community.save();

            //update user's community ID and increment houseID by 1
            let houseId = community.communityCount;
            User.findOneAndUpdate({ email }, { $set: { communityId: communityId, houseId: houseId } }, { new: true }, (err, user) => {
                console.log('communityId updated')
                res.redirect('back')
            });
        } else {
            console.log('Sorry, the communityId and your email do not match!')
            res.redirect('back')
        }
    })
});

// IMPLEMENT CODE FOR USERS TO LEAVE A COMMUNITY. HOWEVER,, USERS CAN ONLY LEAVE A COMMUNITY IF THEY HAVE CLEARED
// THEIR DEBT IN THE CURRENT COMMUNITY

app.post('/createAdminPost', isAdmin, (req, res) => {
    User.findById(req.user._id, (err, user) => {
        let title = req.body.title;
        let content = req.body.content;
        let amount = req.body.amount;
        let id = req.user._id;
        let email = req.user.email;
        let firstName = req.user.firstName;
        let lastName = req.user.lastName;
        let communityId = req.user.communityId;
        let updateAuthor = { id, email, firstName, lastName };

        let update = new Update({ title, content, amount, communityId, updateAuthor });
        update.save().then((newUpdate) => {
            //check if update amount field is empty or of Non-Number type
            if (!isNaN(parseFloat(amount))) {
                User.find({ communityId }, (err, allCommunityUsers) => {
                    if (allCommunityUsers) {
                        // loop through communityUsers object
                        for (let individualUser in allCommunityUsers) {
                            if (allCommunityUsers.hasOwnProperty(individualUser)) {
                                let communityUser = allCommunityUsers[individualUser]
                                    // store payment details for all community users
                                let paymentId = newUpdate._id,
                                    paymentTitle = req.body.title
                                communityUser.paymentDetails.push({ paymentId, paymentTitle, communityId, communityName })
                                    //add amount to all community users debt (toPay)
                                communityUser.toPay = communityUser.toPay + Number(amount);
                                communityUser.save().then(() => {
                                    console.log("Amount Added to toPay successfully!!!")
                                }).catch((err) => {
                                    console.log(err)
                                })
                            }
                        }

                    } else {
                        console.log(err)
                    }
                });
            } else if (amount === "") {
                console.log("Admin did not specify an amount for this update")
            } else {
                console.log("Type provided by admin is not a number")
            }
            user.updates.push(newUpdate);
            // resolve save conflict. Solves the error: "VersionError: No matching document found for id bla bla"
            delete user.__v
            user.save().then(() => {
                res.redirect('/profile')
            })
        }, (err) => {
            console.log(err)
        });
    }).catch((err) => {
        console.log(err)
    });
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

app.post('/leaveCommunity', isLoggedIn, (req, res) => {
    let email = req.user.email;
    User.findOne({ email, paymentDetails: { $elemMatch: { paymentStatus: false } } }).then((user) => {
        if (user) res.redirect('/payment'), console.log('this is what happens')
        else {
            let userRoleArray = User.schema.path('role').enumValues,
                role = userRoleArray[0]
            User.findOneAndUpdate({ email }, { $set: { communityId: null, toPay: 0, role, houseId: null } }, { new: true })
                .then((userWithoutCommunity) => {
                    res.send(userWithoutCommunity)
                }).catch((err) => {
                    console.log(err)
                })
        }
    }).catch((err) => {
        console.log(err)
    })
})

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
};

function generateCommunityID() {
    return uuidv4().slice(-6).toLowerCase();
}

app.listen(port, () => {
    console.log(`listening on ${port}`)
});