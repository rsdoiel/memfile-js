//
// memfile.js - A simplistic in-memory file cache. Not suitable of a huge
// number of files. It doesn't feature logging which a production 
// implementation requirement.
//
// @author: R. S. Doiel, <rsdoiel@gmail.com>
// copyright (c) 2012 all rights reserved
//
// Released under New the BSD License.
// See: http://opensource.org/licenses/bsd-license.php
//
// revision: 0.0.2
//
var fs = require('fs');

var self = {
	options: {
		mime_type: 'application/octet-stream',
		// Sets up a file Watch if true
		on_change_in: false,
		on_change_interval:1000,
		on_change_interval_id: false,
		// Sets up a refresh using setInterval()
		update_in: false,
		update_interval_id: false,
		// Sets up a prune using setTimeout()
		expire_in: false,
		expire_timeout_id: false
	},
	cache: {},
};


var update = function (filename) {
	if (self.cache[filename]) {
		fs.readFile(filename, function (err, buf) {
			if (err || buf.length === 0) {
				del(filename);
				return;
			}

			// We have to make sure we handle a delete in middle of 
			// read for onChange() or onUpdate().
			if (self.cache[filename]) {
				if (self.cache[filename].mime_type.indexOf('text/') === 0) {
					self.cache[filename].buf = buf.toString(); 
				} else {
					self.cache[filename].buf = buf;
				}
				self.cache[filename].modified = Date.now();
				self.cache[filename].size = buf.length; 
			}
		});
	}
};


var onChange = function (filename) {
	var prev = { mtime: Date.now(), ctime: Date.now() };

	// fs.watch() isn't stable yet in NodeJS version 0.6.15
	self.cache[filename].on_change_interval_id = setInterval(function () {
		fs.stat(filename, function (err, stat) {
			var mtime, ctime;
			if (err || stat === null) {
				del(filename);
				return;
			}
			mtime = stat.mtime.getTime();
			ctime = stat.ctime.getTime();
			
			if (prev.mtime !== mtime ||
				prev.ctime !== ctime) {
				update(filename);					
			}
			prev.mtime = mtime;
			prev.ctime = ctime;
		});
	}, self.options.on_change_interval);
};


var onUpdate = function (filename, interval) {
	self.cache[filename].update_interval_id = setInterval(function () {
		fs.readFile(filename, function (err, buf) {
			if (err) {
				del(filename);
				return;
			}
			// We have to make sure we handle a delete in middle of 
			// an update.
			if (self.cache[filename]) {
				if (self.cache[filename].mime_type.indexOf('text/') === 0) {
					self.cache[filename].buf = buf.toString();
				} else {
					self.cache[filename].buf = buf;
				}
				self.cache[filename].modified = Date.now();
				self.cache[filename].size = buf.length; 
			}
		});
	}, interval);
};


var onExpire = function (filename, timeout) {
	setTimeout(function () {
		del(filename);
	}, timeout);
};


var setup = function (defaults) {
	var ky_list, i;
	
	if (defaults !== undefined) {
		ky_list = Object.keys(defaults);
		for (i = 0; i < ky_list.length; i += 1) {
			self.options[ky_list[i]] = defaults[ky_list[i]];
		}
	}
};


var setupItem = function (filename, options, buf) {
	// Delete any existing copy of item
	del(filename);

	self.cache[filename] = {};
	// Recreate based on the defaults
	Object.keys(self.options).forEach(function (ky) {
		self.cache[filename][ky] = self.options[ky];
	});

	// Merge new options
	if (options !== undefined) {
		Object.keys(options).forEach(function (ky) {
			self.cache[filename][ky] = options[ky];
		});
	}

	if (self.cache[filename].mime_type.toLowerCase().indexOf('text/') === 0) {
		self.cache[filename].buf = buf.toString(); 
	} else {
		self.cache[filename].buf = buf;
	}
	self.cache[filename].created = Date.now();
	self.cache[filename].modified = Date.now();
	self.cache[filename].size = buf.length;
		
	if (self.cache[filename].on_change == true) {
		self.cache[filename].onChange = onChange;
		self.cache[filename].onChange(filename);
	}

	// Translate a relative time to 
	// specific type
	if (self.cache[filename].update_in !== false && 
			Number(self.cache[filename].update_in) > 0) {
		// Update options.update_in
		self.cache[filename].onUpdate = onUpdate;
		self.cache[filename].onUpdate(filename, options.update_in);
	}

	if (self.cache[filename].expire_in !== false && 
			Number(self.cache[filename].expire_in) > 0) {
		self.cache[filename].onExpire = onExpire;
		// How do I actually trigger the expire
		self.cache[filename].onExpire(filename, options.expire_in);
	}
	self.cache[filename].modified = Date.now();
	return self.cache[filename];
};


var setSync = function (filename, options) {
	var buf;

	try {
		buf = fs.readFileSync(filename);
	} catch(err) {
		return false;
	}
	return setupItem(filename, options, buf);
};


var set = function (filename, options, callback) {
	fs.readFile(filename, function (err, buf) {
		var item;
		if (err && callback === undefined) {
			throw err;
		} else if (err) {
			if (self.cache[filename] !== undefined) {
				del(filename);
				callback(err);
			}
		}
		item = setupItem(filename, options, buf);
		if (callback !== undefined) {
			callback(null, item);
		}
	});
};


var get = function (filename) {
	if (self.cache[filename] === undefined) {
		return false;
	}
	self.cache[filename].accessed = Date.now();
	return self.cache[filename];
};


var del = function (filename) {
	if (self.cache[filename] !== undefined) {
		// Cleanup timeout's and intervals
		if (self.cache[filename].on_change_interval_id) {
			clearInterval(self.cache[filename].on_change_interval_id);
		}
		if (self.cache[filename].update_interval_id) {
			clearInterval(self.cache[filename].update_interval_id);
		}
		if (self.cache[filename].expire_timeout_id) {
			clearTimeout(self.cache[filename].expire_interval_id);
		}
		// Remove cache entry
		delete self.cache[filename].buf;
		delete self.cache[filename];
	}
	return (self.cache[filename] === undefined);
};

var close = function () {
	Object.keys(self.cache).forEach(function (filename) {
		del(filename);
	});
};

// Configuration setting
exports.setup = setup;
exports.options = self.options;
exports.cache = self.cache;

// Internal utility methods
exports.onChange = onChange;
exports.onUpdate = onUpdate;
exports.onExpire = onExpire;
exports.setupItem = setupItem;

// Primary public API
exports.setSync = setSync;
exports.set = set;
exports.get = get;
exports.del = del;
exports.close = close;
