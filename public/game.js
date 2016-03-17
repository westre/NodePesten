// Debug, log spel in console
var DEBUG = true;

// Init
var pack = []; // Pot
var stack = []; // Aflegstapel

// Vars
var takeAmount = 0; // Current amount to take cards
var rotation = true; // Default: true, true = clockwise | false = counterclockwise

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

// De pot wordt geschud doormiddel van de Fisher–Yates shuffle
// Source: https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
function shuffle() {
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

// Herschudden van de pot
function reshuffle() {
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
	shuffle();
	stack = [];
	stack.push(topcard);
}

// Gooi eerste kaart op van de pot
function start() {
    backgroundDynamic();
	var startingcard = pack[0]; // Haal startkaart uit de pot en sla deze op
	if (startingcard.card != 0) { // Niet beginnen met een joker
		pack.splice(0, 1); // Haal de kaart uit de pot
		stack.push(startingcard); // Voeg de kaart toe aan de aflegstapel
	} else {
		shuffle();
		start();
	}
	
}

// Van de pot afpakken
// Huidige pack, aantal, kaarten op de hand
function draw(amount, hand) {
	if (pack.length < amount) {
		reshuffle();
		DEBUG && console.log("Reshuffling pack");
	}
	var drawedCards = [];
	drawedCards = pack.slice(0, amount); // Haal x kaarten uit de pot en sla deze op
	pack.splice(0, amount); // Haal de kaarten uit de pot
	
	hand.push.apply(hand, drawedCards); // Voeg de kaarten toe aan de kaarten op de hand
	return hand;
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

// Kaart spelen
function play(cardIndex, hand) {
	var card = hand[cardIndex]; // Sla kaart op
	
	if (possible(card)) {
		hand.splice(cardIndex, 1); // Haal kaart uit de hand
		stack.push(card); // Voeg de kaart toe aan de aflegstapel
		DEBUG && console.log("Player " + turn + " speelt: " + fancy(card, true));
		switch (true) {		
			case (card.card == 0):// Joker pak 5
				DEBUG && console.log("Pak 5");
				take(5, true);
				break;
			case (card.card == 1):// Aas is keer
				DEBUG && console.log("Aas is keer");
				rotate();
				break;
			case (card.card == 2):// 2 pak 2
				DEBUG && console.log("Pak 2");
				take(2);
				break;
			case (card.card == 2):// 5 pak een wijf
				if (config.five)
					drawtill({ card: 12, suit: "" });
				else
					next();
				break;
			case (card.card == 7):// Zeven kleeft
				DEBUG && console.log("Nog een keer");
				stick();
				break;
			case (card.card == 8):// Acht wacht
				DEBUG && console.log("Beurt overslaan");
				skip();
				break;
			case (card.card == 11):// Boer veranderd
				DEBUG && console.log("Verander symbool");
				change(prompt("Choose a new suit (H, K, S, R):", card.suit));
				next();
				break;
			case (card.card == 13):// Koning
				DEBUG && console.log("Nog een keer");
				stick();
				break;
			default:
				next();
				break;
		}
	} else {
		return false;
	}
	return stack;
}

function possible(card) {
	var topcard = stack[stack.length - 1];
	if (card.suit == topcard.suit || card.suit == "J" || card.card == topcard.card || (topcard.suit == "J" && card.card == 2) || (topcard.card == 1 && card.card == 2))
		switch (true) {		
			case (card.card == 0):// Joker pak 5
				return true;
				break;
			case (card.card == 1):// Aas is keer
				return true;
				break;
			case (card.card < topcard.card):// Getallen
				return false;
				break;
			default:
				return true;
				break;
		}
}

// Beurt
function next(msg) {
	var previousturn = turn;
	if (rotation) { // Met de klok mee
		turn++;
		if (turn > players.length)
			turn = 1;
	} else { // Tegen de klok in
		turn--;
		if (turn < 1)
			turn = players.length;
	}
	DEBUG && console.log("Rotate: Player " + turn + " is aan zet (" + previousturn);
	
	if (msg)
		alert("Player " + turn + " zijn beurt");
}

function knockknock(player) {
	players[player - 1].knockknock = true;
}

// Kaart eigenschappen
// Sla beurt over
function skip() {
	var previousturn = turn;
	if (rotation) { // Met de klok mee
		turn = turn + 2;
		if (turn > players.length)
			if (turn == players.length + 1)
				turn = 1;
			else //if (turn == players.length + 1)
				turn = 2;
	} else { // Tegen de klok in
		turn = turn - 2;
		if (turn < 1)
			if (turn == 0)
				turn = players.length - 1;
			else //if (turn == -1)
				if (players.length > 2)
					turn = players.length - 2;
				else
					turn = players.length - 1;
	}
	DEBUG && console.log("Skip: Player " + turn + " is aan zet (" + previousturn);
}

// Verander symbool
function change(suit) {
	var topcard = stack[stack.length - 1];
	topcard.suit = suit;
	DEBUG && console.log("Symbool veranderd naar: " + fancy(topcard).suit);
}

// Verander draairichting
function rotate() {
	if (rotation)
		rotation = false;
	else
		rotation = true;
	alert("Rotatie veranderd");
	next();
}

// Kleven
function stick() {
	//alert("Nog een keer");
}

// Kaarten pakken
function take(amount, joker) {
	takeAmount = takeAmount + amount;
	next();
	var hasCard = true;
	$.each(players[turn - 1].hand, function (index, card) {
		if (!possible(card))
			hasCard = false;
	});
	
	if (!hasCard) {
		draw(takeAmount, players[turn - 1].hand);
		alert("Taking " + takeAmount);
		if (joker)
			change(prompt("Choose a new suit (H, K, S, R):"));
		takeAmount = 0;
		next();
	}
}

function backgroundDynamic() {
    $('.hand-card').each(function () {
        var type = $(this).attr('data-card');
        var brand = $(this).attr('data-suit');
        
        $(this).css('background-image', 'url(images/cards/' + type + '+' + brand + '.png)');
        $(this).css('background-size', '140px 200px');
        $(this).css('background-repeat', 'no-repeat');
    });
}