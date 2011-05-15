/* UBERCHAT
This is just a simple chat program that lets you create rooms
and send out links to your friends.
*/

var express = require("express");
var app = express.createServer();

// Configuration
app.use(express.static(__dirname + '/public'));
app.use(express.cookieParser({"secret": "whatever1234"}));
app.use(express.bodyParser());
app.set("view engine", "ejs");
app.set("view options", { layout: false });

// Routes
app.get("/", function(req, res) {
    var xsrf = generateId();
    res.cookie("_xsrf", xsrf);
    res.render("index.ejs", { xsrf: xsrf });
});

app.post("/room", function(req, res) {
    var xsrf = req.cookies["_xsrf"];
    if (!req.header("content-type") == "application/json")
        return res.send({ error: "Content not JSON." }, 400);
    var matchXsrf = req.body._xsrf;
    if (!xsrf || !matchXsrf || !(xsrf == matchXsrf))
        return res.send({ error: "Unauthorized"}, 403);
    var name = req.body.name;
    res.header('content-type', 'application/json');
    name = name.replace(/^\s+|\s+$/, "");
    if (!name || name.length < 4 || name.replace(/^[\w\s]+$/, "") != "")
        return res.send({ error: "Invalid name."}, 400);
    var id = generateId();
    room = Rooms.createRoom(id, name);
    res.send({ url: room.url }, 200);
});

app.get("/room/:id", function(req, res) {
    var room = Rooms.getRoom(req.params.id);
    if (!room)
        // don't know, going home
        return res.redirect("/");
    res.render("room.ejs", { room: room });
});

// Starting HTTP server
app.listen(3000);

// Setting up Socket.IO
var io = require("socket.io");
var socket = io.listen(app, { transports: [ 'htmlfile', 'xhr-multipart', 
                                            'xhr-polling', 'jsonp-polling' ]});

// Random id generator
var generateId = function() {
    var id = '';
    var chars = 'abcdefghijklmnopqrstuvwxyz'+
                'ABCDEFGHIJKLMNOPQRSTUVWXYZ'+
                '0123456789-_';
    for (i=0; i<10; i++) {
        var index = Math.floor(Math.random() * chars.length)
        id += chars[index];
    }
    return id;
};

// A single chat room
var Room = function(id, name) {
    this.name = name;
    this.id = id;
    this.url = "/room/"+this.id;
    this.password = null;
    this.users = new Users(this.name);
    this.created = new Date().getTime();

    // Wrapper for Users.addUser
    this.addUser = function(user) {
        this.users.addUser(user);
    };

    // Wrapper for Users.getUser
    this.getUser = function(name) {
        return this.users.getUser(name);
    };

    // Wrapper for Users.allUsers
    this.allUsers = function() {
        return this.users.allUsers();  
    };

    // Wrapper for Users.sendToAll
    this.sendToAll = function(data) {
        this.users.sendToAll(data);
    };

    // Wrapper for Users.sendToOne
    this.sendToOne = function(user, data) {
        this.users.sendToOne(user, data);
    };

    // Wrapper for Users.checkAway
    this.checkActivity = function() {
        result = this.users.checkAway();
        if (!result)
            result = this.created;
        return result;
    };

    // Wrapper for Users.removeUser
    this.removeUser = function(user) {
        return this.users.removeUser(user);
    };
}

var ROOMTIMEOUT = 60000 * 10; // ten minutes (if no users around)

// All of the chat rooms associated with this server
var Rooms = {
    rooms: {},

    // adding a new room to the room list
    createRoom: function(id, name) {
        var room = Rooms.rooms[id];
        if (room && room.id)
            return null; // already taken
        Rooms.rooms[id] = new Room(id, name);
        return Rooms.rooms[id];
    },

    // retrieving a room object from the room list
    getRoom: function(id) {
        var room = Rooms.rooms[id];
        if (!room || !room.id)
            return null;
        return room;
    },

    // set users to 'away' / 'active', and delete rooms
    // if necessary
    checkActivity: function () {
        for (roomName in Rooms.rooms) {
            if (!Rooms.rooms.hasOwnProperty(roomName))
                continue;
            var room = Rooms.rooms[roomName];
            var lastActivity = room.checkActivity();
            var expires = lastActivity + ROOMTIMEOUT;
            var userCount = room.allUsers().length;
            if (expires < new Date().getTime() && userCount == 0) {
                // deleting room
                var room = Rooms.rooms[roomName];
                Rooms.rooms[roomName] = null;
            }
        }
    },

    // delete a room, alerting any remaining users
    closeRoom: function(name, data) {
        if (!data.message) {
            data.message = "Closing room.";
        }
        Commands.close(Rooms.rooms[name].users, data); 
    }
    
};

// A simple user object
var User = function(client) {
    this.name = null;
    this.client = client;
    this.session = client.sessionId;
    this.activity = new Date().getTime();
    this.status = "active";
    this.room = null;
    this.send = function(data) {
        this.client.send(data);
    };
    this.getRoom = function() {
        return Rooms.getRoom(this.room);
    };
};

var AWAYTIMEOUT = 60000 * 5; // five minutes

