/* URL Shorter By Pan Chen*/
'use strict'
const log = console.log
const bodyParser = require('body-parser')
const express = require('express')
const mongoose = require('./mongoose.js')
const schemas = require('./schemas.js')
const urlSchema = schemas.urlSchema
const userSchema = schemas.userSchema
const Url = mongoose.model('url', urlSchema, 'url')
const User = mongoose.model('user', userSchema, 'user')
const Bcrypt = require("bcryptjs")
const session = require('express-session')

const app = express()

app.use(express.static(__dirname + '/pub'))
app.use(bodyParser.urlencoded({
    extended: true
}))


app.use(bodyParser.json())
app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}))

app.use(express.static(path.join(__dirname, './client/build')))

app.get('*', function(_, res) {
  res.sendFile(path.join(__dirname, './client/build/index.html'), function(err) {
    if (err) {
      res.status(500).send(err)
    }
  })
})

// All routes other than above will go to index.html
app.get("/Login|/Signup|Test", (req, res) => {
    res.sendFile(__dirname + "/client/build/index.html")
})


// User
app.get("/user", (req, res) => {
    if (req.session.loggedin) {
        return res.status(200).json({ "type": 0, "user": req.session.user})
    }
    else {
        return res.status(200).json({ "type": 1, "user": null})
    }
})


app.post('/user', (req, res) => {

    if(!isValidPassword(req.body.password)) {
        return res.status(400).json({ "type": 2})
    }
    else {
        let user = new User({username: req.body.username, password: Bcrypt.hashSync(req.body.password, 10)})

        user.save().then(user => {
            return res.status(200).json({ "type": 0})
        })
        .catch(error => {
            if (error.name === 'MongoError' && error.code === 11000) {
                return res.status(400).json({ "type": 1})
            }
            else {
                return res.status(500).json({ "type": -1})
            }
        })
    }
})


app.put('/user', (req, res) => {
    if(!isValidPassword(req.body.newPassword)) {
        return res.status(400).json({ "type": 1})
    }
    else {
        req.body.newPassword = Bcrypt.hashSync(req.body.newPassword, 10)

        User.findOneAndUpdate({_id: req.session.user._id}, {$set:{password: req.body.newPassword}}).then(user => {
            return res.status(200).json({ "type": 0})
        })
        .catch(error => {
            return res.status(500).json({ "type": -1})
        })
    }
})


app.post('/auth', (req, res) => {
    User.findOne({username: req.body.user.username}, function(err, user) {
        if (user === null) {
            return res.status(404).json({'type': 1})
        }
        else if (!Bcrypt.compareSync(req.body.user.password, user.password)) {
            console.log("wrong password")
            return res.status(404).json({'type': 2})
        }
        else {
            req.session.loggedin = true
            req.session.user = {
                username: user.username,
                quote: user.quote,
                _id: user._id
            }
            return res.status(404).json({'type': 0})
        }
    })
    .catch(error => {
        return res.status(500).json({'type': -1})
    })
})

// Link
app.get('/link',function(req,res) {
    Url.find({'maker': req.session.user._id}, function(err, links){
        return res.status(200).json({'type': 0, 'data': links})
    })
    .catch(error => {
        return res.status(500).json({'type': -1})
    })
})


app.post('/link', (req, res) => {

    if(req.session.user.quote <= 0 ) {
        return res.status(200).json({'type': 1})
    }
    else if(!(/^[a-zA-Z0-9_-]+$/.test(req.body.shortUrl))) {
        return res.status(400).json({'type': 4})
    }
    else {
        if (!((req.body.fullUrl.indexOf("http://") == 0 || req.body.fullUrl.indexOf("https://") == 0))) {
            req.body.fullUrl = "http://" + req.body.fullUrl
        }
        if (!isValidUrl(req.body.fullUrl)) {
            return res.status(400).json({'type': 2})
        }
        let url = new Url(
            {
                fullUrl: req.body.fullUrl,
                shortUrl: req.body.shortUrl,
                maker: req.session.user._id
            })
        url.save(function (err, url) {
            if (err) {
                if (err.name === 'MongoError' && err.code === 11000) 
                {
                    return res.status(400).json({'type': 3})
                }
                else {
                    if (err) {
                        return res.status(500).json({'type': -1})
                    }
                }
            }
            else {
                User.findOneAndUpdate(
                    { '_id': req.session.user._id},
                    { '$inc': { 'quote': -1 } }, 
                    function (err, user) {
                        if (err) {
                            return res.status(500).json({'type': -1})
                        }
                        req.session.user.quote -= 1
                        return res.status(200).json({'type': 0, 'data': url})
                    }
                )
            }
            })  
    }
})


app.delete('/link', (req, res) => {
    Url.findOneAndRemove({_id : req.body._id, maker: req.session.user._id}, function (){
        //const username = url.maker
        User.findOneAndUpdate(
            { _id: req.session.user._id},
            { '$inc': { 'quote': +1 } }, 
            function () {
                req.session.user.quote += 1
                return res.status(200).json({'type': 0})
            }
        )
      })
      .catch(error => {
        return res.status(500).json({'type': -1})
      })
})


app.get('/hello', (req, res) => {
    console.log("Someone says hello")
    return res.send("3Q")
})


app.get('/:shortUrl([a-zA-Z0-9_-]+)', (req, res) => {
    const shorUrl = req.params.shortUrl
    Url.findOne(
        {
            shortUrl: shorUrl
        }, 
        function (err, url) 
        {
            if (err) return console.error(err)
            if (url == undefined) {
                res.redirect(302, "/")
                // res.send("nothing found")
            }
            else {
                const fullUrl = url.fullUrl
                res.redirect(302, fullUrl)
            }
        }
    
    )
})


// Helpers
function isValidUrl(value) {
    return /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(value)
}

function isValidPassword(value) {
    return /^[A-Za-z]\w{7,14}$/.test(value)
}




const port = process.env.PORT || 43030
app.listen(port, () => {
	log(`Listening on port ${port}...`)
})

if (process.env.NODE_ENV === 'production') {
    // Exprees will serve up production assets
    app.use(express.static('client/build'));
  
    // Express serve up index.html file if it doesn't recognize route
    const path = require('path');
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
    });
  }
