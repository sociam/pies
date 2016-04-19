/* global console,  angular, $, window */

angular.module('smvm')
    .factory('crypto', function() {
		function b64ToArrayBuffer(b64) {
		    return new Promise((res, rej) => {
		        var xhr = new XMLHttpRequest();
		        xhr.open('GET', 'data:application/octet-stream;base64,' + b64);
		        xhr.responseType = 'arraybuffer';
		        xhr.addEventListener('load', e => res(xhr.response));
		        xhr.addEventListener('error', e => rej(xhr));
		        xhr.send();
		    });
		}
		function stringToArrayBuffer(str) {
		    return new Promise((res, rej) => {
		        var xhr = new XMLHttpRequest();
		        xhr.open('GET', 'data:text/plain,' + str);
		        xhr.responseType = 'arraybuffer';
		        xhr.addEventListener('load', e => res(xhr.response));
		        xhr.addEventListener('error', e => rej(xhr));
		        xhr.send();
		    });
		}
		function arrayBufferToString(arrayBuffer) {
		  var byteArray = new Uint8Array(arrayBuffer);
		  var byteString = '';
		  for (var i=0; i<byteArray.byteLength; i++) {
		    byteString += String.fromCharCode(byteArray[i]);
		  }
		  return byteString;
		}
		function arrayBufferToBase64String(arrayBuffer) {
		  return btoa(arrayBufferToString(arrayBuffer));
		}
		function toPem(key) {
		  return `
		-----BEGIN PRIVATE KEY-----
		${key}
		-----END PRIVATE KEY-----
		`;
		}
		function fromPem(pem) {
			pem = pem.trim();
			var headlen = "-----BEGIN PRIVATE KEY-----".length,
				footlen = "-----END PRIVATE KEY-----".length;

			if (pem.indexOf("-----BEGIN") === 0) {
				return pem.slice(headlen,pem.length-footlen).trim();
			}
		}				

		return {
			generateKeyPem: () => {
				return window.crypto.subtle.generateKey(
				  {
				    name: "RSA-OAEP",
				    modulusLength: 2048,
				    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
				    hash: {name: "SHA-256"},
				  },
				  true,
				  ["encrypt", "decrypt"]
				)
				.then(keyPair => window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey))
				.then(arrayBufferToBase64String)
				.then(toPem)
				.then(pem => {
   				  console.log("pem >> ", pem);
   				  window.pem = pem;
				  var rsa = KEYUTIL.getKeyFromPlainPrivatePKCS8PEM(pem); // throws: malformed plain PKCS8 private key(code:001)
   				  console.log("rsa >> ", rsa);
   				  window.rrsa = rsa;
				  var sig = rsa.signStringPSS('text', 'sha256', 32);
				  console.log('signature', sig);
				}).catch(e => console.error(e));
			},
			// let's split it up
			generateKeyPairRSA:() => {
				return window.crypto.subtle.generateKey(
				  {
				    name: "RSA-OAEP",
				    modulusLength: 2048,
				    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
				    hash: {name: "SHA-256"},
				  },
				  true, // exportable
				  ["encrypt", "decrypt"]
				);				
			},
			exportPrivatePEM:(keyPair) => {
				return window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey)
					.then(arrayBufferToBase64String)
					.then(toPem);
			},
			importPrivatePEM: (PEM) => {
				return stringToArrayBuffer(fromPem(PEM))
					.then(arrbuff => { 
						window._ar = arrbuff; 
						return window.crypto.subtle.importKey("pkcs8", arrbuff,
							{   //these are the algorithm options
						        name: "RSA-OAEP",
						        hash: {name: "SHA-256"}, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
						    }, 
						    true, ["decrypt"]); 
				});
			},
			toAB: (b64_key) => {
				return b64ToArrayBuffer(b64_key);
			},
			extractKey : (b64_key) => {
			    return b64ToArrayBuffer(b64_key).then(buffer => window.crypto.subtle.importKey("pkcs8", buffer, {name: "RSA-OAEP", hash: {name: "SHA-256"}}, false, ["encrypt"]));
			},
			encrypt : (b64_key, clear_text) => {
			    return b64ToArrayBuffer(b64_key)
			        .then(buffer => window.crypto.subtle.importKey("spki", buffer, {name: "RSA-OAEP", hash: {name: "SHA-256"}}, false, ["encrypt"]))
			        .then(key => new Promise((res, rej) => stringToArrayBuffer(clear_text).then(buffer => res({key, buffer}))))
			        .then(data => window.crypto.subtle.encrypt({name: "RSA-OAEP", hash: {name: "SHA-256"}}, data.key, data.buffer));
			}
		};
    });
