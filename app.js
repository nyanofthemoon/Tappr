'use strict';

var CONFIG = require(__dirname + '/config');

var express = require('express');
var app     = express();

var bodyParser = require('body-parser');
app.use (bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var http = require('http').createServer(app);
var io = require('socket.io')();
io.listen(http);

var options = {
    dotfiles  : 'ignore',
    etag      : false,
    extensions: ['htm', 'html'],
    index     : 'index.html',
    maxAge    : '1d',
    redirect  : false,
    setHeaders: function (res, path, stat) {
        res.set('x-timestamp', Date.now());
    }
};

var gameId              = null;
var leaderboardInterval = null;
var game_status         = 'stopped';

var players         = [];
var admin_socket_id = null;

app.use(express.static('public', options));

app.post('/admin/login', function (req, res) {
    var isAuthenticated = false;
    if (req.body.username == CONFIG.credentials.username && req.body.password == CONFIG.credentials.password) {
        isAuthenticated = true;
        admin_socket_id = req.body.socketId;
    }
    
    res.send({"authentication": isAuthenticated});
}); 

app.get('/admin', function (req, res) {
    res.sendFile(__dirname + '/public/admin/index.html');
});

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/public/player/index.html');
});

io.on('connection', function(socket) {

    console.log('Socket Connected', socket.id);
    socket.emit('debug', {'test': 'server'});
    
    socket.on('error', function(data) {
        console.log("Socket Error " + this.id);
    });
    
    socket.on('disconnect', function(data) {
        console.log("Socket Disconnected " + this.id);
        for (var index in players) {
            if (players[index].socket_id == this.id) {
                console.log("Player Removed: " + players[index].name);
                delete players[index];
                break;
            }
        }

    });
    
    socket.on('add_player', function(data) {
        var isAlreadyInList = false;
        for (var index in players) {
            if (players[index].name == data.name) {
                isAlreadyInList = true;
                console.log(players.name + " already exists");
                break;
            }
        }
        
        if (isAlreadyInList) {
             socket.emit('add_player', {'addition': false, 'message': 'Already in list'});
        } else {
            players.push({name: data.name, socket_id: this.id, tap_count:0});
            socket.join(gameId);
            socket.emit('add_player', {'addition': true, 'message': 'Welcome!'});
        }
    });
    
    socket.on('timer_start', function(data) {
        if (admin_socket_id === this.id && game_status === 'stopped') {
                players     = [];
                game_status = 'waiting';
                gameId      = generateUniqueGameId();
                
            setTimeout(function() {
                game_status = 'started';
                io.to(admin_socket_id).emit ('game_start');
                io.to(gameId).emit('game_start');
                leaderboardInterval = setInterval(function() {

                    var players_no_sockets = players.filter(function (el) {
                        return el.name && el.tap_count;
                    });
                        
                    //players_no_sockets.push({name:el.name, tap_count: el.tap_count});
                    // @TODO go through all players and filter out socketId
                    
                  io.to(admin_socket_id).emit('tap_update', players_no_sockets); //NEED TO POPULATE THIS!! 
                }, 1000);
                
                
                // *****************************************************
                //@NOTE Dre, I think 5000 is 5 seconds and not 5 minutes.
                // 1000 = 1000 milliseconds or 1 second
                
                
                //******************************************************
                //@NOTE yes, this was done just for testing purposes - we will put it back to 300000 when we are ready to test fully
            }, 5000);
        }
    
    });
    
    
    
    
    socket.on('game_status', function(data) {
        socket.emit('game_status', {status: game_status});
    });
    
    socket.on('player_click', function(data) {
        for (var index in players) {
            if (players[index].name == data.name) {
                players[index].tap_count++;
                if (players[index].tap_count >= 100) {
                    clearInterval(leaderboardInterval);
                    socket.to(gameId).emit('game_stop');
                    io.to(admin_socket_id).emit('game_stop');
                }
                
                break;
            }
        }
        
        
    });
        

    
       
    /*
    socket.on('ping', function(socket) {
        console.log('Sending Event To Socket ' + socket.id);
        socket.emit('pong', {});
    });
    
    socket.on('channel-ping', function(socket) {
        console.log('Sending Event To All Sockets Joined Subscribed To Channel');
        socket.to('channelName').emit('channel-pong', {});
        io.to(admin_socket_id).emit   TO SEND EVENT TO ADMIN
    });
    
    socket.on('broadcast-ping', function(socket) {
        console.log('Broadcastying Accross All Sockets');
        io.emit('broadcast-pong', {});
    });

    // Example : Socket Joins a Channel
    socket.join('channelName');
    socket.emit('connect-event', { some: 'data' });*/
});

http.listen(CONFIG.environment.port);

// Helper Functions //

function generateUniqueGameId() {
    return 'game' + new Date().getTime();
}
