var express = require('express');
var app = require('express')();
app.use(express.static('public'));
var server = app.listen(3000);
var io = require('socket.io').listen(server);

var servers = [ {name: 'testsrv1', players: {}}, {name: 'testsrv2', players: {}}, {name: 'testsrv3', players: {}} ];

io.on('connection', function (socket) {
    // misschien is dit niet nodig   
    socket.on('add_server', function (data) {
		servers.push(data);
        
        console.log('add_server: ' + data.name);
	});
    
    socket.on('request_servers', function (fn) {
        fn(servers);
        
        console.log('request_servers: ' + servers.length);
	});
    
    socket.on('join_server', function (data) {
        socket.join(data.server);
        
        var joinedServer = getServerByName(data.server);     
        joinedServer.players[socket.id] = {
            name: data.player
        };
        
        console.log('join_server: ' + data.server + ', aantal spelers: ' + Object.keys(joinedServer.players).length);
	});
    
    socket.on('leave_server', function (server) {
        socket.leave(server);
        
        var leftServer = getServerByName(server);     
        delete leftServer.players[socket.id];
        
        console.log('leave_server: ' + server + ', aantal spelers: ' + Object.keys(leftServer.players).length);
	});
    
    socket.on('send_message', function (data) {
        // stuur data naar de server door .to methode
        io.to(data.server).emit('message', data.message);
        
        console.log('send_message: ' + data.message + " to: " + data.server);
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