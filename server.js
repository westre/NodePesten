var express = require('express');
var app = require('express')();
//require("E:/_Sorted/Projects/Web Developing/NodePesten/node_modules/node-codein");
app.use(express.static('public'));
var server = app.listen(process.env.PORT || 8080);
var io = require('socket.io').listen(server);
var DEBUG = true;

// johnnys gamejs
eval(require('fs').readFileSync('network-game.js').toString());

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
		
		if (Object.keys(leftServer.players).length == 0) {
			resetServer(leftServer);
		}
	});
	
	// dit wordt geroepen wanneer we een chat message event krijgen van de client
	socket.on('send_message', function (data) {
		// stuur data naar de kamer (naar alle clients dus) door de .to methode
		io.to(data.server).emit('message', data.message);
	});
	
	// dit is ingebakken binnen socket.io en wordt geroepen wanneer iemand de pagina verlaat/ververst
	socket.on('disconnect', function () {
		// ga eerst door alle kamers
		for (var server in servers) {
			// ga dan door alle spelers binnen desbetreffende kamer
			for (var player in servers[server].players) {
				// hebben we de speler gevonden?
				if (player == socket.id) {
					io.to(server).emit('message', servers[server].players[player].name + ' is de server uitgegaan');
					
					// verwijder
					delete servers[server].players[player];
					
					// update bestaande spelers en zeg dat er een nieuwe speler is geleaved
					io.to(server).emit('update_player_list', servers[server].players);
					
					if (Object.keys(servers[server].players).length == 0) {
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
		for (var player in theServer.players) {
			// eerste de beste is aan de beurt
			if (turnOrder == 0) {
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
		io.to(server).emit('game_has_started', { length: theServer.pack.length, drawnCard: theServer.stack, startingPlayer: { name: startingPlayer.name, id: startingSocketId } });
	});
	
	socket.on('request_new_card', function (server) {
		var server = getServerByName(server);
		
		for (var player in server.players) {
			if (player == socket.id) {
				DEBUG && console.log(server.players[player].name + " pakt kaarten");
				// jokertje, 2tje
				if (server.takeAmount > 0) {
					io.to(server.name).emit('message', server.players[player].name + ' heeft geen kaarten, en pakt ' + server.takeAmount + ' kaarten.');
					
					for (var cardInt = 1; cardInt <= server.takeAmount; cardInt++) {
						if (server.pack.length == 0) {
							reshuffle(server, player);
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
					else if (topCard.card == 2) {
						next(server);
					}
				}
				else {
					if (server.pack.length == 0) {
						reshuffle(server, player);
					}
					
					server.players[player].hand.push(draw(server.pack, 1)[0]);
					socket.emit('update_player_hand', server.players[player].hand);
					var poss = false;
					for (var card in server.players[player].hand) {
						if (possible(server.stack, server.players[player].hand[card], server.takeAmount))
							poss = true;
					}
					if (!poss)
						next(server);
					else
						DEBUG && console.log("Kan nog een kaart spelen");
				}
			}
		}
	});
	
	socket.on('place_card', function (data, fn) {
		var server = getServerByName(data.server);
		
		// zoek speler
		for (var player in server.players) {
			if (player == socket.id) {
				// zoek kaart
				for (var card in server.players[player].hand) {
					// hebben we de juiste kaart gevonden?
					if (server.players[player].hand[card].card == data.card && server.players[player].hand[card].suit == data.suit) {
						if (possible(server.stack, server.players[player].hand[card], server.takeAmount)) {
							
							DEBUG && console.log("Player " + server.players[player].name + " speelt: " + fancy(server.players[player].hand[card], true));
							// stack krijgt een kaartje er bij (van de speler)
							server.stack.push({ card: data.card, suit: data.suit });
							
							var handCard = server.players[player].hand[card];
							
							// verwijder van speler
							delete server.players[player].hand[card];
							
							switch (true) {		
								case (handCard.card == 0):// Joker pak 5
									DEBUG && console.log("Pak 5");
									take(server, 5);
									break;
                                    
								case (handCard.card == 1):// Aas is keer
									DEBUG && console.log("Aas is keer");
									rotate(server);
									break;
                                    
								case (handCard.card == 2):// 2 pak 2
									DEBUG && console.log("Pak 2");
									take(server, 2);
									break;
                                    
								case (handCard.card == 7):// Zeven kleeft
									DEBUG && console.log("Nog een keer");
									io.to(server.name).emit('update_game', { packLength: server.pack.length, stackLength: server.stack.length, currentStackCard: server.stack[server.stack.length - 1], currentPlayer: server.players[player] });
									break;
                                    
								case (handCard.card == 8):// Acht wacht
									DEBUG && console.log("Beurt overslaan");
									skip(server);
									break;
                                    
								case (handCard.card == 11):// Boer veranderd
									//DEBUG && console.log("Verander symbool");
									promptSuitChange(server, socket);
									break;
                                    
								case (handCard.card == 13):// Koning
									DEBUG && console.log("Nog een keer");
									io.to(server.name).emit('update_game', { packLength: server.pack.length, stackLength: server.stack.length, currentStackCard: server.stack[server.stack.length - 1], currentPlayer: server.players[player] });
									break;
                                    
								default:
									next(server);
									break;
							}
							
							
							// update speler hand
							fn(true);
							socket.emit('update_player_hand', server.players[player].hand);
                          
						}
						else {
							fn(false);
							io.to(player).emit('message', 'das ist nicht mogelijk gozert');
						}
					}
				}
			}
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
		if (promptData == 'H' || promptData == 'K' || promptData == 'S' || promptData == 'R') {
			change(server.stack, promptData);
			next(server);
		}
		else {
			promptSuitChange(server, socket);
			console.log('failed');
		}
		
		DEBUG && console.log('Symbool veranderd naar: ' + promptData);
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
	
	DEBUG && console.log("Rotatie veranderd: " + server.rotation);
}

// Ga door naar de volgende speler
function next(server, ignore) {
	// Check voor einde van de game
	for (var player in server.players) {
		if (server.currentTurnOrder == server.players[player].turnOrder) {
			if (Object.keys(server.players[player].hand).length == 0) {
				var topCard = server.stack[server.stack.length - 1];
				// Check als laatste kaart geen pestkaart was
				if (topCard.card != 0 && topCard.card != 1 && topCard.card != 2 && topCard.card != 7 && topCard.card != 8 && topCard.card != 11 && topCard.card != 13) {
					DEBUG && console.log("End of the game");
					io.to(server.name).emit('message', 'Spel is gewonnen door: ' + server.players[player].name + ', over 5 seconden stopt het spel.');
					io.to(player).emit('won');
					setTimeout(function () {
						io.to(server.name).emit('all_leave_server');
						resetServer(server);
					}, 5000);
				} else { // Anders 2 pakken
					DEBUG && console.log("Laatste kaart pestkaart: " + fancy(topCard, true));
					io.to(player).emit('lastcard');
					server.takeAmount = 2;
					return;
				}
			}
		}
	}
	
	if (server.rotation) {
		var found = false;
		for (var player in server.players) {
			if (server.currentTurnOrder < server.players[player].turnOrder) {
				server.currentTurnOrder = server.players[player].turnOrder;
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
						break;
					}
				}
			}
		}
	}
	else {
		var found = false;
		var nextTurnOrder;
		for (var player in server.players) {
			if (server.currentTurnOrder > server.players[player].turnOrder) {
				nextTurnOrder = server.players[player].turnOrder;
				found = true;
			}
		}
		
		if (!found) {
			// zoek hoogste turn order
			var highestTurnOrder = 0;
			for (var player in server.players) {
				if (highestTurnOrder < server.players[player].turnOrder)
					highestTurnOrder = server.players[player].turnOrder;
			}
			server.currentTurnOrder = highestTurnOrder;
		} else {
			server.currentTurnOrder = nextTurnOrder;
		}

	}
	
	var nextPlayer = {};
	// zoek speler
	for (var player in server.players) {
		// jij bent aan de beurt!
		if (server.players[player].turnOrder == server.currentTurnOrder) {
			nextPlayer = { id: player, name: server.players[player].name };
			DEBUG && console.log("Rotate: Player " + nextPlayer.name + " is aan zet");
		}
	}
	
	
	if (!ignore) { // update game status aan alle clients binnen de kamer, stuur ook gelijk een chat message zeggend wie aan de beurt is
		io.to(server.name).emit('update_game', { packLength: server.pack.length, stackLength: server.stack.length, currentStackCard: server.stack[server.stack.length - 1], currentPlayer: nextPlayer });
		io.to(server.name).emit('message', nextPlayer.name + ' is aan de beurt');
	}
	
	return nextPlayer;
}