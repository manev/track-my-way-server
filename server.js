var main = require('./src/main'); 
var socket = require('./src/socket');

socket();

main.initialize();
main.start();

