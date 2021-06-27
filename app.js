const express = require('express'),
    app = express(),
    http = require('http'),
    server = http.Server(app),
    io = require('socket.io')(server),
    path = require('path'),
    _ = require('lodash'),
    cookieParser = require('cookie-parser'),
    cookie = require('cookie'),
    bodyParser = require('body-parser'),
    fs = require('fs'),
    session = require('express-session'),
    // mangoStore = require('connect-mongodb-session')(session),
    compression = require('compression');
    // store = new mangoStore({
    //     uri: process.env.NODE_ENV && process.env.NODE_ENV == 'production' ? process.env.MONGODB_URI : 'mongodb://localhost:27017/splody',
    //     collection: 'cmmSeshes'
    // });
app.use(compression());
// store.on('error', function (error) {
//     console.log(error);
// });
const sesh = session({
    secret: 'super secret that id normally replace in production'
});
app.use(sesh);
// app.use(passport.initialize());
// app.use(passport.session());
// passport.use(new LocalStrategy(usrModel.authenticate()))
// passport.serializeUser(usrModel.serializeUser());
// passport.deserializeUser(usrModel.deserializeUser());
app.use(cookieParser('spero eam beatam esse'))
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: '50mb' }));
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));
app.set('io', io)
// app.set('pp', passport)
const routes = require('./routes')(io);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));
app.use('/', routes);
// SOCKET STUFF
const socketConfig = require('./socket/socket-main'),
    sc = new socketConfig(io);
// io.on('connection', sc.handleSocket);
// console.log(sc)

const startServer = function () {
    server.listen(process.env.PORT || 9000);
    server.on('error', function (err) {
        console.log('Oh no! Err:', err)
    });
    server.on('listening', function (lst) {
        console.log('Server is listening!')
    });
    server.on('request', function (req) {
        // console.log(req.url);
    })
}
//if you're wondering why the server starting is in a separate function, it's because this server originally waited for a discord bot to start up (and report that it was running) before starting
startServer();


app.use(function (req, res, next) {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    console.log('Err:', err)
    res.send('Error!' + err)
});
