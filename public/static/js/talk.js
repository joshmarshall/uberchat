/* This is the client side chat interface */
var Talk = {

    // Constants
    MAXMESSAGES: 250, // before it starts "cleaning out"

    // User variables
    username: null,
    private: null,
    socket: null,
    room: null,

    // Send a new chat message to the server
    chat: function(message) {
        if (message.replace(/^\s+|\s+$/, "") == "")
            return;
        var data = { command: "chat",
                     message: message };
        if (Talk.private)
            data.private = Talk.private;

        Talk.send(data);
    },

    // Send a final data structure to the socket
    send: function(data) {
        if (!data.room)
            data.room = Talk.room;
        Talk.socket.send(data);
    },

    // Upon initial connection, request a name
    connect: function() {
        Talk.name();
    },

    // Let the user know when he / she has disconnected
    // and empty the user list
    disconnect: function() {
        Talk.commands.error({ message: "You have disconnected."});
        var users = $("#users");
        users.empty();
    },

    // Prompt for name and send it.
    name: function(msg) {
        if (!msg)
            msg = "What's your name?"
        Talk.username = prompt(msg);
        Talk.send({ command: "name", name: Talk.username });
        $("#message").focus();
    },

    // Get list of users for current room
    users: function() {
        Talk.send({ command: "users" });
    },

    // Receive a message from the server and parse it
    receive: function(dataString) {
        var data = JSON.parse(dataString);
        if (Talk.commands.hasOwnProperty(data.command)) {
            Talk.commands[data.command](data);
        } else {
            Talk.commands.error({ message: "Unknown command "+data.command });
        }
    },

    // Tell the server (nicely) that we're leaving
    quit: function() {
        Talk.send({ command: "quit" });
    },

    // The server response commands
    commands: {
        
        // A user is inactive
        away: function(data) {
            var awaySpan = $("<span class='away'></span>");
            awaySpan.text(data.name+" is away.");
            Talk.addEntry(awaySpan);
            Talk.users();
        },

        // A user broadcasted (or private messaged) the room / you
        broadcast: function(data) {
            var prefix = data.name;
            var msgSpan = $("<span class='message'></span>");
            if (data.private) {
                if (data.name == Talk.username) {
                    // you sent this
                    prefix = "(To "+data.private+")";
                    msgSpan.addClass("to-private");
                } else {
                    prefix = "(From "+data.name+")";
                    msgSpan.addClass("private");
                }
            }
            var message = prefix+": "+data.message;
            msgSpan.text(message);
            var li = Talk.addEntry(msgSpan);
            if (data.message.search(new RegExp(Talk.username, 'i'), "") >= 0)
                li.addClass("you");
            var uel = $("#user-"+data.name);
            uel.removeClass("away");
            uel.addClass("active");
        },

        // A new user joined the room
        join: function(data) {
            var message = data.name+" joined the channel.";
            var joinSpan = $("<span class='join'></span>");
            joinSpan.text(message);
            Talk.addEntry(joinSpan);
            if (data.name == Talk.username) {
                // it's YOU!
                var button = $("#send");
                var sendMessage = function(e) {
                    var msg = $("#message");
                    Talk.chat(msg.val());
                    msg.val("");
                }
                button.unbind("click");
                button.click(sendMessage);
                var messageEl = $("#message");
                messageEl.unbind("keyup");
                messageEl.bind("keyup", function (e) {
                    if (e.keyCode == "13") {
                        sendMessage(e);
                    }
                });
            }
            Talk.users();
            $("#message").focus();
        },

        // A user left the room
        leave: function(data) {
            var message = data.name+" left the channel.";
            var leftSpan = $("<span class='left'>"+message+"</span>");
            Talk.addEntry(leftSpan);
            Talk.users();
        },

        // Your submitted name was invalid
        invalidName: function(data) {
            Talk.name(data.message+"\nTry again:");
        },

        // There was an error processing the response
        error: function(data) {
            var message = "ERROR: "+data.message;
            var errorSpan = $("<span class='error'>"+message+"</span>");
            Talk.addEntry(errorSpan);
        },

        // Returning a list of users
        users: function(data) {
            var users = $("#users");
            users.empty();
            var privatePresent = false;
            for (var i=0; i<data.users.length; i++) {
                var user = data.users[i];
                var li = $("<li class='"+user.status+"'></li>");
                li.attr("id", "user-"+user.name);
                if (user.name == Talk.username)
                    li.addClass("you");
                li.unbind("click");
                if (Talk.private && Talk.private == user.name) {
                    li.addClass("private");
                    privatePresent = true;
                    li.bind("click", Talk.clearPrivate);
                } else {
                    li.bind("click", function (event) {
                        var el = event.target;
                        var name = el.id.replace(/^user\-/, "");
                        Talk.addPrivate(name);
                    });
                }
                li.text(user.name);
                users.append(li);
            }
            if (!privatePresent && Talk.private) {
                Talk.clearPrivate();
            }
        }

    },

    // Setting up a private message
    addPrivate: function(name) {
        if (Talk.private)
            Talk.clearPrivate();
        if (name == Talk.username)
            return;
        var recipient = $("#recipient");
        recipient.text("To "+name+":");
        recipient.addClass("private");
        var el = $("#user-"+name);
        el.addClass("private");
        Talk.private = name;
        el.unbind("click");
        el.bind("click", Talk.clearPrivate);
        $("#message").focus();
    },

    // Clearing a private message setup
    clearPrivate: function() {
        var recipient = $("#recipient");
        recipient.text("");
        recipient.removeClass("private");
        var el = $("#user-"+Talk.private);
        el.removeClass("private");
        el.unbind("click");
        el.bind("click", function(e) {
            var elthis = $(e.target);
            var name = elthis.attr("id").replace(/^user\-/, "");
            Talk.addPrivate(name);
        });
        Talk.private = null;
        $("#message").focus();
    },

    // Add a chat entry, whether message, notification, etc.
    addEntry: function(childNode) {
        var li = $("<li class='entry'></li>");
        li.append(childNode);
        var chat = $("#chat");
        while(chat.children().length > Talk.MAXMESSAGES) {
            $(chat.children()[0]).remove();
        }
        chat.append(li);
        var chatRaw = document.getElementById("chat");
        chatRaw.scrollTop = chatRaw.scrollHeight;
        return li;
    },

    // Set up the Talk object.
    init: function(options) {
        Talk.room = options.room;
        Talk.socket = new io.Socket(null, options);
        Talk.socket.connect();
        Talk.socket.on("connect", Talk.connect);
        Talk.socket.on("message", Talk.receive);
        Talk.socket.on("disconnect", Talk.disconnect);
        window.onbeforeunload = Talk.quit;
    }

};

