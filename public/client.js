var socket = null;
var host = false;
var server = null;
var player = null;
var myTurn = false;

$(document).ready(function () {
    $('input[name="player-name"]').val(localStorage.getItem("player"));
    
    // dynamische binding, wanneer we een server will joinen
    $(document).on("click", ".join-server", function () {        
        localStorage.setItem("player", $('input[name="player-name"]').val());
        localStorage.setItem("server", $(this).data('name'));
        
        window.location.href = "game.html";
	});
    
    // disconnect knopje
    $(".leave-server").click(function () {
		leaveServer();
	});
    
    // chatbox voor communicatie tussen de clients
    $('.chatbox-input').keypress(function (e) {
        var key = e.which;
        if(key == 13) { // the enter key code
            sendChatMessage($(this).val());
        }
    });
    
    // voor de host om het spel te starten
    $(".start-game").click(function () {
		if(host) {
            socket.emit('start_game', server);
            sendChatMessage("LETS GET READY TO RUMBLE");
        }
	});
    
    // voor de spelers zodat ze op hun kaart kunnen klikken en het ook verwerkt wordt
    $(".hand").on("click", ".hand-card", function () {        
        var card = $(this).data('card');
        var suit = $(this).data('suit');
        
        if(myTurn) {
            // stuur commando naar server
            myTurn = false;
            socket.emit('place_card', { server: server, card: card, suit: suit }, function (isValid) {
                if(!isValid)
                    myTurn = true;
                    
                console.log('called');
            });
        }
        else {
            alert("het is niet jouw beurt vriend");
        }
	});
    
    $(document).on("click", ".remaining", function () {        
        if(myTurn) {
            // stuur commando naar server
            socket.emit('request_new_card', server);
            myTurn = false;
        }
        else {
            alert("het is niet jouw beurt vriend");
        }
	});    
});

// wordt geroepen wanneer we in serverlist.html zitten
function connect() {
    socket = io.connect('http://localhost:3000');
    
    // stuur een 'request_servers' commando naar de server voor een lijst met servers
    socket.emit('request_servers', function (servers) {
        $.each(servers, function (index, server) {
            $('.server-list').append('<li>' + server.name + ', aantal spelers: ' + Object.keys(server.players).length + ', status: ' + server.state + ' <button class="join-server" data-name="' + server.name + '">join</button></li>');
        });       
    });
}

// wordt geroepen wanneer we in game.html zitten
function joinServer() {
    socket = io.connect('http://localhost:3000');
    
    // stuur een 'join' commando naar de server
    socket.emit('join_server', { server: localStorage.getItem("server"), player: localStorage.getItem("player") }, function (isHost, serverState, playerList) {
        server = localStorage.getItem("server");
        player = localStorage.getItem("player");
        backgroundDynamic();
        if(serverState == 'playing') {  
            alert('sorry spel is al begonnen');
            leaveServer();
            return;
        }
        
        $.each(playerList, function (index, player) {
            $('.player-list ul').append('<li>' + player.name + ' (host: ' + player.host + ')</li>');
        });
        
        $(".server-name").html('Je zit in server: ' + server + ', status: ' + serverState); 
        
        if(isHost) {
            $(".start-game").css('visibility', 'visible');
            host = true;
        }           
    });
    
    socket.on('message', function (data) {
        onReceivedChatMessage(data);
    });
    
    socket.on('game_has_started', function (data) {
        onGameHasStarted(data);
    });
    
    socket.on('update_player_list', function (data) {
        onPlayerListUpdate(data);
    });
    
    socket.on('update_player_hand', function (data) {
        onPlayerUpdateHand(data);
    });
    
    socket.on('update_game', function (data) {
        onGameUpdate(data);
    });
    
    socket.on('prompt_suit_change', function (fn) {
        fn(prompt("je suit graag"));
    });
}

// wordt geroepen wanneer we op disconnect button klikken
function leaveServer() {
    socket.emit('leave_server', server);   
    window.location.href = "serverlist.html";
}

function sendChatMessage(message) {
    // bouw string op
    var stringMessage = player + ": " + message;
    
    // verstuur het naar de server onder het commando 'send_message'
    socket.emit('send_message', { server: server, message: stringMessage });
}

// we krijgen een 'message' commando van de server
function onReceivedChatMessage(data) {
    console.log(data);
    $(".chatbox-messages ul").append('<li>' + data + '</li>');
}

function onGameHasStarted(object) {
    
    $(".start-game").remove();
    $(".remaining").html(object.length + " kaarten");
    
    $(".pot").html('<div class="hand-card">' + fancy(object.drawnCard[0], true) + '</div>');
    
    // vraag mij niet waarom...
    var fixedSocketId = "/#" + socket.id;
    
    if(object.startingPlayer.id == fixedSocketId) {
        myTurn = true;
        alert("Jij bent!");
    }
    backgroundDynamic();
}

function onPlayerListUpdate(data) {
   
    $('.player-list ul').html('');
    
    $.each(data, function (index, player) {
        $('.player-list ul').append('<li>' + player.name + ' (host: ' + player.host + ')</li>');
    });
    backgroundDynamic();
}

function onPlayerUpdateHand(data) {
    
    console.log(data);
    
    $('.hand').html('');
    $.each(data, function (index, card) {
        if(card != null)
            $('.hand').append('<div class="hand-card" data-card="' + card.card + '" data-suit="' + card.suit + '">' + fancy(card, true) + '</div>');
    });
    backgroundDynamic();
}

function onGameUpdate(data) {
    
    $('.remaining').html(data.packLength + ' kaarten');
    
    $('.pot').html('');
    $('.pot').html('<div class="hand-card">' + fancy(data.currentStackCard, true) + ' (' + data.stackLength + ' kaarten)</div>');
    
    console.log(data);
    
    // vraag mij niet waarom...
    var fixedSocketId = "/#" + socket.id;
    
    if(data.currentPlayer.id == fixedSocketId) {
        myTurn = true;
        alert("Jij bent!");
        console.log('ja echt');
    }
    backgroundDynamic();
   
}

function onPromptSuitChange(fn) {
    fn(prompt("je suit graag"));
}

function backgroundDynamic(){
    $('.hand-card').each(function () {
        var type = $(this).attr('data-card');
        var brand = $(this).attr('data-suit');
        
        $(this).css('background-image', 'url(images/cards/' + type + '+' + brand + '.png)');
        $(this).css('background-size', '140px 200px');
        $(this).css('background-repeat', 'no-repeat');
    });
}