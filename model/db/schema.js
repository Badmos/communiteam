const mongoose = require('mongoose'),
    validator = require('validator'),
    bcrypt = require('bcryptjs');
// mongoose.Promise = global.Promise; Uncomment if you're running a version of mongoose less than V5.
let Schema = mongoose.Schema;
let userSchema = new Schema({
    firstName: {
        type: String,
        required: true,
        // unique: true
    },
    lastName: {
        type: String,
        required: true,
        // unique: true
    },
    password: {
        type: String,
        required: true,
        minlength: 1
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        validate: {
            isAsync: false,
            validator: passedEmail => validator.isEmail(passedEmail)
        },
        message: '{VALUE} is not a valid email'
    },
    // phone: {
    //     type: Number,
    //     required: true,
    //     minlength: 11,
    //     validate: {
    //         validator: phoneNumber => validator.isMobilePhone(phoneNumber)
    //     },
    //     message: '{VALUE} is not a valid mobile number'
    // },
    // address: {
    //     type: String,
    //     required: false
    // },
    state: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'superAdmin'],
        default: 'user'
    },
    toPay: Number,
    group: {
        type: String
    },
    updates: [{
        type: Schema.Types.ObjectId,
        ref: 'Update'
    }]
});

let updateSchema = new Schema({
    title: {
        type: String,
        // required: true
    },
    content: {
        type: String,
        // required: true
    },
    amount: Number,
    updateAuthor: {
        id: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        email: String
    }
})


userSchema.methods.correctPassword = function(password) {
    var user = this;
    return bcrypt.compareSync(password, user.password);
};

userSchema.pre("save", function(next) {
    user = this;
    if (user.isModified("password")) {
        bcrypt.genSalt(10, (err, salt) => {
            bcrypt.hash(user.password, salt, (err, hash) => {
                user.password = hash
                next()
            })
        })

    } else {
        next()
    }
});

let User = mongoose.model('User', userSchema);
let Update = mongoose.model('Update', updateSchema);

module.exports.User = User;
module.exports.Update = Update;