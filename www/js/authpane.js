/* global console,  angular, $ */

angular.module('smvm').directive('authpane', () => {
	return {
	    templateUrl:'/tmpl/authpane.html',
	    replace:true,
	    bindings:{},
	    controller:function($scope, $timeout, network, crypto) {
	        $scope.baseurl = document.location.toString();
	        $scope.credentials = {};
	        $scope.keygen = () => {
	        	network.generateKey().then((key) => {
		        	$timeout(() => { $scope.credentials.key = key; })
		        });
	        };
	        $scope.register = () => {
	        	var u = $scope.credentials.username, k = $scope.credentials.key;
	        	network.register(u, k);
	        };
	        $scope.auth = () => {
	        	var u = $scope.credentials.username, k = $scope.credentials.key;
	        	network.auth(u, k).then(x => console.log(x));
	        };
	        $scope.clientGenKey = () => {
	        	console.log('attempting');
				crypto.generateKeyPem().then( xx => {
					console.log("clieneGenerateKeyPem worked ", xx);
					return xx;
				}).catch(e => console.error);
	        };
	        $scope.clientDecode = () => {
	        	var key = $scope.credentials.key;
	        	console.log("decoding ", key);
	        	if (key) { 
	        		crypto.toAB(key).then(result => {
		        		console.log('fromAB', result);
		        		rr = result;
		        	});
		        	crypto.extractKey(key).then( result => {
		        		console.log('result!');
			        	console.log(result);
			        	window.kkey = result;
		        	}).catch((e) => {
		        		console.error("Error ", e.toString());
		        		window.ee = e;
		        	});
		        }
	        };
	        window._c = crypto;
	    }
	};
});
