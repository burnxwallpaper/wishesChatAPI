const express = require('express');
//const jwt = require('jsonwebtoken')
function routes(Account) {
    const accountRouter = express.Router();

    //security token check
    /*accountRouter.use(('/account'), (req, res, next) => {
        let token = req.get("token")
        if (req.method === "POST") { return next(); }
        Account.findOne({ token: token }, (err, account) => {
            if (err) {
                return res.send(err);
            }
            if (account && account.token) {
                req.account = account;
                return next();
            }
            else return res.status(404).json("token invalid");
        });
    })*/

    accountRouter.route('/')

        .get((req, res) => {
            let query = {}
            Account.find(query, (err, account) => {
                if (err) {
                    return res.send(err);
                }
                return res.json(account)
            })

        })
        .post((req, res) => {

            Account.findOne({
                username: req.body.username
            }, function (err, user) {
                if (err) throw err

                if (!user) {
                    res.json({ success: false, message: 'Authenticate failed. User not found' })
                } else if (user) {
                    if (user.password != req.body.password) {
                        res.json({ success: false, message: 'Authenticate failed. Wrong password' })
                    } else {
                        //let token = jwt.sign(JSON.parse(JSON.stringify(user.password + user.username + Math.random())), "secret")

                        //user.token = token
                        //user.save();
                        res.json({
                            success: true,
                            username: user.username,
                            //token: token
                        })
                    }
                }
            })
        });
    //create account
    /*accountRouter.route('/create')
        .post((req, res) => {
            Account.findOne(
                {
                    username: req.body.username
                },
                function (err, user) {
                    if (err) throw err

                    if (user) {
                        return res.json({ success: false, message: 'This username is used' })
                    }
                    const account = new Account(req.body);
                    account.save();
                    return res.status(201).json(account);
                }
            )
        })*/

    //token check
    /*accountRouter.use('/account/:accountId', (req, res, next) => {
        Account.findById(req.params.accountId, (err, account) => {
            if (err) {
                return res.send(err);
            }
            if (account) {
                let token = req.get("token")

                if (account.token === token) {
                    req.account = account;
                    return next();
                }
                else return res.status(404).json("token invalid");
            }

            //req.account = account;
            //return next();

            else return res.sendStatus(404);
        })
    })*/

    accountRouter.route('/:accountId')
        .get((req, res) => {
            res.json(req.account);
        })
    //modify account info
    /*.put((req, res) => {
        const { account } = req;
        account.username = req.body.username
        account.password = req.body.password;
        account.admin = req.body.admin;
        account.history = req.body.history;
        account.information = req.body.information;
        account.save();

        return res.sendStatus(201);
    })*/


    /*.delete((req, res) => {
        req.account.remove((err) => {
            if (err) {
                return res.send(err);
            }
            return res.sendStatus(204);
        })

    })*/


    return accountRouter
}

module.exports = routes;