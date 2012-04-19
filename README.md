memfile.js
==========
revision 0.0.1
--------------

# Overview

An in-memory file cache written for instructional purposes.


# Examples

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

