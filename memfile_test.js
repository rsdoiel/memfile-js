//
// memfile_test.js - Automated test of memfile.js
//
// @author: R. S. Doiel, <rsdoiel@gmail.com>
// copyright (c) 2012 all rights reserved
//
// Released under New the BSD License.
// See: http://opensource.org/licenses/bsd-license.php
//
// revision: 0.0.3
//

var assert = require('assert'),
	util = require('util'),
	fs = require('fs'),
	memfile = require('./memfile');

console.log("Starting [memfile_test.js] ...");

var expected = {}, results = null, src;

Object.keys(memfile.options).forEach(function (ky) {
	expected[ky] = memfile.options[ky];
});

memfile.setup();
Object.keys(expected).forEach(function (ky) {
	assert.equal(expected[ky], memfile.options[ky], ky + " should match");
});

memfile.setup({mime_type: "text/plain"});
Object.keys(expected).forEach(function (ky) {
	if (ky === "mime_type") {
		assert.equal("text/plain", memfile.options.mime_type, "Mime type should have updated.");
	} else {
		assert.equal(expected[ky], memfile.options[ky], ky + " should match");
	}
});


memfile.setup({mime_type: "text/plain", on_change: true});
assert.equal(memfile.options.on_change, true, "Should have updated setup" + util.inspect(memfile.options));
memfile.setup({mime_type: "text/plain", on_change: false});
assert.equal(memfile.options.on_change, false, "Should have updated setup" + util.inspect(memfile.options));

assert.equal(Object.keys(memfile.cache).length, 0, "Should have zero objects in cache.");


// Test setSync()
expected = {}, result = null;
Object.keys(expected).forEach(function (ky) {
	expected[ky] = memfile.options[ky];
});
expected.mime_type = "text/plain";
expected.buf = fs.readFileSync("README.md").toString();

memfile.setSync("README.md", {mime_type: "text/plain"});
assert.ok(memfile.cache["README.md"], "README.md should be cached.");

Object.keys(expected).forEach(function (ky) {
	assert.equal(expected[ky], memfile.cache["README.md"][ky], 
		"expected " + expected[ky] + "; found " + memfile.cache["README.md"][ky]);
});

results = memfile.get("README.md");
Object.keys(expected).forEach(function (ky) {
	assert.equal(expected[ky], results[ky], 
		"expected " + expected[ky] + "; found " + results[ky]);
});

assert.strictEqual(memfile.del("README.md"), true, "del() should return true");
assert.strictEqual(memfile.get("README.md"), false, "Should get false after delete.");

