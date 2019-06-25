const express = require('express'),
    router = express.Router(),
    cloudinary = require('cloudinary')
mongoose = require('mongoose');

// Local Packages
const passport = require('../config/passport'),
    { User, Update, Community, ExCommunityMember } = require('../db/models/schema'),
    { isLoggedIn, isSuperAdmin, isAdmin, isActivated, hasCommunityName, generateCommunityID } = require('../helpers/helpers'),
    { parser } = require('../config/config');


router.route(['/', '/home'])
    .get((req, res) => {
        res.render('home');
    });

router.route('/register')
    .get((req, res) => {
        res.render('register');
    });

router.route('/activateUser/:activationToken')
    .get((req, res) => {
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

router.route('/login')
    .get((req, res) => {
        res.render('login')
    });

router.route('/admin-register')
    .get((req, res) => {
        let user = req.user
        res.render('adminRegisteration', { user });
    });



router.route('/activateAccount')
    .get(isLoggedIn, (req, res) => {
        res.render('activateAccount');
    });

router.route('/profile')
    .get(isLoggedIn, (req, res) => {
        res.render('profile', {
            user: req.user
        });
    });

router.route('/update')
    .get(isLoggedIn, isActivated, (req, res) => {
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



router.route('/updateProfileDetails')
    .get(isLoggedIn, isActivated, (req, res) => {
        User.findById(req.user.id)
            .then(() => {
                res.render('editProfile', { user: req.user })
            })
            .catch((err) => {
                console.log(err)
            })
    })



router.route('/payment')
    .get(isLoggedIn, isActivated, (req, res) => {
        res.render('payment');
    });



router.route('/general')
    .get(isLoggedIn, isActivated, (req, res) => {
        res.render('general');
    });

router.route('/adminPost')
    .get(isLoggedIn, isAdmin, hasCommunityName, isActivated, (req, res) => {
        res.render('adminPost')
    });

router.route('/register')
    .post(passport.authenticate('local-register', {
        failureRedirect: '/',
        successRedirect: '/activateAccount',
        failureFlash: true
    }));

router.route('/login')
    .post(passport.authenticate('local-login', {
        failureRedirect: '/',
        successRedirect: '/profile',
        failureFlash: true
    }));

router.route('/createAdmin')
    .post(isLoggedIn, isSuperAdmin, (req, res) => {
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

router.route('/addCommunityUsers')
    .post(isLoggedIn, isAdmin, (req, res) => {
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

router.route('/joinCommunity')
    .post(isLoggedIn, isActivated, (req, res) => {
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

router.route('/addCommunityName')
    .post(isLoggedIn, isAdmin, isActivated, (req, res) => {
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

router.route('/updateProfileDetails').post(isLoggedIn, isActivated, parser.single("userPhoto"), function(req, res) {
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

router.route('/createAdminPost')
    .post(isLoggedIn, isAdmin, (req, res) => {
        User.findById(req.user._id, (err, user) => {
            let title = req.body.title,
                content = req.body.content,
                amount = req.body.amount,
                id = req.user._id,
                email = req.user.email,
                firstName = req.user.firstName,
                lastName = req.user.lastName,
                communityId = req.user.communityId,
                communityName = req.user.communityName,
                paymentIsCompulsory = JSON.parse(req.body.paymentIsCompulsory.toLowerCase()),
                updateAuthor = { id, email, firstName, lastName };

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

router.route('/removeAdminBadge')
    .post(isLoggedIn, isSuperAdmin, (req, res) => {
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

router.route('/leaveCommunity')
    .post(isLoggedIn, (req, res) => {
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
    });

router.route('/logout')
    .get((req, res) => {
        req.logout();
        res.redirect('/login')
    });

router.route('*')
    .get((req, res) => {
        res.render('404');
    });

module.exports = router;