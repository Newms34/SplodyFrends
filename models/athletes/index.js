const mongoose = require('mongoose'),
    crypto = require('crypto');

const athleteSchema = new mongoose.Schema({
    name: String, 
    nationality:String,
    location:String,
    gender:String,
    birth:Number,//NOT dob, which is the raw date obj
    sports:[String],
    association:String,
    about:String,
    interests:String,
    charities:String,
    pets:String,
    married:Number,
    drinks:Number,
    img:String,
    social:{
        facebook:String,
        linkedin:String,
        twitter:String,
        instagram:String,
        youtube:String,
        twitch:String,
        snapchat:String
    }
    
}, { collection: 'Athlete' });

//disabled user model stuff! 
// const generateSalt = function() {
//     return crypto.randomBytes(16).toString('base64');
// },encryptPassword = function(plainText, salt) {
//     const hash = crypto.createHash('sha1');
//     hash.update(plainText);
//     hash.update(salt);
//     return hash.digest('hex');
// };
// athleteSchema.statics.generateSalt = generateSalt;
// athleteSchema.statics.encryptPassword = encryptPassword;
// athleteSchema.methods.correctPassword = function(candidatePassword) {
//     // console.log('slt', this.salt, 'and their pwd:', this.pass)
//     return encryptPassword(candidatePassword, this.salt) === this.pass;
// };

mongoose.model('Athlete', athleteSchema);