function initializeWebSocket() {

	var http = require('http');
	var socket = require('socket.io');
	var express = require('express');

	var app = express();	
	var server = http.createServer(app);
	var io = require('socket.io').listen(server);
	var MongoClient = require('mongodb').MongoClient;

	var url = 'mongodb://localhost:27017/users';

	io.sockets.on('connection', function (socket) {

		socket.on('android', function (data) {
	    	io.emit('send-wp', data);
	    });

	    socket.on('wp', function (data) {
	    	io.emit('send-android', data);
	    });

	    if(socket.handshake.query.number){
	    	socket.on(socket.handshake.query.number, function(userSender){
	    		io.emit("request-track-result", userSender);
	    	});
	    }

	    socket.on('loggin-user-event', function(data){
	    	MongoClient.connect(url, function(err, db) {
	    		if(err) {
					console.log(err);
				} else {
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
				}
	    	});
	    });

	    socket.on('add-user-event', function(data){	
	    	MongoClient.connect(url, function(err, db) {
	    		if(err) {
					console.log(err);
				} else {
		    		db.collection('names').insertOne(JSON.parse(data), function(err, result){
						if(err) {
							console.log(err);
						}		
					});
				}
			});
	    });
	});
	return server;
};

module.exports = initializeWebSocket;