
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
	RECONNECT_TIMEOUT=12000,
	db, tracker, peers, socket_listener;

var getLocalCollections = () => db.collections().then((sC) => { return sC.map((x) => x.s.name);	}),
	getPeerCollections = (p) => askPeer(p, '/api/collections?local=true').then((x) => (x && JSON.parse(x) || [])),
	findCollection = (cid) => {
		return getLocalCollections().then((lCs) => {
			if (lCs.indexOf(cid) >= 0) { return { id: config.id }; }
			return Promise.filter(peers,
				(p) => getPeerCollections(p).then((cs) => cs.indexOf(cid) >= 0)
			).then((ps) => {
				if (ps.length > 0) { return ps[0]; }
			});
		});
	},
	getMyInterfaces = () => {
		var localhosts = ["127.0.0.1", "::", "::1", "fe80::1"];
		return _(os.networkInterfaces()).values().map((x) => x.map((y) => y.address))
			.flatten()
			.filter((x) => localhosts.indexOf(x) < 0 && x.indexOf(':') < 0) // get rid of localhosts, ipv6 shizzle
			.uniq().value();
	},
	makeFullURLs = (path) => {
		return getMyInterfaces().map((iface) => { return ['http://', iface, ":"+config.port, path].join(''); });
	},
	refresh_peers = (host_key) => {
		// updates our view of peers from tracker and updates tracker with us
		const scrypto = require('./crypto');
		return tracker.collection('nodes').find({_id:config.owner.id}).then(function(d) {
			// record ourselves in there:
			// creates { name: <nodename>, id: 'nodeid', addrs: [ { prot: 'http', host:<addr>, port:3000 } ] }
			// console.info('refreshing peers - got peers ', JSON.stringify(d, null, 2));

			peers = (d && d[0] && d[0].nodes || []).filter((x) => (x.id !== config.id));

			var menode = _({
				addrs : getMyInterfaces().map((x) => ({ prot:config.prot, host: x, port: config.port }))
			}).extend(_.pick(config, ['name','id'])).value(),
			me = {
				_id:config.owner.id,
				pubkey:scrypto.getPublicKey(host_key),
				nodes:peers.concat(menode)
			};
			console.log('registering >> ', JSON.stringify(me, null, 2));
			return tracker.collection('nodes').save(me);
		});
	},
	askPeer = (peer, path) => {
		var pa = peer.addrs[0],
			peer_url = [pa.prot,'://',pa.host,':',''+pa.port, path].join('');
		return new Promise((acc) => {
			request({uri:peer_url, method:'GET', timeout:1000})
				.then(acc)
				.catch((err) => {
					console.error('could not connect to peer ', peer_url, err);
					acc();
				});
		});
	}, 
	postPeer = (peer, path, payload) => {
		var pa = peer.addrs[0],
			peer_url = [pa.prot,'://',pa.host,':',''+pa.port, path].join('');

		return new Promise((acc) => {
			request({method:'POST', uri:peer_url, timeout:1000, body:payload, json:true, headers: { 'content-type': 'application/json' }})
				.then(acc)
				.catch((err) => {
					console.error('could not connect to peer ', peer_url);
					acc(); // we just failfast
				});
		});
	}, reconnect_thread, listen_for_changes = (db_url, fn) => { 
		var oplog = mongolog(db_url).tail();
		var reconnect = () => {
			if (!reconnect_thread) {
				reconnect_thread = setTimeout(() => { 
					reconnect_thread = undefined; 
					listen_for_changes(db_url, fn); 
				}, RECONNECT_TIMEOUT);
			}
		};
		oplog.on('insert', (doc) => { fn('insert', doc); });
		oplog.on('update', (doc) => { fn('update', doc); });
		oplog.on('delete', (doc) => { fn('delete', doc); });
		oplog.on('error', (error) => { console.log('error ! ', error); reconnect(); });
		oplog.on('end', () => { console.log('end!'); reconnect(); });
		oplog.on('stop', () => {  console.log('server stopped'); reconnect(); });
	};

