var express = require('express');
var app = require('express')();
app.use(express.static('public'));
var server = app.listen(3000);
var io = require('socket.io').listen(server);

var players = {};

io.on('connection', function (socket) {
    // een speler heeft connectie gemaakt
    socket.on('join', function (data) {
        // voeg toe aan spelers array
        players[socket.id] = {
            name: data.name    
        };
        
        console.log("'join' commando gekregen van " + players[socket.id].name);
        
        // stuur daarna een 'chat' commando naar alle clients
        io.emit('chat', { 
            message: players[socket.id].name + " heeft connectie gemaakt"
        });
    });
    
    // wanneer een speler de verbinding heeft gesloten
    socket.on('disconnect', function () {
        if(players[socket.id] != null) {
            console.log("'disconnect' commando gekregen van " + players[socket.id].name);
        
            players[socket.id] = null; 
        }
    });
    
    // wanneer we een 'chat' commando krijgen van een client
    socket.on('chat', function (message) {
        console.log("'chat' commando gekregen van " + players[socket.id].name);
        
        // versturen we het commando genaamd 'chat' naar alle clients
        io.emit('chat', {
            message: players[socket.id].name + ": " + message
        });
    });
});