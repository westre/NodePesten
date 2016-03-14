var express = require('express');
var app = require('express')();
app.use(express.static('public'));
var server = app.listen(3000);
var io = require('socket.io').listen(server);

// johnnys gamejs
//eval(require('fs').readFileSync('game.js').toString());

var servers = [ 
    { name: 'Kamer 1', cardStack: [], pot: [], players: {}, state: 'lobby', currentTurnOrder: -1 }, 
    { name: 'Kamer 2', cardStack: [], pot: [], players: {}, state: 'lobby', currentTurnOrder: -1 }, 
    { name: 'Kamer 3', cardStack: [], pot: [], players: {}, state: 'lobby', currentTurnOrder: -1 } 
];

io.on('connection', function (socket) {    
    // dit wordt geroepen wanneer er een request wordt uitgevoerd op serverlist.html
    socket.on('request_servers', function (fn) {
        fn(servers);
        
        console.log('request_servers: ' + servers.length);
	});
    
    // dit wordt geroepen wanneer een speler een kamer joint
    socket.on('join_server', function (data, fn) {
        // join kamer
        socket.join(data.server);
        
        var joinedServer = getServerByName(data.server);
        
        // geen spelers? maak speler de host/game leader!
		if (Object.keys(joinedServer.players).length == 0) {
            joinedServer.players[socket.id] = {
                name: data.player,
                host: true,
                hand: {},
                turnOrder: -1
            };
            // stuur event terug met of ie host is en een lijst met spelers
            fn(true, joinedServer.state, joinedServer.players);
        }
        else {
            joinedServer.players[socket.id] = {
                name: data.player,
                host: false,
                hand: {},
                turnOrder: -1
            };
            // stuur event terug met of ie host is en een lijst met spelers
            fn(false, joinedServer.state, joinedServer.players);
        } 
        
        // update bestaande spelers en zeg dat er een nieuwe speler is gejoint
        io.to(data.server).emit('message', joinedServer.players[socket.id].name + ' is de server ingekomen');
        
        // we willen de spelerslijst ook updaten, stuur speler data mee
        io.to(data.server).emit('update_player_list', joinedServer.players);    
                
        console.log('join_server: ' + data.server + ', aantal spelers: ' + Object.keys(joinedServer.players).length);
	});
    
    // dit wordt geroepen wanneer een speler een kamer uitgaat dmv disconnect te drukken
    socket.on('leave_server', function (server) {
        socket.leave(server);
        
        var leftServer = getServerByName(server);     
  
        // update bestaande spelers en zeg dat er een nieuwe speler is geleaved
        io.to(server).emit('message', leftServer.players[socket.id].name + ' is de server uitgegaan');
        
        delete leftServer.players[socket.id];
        
        // update bestaande spelers en zeg dat er een nieuwe speler is geleaved
        io.to(server).emit('update_player_list', leftServer.players);    
        
        console.log('leave_server: ' + server + ', aantal spelers: ' + Object.keys(leftServer.players).length);
	});
    
    // dit wordt geroepen wanneer we een chat message event krijgen van de client
    socket.on('send_message', function (data) {
        // stuur data naar de kamer (naar alle clients dus) door de .to methode
        io.to(data.server).emit('message', data.message);
        
        console.log('send_message: ' + data.message + " to: " + data.server);
	});
    
    // dit is ingebakken binnen socket.io en wordt geroepen wanneer iemand de pagina verlaat/ververst
    socket.on('disconnect', function() {
        // ga eerst door alle kamers
        for(var server in servers) {
            // ga dan door alle spelers binnen desbetreffende kamer
            for(var player in servers[server].players) {
                // hebben we de speler gevonden?
                if(player == socket.id) {
                    console.log("player: " + servers[server].players[player].name + " browser afgesloten/refresh");
                    io.to(server).emit('message', servers[server].players[player].name + ' is de server uitgegaan');
                    
                    // verwijder
                    delete servers[server].players[player];
                    
                    // update bestaande spelers en zeg dat er een nieuwe speler is geleaved
                    io.to(server).emit('update_player_list', servers[server].players); 
                    break;
                }               
            }
        }
    });
    
    // dit wordt geroepen wanneer de host op start game knopje drukt
    socket.on('start_game', function (server) {
        // todo: server-side check of gozert wel echt de host is
        var theServer = getServerByName(server);
        // verander status naar playing, voor join check en serverlijst
        theServer.state = 'playing';
        
        // initializeer spel logica
        theServer.cardStack = create(2);
        console.log(theServer.cardStack.length);
        
        var startingPlayer = null;
        var startingSocketId = null;
        
        var turnOrder = 0;
        for(var player in theServer.players) {
            // eerste de beste is aan de beurt
            if(turnOrder == 0) {
                startingPlayer = theServer.players[player];
                startingSocketId = player;
                theServer.currentTurnOrder = turnOrder;
            }
            
            // geef ieder speler 7 kaarten    
            theServer.players[player].hand = draw(theServer.cardStack, 7);
            
            // geef ook een turn order aan de speler
            theServer.players[player].turnOrder = turnOrder;
            
            // update per speler hun hand
            io.to(player).emit('update_player_hand', theServer.players[player].hand);
            turnOrder++;
        }
        
        // pot begint met 1 kaart
        theServer.pot = draw(theServer.cardStack, 1);
              
        // stuur data naar alle clients binnen die kamer
        io.to(server).emit('game_has_started', { length: theServer.cardStack.length, drawnCard: theServer.pot, startingPlayer: {name: startingPlayer.name, id: startingSocketId} });
        
        console.log('game_has_started: ' + server);
	});
    
    socket.on('place_card', function (data) {
        var server = getServerByName(data.server);
        console.log("name: " + server.name);
        
        // pot krijgt een kaartje er bij (van de speler)
        server.pot.push({ card: data.card, suit: data.suit });
        
        // zoek speler
        for(var player in server.players) {
            if(player == socket.id) {
                // zoek kaart
                for(var card in server.players[player].hand) {
                    // hebben we de juiste kaart gevonden?
                    if(server.players[player].hand[card].card == data.card && server.players[player].hand[card].suit == data.suit) {
                        // verwijder van speler
                        delete server.players[player].hand[card];
                        
                        // update speler hand
                        socket.emit('update_player_hand', server.players[player].hand);
                        console.log('kaart verwijderd en update_player_hand');
                    }
                }              
                console.log('speler gevonden');
            }
        }
        
        // we gaan nu even van uit dat niemand de server uit is :P
        // dit levert problemen met: als iemand uit de server gaat, als we van volgorde verwisselen
        if(server.currentTurnOrder + 1 <= Object.keys(server.players).length - 1) {
            server.currentTurnOrder++;
            console.log("turn boven mij");
        }
        else {
            server.currentTurnOrder = 0;
            console.log("geen turn boven mij gevodnen");
        }
        
        var currentPlayer = null;
        // zoek speler
        for(var player in server.players) {
            // jij bent aan de beurt!
            if(server.players[player].turnOrder == server.currentTurnOrder) {
                currentPlayer = {id: player, name: server.players[player].name};
            }
        }
        
        // update game status aan alle clients binnen de kamer, stuur ook gelijk een chat message zeggend wie aan de beurt is                    
        io.to(data.server).emit('update_game', { stackLength: server.cardStack.length, potLength: server.pot.length, currentPotCard: server.pot[server.pot.length - 1], currentPlayer: currentPlayer });
        io.to(data.server).emit('message', 'de beurt is aan: ' + currentPlayer.name);
        
        console.log('place_card: ' + data);
	});
});

function getServerByName(name) {
    var found = null;
    
    servers.forEach(function (server) {
		if (server.name == name) {
            found = server;
        } 
    });
    
    return found;  
}