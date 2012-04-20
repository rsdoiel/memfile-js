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
// revision: 0.0.3
//
var fs = require('fs'),
	util = require('util'),
	events = require('events');

var event = new events.EventEmitter();

var options = {
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
	}, cache = {};


var update = function (filename) {
	if (cache[filename]) {
		fs.readFile(filename, function (err, buf) {
			if (err || buf.length === 0) {
				if (cache[filename] !== undefined) {
					event.emit("update", { error: true, error_msg: err,
						 filename: filename, time: Date.now() });
					del(filename, false);
				}
				return;
			}

			// We have to make sure we handle a delete in middle of 
			// read for onChange() or onUpdate().
			if (cache[filename]) {
				if (cache[filename].mime_type.indexOf('text/') === 0) {
					cache[filename].buf = buf.toString(); 
				} else {
					cache[filename].buf = buf;
				}
				cache[filename].modified = Date.now();
				cache[filename].size = buf.length; 
				// Emit an update event
				event.emit("update", {status: "OK", filename: filename, time: cache[filename].modified, size: cache[filename].size});
			}
		});
	}
};

// Watch for time change on disc, then update
var onChange = function (filename) {
	var prev = { mtime: Date.now(), ctime: Date.now() };

	// fs.watch() isn't stable yet as of NodeJS version 0.6.15
	// Fake it by polling the file system.
	cache[filename].on_change_interval_id = setInterval(function () {
		fs.stat(filename, function (err, stat) {
			var mtime, ctime;
			if (err || stat === null) {
				// Since we have an error, assume file is removed.
				del(filename, true);
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
	}, options.on_change_interval);
};

// Read from disc every interval
var onUpdate = function (filename, interval) {
	cache[filename].update_interval_id = setInterval(function () {
		fs.readFile(filename, function (err, buf) {
			if (err) {
				// Emit a delete event
				event.emit("update", {error: true, error_msg: err,
					filename: filename, time: Date.now() });
				// We don't delete it as we may want to hold onto our
				// last valid copy.
				return;
			}
			// We have to make sure we handle a delete in middle of 
			// an update.
			if (cache[filename]) {
				if (cache[filename].mime_type.indexOf('text/') === 0) {
					cache[filename].buf = buf.toString();
				} else {
					cache[filename].buf = buf;
				}
				cache[filename].modified = Date.now();
				cache[filename].size = buf.length; 
				// Emit an update event
				event.emit("update", {status: "OK", filename: filename, time: cache[filename].modified, size: cache[filename].size});
			}
		});
	}, interval);
};

var onExpire = function (filename, timeout) {
	setTimeout(function () {
		// Emit an Expired event
		event.emit("expire", { status: "OK", filename: filename, time: Date.now()});
		del(filename, false);
	}, timeout);
};


var setup = function (defaults) {
	var ky_list, i;
	
	if (defaults !== undefined) {
		ky_list = Object.keys(defaults);
		for (i = 0; i < ky_list.length; i += 1) {
			options[ky_list[i]] = defaults[ky_list[i]];
		}
	}
	
};


var setupItem = function (filename, custom_options, buf) {
	// Delete any existing copy of item
	del(filename, false);

	cache[filename] = {};
	// Recreate based on the defaults
	Object.keys(options).forEach(function (ky) {
		cache[filename][ky] = options[ky];
	});

	// Merge new options
	if (custom_options !== undefined) {
		Object.keys(custom_options).forEach(function (ky) {
			cache[filename][ky] = custom_options[ky];
		});
	}

	if (cache[filename].mime_type.indexOf('text/') === 0) {
		cache[filename].buf = buf.toString(); 
	} else {
		cache[filename].buf = buf;
	}
	cache[filename].created = Date.now();
	cache[filename].modified = Date.now();
	cache[filename].size = buf.length;
		
	if (cache[filename].on_change == true) {
		cache[filename].onChange = onChange;
		cache[filename].onChange(filename);
	}

	// Translate a relative time to 
	// specific type
	if (cache[filename].update_in !== false && 
			Number(cache[filename].update_in) > 0) {
		// Update options.update_in
		cache[filename].onUpdate = onUpdate;
		cache[filename].onUpdate(filename, cache[filename].update_in);
	}

	if (cache[filename].expire_in !== false && 
			Number(cache[filename].expire_in) > 0) {
		cache[filename].onExpire = onExpire;
		// How do I actually trigger the expire
		cache[filename].onExpire(filename, cache[filename].expire_in);
	}
	cache[filename].modified = Date.now();
	return cache[filename];
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
		if (err) {
			if (cache[filename] !== undefined) {
				// this is false because this is gc of partial create.
				del(filename, false);
			}
			// Emit a create error
			event.emit("create", { error: true, error_msg:err, 
				filename: filename });
			if (callback !== undefined) {
				callback(err);
			}
			return;
		}
		item = setupItem(filename, options, buf);
		// Emit a create event
		event.emit("create", { status: "OK", filename: filename });
		if (callback !== undefined) {
			callback(null, item);
		}
	});
};


var get = function (filename) {
	if (cache[filename] === undefined) {
		return false;
	}
	cache[filename].accessed = Date.now();
	// Emit an accessed event
	event.emit("accessed", { status: "OK", filename: filename, time: cache[filename].accessed, size: cache[filename].size });
	return cache[filename];
};

var del = function (filename, emit_event) {
	if (emit_event === undefined) {
		emit_event = true;
	}
	if (cache[filename] !== undefined) {
		// Cleanup timeout's and intervals
		if (cache[filename].on_change_interval_id) {
			clearInterval(cache[filename].on_change_interval_id);
		}
		if (cache[filename].update_interval_id) {
			clearInterval(cache[filename].update_interval_id);
		}
		if (cache[filename].expire_timeout_id) {
			clearTimeout(cache[filename].expire_interval_id);
		}
		// Remove cache entry
		delete cache[filename].buf;
		delete cache[filename];
		if (emit_event === true) {
			// Emit a delete event
			event.emit("delete", { status: "OK", 
				filename: filename, time: Date.now() });
		}
	}
	return (cache[filename] === undefined);
};

var close = function () {
	Object.keys(cache).forEach(function (filename) {
		// We're not emitting delete events on closing, just close event.
		del(filename, false);
	});
	// Emit a exit event.
	event.emit("close", { status: "OK" });
};

// Export the event methods
exports.event = event;

// Configuration setting
exports.setup = setup;
exports.options = options;
exports.cache = cache;

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
