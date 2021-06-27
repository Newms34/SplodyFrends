const express = require('express');
const router = express.Router();

const routeExp = function (io) {
    this.authbit = (req, res, next) => {
        if (req.session && req.session.user && req.session.user._id) {
            if (req.session.user.isBanned) {
                res.status(403).send('banned');
            }
            next();
        } else {
            res.status(401).send('err')
        }
    };    
    return router;
}

module.exports = routeExp;