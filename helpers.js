var needle = require('needle'),
	express = require('express'),
	config = require('./config');
	db = require('./db');
var middleware = {
	checkAdmin: (req, res, next) => {
	  return (req, res, next) => {
			if(req.session.isadmin) {
				next();
			} else {
				res.redirect('/logout');
			}
	  }
	},
	checkAuth: (req, res, next) => {
	  return (req, res, next) => {
	    if(!req.session.name) {
	  		res.redirect(config.twitch.authurl);
	  	}else{
	  		next();
	  	}
	  }
	},
	checkxhr: (req, res, next) => {
	  return (req, res, next) => {
	    if(!req.xhr) {
	  		res.send('this is an improper request');
	  	}else{
	  		next();
	  	}
	  }
	}
}
var twitch = {
	auth: (client_id, client_secret, grant_type, redirect_uri, code) => {
	  return new Promise((resolve, reject) => {
	    var request_object = {client_id: client_id,client_secret: client_secret,grant_type: grant_type, redirect_uri: redirect_uri, code: code };
	    needle.post('https://api.twitch.tv/kraken/oauth2/token',request_object, config.twitch.header, (err, resp, body) => {
			  if(!err) {
	        needle.get('https://api.twitch.tv/kraken/user?oauth_token=' + body.access_token, config.twitch.header, (err, data) => {
	          if(!err && data.statusCode == 200) {
							db.intro.select(data.body._id).then((db) => {
								if(db.length > 0 && db[0].admin && db[0].admin == true) {
									var modstatus = true;
								} else {
									var modstatus = false;
								}
								resolve({'name': data.body._id, 'token': body.access_token, 'modstatus': modstatus, 'display_name': data.body.display_name});
							})

	          } else {
	            console.log(err);
	          }
	        });
	      } else {
	        console.log(err);
	      }
	    });
	  });
	},
	profile: (username) => {
		return new Promise(function(resolve, reject) {
			needle.get("https://api.twitch.tv/kraken/channels/"+username, config.twitch.header, (err, data) => {
				if(err) {
					resolve(err);
				} else {
					if(data.body.status != "422") {
						resolve(data.body)
					} else {
						resolve(false);
					}
				}
			})
		});
	},
	videos: (username, limit, type) => {
		return new Promise(function(resolve, reject) {
			needle.get('https://api.twitch.tv/kraken/channels/'+username+'/videos?limit='+limit+"&broadcasts="+type, config.twitch.header, (err, data) => {
				if(err) {
					resolve(err);
				} else {
					if(data.body.status != "422") {
						resolve(data.body.videos)
					} else {
						resolve(false);
					}
				}
			})
		});
	},
	getstreams: (listarr) => {
		return new Promise(function(resolve, reject) {
			needle.get('https://api.twitch.tv/kraken/streams/?channel='+listarr, config.twitch.header, (err, data) => {
				resolve(data.body.streams);
			});
		});
	}
}
var general = {
	chunks: (array, size) => {
		var results = [];
		while(array.length) {
			results.push(array.splice(0, size));
		}
		return results;
	},
	random: (input) => {
		for(var n = 0; n < input.length - 1; n++) {
			var k = n + Math.floor(Math.random() * (input.length - n));
			var temp = input[k];
			input[k] = input[n];
			input[n] = temp;
		}
		return input;
	},
	inarray: (value, array) => {
		return array.indexOf(value) > -1;
	},
	setredditflair: (redditname, twitchname, auth, oauth) => {
	  return new Promise(function(resolve, reject) {
	    needle.post('https://'+oauth.clientid+':'+oauth.secret+'@www.reddit.com/api/v1/access_token', auth, (err, res) => {
	      var options = {headers: {"Authorization": "bearer "+res.body.access_token, "User-Agent": "twitchdb/0.1 by "+auth.username}}
	      needle.get('https://oauth.reddit.com/r/twitch/api/flairlist.json?name='+redditname, options, (err, oauth) => {
	          if(oauth.body.users[0].user.toLowerCase() == redditname.toLowerCase()) {
							if(oauth.body.users[0].flair_text === null || oauth.body.users[0].flair_text.length === 0 || oauth.body.users[0].flair_text.length === "") {
								var flairdata = {
		              'api_type': 'json',
		              'css_class': "introflair",
		              'name': redditname,
		              'text': "http://www.twitch.tv/"+twitchname
		            }
								needle.post('https://oauth.reddit.com/r/twitch/api/flair', flairdata, options, (err, flair) => {
									if(flair.body.json.errors.length == 0) {
										resolve({'status': true});
									} else {
										resolve({'status': false});
									}
								});
							} else {
								resolve({'status': true});
							}

	          } else {
	            resolve({'status': false});
	          }
	      });
	    });
	  });
	}
}

module.exports = {
	middleware: middleware,
	twitch: twitch,
	general: general
};
