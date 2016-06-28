// initalize web socket object.
function initializeWebSocket() {

    var http = require('http');
    var socket = require('socket.io');
    var express = require('express');

    var app = express();
    var server = http.createServer(app);
    var io = require('socket.io').listen(server);
    var MongoClient = require('mongodb').MongoClient;
    var gcm = require('node-gcm');

    var user = "admin";
    var pass = "aC4yFiqqu6zY";

    var url = 'mongodb://localhost:27017/whereru';
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
                io.emit('log', "error connecting mongo");
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
                        io.sockets.sockets.forEach(function (s) {
                            if (s.user && s.user.Phone.Number === doc.Phone.Number)
                                doc.IsOnline = true;
                        });
                    results.push(doc);
                } else {
                    io.emit('get-all-registered-users-event', JSON.stringify(results));
                }
            });
        });
    }

    io.sockets.on('connection', function (socket) {
        socket.on('disconnect', function (e) {
            if (socket.user)
                io.emit('disonnect-user', JSON.stringify(socket.user));
        });

        socket.on("request-user-track", function (target) {
            var targetUser = JSON.parse(target);

            var senderRoom = socket.user.Phone.Number + "-send-position-event";
            socket.join(senderRoom);

            var requestUserEvent = targetUser.Phone.Number + "-request-user-event";
            io.in(targetUser.Phone.Number).emit(requestUserEvent, JSON.stringify(socket.user));
        });

        socket.on("request-user-track-result", function (target) {
            var targetUser = JSON.parse(target);

            if (targetUser.IsAccepted) {
                var room = socket.user.Phone.Number + "-send-position-event";
                socket.join(room);
            }

            var room = targetUser.SenderUser.Phone.Number;

            targetUser.SenderUser = socket.user;
            io.in(room).emit("request-user-event-result", JSON.stringify(targetUser));
        });

        socket.on("send-position-event", function (target, position) {
            var targetUser = JSON.parse(target);
            var room = targetUser.Phone.Number + "-send-position-event";
            io.in(room).emit("send-position-event", position);
        });

        socket.on("stop-user-tracking", function (target) {
            io.in(targetUser.Phone.Number).emit("stop-user-tracking", JSON.stringify(socket.user));
        });

        socket.on('loggin-user-event', function (data) {
            var user = JSON.parse(data);
            socket.join(user.Phone.Number);

            socket.user = user;
            socket.user.IsOnline = true;

            emitUsers();
        });

        socket.on('add-user-event', function (data) {
            mongoOp(function (db) {
                db.collection('users').insert(JSON.parse(data), function (err, result) {
                    if (err) {
                        io.emit('log', "error connection to users");
                        console.log(err);
                    }
                });
            });
        });

        socket.on('user-registration-key', function (data) {
            var payload = JSON.parse(data);
            mongoOp(function (db) {
                db.collection('push-registration').update({ phoneNumber: payload.phoneNumber }, payload, { upsert: true }, function (err, result) {
                    if (err) {
                        io.emit('log', "error connection to users");
                        console.log(err);
                    }
                });

                // db.collection('push-registration').remove({ phoneNumber: payload.phoneNumber }, 1, function (err, result) {
                //     if (!err)
                //         db.collection('push-registration').insert(payload, function (err, result) {
                //             if (err) {
                //                 io.emit('log', "error connection to users");
                //                 console.log(err);
                //             }
                //         });
                // });
            });
        });

        socket.on('sender-user-push', function (data) {
            var targetUser = JSON.parse(data);

            mongoOp(function (db) {
                var cursor = db.collection('push-registration').find({ phoneNumber: targetUser.Phone.Number });

                cursor.each(function (err, doc) {
                    if (err) {
                        console.log(err);
                    } else if (doc != null) {
                        var message = new gcm.Message({
                            data: { key1: 'msg1' }
                        });

                        // Set up the sender with you API key, prepare your recipients' registration tokens.
                        var sender = new gcm.Sender('AIzaSyAew8rDZygmnQ1aHPKgNG1UaBOqW02HAfs');

                        var regTokens = [doc.key];

                        sender.send(message, { registrationTokens: regTokens }, function (err, response) {
                            if (err)
                                console.error(err);
                            else
                                console.log(response);
                        });
                    }
                });
            });
        });

        socket.on('ping', function () {
            if (socket.user)
                io.emit('ping-back', JSON.stringify(socket.user));
        });
    });
    return server;
};

module.exports = initializeWebSocket;