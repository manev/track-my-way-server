function initializeWebSocket() {

	var http = require('http');
	var socket = require('socket.io');
	var express = require('express');

	var app = express();	
	var server = http.createServer(app);
	var io = require('socket.io').listen(server);

	io.sockets.on('connection', function (socket) {
	    socket.on('event', function (data) {
	    	io.emit('this', data);
	        console.log(data);
	    });
	});
	return server;
};

module.exports = initializeWebSocket;