const ipcMain = require('electron').ipcMain;
const dialog = require('electron').dialog;

const async = require('async');
const path = require('path');
const nedb = require('nedb'),
      db = new nedb({filename: path.join(__dirname, 'live.db'), autoload: true, onload: (err) => {}});

const ajax = require('./ajax');

function initDB(localdb) {
    localdb.ensureIndex({fieldName: 'id', unique: true}, (err) => {});
}

function loadIDs(localdb, cb) {
    localdb.find({}, {id: 1, subject: 1, _id: 0}, function(err, docs) {
        cb(err, docs);
    });
}

function mergeDB(localdb, srcdb, cb) {
    srcdb.find({}, {_id:0}, function(err, docs) {
        if (err) cb(err);
        else {
            async.each(docs, function(eachdoc, callback) {
                localdb.update({id: eachdoc.id}, eachdoc, {upsert: true}, callback);
            }, cb);
        }
    });
}

// AJAX
(function() {
    initDB(db);
    ipcMain.on('loadList', function(event, arg) {
        loadIDs(db, function(err, ret) {
            if (err) event.sender.send('loadList-error', err);
            else event.sender.send('loadList-reply', ret);
        });
    });
    ipcMain.on('getZhihuLivesList', function(event, arg) {
        ajax.getUserLives(arg.userid, arg.z_c0, function (err, ret) {
            if (err) event.sender.send('getZhihuLivesList-error', err);
            else event.sender.send('getZhihuLivesList-reply', ret);
        });
    });
    ipcMain.on('getZhihuLivesData', function(event, arg) {
        async.each(arg.list, function (item, cb) {
            ajax.getLiveMessages(item.id, arg.z_c0, function (err, ret) {
                if (err) cb(err);
                else {
                    // save in db
                    db.update({id: item.id}, {
                        id: item.id,
                        status: item.status,
                        subject: item.subject,
                        speaker: item.speaker,
                        description: item.description,
                        message: ret
                    }, {
                        upsert: true
                    }, cb);
                }
            })
        }, function (err) {
            if (err) event.sender.send('getZhihuLivesData-error', err);
            else event.sender.send('getZhihuLivesData-reply');
        });
    });
    ipcMain.on('deleteData', function(event, arg) {
        async.each(arg, function (liveid, cb) {
            db.remove({id: liveid}, {}, cb);
        }, function (err) {
            if (err) console.log(err);
        });
    })
    ipcMain.on('importDatabase', function(event) {
        dialog.showOpenDialog({
            properties: ['openFile', 'openDirectory']
        }, function (files) {
            if (files) {
                // only process files[0]
                var ndb = new nedb({filename: files[0], autoload: true, onload: function (err) {
                    if (err) event.sender.send('importDatabase-error', err);
                }});
                mergeDB(db, ndb, (err) => {
                    if (err) event.sender.send('importDatabase-error', err);
                    else event.sender.send('importDatabase-reply');
                });
            }
        });
    });
    ipcMain.on('getLiveDetail', function(event, args) {
        db.find({id: args}, {_id: 0}, function(err, docs) {
            if (err) event.sender.send('getLiveDetail-error', err);
            else event.sender.send('getLiveDetail-reply', docs[0]);
        });
    });
})();
