function create() {
	// Kaarten:
	// 1 = Aas
	// 2 t/m 10 = getallen
	// 11 = boer
	// 12 = vrouw
	// 13 = koning	
	
	// Symbolen:
	// H = harten 
	// K = Klaver 
	// S = Schoppen
	// R = Ruiten
	var pack = [];
	// Aantal kaarten
	var cards = 13; // 13 * 4 suits = 52 kaarten	
	var suits = new Array("H", "K", "S", "R");
	
	var count = 0;
	// Voeg kaarten toe
	for (s = 0; s < suits.length; s++) // Voor elke suit
		for (c = 1; c <= cards; c++) { // Doorloop 13 getallen
			pack[count++] = { card: c, suit: suits[s] }; // Voer kaart object toe aan de pot
		}
	// Voeg Jokers toe
	for (i = 0; i < 2; i++)
		pack[count++] = { card: 0, suit: "J" }; // 0 = Joker, J = Joker
	
	return pack;
}


// De pot wordt geschud doormiddel van de Fisher–Yates shuffle
// Source: https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
function shuffle(pack) {
	var to; // Naar positie 
	var from; // Orginele positie
	for (i = pack.length; i > 0; i--) {
		to = Math.floor(Math.random() * i); // Random nieuwe plek
		from = pack[i]; // Orginele plek
		if (from) {
			pack[i] = pack[to]; // Plaats kaart op nieuwe plek
			pack[to] = from; // Wissel andere kaart met de oude plek
		}
	}
	
	return pack;
}


// Van de pot afpakken
// Huidige pack, aantal, kaarten op de hand
function draw(pack, amount) {
	var drawedCards = [];
	drawedCards = pack.slice(0, amount); // Haal x kaarten uit de stapel en sla deze op
	pack.splice(0, amount); // Haal de kaarten uit de stapel
	
	//hand.push.apply(hand, drawedCards); // Voeg de kaarten toe aan de kaarten op de hand
	return drawedCards;
}


// Herschudden van de pot
function reshuffle(server, player) {
	var topcard = server.stack[server.stack.length - 1];
	server.stack.splice(0, 1);
	
	server.pack = server.stack;
	shuffle(server.pack);
	
	server.stack = [];
	server.stack.push(topcard);
	
	io.to(server.name).emit('update_game', { packLength: server.pack.length, stackLength: server.stack.length, currentStackCard: server.stack[server.stack.length - 1], currentPlayer: server.players[player] });
	io.to(server.name).emit('message', 'Geen kaarten meer in de pot, herschudden');
	
	console.log("geen kaarten meer gevonden");
}


// Gooi eerste kaart op van de pot
function start(pack, stack) {
	var startingcard = pack[0]; // Haal startkaart uit de pot en sla deze op
	if (startingcard.card != 0) { // Niet beginnen met een joker
		pack.splice(0, 1); // Haal de kaart uit de pot
		stack.push(startingcard); // Voeg de kaart toe aan de aflegstapel
	} else {
		shuffle(pack);
		start(pack, stack);
	}
	
}

// Checkt als kaart op gegooid mag worden of niet
function possible(stack, card, takeAmount) {
	var topcard = stack[stack.length - 1];
	if (card.suit == topcard.suit && takeAmount == 0 || 
		card.card == 0 && takeAmount == 0 || 
		card.card == topcard.card || 
		(topcard.card == 0 && card.card == 2) || 
		(topcard.card == 2 && card.card == 0)
		) {
		return true;
	}
	return false;
}


// Verander symbool
function change(stack, suit) {
	var topcard = stack[stack.length - 1];
	topcard.suit = suit;
	DEBUG && console.log("Symbool veranderd naar: " + fancy(topcard).suit);
}


// Geeft een string terug om weer te geven
function fancy(origCard, toString) {
	var card = { card: origCard.card, suit: origCard.suit };
	switch (card.suit) {
		case "H":
			card.suit = "Harten"
			break;
		case "K":
			card.suit = "Klaver"
			break;
		case "S":
			card.suit = "Schoppen"
			break;
		case "R":
			card.suit = "Ruiten"
			break;
	}
	
	if (!(card.card > 1 && card.card < 10))
		switch (card.card) {
			case 0:
				card.card = "Joker";
				break;
			case 1:
				card.card = "Aas";
				break;
			case 11:
				card.card = "Boer";
				break;
			case 12:
				card.card = "Vrouw";
				break;
			case 13:
				card.card = "Koning";
				break;
		}
	
	if (toString)
		if (origCard.card == 0)
			return card.card;
		else
			return card.suit + " " + card.card;
	else
		return card;
}