// A list of users, with appropriate methods
var Users = function(room) {
    this.room = room;

    // Add a new user to the room
    this.addUser = function(user) {
        this[user.name] = user;
    };

    // Checks to see if a user exists
    this.getUser = function(name) {
        var user = this[name];
        if (user && user.name) {
            return user;
        };
    };

    // Pull a user from the object
    this.removeUser = function(user) {
        user.status = "quit";
        testUser = this[user.name];
        if (testUser && testUser.session == user.session) {
            this[user.name] = null;
            return true;
        } else {
            console.log("sessions don't match -- not deleting.");
            return false;
        }
    };

    // Return all valid users
    this.allUsers = function() {
        var users = [];
        for (attr in this) {
            if (!this.hasOwnProperty(attr))
                continue;
            var user = this.getUser(attr);
            if (user && user.name) {
                users.push(user);
            }
        }
        return users;
    };

    // Send a message to all users in this list
    this.sendToAll = function(data) {
        var msg = JSON.stringify(data);
        var users = this.allUsers();
        for (var i=0; i<users.length; i++) {
            user = users[i];
            user.send(msg);
        }
    };

    // Send a message to a single user
    this.sendToOne = function(user, data) {
        var msg = JSON.stringify(data);
        user.send(msg);
    };

    // Check which users are inactive ('away')
    this.checkAway = function() {
        var mostRecent = 0;
        var users = this.allUsers();
        var now = new Date().getTime();
        for (var i=0; i<users.length; i++) {
            var user = users[i];
            if (!user.activity)
                continue;
            if (user.activity > mostRecent)
                mostRecent = user.activity;
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
        return mostRecent;
    };

};

// The list of interface commands the server can send / receive
var Commands = {
    
    // Alert all users that a room is closing
    close: function(room, data) {
        data = { command: "close",
                 message: data.message };
        room.sendToAll(data);
    },

    // Alert a room that a user is inactive (away)
    away: function(user, data) {
        data = { command: "away",
                 name: user.name };
        user.getRoom().sendToAll(data);
    },

    // Broadcast a chat message (may be a 'private' broadcast)
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
            toUser = user.getRoom().users[privateUser];
            if (!toUser)
                return Commands.error(user, "User doesn't exist or left.");
            user.getRoom().sendToOne(toUser, data);
            user.getRoom().sendToOne(user, data);
        } else {
            user.getRoom().sendToAll(data);
        }
    },

    // Send an error to a single user
    error: function(user, message) {
        var data = { name: user.name,
                     message: message,
                     command: "error" };
        user.getRoom().sendToOne(user, data);
    },

    // A user requested an invalid name
    invalidName: function(user, message) {
        data = { command: "invalidName",
                 name: user.name,
                 message: message };
        user.getRoom().sendToOne(user, data);
    },

    // A user has 'joined' a room (valid name)
    join: function(user, data) {
        user.getRoom().addUser(user);
        user.activity = new Date().getTime();
        data = { command: "join",
                 name: user.name }
        user.getRoom().sendToAll(data);
    },

    // A user has left a room (DCed, etc.)
    leave: function(user, data) {
        data = { command: "leave",
                 name: user.name }
        var room = user.getRoom();
        if (!room) {
            console.log("No room for user?");
            return;
        }
        var result = room.removeUser(user);
        if (result)
            user.getRoom().sendToAll(data);
    },

    // A user has requested a list of users in the room
    users: function(user, data) {
        userData = [];
        users = user.getRoom().allUsers();
        for (var i=0; i<users.length; i++) {
            userData.push({ name: users[i].name,
                            status: users[i].status });
        }
        data = { command: "users",
                 users: userData }
        user.getRoom().sendToOne(user, data);
    },

    // The request commands (from a user)
    commands: {
        
        // A user is submitting a name for the room
        name: function(user, data) {
            var message = null;
            if (!data.name || data.name.length < 3)
                message = "Name must be 3 characters or longer.";
            if (!data.name || data.name.replace(/^\w+$/g, "") != "")
                message = "Only letters, numbers, and _ are allowed.";
            if (user.getRoom().getUser(data.name))
                message = "That name is taken.";
            if (message)
                return Commands.invalidName(user, message);

            if (user.name) {
                return Commands.error(user, "Can't change name!");
            }
            user.name = data.name;
            Commands.join(user, data);
        },

        // A user has submitted a message
        chat: function(user, data) {
            Commands.broadcast(user, data);
        },

        // A user has requested a list of users
        users: function(user, data) {
            Commands.users(user, data);
        },

        // A user quits the channel nicely
        quit: function(user, data) {
            Commands.leave(user, data);
        }

    },

    // Parse a requested command
    parse: function(user, data) {
        if (!user.room && !data.room)
            return Commands.error(user, "Unknown room.");
        if (!user.room) {
            var room = Rooms.getRoom(data.room);
            if (!room)
                return Commands.error(user, "Unknown room.");
            user.room = data.room;
        }
        if (Commands.commands.hasOwnProperty(data.command)) {
            Commands.commands[data.command](user, data);
        } else {
            Commands.error(user, "Unknown command: "+data.command);
        }
    }

};

// Attach basic socket event listeners
socket.on("connection", function(client) {
    client.user = new User(client);
    client.on("message", function(data) {
        Commands.parse(client.user, data);
    });

    client.on("disconnect", function() {
        Commands.leave(client.user, {});
    });
});

// Set up activity checking interval
var activityInterval = setInterval(Rooms.checkActivity, 5000);
