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
	
	var filelist = [ "htdocs/favicon.ico", "htdocs/clock.html", "htdocs/js/clock.js", "htdocs/clock.css" ];
	
	filelist.forEach(function (filename) {
		// Remember a file and mime type, update if it changes
		// on disc, forget it after an five minutes (300000 milliseconds)
		memfile.setSync(filename, {
			mime_type: mimetype.lookup(filename), 
			update_on_change: true,
			expire_in: 300000});
	});
	
	// Create the web server serving the clock web site
	console.log("Starting web server)
	http.createServer(function (req, res) {
		var file;
	
		if (req.url === "/" || req.url === "/index.html") {
			req.url = "/clock.html";
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

