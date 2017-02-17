// initalize web socket object.
function initializeWebSocket() {

    var http = require('http');
    var socket = require('socket.io');
    var express = require('express');
    var pushService = require('./push-service');

    var app = express();
    var server = http.createServer(app);
    var io = require('socket.io').listen(server, {
        origins: '*:*'
    });
    io.set("origins", "*:*");
    var MongoClient = require('mongodb').MongoClient;
    var gcm = require('node-gcm');

    var user = "admin";
    var pass = "aC4yFiqqu6zY";

    var userSocketsMap = {};
    var currentUserSessions = {};
    var currentWebSessions = {};

    var allowCrossDomain = function (req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS");
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
        next();
    }

    app.use("/*", allowCrossDomain);

    var url = 'mongodb://127.0.0.1:27017/whereru';
    if (process.env.OPENSHIFT_MONGODB_DB_PASSWORD) {
        url = 'mongodb://' + process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
            process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
            process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
            process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
            process.env.OPENSHIFT_APP_NAME;
    }

    function mongoOp(func) {
        MongoClient.connect(url, function (err, db) {
            if (err) {
                console.log("error: " + func.toString());
                io.emit('log', "error connecting mongo. Error: " + err.message + "; stack: " + err.stack);
            } else {
                db.authenticate(user, pass, function (args) {
                    func(db);
                });
            }
        });
    }

    function emitUsers() {
        mongoOp(function (db) {
            var cursor = db.collection('users').find();
            var results = [];
            cursor.each(function (err, doc) {
                if (err) {
                    console.log(err);
                } else if (doc != null) {
                    if (!doc.IsOnline)
                        Object.keys(io.sockets.sockets).forEach(function (s) {
                            var socket = io.sockets.sockets[s];
                            if (socket.user && socket.user.Phone.Number === doc.Phone.Number)
                                doc.IsOnline = true;
                        });
                    results.push(doc);
                } else {
                    io.emit('get-all-registered-users-event', JSON.stringify(results));
                }
            });
        });
    }

    function disposeUser(user) {
        delete userSocketsMap[user.Phone.Number];
        io.emit('disonnect-user', JSON.stringify(user));
    }

    io.sockets.on('connection', function (socket) {
        socket.on('disconnect', function (e) {
            if (socket.user) {
                socket.user.IsOnline = false;
                if (socket.user.hasRequestStarted) {
                    setTimeout(function () {
                        if (!userSocketsMap[socket.user.Phone.Number].user.IsOnline)
                            disposeUser(socket.user);
                    }, 15000);
                } else {
                    disposeUser(socket.user);
                }
            }
            if (socket["tracked-room"]) {
                const ns = socket["tracked-room"];
                currentWebSessions[ns].count = --currentWebSessions[ns].count;
                const num = ns.split('-')[0];
                if (num && userSocketsMap[num])
                    userSocketsMap[num].emit("active-web-user-in-session", currentWebSessions[ns].count);
            }
        });

        socket.on("request-user-track", function (target) {
            if (socket.user.hasRequestStarted) {
                socket.emit("user-has-request-started", target);
                return;
            }
            socket.user.hasRequestStarted = true;
            var targetUser = JSON.parse(target);
            var userSocket = userSocketsMap[targetUser.Phone.Number];
            if (userSocket) {
                if (userSocket.user.hasRequestStarted) {
                    socket.emit("user-has-request-started", JSON.stringify(targetUser));
                } else {
                    userSocket.user.hasRequestStarted = true;
                    userSocket.emit("request-user-event", JSON.stringify(socket.user));
                }
            } else {
                socket.emit("disonnect-user", JSON.stringify(targetUser));
            }
        });

        socket.on("request-user-track-result", function (target) {
            var targetUser = JSON.parse(target);
            var targetSocket = userSocketsMap[targetUser.SenderUser.Phone.Number];

            targetUser.SenderUser = socket.user;
            if (targetSocket) {
                if (!targetUser.IsAccepted) {
                    targetSocket.user.hasRequestStarted = false;
                    socket.user.hasRequestStarted = false;
                }
                targetSocket.emit("request-user-event-result", JSON.stringify(targetUser));
            } else {
                socket.emit("disonnect-user", JSON.stringify(targetUser));
            }
        });

        socket.on("send-position-event", function (target, position, ns) {
            if (ns) {
                if (currentWebSessions[ns]) {
                    const args = JSON.stringify({
                        target: target,
                        position: position
                    });
                    socket.broadcast.in(ns).emit("send-position-event", args);
                    // currentWebSessions[ns].sockets.forEach(function (s) {
                    //     s.emit("send-position-event", args);
                    // });
                }
            } else {
                var targetUser = JSON.parse(target);
                var targetSocket = userSocketsMap[targetUser.Phone.Number];
                if (targetSocket) {
                    targetSocket.emit("send-position-event", position);
                } else {
                    socket.emit("disonnect-user", JSON.stringify(targetUser));
                }
            }
        });

        socket.on("stop-user-tracking", function (target) {
            const targetUser = JSON.parse(target);
            const targetSocket = userSocketsMap[targetUser.Phone.Number];
            if (targetUser["tracked-room"]) {
                delete currentWebSessions[targetUser["tracked-room"]];
            }
            if (targetSocket && targetSocket.user && socket.user) {
                targetSocket.user.hasRequestStarted = false;
                socket.user.hasRequestStarted = false;
                targetSocket.emit("stop-user-tracking", JSON.stringify(socket.user));
            } else {
                socket.emit("disonnect-user", JSON.stringify(targetUser));
            }
        });

        socket.on("loggin-user-event", function (data, callback) {
            const user = JSON.parse(data);

            socket.user = user;
            socket.user.IsOnline = true;

            userSocketsMap[user.Phone.Number] = socket;

            emitUsers();

            callback();
        });

        socket.on("add-user-event", function (data, callback) {
            mongoOp(function (db) {
                db.collection('users').insert(JSON.parse(data), function (err, result) {
                    if (err) {
                        io.emit('log', "error connection to users");
                        console.log(err);
                        callback(JSON.stringify(err));
                    }
                    callback(JSON.stringify({
                        status: "Ok"
                    }));
                });
            });
        });

        socket.on("sender-user-push", function (args, callback) {
            pushService(args, socket.user, function (err) {
                callback(err);
            });
        });

        socket.on("ping-me", function () {
            if (socket.user)
                io.emit("ping-back", JSON.stringify(socket.user));
        });

        socket.on("web-register-listener", function (ns) {
            const num = ns.split('-')[0];
            if (num && userSocketsMap[num]) {
                socket["tracked-room"] = ns;
                socket.join(ns);
                if (currentWebSessions[ns])
                    currentWebSessions[ns].count = ++currentWebSessions[ns].count;
                else
                    currentWebSessions[ns] = {
                        count: 1
                    };
                userSocketsMap[num].emit("active-web-user-in-session", currentWebSessions[ns].count);
            }
        });
    });
    return server;
};

module.exports = initializeWebSocket;