(function () {
	var create_cnt = 0,
		create_err = 0,
		update_cnt = 0,
		update_err = 0,
		delete_cnt = 0,
		expire_cnt = 0,
		accessed_cnt = 0,
		close_cnt = 0;

	// Test non-blocking set()
	console.log("Checking set()");
	memfile.event.on("create", function (msg) {
		
		assert.ok(msg.status || msg.error, "Should get a status or error on create.");
		if (msg.status === "OK") {
			create_cnt += 1;
		}
		if (msg.error === true) {
			create_err += 1;
		};

	});

	memfile.event.on("update", function (msg) {
		//console.log(msg);
		assert.ok(msg.status || msg.error, "Should get a status or error on update.");
		if (msg.status === "OK") {
			update_cnt += 1;
		}
		if (msg.error === true) {
			update_err += 1;
		};

	});

	memfile.event.on("expire", function (msg) {
		
		assert.ok(msg.status || msg.error, "Should get a status or error on expire.");
		if (msg.status === "OK") {
			expire_cnt += 1;
		}
	});

	memfile.event.on("delete", function (msg) {
		
		assert.ok(msg.status || msg.error, "Should get a status or error on delete.");
		if (msg.status === "OK") {
			delete_cnt += 1;
		}
	});

	memfile.event.on("close", function (msg) {
		
		assert.ok(msg.status || msg.error, "Should get a status or error on close.");
		if (msg.status === "OK") {
			close_cnt += 1;
		}
	});
	
	memfile.set("README.md",{mime_type: "text/plain", expire_in: 50}, function (err, item) {
		assert.ok(! err, "Shouldn't get an error on set README.md");
		Object.keys(expected).forEach(function (ky) {
			assert.equal(expected[ky], memfile.cache["README.md"][ky], 
				"expected " + expected[ky] + "; found " + memfile.cache["README.md"][ky]);
		});
		Object.keys(expected).forEach(function (ky) {
			assert.equal(expected[ky], item[ky], 
				"expected " + expected[ky] + "; found " + item[ky]);
		});
		
		assert.equal(typeof memfile.cache["README.md"].onExpire, "function", "Should have onExpire() attached."); 
	
		console.log("Checking onExpire(), expire_in");
		setTimeout(function () {
			assert.strictEqual(memfile.get("README.md"), false, "README.md still in memory after 75 milliseconds. " + util.inspect(memfile.cache));
			// Next check update_in ...
			console.log("Checking onExpire(), expire_in, success");
		}, 75);
		console.log("Checking set(), success");
	});
	
	console.log("Setting up for onUpdate(), update tests.");
	try {
		results = fs.statSync("test-data");
	} catch (err) {
		results = false;
	}
	if (results === false) {
		fs.mkdirSync("test-data", 0770);
	}
	src = "First Line";
	fs.writeFileSync("test-data/test-1.txt", src);
	fs.writeFileSync("test-data/test-2.txt", src);
	
	console.log("Checking onUpdate(), update_in");
	memfile.set("test-data/test-1.txt", {mime_type: "text/plain", update_in: 10}, function (err, item) {
			var update_cnt = 0, check_interval_id, modified = item.modified;
	
	
			assert.equal(item.update_in, 10, "Should by update_in: 10" + util.inspect(item));
			// Wait for next update and check status
			console.log("Checking stat 1st access");
			setTimeout(function () {
				assert.ok(memfile.cache["test-data/test-1.txt"].modified > modified, "(1st) Should have been modified since " + modified);
				console.log("Checking stat 1st access, success");
				update_cnt += 1;
				modified = memfile.cache["test-data/test-1.txt"].modified;
			}, 20);
	
			console.log("Checking stat 2nd access");
			setTimeout(function () {
				assert.ok(memfile.cache["test-data/test-1.txt"].modified > modified, "(2nd) Should have been modified since " + modified + "," + memfile.cache["test-data/test-1.txt"].modified);
				console.log("Checking stat 2nd access, success");
				update_cnt += 1;
			}, 50);
			
			setTimeout(function () {
				assert.equal(2, update_cnt, "Failed from complete checking onUpdate(), update_in");
				console.log("Checking onUpdate(), update_in, success");
			}, 80);
	});
	
	
	console.log("Setting up for onChange(), on_change");
	memfile.set("test-data/test-2.txt", {mime_type: "text/plain", on_change: true}, function (err, item) {
		assert.ok(! err, "Shouldn't get an error updating test-data/test-2.txt: " + err);
		results = item.modified;
	});
	
	console.log("Checking onChange(), on_change");
	src += "\nSecond Line";
	console.log("\tchanging test-data/test-2.txt: ", Date.now());
	fs.writeFileSync("test-data/test-2.txt", src);
	console.log("\tchange test-data/test-2.txt, completed: ", Date.now());
	
	setTimeout(function () {
		var item = memfile.get("test-data/test-2.txt");
	
		console.log("\tchecking for change in cache: ", Date.now());		
		assert.strictEqual(item.buf, src, "item != src: " + item.buf + " <--> " + src);
		console.log("Checking onChange(), on_change, success");
	}, 1000);


	console.log("Checking onChange(), file removal");
	fs.unlinkSync("test-data/test-2.txt");
	setTimeout(function () {
		var item = memfile.get("test-data/test-2.txt");
		assert.strictEqual(item, false, "Shouldn't have an entry for test-data/test-2.txt");
		console.log("Checking onChange(), file removal, success");
	}, 2000);
	
	console.log("Setting up final tests...");
	setTimeout(function () {
		var ky_list = Object.keys(memfile.cache);

		console.log("Checking event counts");
		assert.equal(ky_list.length, 1, "Should have one item in cache when we're ready to shutdown.");
		memfile.close();
		ky_list = Object.keys(memfile.cache);
	
		assert.equal(ky_list.length, 0, "Should have zero items in cache when we're ready to shutdown.");
		
		assert.equal(create_cnt, 3, "Should have 3 create event. " + create_cnt);
		assert.equal(create_err, 0, "Should have 0 create error event. " + create_err);

		assert.equal(update_cnt, 499, "Should have allot update events. " + update_cnt);
		assert.equal(update_err, 0, "Should have 0 update error event. " + update_err);

		assert.equal(expire_cnt, 1, "Should have one expire event. " + expire_cnt);
		assert.equal(delete_cnt, 1, "Should have one delete event. " + delete_cnt);
		console.log("Checking event counts, success");
		
		console.log("Success!");
	}, 5000);
}());




