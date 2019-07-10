const passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    uuidv4 = require('uuid/v4')
nodemailer = require('nodemailer');

// Local Packages
const { User } = require('../db/models/schema');

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
                // replace all instances of a '-' with an empty string.
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

module.exports = passport;