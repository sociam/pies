/* global console,  angular, $, window */


angular.module('smvm', [])
    .factory('clientcrypto', function() {
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

		return {
			encrypt : (b64_key, clear_text) {
			    return b64ToArrayBuffer(b64_key)
			        .then(buffer => window.crypto.subtle.importKey("spki", buffer, {name: "RSA-OAEP", hash: {name: "SHA-256"}}, false, ["encrypt"]))
			        .then(key => new Promise((res, rej) => stringToArrayBuffer(clear_text).then(buffer => res({key, buffer}))))
			        .then(data => window.crypto.subtle.encrypt({name: "RSA-OAEP", hash: {name: "SHA-256"}}, data.key, data.buffer));
			}
		};
    });
