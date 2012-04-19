memfile.js
==========
revision 0.0.2
--------------

# Overview

An in-memory file cache written for instructional purposes. If you were
to extend this for production purposes then you would need to cap memory consumption at some point and attrition out items which were accessed rarely.
You would also want logging integration. It might make more sense at that
point to integrate with a database backend allowing for a secondary level of caching.


# Problems

The onChange() should really be using fs.watch() to detect a change in the
file but currently that is listed as unstable in NodeJS version 0.6.15.


# Examples

Below is an example of using memfile with a simplistic web server.

	var http = require("http"),
		path = require("path"),
		memfile = require("memfile"),
		mimetype = require("mimetype");
	
	var file_list = [ 
		"htdocs/favicon.png", 
		"htdocs/clock.html", 
		"htdocs/js/clock.js", 
		"htdocs/clock.css"
	];
	
	file_list.forEach(function (filename) {
		// Remember the files, mime type, and update if it changes
		memfile.setSync(filename, {
			mime_type: mimetype.lookup(filename), 
			on_change: true});
	});
	
	// Create the web server serving the clock web site
	console.log("Starting web server)
	http.createServer(function (req, res) {
		var file;

		// Handle special case urls	
		if (req.url === "/" || req.url === "/index.html") {
			req.url = "/clock.html";
		} else if (req.url === "/favicon.ico") {
			req.url = "/favicon.png";
		}

		file = memfile.get(path.join("htdocs", req.url));
		if (file === true) {
			res.writeHead(200, {"Content-Type": file.mime_type)});
			res.end(file.buf);
		} else {
			res.writeHead(404, {"Content-Type": "text/plain"});
			res.end(req.url + " not found.");
		}
	}).listen(8080, "localhost");

