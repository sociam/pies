/* jshint strict:false */
/* global console, require */

var crypto = require('crypto'),ursa = require('ursa');

var exports = module.exports = {
	create_keypair : () => ursa.generatePrivateKey(1024, 65537),
	getPublicKey : (key) => key.toPublicPem().toString(),
	loadKey:(priv_pem) => ursa.createPrivateKey(priv_pem),
	loadPublicKey:(pub_pem) => ursa.createPublicKey(pub_pem),
	// encrypt
	privEncrypt:(key, str) => key.privateEncrypt(str, 'utf8', 'base64'),
	pubEncrypt:(key,str) => key.publicEncrypt(str, 'utf8', 'base64'),
	// decrypt
	pubDecrypt:(key, base64) => key.publicDecrypt(base64, 'base64', 'utf8'),
	privDecrypt:(key, base64) => key.privateDecrypt(base64, 'base64', 'utf8')
};

module.exports = exports;