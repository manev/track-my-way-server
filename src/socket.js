function initializeWebSocket() {

	var http = require('http');
	var socket = require('socket.io');
	var express = require('express');

	var app = express();	
	var server = http.createServer(app);
	var io = require('socket.io').listen(server);

	io.sockets.on('connection', function (socket) {

		socket.on('android', function (data) {
	    	io.emit('send-wp', data);
	    });

	    socket.on('wp', function (data) {
	    	io.emit('send-android', data);
	    });
	});
	return server;
};

module.exports = initializeWebSocket;