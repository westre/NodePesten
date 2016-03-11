// Een stapel kaarten wordt aangemaakt
function create(jokers) {
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
	
	var pack = new Array();
	
	var count = 0;
	// Voeg kaarten toe
	for (s = 0; s < suits.length; s++) // Voor elke suit
		for (c = 1; c <= cards; c++) // Doorloop 13 getallen
			pack[count++] = { card: c, suit: suits[s] }; // voer kaart + suit toe aan de stapel
	// Voeg Jokers toe
	for (i = 0; i < jokers; i++)
		pack[count++] = { card: 0, suit: "J" }; // 0 = Joker, J = Joker
	
	return pack;
}

// De stapel wordt geschud doormiddel van de Fisher–Yates shuffle
// Source: https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
function shuffle(pack) {
	var to; // Naar positie 
	var from; // Orginele positie
	for (i = pack.length; i > 0; i--) {
		to = Math.floor(Math.random() * i); // Random nieuwe plek
		from = pack[i]; // Orginele plek
		pack[i] = pack[to]; // Plaats kaart op nieuwe plek
		pack[to] = from; // Wissel andere kaart met de oude plek
	}
	return pack;
}

// Van de stapel afpakken
// Huidige pack, aantal, kaarten op de hand
function draw(pack, amount, hand) {
	var drawedCards = new Array();
	drawedCards = pack.slice(0, amount); // Haal x kaarten uit de stapel en sla deze op
	
	pack.splice(0, amount); // Haal de kaarten uit de stapel
	
	hand.push.apply(hand, drawedCards); // Voeg de kaarten toe aan de kaarten op de hand
	
	return hand;
}