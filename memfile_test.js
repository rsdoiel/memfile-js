//
// memfile_test.js - Automated test of memfile.js
//
// @author: R. S. Doiel, <rsdoiel@gmail.com>
// copyright (c) 2012 all rights reserved
//
// Released under New the BSD License.
// See: http://opensource.org/licenses/bsd-license.php
//
// revision: 0.0.1
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


memfile.setup({mime_type: "text/plain", on_change_in: 100});
assert.equal(memfile.options.on_change_in, 100, "Should have updated setup" + util.inspect(memfile.options));

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

// Test non-blocking set()
console.log("Checking set()");
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
	
	assert.equal(typeof memfile.cache["README.md"].onPrune, "function", "Should have onPrune() attached."); 

	console.log("Checking onPrune(), expire_in");
	setTimeout(function () {
		assert.strictEqual(memfile.get("README.md"), false, "README.md still in memory after 75 milliseconds. " + util.inspect(memfile.cache));
		// Next check update_in ...
		console.log("Checking onPrune(), expire_in, success");
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

		console.log("Checking stat for 2nd access");
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


console.log("Setting up for onChange(), on_change_in");
memfile.set("test-data/test-2.txt", {mime_type: "text/plain", on_change_in: 25}, function (err, item) {
	assert.ok(! err, "Shouldn't get an error updating test-data/test-2.txt: " + err);
	results = item.modified;
});

console.log("Checking onChange(), on_change_in");
src += "\nSecond Line";
console.log("\tchanging test-data/test-2.txt: ", Date.now());
fs.writeFileSync("test-data/test-2.txt", src);
console.log("\tchange test-data/test-2.txt, completed: ", Date.now());

setTimeout(function () {
	var item = memfile.get("test-data/test-2.txt");

	console.log("\tchecking for change in cache: ", Date.now());		
	assert.strictEqual(item.buf, src, "item != src: " + item.buf + " <--> " + src);
	console.log("Checking onChange(), on_change_in, success");
}, 1000);


setTimeout(function () {
	var ky_list = Object.keys(memfile.cache);
	//console.log("DEBUG", memfile);

	memfile.shutdown();
	console.log("Success!");
}, 15000);




