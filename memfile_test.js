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
	memfile = require('./memfile');

console.log("Starting [memfile_test.js] ...");

assert.ok(false, "Tests not implemented yet.");

setTimeout(function () {
	assert.strictNotEqual(memfile.get("README.md"), false, "README.md still in memory after 30 seconds.");
}, 30000);
