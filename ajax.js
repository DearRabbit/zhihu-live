const request = require('request');
const async = require('async');

function getUserLives(id, zc0, cbMain) {
    var liveList = [];
    var options = {
        url: 'https://api.zhihu.com/people/'+id+'/lives',
        json: true,
        headers: {
            'cookie': 'z_c0='+zc0
        }
    };

    var is_end = false;
    async.doWhilst(
        function (cbEnd) {
            request(options, function (err, res, body) {
                if (err) cbEnd(err);
                else if (res.statusCode != 200) cbEnd(new Error(res.statusCode));
                else {
                    for (var i of body.data) {
                        liveList.push({
                            id: i.id,
                            subject: i.subject,
                            status: i.status,
                            speaker: {
                                id: i.speaker.member.id,
                                name: i.speaker.member.name,
                                avatar: processAvatar(i.speaker.member.avatar_url),
                            },
                            description: i.description
                        });
                    }
                    is_end = body.paging.is_end;
                    options.url = body.paging.next;
                    cbEnd();
                }
            });
        },
        function () {
            return !is_end;
        },
        function (err) {
            cbMain(err, liveList);
        }
    );
}
function processImage(url) {
    return url.replace(/_[a-z]+.jpg/, '_b.jpg 2x');
}
function processAvatar(url) {
    return url.replace(/_[a-z]+.jpg/, '_xl.jpg 2x');
}

function processMessage(msg) {
    var ret = {
        id: msg.id,
        type: msg.type,
        created_at: msg.created_at,
    };

    // sender
    ret.sender = {
        id: msg.sender.member.id,
        name: msg.sender.member.name,
        avatar: processAvatar(msg.sender.member.avatar_url),
        role: msg.sender.role
    }

    if (msg.replies) ret.replies = msg.replies;
    if (msg.in_reply_to) ret.in_reply_to = msg.in_reply_to;

    switch (msg.type) {
        case 'audio':
            ret.audio = {
                url: msg.audio.url,
                duration: msg.audio.duration
            }
            break;
        case 'text':
            ret.text = msg.text;
            break;
        case 'image':
            ret.image = msg.image;
            ret.image.url = processImage(ret.image.url);
            break;
        default: break;
    }
    return ret;
}

function getLiveMessages(id, zc0, cbMain) {
    var messageList = [];

    var limit = 30;
    var baseurl = 'https://api.zhihu.com/lives/'+id+'/messages?limit=' + limit + '&chronology=desc';
    var options = {
        url: baseurl,
        json: true,
        headers: {
            'cookie': 'z_c0='+zc0
        }
    };

    var unload_count = 0;
    async.doWhilst(
        function (cbEnd) {
            request(options, function (err, res, body) {
                if (err) cbEnd(err);
                else if (res.statusCode != 200) cbEnd(new Error(res.statusCode));
                else {
                    for (var idx = body.data.length - 1; idx >= 0; idx--) {
                        messageList.push(processMessage(body.data[idx]));
                    }
                    unload_count = body.unload_count;
                    options.url = baseurl + '&before_id=' + body.data[0].id;
                    cbEnd();
                }
            });
        },
        function () {
            return unload_count > limit;
        },
        function (err) {
            cbMain(err, messageList.reverse());
        }
    );
}

module.exports = {
    getUserLives: getUserLives,
    getLiveMessages: getLiveMessages
}
