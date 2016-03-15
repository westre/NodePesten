var express = require('express');
var app = require('express')();
app.use(express.static('public'));
var server = app.listen(3000);
var io = require('socket.io').listen(server);
var DEBUG = true;

// johnnys gamejs
eval(require('fs').readFileSync('public/network-game.js').toString());

var servers = [ 
	{ name: 'Kamer 1', pack: [], stack: [], players: {}, state: 'lobby', currentTurnOrder: -1, takeAmount: -1, rotation: true }, 
	{ name: 'Kamer 2', pack: [], stack: [], players: {}, state: 'lobby', currentTurnOrder: -1, takeAmount: -1, rotation: true }, 
	{ name: 'Kamer 3', pack: [], stack: [], players: {}, state: 'lobby', currentTurnOrder: -1, takeAmount: -1, rotation: true }
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
				server.players[player].hand.push(draw(server.pack, 1)[0]);
				socket.emit('update_player_hand', server.players[player].hand);
				next(server);
			}
		}
	});
	
	socket.on('place_card', function (data, fn) {
		var server = getServerByName(data.server);
		
		var nextPlayer = null;
		
		// zoek speler
		for (var player in server.players) {
			if (player == socket.id) {
				// zoek kaart
				for (var card in server.players[player].hand) {
					// hebben we de juiste kaart gevonden?
					if (server.players[player].hand[card].card == data.card && server.players[player].hand[card].suit == data.suit) {
						if (possible(server.stack, server.players[player].hand[card])) {
							
							DEBUG && console.log("Player " + server.players[player].name + " speelt: " + fancy(server.players[player].hand[card], true));
							// stack krijgt een kaartje er bij (van de speler)
							server.stack.push({ card: data.card, suit: data.suit });
							
							switch (true) {		
								case (server.players[player].hand[card].card == 0):// Joker pak 5
									DEBUG && console.log("Pak 5");
									take(server, 5, true);
									break;
								case (server.players[player].hand[card].card == 1):// Aas is keer
									DEBUG && console.log("Aas is keer");
									rotate(server);
									break;
								case (server.players[player].hand[card].card == 2):// 2 pak 2
									DEBUG && console.log("Pak 2");
									take(server, 2);
									break;
								case (server.players[player].hand[card].card == 7):// Zeven kleeft
									DEBUG && console.log("Nog een keer");
									io.to(server.name).emit('update_game', { packLength: server.pack.length, stackLength: server.stack.length, currentStackCard: server.stack[server.stack.length - 1], currentPlayer: server.players[player] });
									break;
								case (server.players[player].hand[card].card == 8):// Acht wacht
									DEBUG && console.log("Beurt overslaan");
									skip(server);
									break;
                                    
								case (server.players[player].hand[card].card == 11):// Boer veranderd
									//change(prompt("Choose a new suit (H, K, S, R):", card.suit));
									DEBUG && console.log("Verander symbool");
									socket.emit('prompt_suit_change', function (promptData) {
										change(server.stack, promptData);
										next(server);
									});
									break;
								case (server.players[player].hand[card].card == 13):// Koning
									DEBUG && console.log("Nog een keer");
									io.to(server.name).emit('update_game', { packLength: server.pack.length, stackLength: server.stack.length, currentStackCard: server.stack[server.stack.length - 1], currentPlayer: server.players[player] });
									break;
								default:
									next(server);
									break;
							}
							
							// verwijder van speler
							delete server.players[player].hand[card];
							
							// update speler hand
							fn(true);
							socket.emit('update_player_hand', server.players[player].hand);
						}
						else {
							fn(false);
							io.to(data.server).emit('message', 'das ist nicht mogelijk gozert');
						}
					}
				}
			}
		}
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

function skip(server) {
	next(server);
	next(server);
}

// Kaarten pakken
function take(server, amount, joker) {
	server.takeAmount = server.takeAmount + amount;
	next(server);
	
	var nextPlayer = null;
	var socketId = null;
	
	if (server.rotation) {
		var found = false;
		for (var player in server.players) {
			if (server.currentTurnOrder < server.players[player].currentTurnOrder) {
				nextPlayer = server.players[player];
				socketId = player;
				console.log(server.players[player].name + " take");
				break;
			}
		}
		
		if (!found) {
			for (var from = 0; from < 100; from++) {
				for (var player in server.players) {
					if (from == server.players[player].currentTurnOrder && !found) {
						nextPlayer = server.players[player];
						found = true;
						socketId = player;
						console.log(server.players[player].name + " take");
						break;
					}
				}
			}
		}
	}
	else {
		var found = false;
		for (var from = server.currentTurnOrder; from > 0; from--) {
			for (var player in server.players) {
				if (from == server.players[player].currentTurnOrder && !found) {
					nextPlayer = server.players[player];
					found = true;
					socketId = player;
					console.log(server.players[player].name + " take");
					break;
				}
			}
		}
		
		if (!found) {
			// zoek hoogste turn order
			var start = 0;
			for (var player in server.players) {
				if (start < server.players[player].currentTurnOrder) {
					nextPlayer = server.players[player];
					socketId = player;
					console.log(server.players[player].name + " take");
					break;
				}
			}
		}
	}
	
	var hasCard = true;
	for (var card in nextPlayer.hand) {
		if (!possible(server.stack, card))
			hasCard = false;
	}
	
	if (!hasCard) {
		nextPlayer.hand.push(draw(server.pack, server.takeAmount))
		
		// update speler hand
		socket.emit('update_player_hand', nextPlayer.hand);
		//change(prompt("Choose a new suit (H, K, S, R):"));
		if (joker) {
			io.to(socketId).emit('prompt_suit_change', function (promptData) {
				change(server.stack, promptData);
				next(server);
			});
		}
		
		server.takeAmount = 0;
		next(server);
	}
}

// Verander draairichting
function rotate(server) {
	if (server.rotation)
		server.rotation = false;
	else
		server.rotation = true;
	
	next(server);
	
	DEBUG && console.log("Rotatie veranderd");
}

function next(server) {
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
			server.currentTurnOrder = 0; // dit gaat fout
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
	} else {
		var found = false;
		for (var from = server.currentTurnOrder; from > 0; from--) {
			for (var player in server.players) {
				if (from == server.players[player].turnOrder) {
					server.currentTurnOrder = server.players[player].turnOrder;
					found = true;
					break;
				}
			}
		}
		
		if (!found) {
			// zoek hoogste turn order
			var start = 0;
			for (var player in server.players) {
				if (start < server.players[player].turnOrder) {
					start = server.players[player].turnOrder;
					break;
				}
			}
			
			server.currentTurnOrder = start;
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
	
	// update game status aan alle clients binnen de kamer, stuur ook gelijk een chat message zeggend wie aan de beurt is                    
	io.to(server.name).emit('update_game', { packLength: server.pack.length, stackLength: server.stack.length, currentStackCard: server.stack[server.stack.length - 1], currentPlayer: nextPlayer });
	io.to(server.name).emit('message', 'de beurt is aan: ' + nextPlayer.name);
	
	return nextPlayer;
}