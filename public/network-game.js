// Debug, log spel in console
var DEBUG = true;

// Init
//var pack = []; // Pot
//var stack = []; // Aflegstapel

// Vars
//var takeAmount = 0; // Current amount to take cards
//var rotation = true; // Default: true, true = clockwise | false = counterclockwise

// Beurt
var players;
var turn = 1; // Default:1, huidige speler

// Default config
var config = { jokers: 2, cards: 7, five: false, takelast: 2 };
// config.jokers;   Default:2,     Aantal jokers in het spel
// config.cards;    Default:7,     Aantal beginkaarten
// config.five;     Default:false, Vijf pak een wijf regel
// config.takelast; Default:2,     2 of 5 pakken gebruikelijk, als je met een pestkaart uitkomt

// Set de gameconfig
// config({jokers: 2, cards: 7, five: false, takelast: 2}, players array)
function setconfig(settings, playerList) {
	config = settings;
	players = playerList;
}

// networked
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
	for (i = 0; i < config.jokers; i++)
		pack[count++] = { card: 0, suit: "J" }; // 0 = Joker, J = Joker
	
	return pack;
}

// networked
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

// networked
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
function reshuffle(stack, pack) {
	var topcard = stack[stack.length - 1];
	stack.splice(0, 1);
	var temppack;
	if (pack.length > 0)
		temppack = pack;
	pack = stack;
	if (temppack)
		if (!temppack.length == 1)
			$each(temppack, function (index, card) {
				pack.push(card);
			});
		else
			pack.push(temppack[0]);
	shuffle(pack);
	stack = [];
	stack.push(topcard);
}

// networked
// Gooi eerste kaart op van de pot
function start(pack, stack) {
	var startingcard = pack[0]; // Haal startkaart uit de pot en sla deze op
	if (startingcard.card != 0) { // Niet beginnen met een joker
		pack.splice(0, 1); // Haal de kaart uit de pot
		stack.push(startingcard); // Voeg de kaart toe aan de aflegstapel
	} else {
		shuffle();
		start();
	}
	
}

// networked
function possible(stack, card) {
	var topcard = stack[stack.length - 1];
	if (card.suit == topcard.suit || card.suit == "J" || card.card == topcard.card || (topcard.suit == "J" && card.card == 2) || (topcard.card == 1 && card.card == 2)) {
        return true;
    }
    return false;
		/*switch (true) {		
			case (card.card == 0):// Joker pak 5
				return true;
			case (card.card == 1):// Aas is keer
				return true;
			case (card.card < topcard.card):// Getallen
				return false;
			default:
				return true;
		}*/
}

// networked
// Verander symbool
function change(stack, suit) {
	var topcard = stack[stack.length - 1];
	topcard.suit = suit;
	//DEBUG && console.log("Symbool veranderd naar: " + fancy(topcard).suit);
}



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


function knockknock(player) {
	players[player - 1].knockknock = true;
}


