/* global console,  angular, $, window, cryptico */

angular.module('smvm')
    .factory('crypto', function() {
		return {
			generateKeyPem: (pass) => cryptico.generateRSAKey(pass, 2048), 
			encrypt:(str, pubkey, privkey) => cryptico.encrypt(str, pubkey, privkey),
			decrypt:(ciphertext, privkey) => cryptico.decrypt(ciphertext, privkey)
		};
    });
