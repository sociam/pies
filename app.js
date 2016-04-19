/* jshint strict:false */
/* global console, require, process */

// window.auth('http://hip.cat/emax','foo').then((x) => console.log('ok ', x));
// window.posti('castvote', {ballot:'http://hillary.com/#clinton'}).then((x) => console.log('ok ', x))
// window.geti('castvote').then((x) => console.log('ok ', x))

var express = require('express'),
	app = express(),
	http = require('http'),
	server = http.createServer(app),
	io = require('socket.io')(server),
	_ = require('lodash'),
	Promise = require('bluebird'),
	mongo = require('mongodb-bluebird'),
	bodyParser = require('body-parser'),
	fs = require('fs'),	
	config_file = process.argv.length > 2 ? process.argv[2] : './config.json',
	config = JSON.parse(fs.readFileSync(config_file)),
	cookieParser = require('cookie-parser'),
	snet = require('./net'),
	scrypto = require('./crypto'),
	sauth = require('./auth'),
	socketio = require('socket.io'),
	host_key;

console.info('initialising with config ', config_file);
// set up middleware

// connect to the db -- which is at config.db
console.log('PIES instance:', config.id, ' port:', config.port, ' database:', config.db);

// key management -->
if (config.privkey === undefined) { 
	// const out_file = [config_file,'-key.json'].join('');
	config.privkey = scrypto.create_keypair().toPrivatePem().toString();
	fs.writeFileSync(config_file, JSON.stringify(config, null, 4));
	console.info('No private key, creating one for you and it writing to ', config_file, JSON.stringify(config, null, 4));	
}
host_key = scrypto.loadKey(config.privkey);

snet.connect(host_key).then((db) => {
	// snet kicks things off!
	snet.register(app, io, db, host_key);
	sauth.register(app, db, host_key); // register auth	
});

// cors
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// register middleware
app.use(bodyParser.json()); // for parsing application/json
app.use(cookieParser());
app.use('/', express.static('www'));

// http.createServer(app).listen(3000);
server.listen(config.port, function() { });
