function initializeWebSocket() {

	var http = require('http');
	var socket = require('socket.io');
	var express = require('express');

	var app = express();
	var server = http.createServer(app);
	var io = socket(server);
	io.on('connection', function (socket) {
	    socket.on('event', function (data) {
	        console.log(data);
	    });
	});
	//server.listen(3001);	
};

module.exports = initializeWebSocket;