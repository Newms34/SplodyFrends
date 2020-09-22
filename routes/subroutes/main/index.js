const express = require('express');
const router = express.Router(),
    _ = require('lodash'),
    // mongoose = require('mongoose'),
    axios = require('axios'),
    fs = require('fs');
// mongoose.Promise = Promise;


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
    router.get('/something',(req,res,next)=>{
        //get number of athletes starting at n
        mongoose.model('Athlete').find({},null,{sort:{date:-1}}).exec((err,aths)=>{
            console.log(err,aths)
            const st = req.query.n ||0,
            en = st+20;
            const athsOut =  aths && aths.length? aths.slice(st,en):[];
            res.send(athsOut)
        })
    })
    
    return router;
}

module.exports = routeExp;