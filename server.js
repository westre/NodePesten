var express = require('express');
var app = require('express')();
app.use(express.static('public'));
var server = app.listen(3000);
var io = require('socket.io').listen(server);

var servers = [ 
    { name: 'Kamer 1', players: {}, state: 'lobby' }, 
    { name: 'Kamer 2', players: {}, state: 'lobby' }, 
    { name: 'Kamer 3', players: {}, state: 'lobby' } 
];

io.on('connection', function (socket) {    
    socket.on('request_servers', function (fn) {
        fn(servers);
        
        console.log('request_servers: ' + servers.length);
	});
    
    socket.on('join_server', function (data, fn) {
        socket.join(data.server);
        
        var joinedServer = getServerByName(data.server);
        
        // geen spelers? maak speler de host/game leader!
        if(Object.keys(joinedServer.players).length == 0) {
            joinedServer.players[socket.id] = {
                name: data.player,
                host: true
            };
            // stuur event terug met of ie host is en een lijst met spelers
            fn(true, joinedServer.state, joinedServer.players);
        }
        else {
            joinedServer.players[socket.id] = {
                name: data.player,
                host: false
            };
            // stuur event terug met of ie host is en een lijst met spelers
            fn(false, joinedServer.state, joinedServer.players);
        } 
        
        // update bestaande spelers en zeg dat er een nieuwe speler is gejoint
        io.to(data.server).emit('message', joinedServer.players[socket.id].name + ' is de server ingekomen');
        io.to(data.server).emit('update_player_list', joinedServer.players);    
                
        console.log('join_server: ' + data.server + ', aantal spelers: ' + Object.keys(joinedServer.players).length);
	});
    
    socket.on('leave_server', function (server) {
        socket.leave(server);
        
        var leftServer = getServerByName(server);     
  
        // update bestaande spelers en zeg dat er een nieuwe speler is gejoint
        io.to(server).emit('message', leftServer.players[socket.id].name + ' is de server uitgegaan');
        
        delete leftServer.players[socket.id];
        
        // update bestaande spelers en zeg dat er een nieuwe speler is gejoint
        io.to(server).emit('update_player_list', leftServer.players);    
        
        console.log('leave_server: ' + server + ', aantal spelers: ' + Object.keys(leftServer.players).length);
	});
    
    socket.on('send_message', function (data) {
        // stuur data naar de server door .to methode
        io.to(data.server).emit('message', data.message);
        
        console.log('send_message: ' + data.message + " to: " + data.server);
	});
    
    socket.on('disconnect', function() {
        for(var server in servers) {
            for(var player in servers[server].players) {
                if(player == socket.id) {
                    console.log("player: " + servers[server].players[player].name + " browser afgesloten/refresh");
                    io.to(server).emit('message', servers[server].players[player].name + ' is de server uitgegaan');
                    
                    delete servers[server].players[player];
                    
                    // update bestaande spelers en zeg dat er een nieuwe speler is gejoint
                    io.to(server).emit('update_player_list', servers[server].players); 
                    break;
                }               
            }
        }
    });
    
    socket.on('start_game', function (server) {
        // todo: server-side check of gozert wel echt de host is
        var theServer = getServerByName(server);
        theServer.state = 'playing';
              
        io.to(server).emit('game_has_started');
        
        console.log('game_has_started: ' + server);
	});
});

function getServerByName(name) {
    var found = null;
    
    servers.forEach(function (server) {
        if(server.name == name) {
            found = server;
        } 
    });
    
    return found;  
}