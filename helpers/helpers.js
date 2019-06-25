const uuidv4 = require('uuid/v4');

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

module.exports.isLoggedIn = isLoggedIn;
module.exports.isSuperAdmin = isSuperAdmin;
module.exports.isAdmin = isAdmin;
module.exports.isActivated = isActivated
module.exports.hasCommunityName = hasCommunityName
module.exports.generateCommunityID = generateCommunityID