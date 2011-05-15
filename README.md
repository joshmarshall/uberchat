UberChat
========

This is just an early experiment with Node.JS + Socket.IO.
You can play with a live example at chat.joshmarshall.org.

There isn't a datastore / persistence layer yet. That may
be coming... but it's a goofy little project, so don't hold 
your breath. :)

Requirements
------------
* Node.JS (http://node.js)
* NPM (if you install packages using it :))
* Socket.IO (npm install socket.io)
* Express (npm install express)
* EJS (npm install ejs)

Running
-------
Just a node app, so:

    node app.js
    NODE_ENV=production node app.js

etc., work like normal.

Configuration
-------------
The default configuration options are in config.js, but
I recommend creating "development.js" or "production.js"
files in the main root instead of jacking with config.js,
unless you want to make changes to every installation.

These will be automatically used based on the contents
of "NODE_ENV"
