var jwt = require('jsonwebtoken');
const jwtKey = process.env.Secretkey;
require('dotenv').config({ path: './SECRET/config.env' })

function verify(req, res, next) {
    let accessToken = req.cookies.token

    //if there is no token stored in cookies, the request is unauthorized
    if (!accessToken) {
        res.redirect('/')
    }

    let payload
    try {
        //use the jwt.verify method to verify the access token
        //throws an error if the token has expired or has a invalid signature
        payload = jwt.verify(accessToken, jwtKey)
        next()
    } catch (e) {
        //if an error occured return request unauthorized error
        return res.status(401).send()
    }
}
module.exports = verify;