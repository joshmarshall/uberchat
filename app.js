var express = require("express");

var app = express.createServer();
app.configure(function() {
    app.use(express.static(__dirname + '/public'));
});
app.set("view engine", "ejs");
app.set("view options", { layout: false });
app.get("/", function(req, res) {
    res.render("index.ejs", { title: "TESTING!" });
});
app.listen(3000);

var io = require("socket.io");
var socket = io.listen(app, { transports: [ 'htmlfile', 'xhr-multipart', 
                                            'xhr-polling', 'jsonp-polling' ]});
var User = function() {
    this.name = null;
    this.client = null;
    this.activity = null;
    this.status = null;
};

var AWAYTIMEOUT = 60000 * 5; // five minutes

var Users = {
    
    allUsers: function() {
        var users = [];
        for (attr in Users) {
            if (Users.hasOwnProperty(attr) && Users[attr].name) {
                users.push(Users[attr]);
            }
        }
        return users;
    },

    sendToAll: function(data) {
        var msg = JSON.stringify(data);
        var users = Users.allUsers();
        for (var i=0; i<users.length; i++) {
            user = users[i];
            user.client.send(msg);
        }
    },

    sendToOne: function(user, data) {
        var msg = JSON.stringify(data);
        user.client.send(msg);
    },

    checkAway: function() {
        var users = Users.allUsers();
        var now = new Date().getTime();
        for (var i=0; i<users.length; i++) {
            var user = users[i];
            if (!user.activity)
                continue;
            var diff = now - user.activity;
            if (diff > AWAYTIMEOUT) {
                if (user.status != "away") {
                    
                    user.status = "away";
                    Commands.away(user, {});
                }
            } else {
                user.status = "active";
            }
        }
    }

};

var Commands = {
    
    away: function(user, data) {
        data = { command: "away",
                 name: user.name };
        Users.sendToAll(data);
    },

    broadcast: function(user, data) {
        user.activity = new Date().getTime();
        if (user.status == "away")
            user.status = "active";
        privateUser = data.private;
        data = { command: "broadcast",
                 message: data.message,
                 name: user.name };
        if (privateUser) {
            data.private = privateUser;
            toUser = Users[privateUser];
            if (!toUser)
                return Commands.error(user, "User doesn't exist or left.");
            Users.sendToOne(toUser, data);
            Users.sendToOne(user, data);
        } else {
            Users.sendToAll(data);
        }
    },

    error: function(user, message) {
        var data = { name: user.name,
                     message: message,
                     command: "error" };
        Users.sendToOne(user, data);
    },

    invalidName: function(user, message) {
        data = { command: "invalidName",
                 name: user.name,
                 message: message };
        Users.sendToOne(user, data);
    },

    join: function(user, data) {
        Users[user.name] = user;
        user.activity = new Date().getTime();
        data = { command: "join",
                 name: user.name }
        Users.sendToAll(data);
    },

    leave: function(user, data) {
        data = { command: "leave",
                 name: user.name }
        Users.sendToAll(data);
        delete Users[user.name];
    },

    users: function(user, data) {
        userData = [];
        users = Users.allUsers();
        for (var i=0; i<users.length; i++) {
            userData.push({ name: users[i].name,
                            status: users[i].status });
        }
        data = { command: "users",
                 users: userData }
        Users.sendToOne(user, data);
    },

    commands: {
        
        name: function(user, data) {
            var message = null;
            if (!data.name || data.name.length < 3)
                message = "Name must be 3 characters or longer.";
            if (!data.name || data.name.replace(/^\w+$/g, "") != "")
                message = "Only letters, numbers, and _ are allowed.";
            if (Users.hasOwnProperty(data.name)) 
                message = "That name is taken.";
            if (message)
                return Commands.invalidName(user, message);

            if (user.name) {
                return Commands.error(user, "Can't change name!");
            }
            user.name = data.name;
            Commands.join(user, data);
        },

        chat: function(user, data) {
            Commands.broadcast(user, data);
        },

        users: function(user, data) {
            Commands.users(user, data);
        }

    },

    parse: function(user, data) {
        if (Commands.commands.hasOwnProperty(data.command)) {
            Commands.commands[data.command](user, data);
        } else {
            Commands.error(user, "Unknown command: "+data.command);
        }
    }

};

socket.on("connection", function(client) {
    client.user = new User();
    client.user.client = client;
    client.on("message", function(data) {
        Commands.parse(client.user, data);
    });

    client.on("disconnect", function() {
        Commands.leave(client.user, {});
    });
});

var awayInterval = setInterval(Users.checkAway, 5000);
