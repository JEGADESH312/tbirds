const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const model = require('./model')
router.post('/', (req, res) => {
    model.findOne({ 'username': req.body.username }, (err, existuser) => {
        if (!existuser) {
            var numSaltRounds = 10;
            bcrypt.genSalt(numSaltRounds, function(err, salt) {
                bcrypt.hash(req.body.password, salt, function(err, hash) {
                    var newuser = new model({
                        username: req.body.username,
                        email: req.body.email,
                        password: hash
                    })
                    newuser.save().then(data => {
                        res.redirect('/')
                    })

                });
            });
        } else {
            res.redirect('/signup?createuser_error=' + encodeURIComponent('username alreay taken'))
        }
    })

})

module.exports = router;