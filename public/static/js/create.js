Create = {

    valid: false,

    init: function() {
        $("#room-name").unbind("keyup");
        $("#room-name").bind("keyup", Create.validate);
        Create.validate(); // just in case FF or something prepopulated
    },

    post: function() {
        var xsrf = $("#_xsrf").val();
        var name = $("#room-name").val();
        var data = { _xsrf: xsrf, name: name };
        $.ajax({ url: "/room",
                 type: "POST",
                 contentType: "application/json",
                 data: JSON.stringify(data),
                 success: Create.success,
                 error: Create.error });
        Create.disableButton("Going...");
    },

    success: function(data) {
        window.location.href = data.url;
    },

    error: function(data) {
        alert("Error sending name: "+data.error);
        Create.validate();
    },

    validate: function() {
        var name = $("#room-name").val();
        name = name.replace(/^\s+|\s+$/, "");
        if (!name) {
            Create.disableButton("No Name");
            return null;
        }
        if (name.length < 4) {
            Create.disableButton("Name Too Short");
            return null;
        }
        if (name.replace(/^[\w\s+]+/i, "") != "") {
            Create.disableButton("Invalid Name");
            return null;
        }
        Create.enableButton("Make It!");
        return name;
    },

    disableButton: function(message) {
        var button = $("#room-name-button");
        button.unbind("click");
        button.addClass("disabled");
        button.text(message);
        button.css("opacity", 0.5);
    },

    enableButton: function(message) {
        var button = $("#room-name-button");
        button.removeClass("disabled");
        button.text(message);
        button.css("opacity", 1);
        button.unbind("click");
        button.bind("click", Create.post);
    }

};

$(Create.init);
