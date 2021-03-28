const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const model = require('./model');
var jwt = require('jsonwebtoken');

require('dotenv').config({ path: './SECRET/config.env' })
const jwtKey = process.env.Secretkey;
const jwtExpirySeconds = 300;
router.post('/', (req, res) => {
    let loginuser = req.body.username;
    let loginpassword = req.body.password;
    model.findOne({ 'username': loginuser }, (err, user) => {
        if (user) {
            bcrypt.compare(loginpassword, user.password, function(err, result) {
                if (result) {

                    const token = jwt.sign({ 'id': user.id }, jwtKey, {
                        algorithm: "HS256",
                        expiresIn: jwtExpirySeconds,
                    })
                    res.cookie("token", token, { maxAge: jwtExpirySeconds * 1000 })
                    res.redirect('/home')

                } else {
                    res.redirect('/?error=' + encodeURIComponent('Password is InCorrect'))
                        // res.json("Password is InCorrect")

                }
            });
        } else {
            res.redirect('/?error=' + encodeURIComponent('Username is InCorrect'))
                // res.json("Username is InCorrect")
        }
    })

});










module.exports = router;