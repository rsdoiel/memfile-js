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
// revision: 0.0.1
//
var fs = require('fs');

var self = {
	options: {
		mime_type: 'application/octet-stream',
		// Sets up a file Watch if true
		on_change: false,
		on_change_interval: 500,
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


var onChange = function (filename, interval) {
	// fs.watch() is really what you want here but is listed
	// as unstable in 0.6.15 docs so I've cooked up an overly 
	// simplistic version of my own.
	self.cache[filename].on_change_interval_id = setInterval(function () {
		fs.stat(filename, function (err, stat) {
			var last_time = (Date.now() - interval), options = {};
			// Figure the time of last check
			if (err) {
				// File is missing, prune
				del(filename);
			}
			// Check if the file has changed or been modified
			if (stat.ctime.getTime() >= last_time || 
				stat.mtime.getTime() >= last_time) {
				set(filename, self.cache[filename].options);
			}
		});
	}, interval);
};


var onUpdate = function (filename, interval) {
	self.cache[filename].update_interval_id = setInterval(function () {
		set(filename, self.cache[filename].options);
	}, interval);
};


var onPrune = function (filename, timeout) {
	var timeout_id = self.cache[filename].expire_timeout_id;
	self.cache[filename].expire_timeout_id = setTimeout(function () {
		del(filename);
		clearTimeout(timeout_id);
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

		
	if (options.update_on_change === true) {
		self.cache[filename].onChange = onChange;
		self.cache[filename].onChange(filename, self.cache[filename].on_change_interval);
	}

	// Translate a relative time to 
	// specific type
	if (options.update_in !== false && Number(options.update_in) > 0) {
		// Update options.update_in
		self.cache[filename].onUpdate = onUpdate;
		self.cache[filename].onUpdate(filename, options.update_in);
	}

	if (options.expire_in !== false && Number(options.expire_in) > 0) {
		self.cache[filename].onPrune = onPrune;
		// How do I actually trigger the expire
		self.cache[filename].onPrune(filename, options.expire_in);
	}
	
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
		if (err && callback === undefined) {
			throw err;
		} else if (err) {
			if (self.cache[filename] !== undefined) {
				del(filename);
				callback(err);
			}
		}
		if (callback !== undefined) {
			callback(null, setupItem(filename, options, buf));
		} else {
			setupItem(filename, options, buf);
		}
	});
};


var get = function (filename) {
	if (self.cache[filename] === undefined) {
		return false;
	}
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
			clearTimeout(self.cache[filemane].expire_interval_id);
		}
		// Remove cache entry
		delete self.cache[filename].buf;
		delete self.cache[filename];
	}
	return (self.cache[filename] === undefined);
};

// Configuration setting
exports.setup = setup;
exports.options = self.options;
exports.cache = self.cache;

// Internal utility methods
exports.onChange = onChange;
exports.onUpdate = onUpdate;
exports.onPrune = onPrune;
exports.setupItem = setupItem;

// Primary public API
exports.setSync = setSync;
exports.set = set;
exports.get = get;
exports.del = del;
