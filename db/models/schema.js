const validator = require('validator'),
    bcrypt = require('bcryptjs');

/* Local package(s)*/
const { mongoose } = require('../mongoose');
// mongoose.Promise = global.Promise; Uncomment if you're running a version of mongoose less than V5.
let Schema = mongoose.Schema;
let userSchema = new Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
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
        lowercase: true,
        validate: {
            isAsync: false,
            validator: passedEmail => validator.isEmail(passedEmail)
        },
        message: '{VALUE} is not a valid email'
    },
    isActive: {
        type: Boolean,
        default: false
    },
    activationToken: String,
    accountIsUpdated: {
        type: Boolean,
        default: false
    },
    phone: {
        type: String,
        minlength: 11,
        validate: {
            validator: phoneNumber => validator.isMobilePhone(phoneNumber)
        },
        message: '{VALUE} is not a valid mobile number'
    },
    address: {
        type: String,
        trim: true
    },
    state: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'superAdmin'],
        default: 'user'
    },
    toPay: {
        type: Number,
        default: 0
    },
    communityId: {
        type: String,
        default: null
    },
    userPhoto: {
        userPhotoURL: String,
        userPhotoID: String
    },
    houseId: Number,
    secretCode: {
        type: String,
        lowercase: true,
        default: null
    },
    communityName: {
        type: String,
        default: null
    },
    updates: [{
        type: Schema.Types.ObjectId,
        ref: 'Update'
    }],
    paymentDetails: [{
        paymentId: String,
        amount: Number,
        paymentTitle: String,
        paymentStatus: {
            type: Boolean,
            default: false
        },
        paymentIsCompulsory: {
            type: Boolean,
            default: false
        },
        paymentDate: Date,
        communityId: String,
        communityName: String
    }]
}, {
    timestamps: true
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
    communityId: String,
    paymentIsCompulsory: {
        type: Boolean,
        Default: false
    },
    updateAuthor: {
        id: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        email: String,
        firstName: String,
        lastName: String
    }
}, {
    timestamps: true
});

let communitySchema = new Schema({
    communityId: String,
    communityName: {
        type: String,
        default: null
    },
    communityMembersEmail: [{
        email: {
            type: String,
            lowercase: true
        }
    }],
    //Total number of people who have joined community till date
    communityCountFromInception: {
        type: Number,
        default: 0
    },
    //Number of people remaining in community. After other may have left.
    presentCommunityCount: Number
});

let exCommunityMemberSchema = new Schema({
    email: {
        type: String,
        lowercase: true
    },
    communityId: String,
    houseId: Number,
    secretCode: String,
    address: String
});

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
let Community = mongoose.model('Community', communitySchema);
let ExCommunityMember = mongoose.model('ExCommunityMember', exCommunityMemberSchema);

module.exports.User = User;
module.exports.Update = Update;
module.exports.Community = Community;
module.exports.ExCommunityMember = ExCommunityMember;