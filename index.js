var express = require('express');
var exphbs = require('express-handlebars');
var bodyParser = require('body-parser')
var app = express();
const path = require('path');
const mongoose = require('mongoose');
const cookieParser = require("cookie-parser")
app.use(cookieParser())
var jwt = require('jsonwebtoken');
const port = process.env.PORT || 3000
require('dotenv').config({ path: './SECRET/config.env' })

const jwtKey = process.env.Secretkey;
mongoose.connect(process.env.Mongodb, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, (err) => {
    if (!err) {
        console.log("Database Connected");
    } else {
        console.log(err);
    }
});
app.use(bodyParser.urlencoded({ extended: false }))

app.use(express.static(path.join(__dirname, 'public')));

app.engine('hbs', exphbs({ extname: 'hbs', defaultLayout: 'main.hbs' }));
app.set('view engine', 'hbs');

app.use('/newuser', require('./createusers'))
app.use('/login', require('./login'))
app.get('/', function(req, res, next) {
    let token = req.cookies.token;
    res.render('index', { user: token });
});
app.get('/signup', function(req, res, next) {
    res.render('signup', { newuser: 'block' });
});

function verifymiddleware(req, res, next) {
    let token = req.cookies.token;
    if (!token) {
        res.redirect('/')
    } else {
        jwt.verify(token, jwtKey, function(err, decoded) {
            if (decoded) {
                next()
            }
        });

    }
}
app.get('/home', verifymiddleware, (req, res) => {
    res.render('secured_page', { layout: false })

})


app.get('/logout', (req, res) => {
    res.clearCookie("token");
    res.redirect('/')
});

app.listen(port);