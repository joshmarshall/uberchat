var Talk = {
    username: null,
    private: null,
    socket: null,

    chat: function(message) {
        if (message.replace(/^\s+|\s+$/, "") == "")
            return;
        var data = { command: "chat",
                     message: message };
        if (Talk.private)
            data.private = Talk.private;

        Talk.send(data);
    },

    send: function(data) {
        Talk.socket.send(data);
    },

    connect: function() {
        Talk.name();
        document.body.style.cursor = "default";
    },

    disconnect: function() {
        Talk.commands.error({ message: "You have disconnected."});
        var users = $("#users");
        users.empty();
    },

    name: function(msg) {
        if (!msg)
            msg = "What's your name?"
        Talk.username = prompt(msg);
        Talk.send({ command: "name", name: Talk.username });
    },

    users: function() {
        Talk.send({ command: "users" });
    },

    receive: function(dataString) {
        var data = JSON.parse(dataString);
        if (Talk.commands.hasOwnProperty(data.command)) {
            Talk.commands[data.command](data);
        } else {
            console.log("Unknown command: "+data.command);
        }
    },

    commands: {
        
        away: function(data) {
            var awaySpan = $("<span class='away'></span>");
            awaySpan.text(data.name+" is away.");
            Talk.addEntry(awaySpan);
            Talk.users();
        },

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
        },

        leave: function(data) {
            var message = data.name+" left the channel.";
            var leftSpan = $("<span class='left'>"+message+"</span>");
            Talk.addEntry(leftSpan);
            Talk.users();
        },

        invalidName: function(data) {
            Talk.name(data.message+"\nTry again:");
        },

        error: function(data) {
            var message = "ERROR: "+data.message;
            var errorSpan = $("<span class='error'>"+message+"</span>");
            Talk.addEntry(errorSpan);
        },

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

    addEntry: function(childNode) {
        var li = $("<li class='entry'></li>");
        li.append(childNode);
        var chat = $("#chat");
        chat.append(li);
        var chatRaw = document.getElementById("chat");
        chatRaw.scrollTop = chatRaw.scrollHeight;
        return li;
    },

    init: function() {
        var options = { transports: ['htmlfile', 
                                     'xhr-multipart', 'xhr-polling', 
                                     'jsonp-polling' ]};
        Talk.socket = new io.Socket(null, options);
        Talk.socket.connect();
        Talk.socket.on("connect", Talk.connect);
        Talk.socket.on("message", Talk.receive);
        Talk.socket.on("disconnect", Talk.disconnect);
    }

};

