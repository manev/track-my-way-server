var socket = require('./src_/socket');
socket();

var main = require('./src_/main'); 
main.initialize();
main.start();