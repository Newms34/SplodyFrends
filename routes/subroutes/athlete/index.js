const express = require('express');
const router = express.Router(),
    _ = require('lodash'),
    mongoose = require('mongoose'),
    axios = require('axios'),
    fs = require('fs');
mongoose.Promise = Promise;


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
    router.get('/athlete',(req,res,next)=>{
        //get number of athletes starting at n
        mongoose.model('Athlete').find({},null,{sort:{date:-1}}).exec((err,aths)=>{
            console.log(err,aths)
            const st = req.query.n ||0,
            en = st+20;
            const athsOut =  aths && aths.length? aths.slice(st,en):[];
            res.send(athsOut)
        })
    })
    router.post('/athlete',(req,res,next)=>{
        mongoose.model('Athlete').create(req.body,function(err,c){
            console.log(err)
            if(err){
                return res.status(400).send(err);
            }
            res.send('done');
        })
    })
    //normally I'd make this a DELETE request. But the requirements requested a PUT request. This is the only place I can reasonably see doing that.
    router.put('/athlete',(req,res,next)=>{
        if(!req.query.id){
            return res.status(400).send('err');
        }
        mongoose.model('Athlete').findByIdAndDelete({_id:req.query.id},function(err,rem){
            if(err){
                return res.status(400).send('err');
            }
            res.send('done');
        })
    })
    return router;
}

module.exports = routeExp;