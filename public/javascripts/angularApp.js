var app = angular.module('flapperNews',['ui.router']).run(['$rootScope',function($rootScope){
	$rootScope.$on('$stateChangeStart',function(event, toState, toParams, fromState, fromParams){
		console.log('$stateChangeStart to '+toState.to+'- fired when the transition begins. toState,toParams : \n',toState, toParams);
	});
	$rootScope.$on('$stateChangeError',function(event, toState, toParams, fromState, fromParams, error){
		console.log('$stateChangeError - fired when an error occurs during transition.');
		console.log(arguments);
	});
	$rootScope.$on('$stateChangeSuccess',function(event, toState, toParams, fromState, fromParams){
		console.log('$stateChangeSuccess to '+toState.name+'- fired once the state transition is complete.');
	});
	$rootScope.$on('$viewContentLoaded',function(event){
		console.log('$viewContentLoaded - fired after dom rendered',event);

	});
	$rootScope.$on('$stateNotFound',function(event, unfoundState, fromState, fromParams){
		console.log('$stateNotFound '+unfoundState.to+'  - fired when a state cannot be found by its name.');
		console.log(unfoundState, fromState, fromParams);

	});
}]);

app.factory('posts',["$http",'auth',function($http,auth){
	//service body
	var o = {
		posts:[]
	};

	o.getAll=function(){
		return $http.get("/posts").success(function(data){
			angular.copy(data,o.posts);
		});
	};

	o.create=function(post){
		return $http.post("/posts",post,{
			headers:{Authorization: 'Bearer '+auth.getToken()}
		}).success(function(data){
			o.posts.push(data);
		});
	};

	o.upvote = function(post){
		return $http.put('/posts/'+post._id+'/upvote',null,{
			headers:{Authorization: 'Bearer '+auth.getToken()}
		})
		.success(function(data){
			post.upvotes +=1;
		});
	};

	o.get = function(id){
		return $http.get('/posts/'+id).then(function(res){
			return res.data;
		});
	};

	o.addComment = function(id,comment){
		return $http.post('/posts/'+id + '/comments',comment,{
			headers:{Authorization: 'Bearer '+auth.getToken()}
		});
	};

	o.upvoteComment = function(post,comment){
		return $http.put('/posts/'+post._id+'/comments/'+comment._id+ '/upvote',null,{
			headers:{Authorization: 'Bearer '+auth.getToken()}
		}).
			success(function(data){
				comment.upvotes +=1;
			});
	};
	return o;
}]).factory('auth',['$http','$window',function($http,$window){
	var auth = {};

	auth.saveToken = function(token){
		$window.localStorage['flapper-news-token'] = token;
	};

	auth.getToken = function(token){
		return $window.localStorage['flapper-news-token'];
	};

	auth.isLoggedIn = function(){
		var token = auth.getToken();

		if(token){
			var payload = JSON.parse($window.atob(token.split('.')[1]));
			return payload.exp > Date.now() / 1000;
		}else{
			return false;
		}
	};

	auth.currentUser = function(){
		var token = auth.getToken();

		if(token){
			var payload = JSON.parse($window.atob(token.split('.')[1]));
			return payload.username;
		}else{
			return null;
		}
	};

	auth.register = function(user){
		return $http.post('/register',user).success(function(data){
			auth.saveToken(data.token);
		});
	};

	auth.logIn = function(user){
		return $http.post('/login',user).success(function(data){
			auth.saveToken(data.token);
		});
	};

	auth.logOut = function(){
		$window.localStorage.removeItem('flapper-news-token');
	};

	return auth;
}]);

app.controller('MainCtrl',[
	'$scope',
	'posts',
	'auth',
	function($scope,posts,auth){
		$scope.posts=posts.posts;
		$scope.isLoggedIn = auth.isLoggedIn;
		$scope.test = 'Hello world!';
		$scope.addPost = function(){
			if(!$scope.title || $scope.title===''){return;}
			posts.create({
				title:$scope.title,
				link:$scope.link,
			});
			$scope.title="";
			$scope.link="";
		};
		$scope.incrementUpvotes=function(post){
			posts.upvote(post);
		}
	}
]);

app.controller('AuthCtrl',[
	'$scope',
	'$state',
	'auth',
	function($scope, $state, auth){
		$scope.user = {};

		$scope.register = function(){
			auth.register($scope.user).error(function(error){
				$scope.error = error;
			}).then(function(){
				$state.go('home');
			});
		};

		$scope.logIn = function(){
			auth.logIn($scope.user).error(function(error){
				$scope.error = error;
			}).then(function(){
				$state.go('home');
			});
		};
	}
]);

app.controller('PostsCtrl',[
	'$scope',
	'posts',
	'post',
	'auth',
	function($scope,posts,post,auth){
		$scope.post=post;
		$scope.isLoggedIn = auth.isLoggedIn;
		$scope.addComment = function(){
			if($scope.body===''){return;}
			posts.addComment(post._id,{
				body:$scope.body,
				author:'user',
			}).success(function(comment){
				$scope.post.comments.push(comment);
			});
			$scope.body = '';
		};

		$scope.incrementUpvotes = function(comment){
			posts.upvoteComment(post,comment);
		};
	}
]);

app.controller('NavCtrl',[
	'$scope',
	'auth',
	function($scope,auth){
		$scope.isLoggedIn = auth.isLoggedIn;
		$scope.currentUser = auth.currentUser;
		$scope.logOut = auth.logOut;
	}
]);

app.config([
	'$stateProvider',
	'$urlRouterProvider',
	function($stateProvider,$urlRouterProvider){
		$stateProvider
		.state('home',{
			url:'/home',
			templateUrl:'/home.html',
			controller:'MainCtrl',
			resolve:{
				postPromise:['posts',function(posts){
					console.log("Posts.getAll");
					return posts.getAll();
				}]
			}
		}).state('posts',{
			url: '/posts/{id}',
			templateUrl: '/posts.html',
			controller: 'PostsCtrl',
			resolve:{
				post:['$stateParams','posts',function($stateParams,posts){
					console.log("Posts.get");
					return posts.get($stateParams.id);
				}]
			}
		}).state('login',{
			url:'/login',
			templateUrl: '/login.html',
			controller:'AuthCtrl',
			onEnter:['$state','auth',function($state,auth){
				if(auth.isLoggedIn()){
					$state.go('home');
				}
			}]
		}).state('register',{
			url:'/register',
			templateUrl:'/register.html',
			controller:'AuthCtrl',
			onEnter:['$state','auth',function($state,auth){
				if(auth.isLoggedIn()){
					$state.go('home');
				}
			}]
		});

		$urlRouterProvider.otherwise('home');
	}
]);
