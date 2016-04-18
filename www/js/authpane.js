/* global console,  angular, $ */

angular.module('smvm').directive('authpane', () => {
	return {
	    templateUrl:'/tmpl/authpane.html',
	    replace:true,
	    bindings:{},
	    controller:function($scope, $timeout, network) {
	        console.log('authpane');

	        $scope.baseurl = document.location.toString();
	        $scope.credentials = {};
	        $scope.keygen = () => {
	        	network.generateKey().then((key) => {
	        		console.log('key!', key);
		        	$timeout(() => { $scope.credentials.key = key; })
		        });
	        };
	    }
	};
});
