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

var expected = {}, results = null;

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


memfile.setup({mime_type: "text/plain", on_change_interval: 100});
assert.equal(memfile.options.on_change_interval, 100, "Should have updated setup" + util.inspect(memfile.options));

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
memfile.set("README.md",{mime_type: "text/plain", expires_in: 5000}, function (err, item) {
	assert.ok(! err, "Shouldn't get an error on set README.md");
	Object.keys(expected).forEach(function (ky) {
		assert.equal(expected[ky], memfile.cache["README.md"][ky], 
			"expected " + expected[ky] + "; found " + memfile.cache["README.md"][ky]);
	});
	Object.keys(expected).forEach(function (ky) {
		assert.equal(expected[ky], item[ky], 
			"expected " + expected[ky] + "; found " + item[ky]);
	});
});

console.log("Checking expire_in (10 secs)");
setTimeout(function () {
	assert.strictEqual(memfile.get("README.md"), false, "README.md still in memory after 10 seconds. " + util.inspect(memfile.cache));
	console.log("Checking expire_in success");
}, 10000);



