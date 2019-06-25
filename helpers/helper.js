exports.isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

exports.isSuperAdmin = (req, res, next) => {
    if (req.user.role === 'superAdmin') return next();
    res.send(req.user);
}

exports.isAdmin = (req, res, next) => {
    if (req.user.role === 'admin') return next();
    res.send(req.user);
};

exports.isActivated = (req, res, next) => {
    if (req.user.isActive) return next();
    res.send(req.user);
}

exports.hasCommunityName = (req, res, next) => {
    if (req.user.communityName !== null) return next()
    res.send(req.user);
}

exports.generateCommunityID = () => {
    return uuidv4().slice(-6).toLowerCase();
}