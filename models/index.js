const mongoose = require('mongoose'),
	http = require('https');
require('./athletes/');
console.log('Node Environment:', process.env.NODE_ENV)
if (!process.env.NODE_ENV || process.env.NODE_ENV != 'production') {
    //just some quick env check. If we're developing locally, go ahead and use our local db. Otherwise, use the mlab db.
    console.log('using LOCAL database!')
    mongoose.connect('mongodb://localhost:27017/splody',{ useNewUrlParser: true,useUnifiedTopology:true });
} else {
    mongoose.connect(process.env.MONGODB_URI,{ useNewUrlParser: true,useUnifiedTopology:true });
}
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function(e) {
    console.log('Database connected!')
})
