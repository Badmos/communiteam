const express = require('express'),
    flash = require('express-flash'),
    mongoose = require('mongoose'),
    bodyParser = require('body-parser'),
    passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    nodemailer = require('nodemailer'),
    session = require('express-session'),
    uuidv4 = require('uuid/v4'),
    path = require('path'),
    multer = require('multer'),
    cloudinary = require('cloudinary'),
    cloudinaryStorage = require('multer-storage-cloudinary');

require('dotenv').config();
const router = express.Router(),
    app = express();

let PORT = app.get(process.env.PORT) || 3000;
const { User, Update, Community, ExCommunityMember } = require('./model/db/schema');

let mongodbUrl = process.env.DATABASEURL || 'mongodb://localhost:27017/communiteam';
mongoose.connect(mongodbUrl, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    // Use ssl connection (needs to have a mongod server with ssl support). Default is false. Change to true when using ssl
    ssl: false,
    // sets how many times to try reconnecting
    reconnectTries: Number.MAX_VALUE,
    // sets the delay between every retry (milliseconds)
    reconnectInterval: 1000
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/public')));
app.set('view engine', 'ejs');

app.use(session({
    secret: process.env.SESSIONSECRET,
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
                let uuidFormattedToken = uuidv4().replace(/-/g, ''),
                    randomToken = Math.random().toString().substring(2)
                user = new User()
                user.email = email;
                user.password = password;
                user.firstName = req.body.firstName;
                user.lastName = req.body.lastName;
                user.state = req.body.state;
                user.activationToken = `${uuidFormattedToken}${randomToken}`
                user.save(function(err) {
                    if (err) console.log(err)
                    else {
                        done(null, user)
                        let transporter = nodemailer.createTransport({
                            host: "smtp.gmail.com",
                            port: 465, //587 is default,
                            secure: true, // true for 465, false for other ports
                            auth: {
                                user: process.env.EMAIL,
                                pass: process.env.PASSWORD
                            }
                        });
                        let mailOptions = {
                                from: '"Communiteam" <YusufTemitayoBadmos@gmail.com>',
                                to: "YusufTemitayoBadmos@gmail.com",
                                subject: "Communiteam Account Confirmation",
                                text: "Email",
                                html: `<div style="position: absolute;
                                margin: 60px 60px;
                                width: 500px;
                                height: 270px;
                                background-color: #f5f5f5"> 
                                    <p style="padding-top: 10px; padding-left: 10px; font-size: 16px; line-height: 1.5; font-family: Helvetica Neue, Helvetica, Arial, sans-serif">Hi ${user.firstName},</p>
                                    <p style="padding-left: 10px; font-size: 16px; line-height: 1.5; font-family: Helvetica Neue, Helvetica, Arial, sans-serif">Welcome aboard! Help us confirm it's you. Click the button below to activate your account.</p>
                                    <a href="http://127.0.0.1:3000/activateUser/${user.activationToken}" style="padding-left: 150px"><button style="color: #f5f5f5;
                                    border-radius: 4px;
                                    text-transform: uppercase;
                                    text-align: center;
                                    opacity: 1;
                                    background-color: #011B32;
                                    padding: 12px 30px;
                                    border: none;
                                    text-decoration: none" type="submit">Activate account</button></a> 
                                    <p style="font-size: 16px; padding-left: 10px; line-height: 1.5; font-family: Helvetica Neue, Helvetica, Arial, sans-serif">Doesn't seem to work? Copy the link below and paste in a browser.</p>
                                    <p style="padding-left: 10px">http://127.0.0.1:3000/activateUser/${user.activationToken}</p>
                                </div>`
                            }
                            // send mail with defined transport object
                        transporter.sendMail(mailOptions, (error, response) => {
                            if (error) console.log(error)
                            else console.log(response)
                        });
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

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const storage = cloudinaryStorage({
    cloudinary: cloudinary,
    folder: "profilePicture",
    allowedFormats: ["jpg", "png", "png"],
    transformation: [{ width: 500, height: 500, crop: "limit" }]
});

let imageFilter = function(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/i)) {
        return cb(new Error('Only JPG, JPEG, and PNG formats are supported'), false)
    }
    cb(null, true)
}

const parser = multer({ storage: storage, fileFilter: imageFilter });

app.get(['/', '/home'], (req, res) => {
    res.render('home');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.get('/activateUser/:activationToken', (req, res) => {
    let activationToken = req.params.activationToken;
    User.findOneAndUpdate({ activationToken }, { $set: { isActive: true } }, { new: true }, (err, user) => {
        if (err) console.log(err)
        else if (!user) console.log("Activation token does not exist"), res.redirect('/login')
        else {
            user.activationToken = undefined;
            user.save().then(() => {
                console.log('Account activated. Proceed to Login')
                res.redirect('/login')
            })
        }
    })
})

app.get('/login', (req, res) => {
    res.render('login')
});

app.get('/admin-register', (req, res) => {
    let user = req.user
    res.render('adminRegisteration', { user });
});

app.get('/activateAccount', isLoggedIn, (req, res) => {
    res.render('activateAccount');
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

app.get('/update', isLoggedIn, isActivated, (req, res) => {
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

app.get('/updateProfileDetails', isLoggedIn, isActivated, (req, res) => {
    User.findById(req.user.id)
        .then(() => {
            res.render('editProfile', { user: req.user })
        })
        .catch((err) => {
            console.log(err)
        })
})

app.get('/payment', isLoggedIn, isActivated, (req, res) => {
    res.render('payment');
});

app.get('/general', isLoggedIn, isActivated, (req, res) => {
    res.render('general');
});

app.get('/adminPost', isLoggedIn, isAdmin, hasCommunityName, isActivated, (req, res) => {
    res.render('adminPost')
})

app.post('/register',
    passport.authenticate('local-register', {
        failureRedirect: '/',
        successRedirect: '/activateAccount',
        failureFlash: true
    })
);

app.post('/login',
    passport.authenticate('local-login', {
        failureRedirect: '/',
        successRedirect: '/profile',
        failureFlash: true
    })
);

app.post('/createAdmin', isLoggedIn, isSuperAdmin, (req, res) => {
    let potentialAdmin = req.body.potentialAdmin;
    let userRoleArray = User.schema.path('role').enumValues;
    User.findOneAndUpdate({ email: potentialAdmin }, { $set: { role: userRoleArray[1] } }, { new: true }, (err, user) => {
        if (err) console.log(err);
        else if (!user) {
            console.log("Email not found! Only existing users can become admins!");
            res.redirect('back');
        } else {
            if (user.communityId === null && user.isActive) {
                let communityIdStorage = generateCommunityID();

                //check if communityId is Unique. Save it alongside its email.
                Community.findOne({ communityId: communityIdStorage }, (err, community) => {
                    if (community) console.log(`${community} exists. Make user admin again`), res.redirect('back')
                    else {
                        let newCommunity = new Community();
                        newCommunity.communityId = communityIdStorage;
                        newCommunity.communityCountFromInception = 1;
                        newCommunity.presentCommunityCount = newCommunity.communityCountFromInception
                        newCommunity.communityMembersEmail.push({ email: potentialAdmin })
                        newCommunity.save();

                        //save admin's newly generated communityId.
                        user.communityId = communityIdStorage;
                        user.houseId = newCommunity.communityCountFromInception;
                        user.save()
                        console.log(`${potentialAdmin} now has admin rights. CommunityID generated`);
                        res.redirect('back')
                    }
                })
            } else {
                console.log(`${potentialAdmin} now has admin rights. Already has communityID. Potential admins must be activated.`);
                res.redirect('back')
            }
        }
    })
});

app.post('/addCommunityUsers', isLoggedIn, isAdmin, (req, res) => {
    let communityId = req.user.communityId
    let email = req.body.communityUser.toLowerCase().trim();
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
            console.log(err);
        } else {
            console.log('User already exists in the community!')
        }
    })
});

app.post('/joinCommunity', isLoggedIn, isActivated, (req, res) => {
    let communityId = req.body.communityId.toLowerCase();
    let email = req.user.email;
    let secretCode = req.body.secretCode.toLowerCase().trim(); // will be used to transfer membership through members
    let predecessorEmail = req.body.predecessorEmail.toLowerCase().trim(); // to transfer membership to new members of the same house

    //ensure user provides an existing community and admin has added them to the community list.
    Community.findOne({ communityId, communityMembersEmail: { $elemMatch: { email } } }, (err, community) => {
        let communityName = community.communityName;
        if (err) console.log(err)
            // if the community exists and the user entered a predecessor email
        else if (community && predecessorEmail && secretCode) {
            ExCommunityMember.findOne({ predecessorEmail }, (err, exMember) => {
                // check if email provided is that of an ex community member
                if (exMember) {
                    let houseId = exMember.houseId;
                    if (secretCode === exMember.secretCode) {
                        community.communityCountFromInception = community.communityCountFromInception + 1;
                        community.presentCommunityCount = community.presentCommunityCount + 1;
                        community.save();

                        // update user details to those of predecessor
                        User.findOneAndUpdate({ email }, { $set: { communityId, communityName, houseId, secretCode: exMember.secretCode } }, { new: true }, (err, user) => {
                            console.log('communityId, houseId and secret code updated. Those of the predecessor were used.')
                            res.redirect('back')
                        });
                    } else {
                        console.log('Your secret code does not match with that of your predecessor')
                        res.redirect('back')
                    }
                } else {
                    console.log(err)
                }

            })
        } else if (community) {
            //update total number of users who have joined community (community count from inception) and the ones that presently remain
            community.communityCountFromInception = community.communityCountFromInception + 1;
            community.presentCommunityCount = community.presentCommunityCount + 1;
            community.save();

            //update user's community ID and increment houseID by 1
            let houseId = community.communityCountFromInception;
            User.findOneAndUpdate({ email }, { $set: { communityId, communityName, houseId } }, { new: true }, (err, user) => {
                if (user) console.log('communityId, houseId and community name updated'), res.redirect('back');
                else {
                    console.log(err)
                }
            });
        } else {
            console.log('Sorry, the communityId and your email do not match!')
            res.redirect('back')
        }
    })
});

app.post('/addCommunityName', isLoggedIn, isAdmin, isActivated, (req, res) => {
    let communityId = req.user.communityId,
        communityName = req.body.communityName;
    User.findByIdAndUpdate(req.user._id, { $set: { communityName } }, { new: true })
        .then((user) => {
            Community.findOneAndUpdate({ communityId }, { $set: { communityName } }, { new: true })
                .then((community) => {
                    console.log('community name added to community')
                    res.redirect('back')
                })
                .catch((err) => {
                    console.log('Internal server error when updating community details')
                })
        })
        .catch((err) => {
            console.log('Internal Server Error when trying to update user details')
        })

});

app.post('/updateProfileDetails', isLoggedIn, isActivated, parser.single("userPhoto"), function(req, res) {
    // if (err) {
    //     return res.status(500).send("Image must be PNG, JPEG, or JPG")
    // }
    // next();
    cloudinary.v2.uploader.upload(req.file.url, (error, response) => {
        if (error) {
            console.log(error)
            res.redirect('back')
        } else {
            let phone = req.body.phone,
                state = req.body.state,
                address = req.body.address,
                userPhoto = {};
            userPhoto.userPhotoURL = req.file.url;
            userPhoto.userPhotoID = req.file.public_id;
            secretCode = req.body.secretCode;
            User.findByIdAndUpdate(req.user.id, { $set: { phone, state, address, secretCode, userPhoto, accountIsUpdated: true } }, { new: true })
                .then((updatedUser) => {
                    console.log('User details updated')
                    res.redirect('/profile')
                })
                .catch((error) => {
                    console.log('Error occured, user details cannot be updated')
                    res.redirect('/back')
                })
        }
    })

})

app.post('/createAdminPost', isLoggedIn, isAdmin, (req, res) => {
    User.findById(req.user._id, (err, user) => {
        let title = req.body.title;
        let content = req.body.content;
        let amount = req.body.amount;
        let id = req.user._id;
        let email = req.user.email;
        let firstName = req.user.firstName;
        let lastName = req.user.lastName;
        let communityId = req.user.communityId;
        let communityName = req.user.communityName;
        let paymentIsCompulsory = JSON.parse(req.body.paymentIsCompulsory.toLowerCase());
        let updateAuthor = { id, email, firstName, lastName };

        let update = new Update({ title, content, amount, communityId, paymentIsCompulsory, updateAuthor });
        update.save().then((newUpdate) => {
            //check if update amount field is not empty or not of Non-Number type
            if (!isNaN(parseFloat(amount))) {
                User.find({ communityId }, (err, allCommunityUsers) => {
                    if (allCommunityUsers) {
                        // loop through communityUsers object
                        for (let individualUser in allCommunityUsers) {
                            if (allCommunityUsers.hasOwnProperty(individualUser)) {
                                let communityUser = allCommunityUsers[individualUser]
                                    // store payment details for all community users
                                let paymentId = newUpdate._id,
                                    paymentTitle = req.body.title,
                                    paymentIsCompulsory = JSON.parse(req.body.paymentIsCompulsory.toLowerCase());
                                console.log(paymentIsCompulsory)
                                console.log(typeof paymentIsCompulsory)
                                communityUser.paymentDetails.push({ paymentId, amount, paymentTitle, paymentIsCompulsory, communityId, communityName })
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
            // resolve save conflict. Solves the error: "VersionError: No matching document found for id {{mongoId}}"
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

app.post('/removeAdminBadge', isLoggedIn, isSuperAdmin, (req, res) => {
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
    let email = req.user.email,
        communityId = req.user.communityId,
        communityName = req.user.communityName,
        secretCode = req.user.secretCode,
        houseId = req.user.houseId;
    // check if the user has any payment they owe before allowing them leave
    User.findOne({ email, paymentDetails: { $elemMatch: { paymentStatus: false, paymentIsCompulsory: true, communityId } } })
        .then((user) => {
            if (user) res.redirect('/payment'), console.log('User is mandated to complete all compulsory payments')
            else {
                // remove user from community email list and update number of persons in communtiy
                Community.findOneAndUpdate({ communityId }, { $pull: { communityMembersEmail: { email } } }, { new: true })
                    .then((community) => {
                        community.presentCommunityCount = community.presentCommunityCount - 1
                        community.save();
                    })
                    .catch((err) => {
                        console.log(err);
                    });

                // forward users community details to the collection of users who have left different communities
                let exCommunityMember = new ExCommunityMember();
                exCommunityMember.email = email;
                exCommunityMember.communityId = communityId;
                exCommunityMember.communityName = communityName;
                exCommunityMember.secretCode = secretCode;
                exCommunityMember.houseId = houseId;
                exCommunityMember.save()

                // remove user from community. They still remain on the platform.
                let userRoleArray = User.schema.path('role').enumValues,
                    role = userRoleArray[0]
                User.findOneAndUpdate({ email }, { $set: { communityId: null, communityName: null, toPay: 0, role, houseId: null, secretCode: null, accountIsUpdated: false } }, { new: true })
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
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

function isSuperAdmin(req, res, next) {
    if (req.user.role === 'superAdmin') return next();
    res.send(req.user);
}

function isAdmin(req, res, next) {
    if (req.user.role === 'admin') return next();
    res.send(req.user);
};

function isActivated(req, res, next) {
    if (req.user.isActive) return next();
    res.send(req.user);
}

function hasCommunityName(req, res, next) {
    if (req.user.communityName !== null) return next()
    res.send(req.user);
}

function generateCommunityID() {
    return uuidv4().slice(-6).toLowerCase();
}

app.listen(PORT, () => {
    console.log(`listening on ${PORT}`)
});