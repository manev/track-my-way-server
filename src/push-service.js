function push(args, currentUser, callback) {
    var data = JSON.parse(args);
    var targetUser = data.targetUser;
    var sharedUrl = data.sharedUrl;

    var sendNotification = function (data) {
        var headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": "Basic NDY1OWVlODEtM2Y4YS00NjZlLWIxYTgtZjczYjM0ZjFjNmNm"
        };

        var options = {
            host: "onesignal.com",
            port: 443,
            path: "/api/v1/notifications",
            method: "POST",
            headers: headers
        };

        var https = require('https');
        var req = https.request(options, function (res) {
            res.on('data', function (data) {
                var errors = JSON.parse(data).errors;
                if (errors && errors.length > 0)
                    callback(JSON.stringify({
                        error: errors[0]
                    }));
                else
                    callback();
            });
        });

        req.on('error', function (e) {
            console.log("ERROR:");
            console.log(e);
            callback(e);
        });

        req.write(JSON.stringify(data));
        req.end();
    };

    var message = {
        app_id: "2f7c3177-9126-4fc5-94a4-53187cd2fa43",
        contents: {
            "en": currentUser.FirstName + " wants to share location"
        },
        url: sharedUrl,
        data: data,
        include_player_ids: [targetUser.PushId]
    };

    sendNotification(message);
}

module.exports = push;