const express = require('express');
const router = express.Router();

module.exports = function (io) {
    //io here is socketio. I'm including it just in case we might need to add, for example, a "your athlete just got updated!" notice
    router.use('/main', require('./subroutes/main')(io));

    router.get('/alive', function (req, res, next) {
        //hb for making sure we're still alive
        res.send(true)
    })
    router.get('*', function (req, res, next) {
        res.sendFile('index.html', { root: './views' })
    });
    router.use(function (req, res) {
        res.status(404).end();
    });
    return router;
};

//helper stuff
Array.prototype.findOne = function (p, v) {
    let i = 0;
    if (typeof p !== 'string' || !this.length) {
        return false;
    }
    for (i; i < this.length; i++) {
        if (this[i][p] && this[i][p] == v) {
            return i;
        }
    }
    return false;
}

Array.prototype.removeOne = function (n) {
    this.splice(this.indexOf(n), 1);
}
