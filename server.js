var express = require('express');
var app = require('express')();
//require("E:/_Sorted/Projects/Web Developing/NodePesten/node_modules/node-codein");
app.use(express.static('public'));
var server = app.listen(process.env.PORT || 8080);
var io = require('socket.io').listen(server);

// johnnys gamejs
eval(require('fs').readFileSync('public/network-game.js').toString());

var servers = [ 
    { name: 'Kamer 1', pack: [], stack: [], players: {}, state: 'lobby', currentTurnOrder: -1, takeAmount: 0, rotation: true }, 
    { name: 'Kamer 2', pack: [], stack: [], players: {}, state: 'lobby', currentTurnOrder: -1, takeAmount: 0, rotation: true }, 
	{ name: 'Kamer 3', pack: [], stack: [], players: {}, state: 'lobby', currentTurnOrder: -1, takeAmount: 0, rotation: true }
];

io.on('connection', function (socket) {    
    // dit wordt geroepen wanneer er een request wordt uitgevoerd op serverlist.html
    socket.on('request_servers', function (fn) {
        fn(servers);
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
        
        if(Object.keys(leftServer.players).length == 0) {
            resetServer(leftServer);
        }   
	});
    
    // dit wordt geroepen wanneer we een chat message event krijgen van de client
    socket.on('send_message', function (data) {
        // stuur data naar de kamer (naar alle clients dus) door de .to methode
        io.to(data.server).emit('message', data.message);
	});
    
    // dit is ingebakken binnen socket.io en wordt geroepen wanneer iemand de pagina verlaat/ververst
    socket.on('disconnect', function() {
        // ga eerst door alle kamers
        for(var server in servers) {
            // ga dan door alle spelers binnen desbetreffende kamer
            for(var player in servers[server].players) {
                // hebben we de speler gevonden?
                if(player == socket.id) {
                    io.to(server).emit('message', servers[server].players[player].name + ' is de server uitgegaan');
                    
                    // verwijder
                    delete servers[server].players[player];
                    
                    // update bestaande spelers en zeg dat er een nieuwe speler is geleaved
                    io.to(server).emit('update_player_list', servers[server].players); 
                    
                    if(Object.keys(servers[server].players).length == 0) {
                        var server2 = getServerByName(server);
                        resetServer(server2);
                    }   
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
        theServer.pack = create();
        shuffle(theServer.pack);
        
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
            theServer.players[player].hand = draw(theServer.pack, 7);
            
            // geef ook een turn order aan de speler
            theServer.players[player].turnOrder = turnOrder;
            
            // update per speler hun hand
            io.to(player).emit('update_player_hand', theServer.players[player].hand);
            turnOrder++;
        }
        
        // stack begint met 1 kaart
        start(theServer.pack, theServer.stack);
              
        // stuur data naar alle clients binnen die kamer
        io.to(server).emit('game_has_started', { length: theServer.pack.length, drawnCard: theServer.stack, startingPlayer: {name: startingPlayer.name, id: startingSocketId} });
	});
    
    socket.on('request_new_card', function (server) {
        var server = getServerByName(server);
        
		for (var player in server.players) {
			if (player == socket.id) {
                // jokertje, 2tje
				if (server.takeAmount > 0) {
                    socket.emit('message', server.players[player].name + ' heeft geen kaarten, moet kaarten pakken: ' + server.takeAmount);
                    
                    for(var cardInt = 1; cardInt <= server.takeAmount; cardInt++) {
                        if(server.pack.length == 0) {
                            reshufflePlease(server, player);
                        }
                        server.players[player].hand.push(draw(server.pack, 1)[0]);       
                    }
                    
                    // update speler hand
                    socket.emit('update_player_hand', server.players[player].hand);
                    
                    server.takeAmount = 0;
                    
                    var topCard = server.stack[server.stack.length - 1];
					if (topCard.card == 0) {
                        promptSuitChange(server, socket);
                    }
                    else if(topCard.card == 2) {
                        next(server);
                    }
                }
                else {
                    if(server.pack.length == 0) {
                        reshufflePlease(server, player);
                    }
                    
                    server.players[player].hand.push(draw(server.pack, 1)[0]);
                    socket.emit('update_player_hand', server.players[player].hand);
                    next(server);
                } 
            }
        } 
    });
    
    socket.on('place_card', function (data, fn) {
        var server = getServerByName(data.server);
        var gameEnded = false;
        
        // zoek speler
        for(var player in server.players) {
            if(player == socket.id) {
                // zoek kaart
                for(var card in server.players[player].hand) {
                    // hebben we de juiste kaart gevonden?
                    if(server.players[player].hand[card].card == data.card && server.players[player].hand[card].suit == data.suit) {
                        if (possible(server.stack, server.players[player].hand[card])) {
                            // stack krijgt een kaartje er bij (van de speler)
                            server.stack.push({ card: data.card, suit: data.suit });
                            
                            switch (true) {		
                                case (server.players[player].hand[card].card == 0): // Joker pak 5
                                    take(server, 5);
                                    break;
                                    
                                case (server.players[player].hand[card].card == 1): // Aas is keer
                                    rotate(server);
                                    break;
                                    
                                case (server.players[player].hand[card].card == 2): // 2 pak 2
                                    take(server, 2);
                                    break;
                                    
                                case (server.players[player].hand[card].card == 7): // Zeven kleeft
                                    io.to(server.name).emit('update_game', { packLength: server.pack.length, stackLength: server.stack.length, currentStackCard: server.stack[server.stack.length - 1], currentPlayer: server.players[player] });
                                    break;
                                    
                                case (server.players[player].hand[card].card == 8): // Acht wacht
                                    skip(server);
                                    break;
                                    
                                case (server.players[player].hand[card].card == 11): // Boer veranderd
                                    promptSuitChange(server, socket);                        
                                    break;
                                    
                                /*case (server.players[player].hand[card].card == 13): // Koning
                                    io.to(server.name).emit('update_game', { packLength: server.pack.length, stackLength: server.stack.length, currentStackCard: server.stack[server.stack.length - 1], currentPlayer: server.players[player] });
                                    break;*/
                                    
                                default:
                                    next(server);
                                    break;
                            }
                            
                            // verwijder van speler
                            delete server.players[player].hand[card];
                            
                            // update speler hand
                            fn(true);
                            socket.emit('update_player_hand', server.players[player].hand);
                            
                            if(Object.keys(server.players[player].hand).length == 0) {
                                io.to(data.server).emit('message', 'Spel is gewonnen door: ' + server.players[player].name + ', over 5 seconden stopt het spel.');
                                gameEnded = true;
                            }
                            
                            console.log('updating player hands');
                        }
                        else {
                            fn(false);
                            io.to(data.server).emit('message', 'das ist nicht mogelijk gozert');
                        }
                    }
                }              
            }
        }
        
        if(gameEnded) {
            setTimeout(function() { 
                io.to(data.server).emit('all_leave_server');
                resetServer(server);
            }, 5000);
        }
	});
    
    socket.on('is_it_my_turn', function (server, fn) {
        var server = getServerByName(server);
        
        var myTurn = false;       
		if (server.players[socket.id].turnOrder == server.currentTurnOrder) {
            myTurn = true;
        }
        
        fn(myTurn);
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

function promptSuitChange(server, socket) {
    socket.emit('prompt_suit_change', function (promptData) {
        if(promptData == 'H' || promptData == 'K' || promptData == 'S' || promptData == 'R') {
            change(server.stack, promptData);
            next(server);
        }
        else {
            promptSuitChange(server, socket);
            console.log('failed');
        }
        
        console.log('promptsuitchange: ' + promptData);
    });
}

function resetServer(server) {
    server.pack = [];
    server.stack = [];
    server.players = {};
    server.state = 'lobby';
    server.currentTurnOrder = -1;
    server.takeAmount = 0;
    server.rotation = true;
    
    console.log(server.name + " gereset");
}

function reshufflePlease(server, player) {
    var topcard = server.stack[server.stack.length - 1];
    server.stack.splice(0, 1);

    server.pack = server.stack;
    shuffle(server.pack);
    
    server.stack = [];
    server.stack.push(topcard);
    
    io.to(server.name).emit('update_game', { packLength: server.pack.length, stackLength: server.stack.length, currentStackCard: server.stack[server.stack.length - 1], currentPlayer: server.players[player] });
    io.to(server.name).emit('message', 'geen kaarten gevonden, reshuffling');
    
    console.log("geen kaarten meer gevonden");
}

function skip(server) {
    next(server, true);
    next(server);
}

// Kaarten pakken
function take(server, amount) {
	server.takeAmount = server.takeAmount + amount;
	next(server);
}

// Verander draairichting
function rotate(server) {
	if (server.rotation)
		server.rotation = false;
	else
		server.rotation = true;
    
	next(server);
    
    console.log("rotate");
}

function next(server, ignore) {
	console.log(server.rotation);
	console.log(server.currentTurnOrder);
	console.log(server.players);
    
	if (server.rotation) {
        var found = false;
        for(var player in server.players) {
            if(server.currentTurnOrder < server.players[player].turnOrder) {
                server.currentTurnOrder = server.players[player].turnOrder;
                console.log("Rotation = true 1");
                found = true;
                break;
            }
        }
        
		if (!found) {
            server.currentTurnOrder = 0;
			for (var from = 0; from < 100; from++) {
				for (var player in server.players) {
					if (from == server.players[player].turnOrder && !found) {
                        server.currentTurnOrder = server.players[player].turnOrder;
                        found = true;
                        console.log("Rotation = true 2");
                        break;
                    }
                }
            }
        }
    }
    else {
        var found = false;
        for(var from = server.currentTurnOrder - 1; from > 0; from--) {
            for(var player in server.players) {
                if(from == server.players[player].turnOrder && !found) {
                    server.currentTurnOrder = server.players[player].turnOrder;
                    found = true;
                    console.log("Rotation = false 1");
                    break;
                }
            }
        }
        
        if(!found) {
            // zoek hoogste turn order
            var start = 0;
			for (var player in server.players) {
				if (start < server.players[player].turnOrder) {
                    if(server.currentTurnOrder != server.players[player].turnOrder) {
                        start = server.players[player].turnOrder;
                        console.log("Rotation = false 2");
                    }
                }
            }
            
            server.currentTurnOrder = start;
        }
    }
    
    var nextPlayer = {};
    // zoek speler
    for(var player in server.players) {
        // jij bent aan de beurt!
        if(server.players[player].turnOrder == server.currentTurnOrder) {
			nextPlayer = { id: player, name: server.players[player].name };
            console.log(server.players[player].name + " is aan de beurt");
        }
    }
    
    // update game status aan alle clients binnen de kamer, stuur ook gelijk een chat message zeggend wie aan de beurt is                    
	if (!ignore) {
        io.to(server.name).emit('update_game', { packLength: server.pack.length, stackLength: server.stack.length, currentStackCard: server.stack[server.stack.length - 1], currentPlayer: nextPlayer });
        io.to(server.name).emit('message', 'de beurt is aan: ' + nextPlayer.name);
    }                 
    
    
    return nextPlayer;
}