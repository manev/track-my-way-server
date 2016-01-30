function initializeWebSocket() {

	var http = require('http');
	var socket = require('socket.io');
	var express = require('express');

	var app = express();	
	var server = http.createServer(app);
	var io = require('socket.io').listen(server);
	var MongoClient = require('mongodb').MongoClient;

	var user = "admin";
	var pass = "aC4yFiqqu6zY";

	var url = 'mongodb://localhost:27017/whereru';
	if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD){
		url = 'mongodb://' + process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
					process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
				  	process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
					process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
					process.env.OPENSHIFT_APP_NAME;
	}

	function mongoOp(func){
		MongoClient.connect(url, function(err, db) {
    		io.emit('log', "mongo connected");
    		io.emit('log', "err == " + err === null);

			if(err) {
				console.log("error: " + func.toString());	
			} else {
				db.authenticate(user, pass, function(args){
    				io.emit('log', "user authenticated");
					func(db);
    			});	
			}
    	});
	}

	io.sockets.on('connection', function (socket) {
		socket.on('android', function (data) {
	    	io.emit('send-wp', data);
	    });

	    socket.on('wp', function (data) {
	    	io.emit('send-android', data);
	    });

	    socket.on("request-user-track", function(target){
			var targetUser = JSON.parse(target);

	    	var senderRoom = socket.user.Phone.Number + "-send-position-event";
	    	socket.join(senderRoom);

	    	var requestUserEvent = targetUser.Phone.Number + "-request-user-event";
	    	io.in(requestUserEvent).emit(requestUserEvent, JSON.stringify(socket.user));
	    });

	    socket.on("request-user-track-result", function(target){
			var targetUser = JSON.parse(target);

	    	if(targetUser.IsAccepted){
	    		var room = socket.user.Phone.Number + "-send-position-event";
	    		socket.join(room);
	    	}

	    	var room = targetUser.SenderUser.Phone.Number + "-request-user-event";

	    	targetUser.SenderUser = socket.user;
	    	io.in(room).emit("request-user-event-result", JSON.stringify(targetUser));
	    });

		socket.on("send-position-event", function(target, position){
			var targetUser = JSON.parse(target);
	    	var room = targetUser.Phone.Number + "-send-position-event";
	    	io.in(room).emit("send-position-event", position);
		});

	    socket.on('loggin-user-event', function(data){
	    	var user = JSON.parse(data);
	    	var requestUserEvent = user.Phone.Number + "-request-user-event";
	    	socket.join(requestUserEvent);

	    	socket.user = user;

	    	mongoOp(function(db){
	    		var cursor = db.collection('names').find();
	    		var results = [];
	    		cursor.each(function(err, doc){
	    			if(err) {
	    				console.log(err);
	    			} else if(doc != null) {
	    				results.push(doc);
	    			} else {
				    	io.emit('get-all-registered-users-event', JSON.stringify(results));		
	    			}
	    		});
	    	});
	    });

	    socket.on('add-user-event', function(data){	
    		io.emit('log', "add-user-event");
	    	mongoOp(function(db){
    			io.emit('log', "before insert into users");
    			io.emit('log', "db: " + db === null || db === undefined);
    			io.emit('log', "db.collection: " + db.collection === null || db.collection === undefined);
	    		db.collection('users').insertOne(JSON.parse(data), function(err, result){
    				io.emit('log', "insert user");
					if(err) {
    					io.emit('log', "error connection to users");
						console.log(err);
					}		
				});
    			io.emit('log', "after insert into users");
	    	});
	    });
	});
	return server;
};

module.exports = initializeWebSocket;