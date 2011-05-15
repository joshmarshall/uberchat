/* The Base Configuration file and startup options

ONLY change these if you want them changed across ALL installations.
(i.e., this file should be in version control). You should put specific
deploayment options under "development.js" or "production.js", etc under
the root folder.

Those files should look like:

    exports.update = function(config) {
        config.port = 1337;
    };

*/

exports.configure = function() {

    this.port = 3000;
    this.cookieSecret = "whatever1234";
    this.awayTimeout = 60000 * 5; // five minutes
    this.roomTimeout = 60000 * 20; // twenty minutes
    this.checkInterval = 10000; // ten seconds
    this.transports = [ 'htmlfile', 'xhr-multipart', 'xhr-polling',
                        'jsonp-polling' ];
    
    // Configure deployment settings
    if (process.env.NODE_ENV)
        require("./"+process.env.NODE_ENV+".js").update(this);
   
    return this;
};