module.exports = {
	makeFullURLs:makeFullURLs,
	connect:(host_key) => { 
		return mongo.connect(config.tracker).then((tr) => {
			console.info('connected to tracker ', config.tracker);
			tracker = tr;
			listen_for_changes(config.tracker, (changetype, doc) => {
				console.log('remote registry change, refreshing peers', changetype, doc);
				if (doc.o._id == config.owner.id) { 
					console.info('got feedback, ignoring');
					return; 
				}  
				setTimeout(() => refresh_peers(host_key), 1000);
			});
			refresh_peers(host_key);			
			return mongo.connect(config.db);
		}).then((db_) => {
			listen_for_changes(config.db, (type, what) => { console.log('local db change >> ', type, doc); });
			db = db_; 
			return db;
		}).catch((err) => { console.error("could not connect to tracker", err); });
	},
	register:(app, io, db, host_key) => {
		// start registering api endpoints
		console.info('registering net endpoints >>>> ');
		socket_listener = require('./socketer').register(app, db, io);
		app.get('/api/collections', (req,res) => {
			var localOnly = url.parse(req.url, true).query.local;
			if (localOnly) {
				return getLocalCollections().then((cs) => {
					res.status(200).send(JSON.stringify(cs));
				});
			}
			return getLocalCollections().then((locals) => {
				return Promise.all(peers.map((p) => getPeerCollections(p)))
				.then((cs) => _(cs).filter((x) => x).push(locals).flatten().uniq().value())
				.then((csuniq) => res.status(200).send(JSON.stringify(csuniq)));
			}); // getLocalCollections
		}); // app.get

		// (name) -> returns (first) host that contains the collection
		app.get('/api/findCollection', (req,res) => {
			var cname = url.parse(req.url, true).query.name;
			findCollection(cname).then((p) => {
				console.info('peers hit for ', cname, p);
				if (p !== undefined) {	return res.status(200).send(p.id);	}
				return res.status(404).send('');
			});
		});

		// gets a document with specified id from the given collection
		app.get('/api/:collection/:id', (req,res) => {
			var cname = req.params.collection,
				id = req.params.id;

			findCollection(cname).then((chost) => {
				if (!chost) {
					console.error("Could not find collection ", cname, " returning 404");
					return res.status(400).send('Could not find collection');
				}
				if (chost && chost.id === config.id) {
					console.info('local hit! ');
					return db.collection(cname).find({_id:id}).then((docs) => {
						res.status(200).send(""+JSON.stringify(docs));
					}).catch((err) => {
						console.error("something went wrong fetching ", cname, " > ", id);
						res.status(400).send(err.toString());
					});
				}
				console.log('asking chost ', chost.id, ' - ', req.url);
				askPeer(chost, req.originalUrl).then(function(remote_response) {
					console.info('peer response', remote_response);
					res.status(200).send(""+remote_response);
				});
			});
		});
		// post like this:
		app.post('/api/:collection/:id', (req,res) => {

			var cname = req.params.collection,
				id = req.params.id,
				dtou = req.get('dtou');
			console.info('got data terms of use header', dtou);
			// console.info('POST /api/',cname,id, ' -> ', req.body, typeof req.body, 'rawbody ', req.rawbody);
			findCollection(cname).then((chost) => {
				if (!chost) {
					console.error("Could not find collection ", cname, " returning 404");
					return res.status(400).send('Could not find collection');
				}
				if (chost && chost.id === config.id) {
					// local commit!
					console.info('local hit on collection > ', cname);
					return db.collection(cname).save(_.extend({_id:id}, req.body)).then(() => {
						console.info('success inserting ');
						res.status(200).send('ok');
					}).catch((err) => {
						console.error("something went wrong fetching ", cname, " > ", id);
						res.status(400).send(err.toString());
					});
				}
				// remote commit, so ask appropriate peer
				console.log('asking chost ', chost.id, ' - ', req.url);
				postPeer(chost, req.originalUrl, req.body).then(function(remote_response) {
					console.info('peer response', remote_response);
					res.status(200).send(""+remote_response);
				});
			});
		});

		app.get('/api/generateKey', (req,res) => {
			var scrypto = require('./crypto'),
				skey = scrypto.create_keypair().toPrivatePem().toString();
			res.status(200).send(skey);
		});
		console.info('registered!');
	},
	registerUser:(id, pubkey) => {
		return tracker.collection('nodes').findById(id).then((doc) => {
			doc = doc || {_id:id};
			doc.pubkey = pubkey;
			return tracker.collection('nodes').save(doc);
		});
	},
	getIdentity: (id) => {
		if (!tracker) throw new Error("Tracker not initialised");
		return tracker.collection('nodes').findById(id);
	},
	getPublicKey: (id) => {
		if (!tracker) throw new Error("Tracker not initialised");
		return tracker.collection('nodes').findById(id).then((x) => x && x[0].pubkey);
	}
};
	

