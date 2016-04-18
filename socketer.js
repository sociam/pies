
/* jshint strict:false */
/* global console, require, process */

var _ = require('lodash'),
	Promise = require('bluebird'),
	mongo = require('mongodb-bluebird'),
	mongolog = require('mongo-oplog'),
	fs = require('fs'),	
	config_file = process.argv.length > 2 ? process.argv[2] : './config.json',
	config = JSON.parse(fs.readFileSync(config_file)),
	url = require('url'),
	config = JSON.parse(fs.readFileSync(config_file)),	
	os = require('os'),
	request = require('request-promise'),	
	crypto = require('./crypto'),
	sockets = [],
	db, tracker, peers;

var SocketHandler = function(app, socket) { 
	var this_ = this;
	this.app = app;
	socket.on('message', function (data) {	

		// should give us an object { username: id, password: "ok".encrypted(private_key) } 
		if (data && data.type == 'auth' && data.id && data.challenge ) { 
			this_.checkAuth(data.id, data.challenge).then((result) => {
				if (result) {
					this_.authenticated = data.id;
				}
			});
		}
	});	
	socket.on('disconnect', () => {
		console.info("got disconnect! getting rid of socket ", socket);
		sockets = sockets.filter((x) => x !== socket);
	});
};

SocketHandler.prototype = {
	check_auth:function(userid, challenge) {
		return require('./net').getPublicKey(userid).then((pkey) => {
			if (pkey) {
				var pubkey = crypto.loadPublicKey(pkey),
					result = crypto.pubDecrypt(pubkey, challenge);
				console.log('result of decrypting ', result);
				if (result === 'challenge') return true;
				return false;
			}
			throw Error("No Public Key for user " + userid);
		});
	}
};

module.exports = {
	register:(app, db, io) => { 
		db = db;
		io.on('connection', function (socket) {
			var s = new SocketHandler(app, socket);
			sockets.push(s);
		});
	}
};
