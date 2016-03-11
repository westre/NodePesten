var socket = null;
var host = false;
var server = null;
var player = null;

$(document).ready(function () {
    $('input[name="player-name"]').val(localStorage.getItem("player"));
    
    // dynamische binding
    $(document).on("click", ".join-server", function () {        
        localStorage.setItem("player", $('input[name="player-name"]').val());
        localStorage.setItem("server", $(this).data('name'));
        
        window.location.href = "game.html";
	});
    
    $(".leave-server").click(function () {
		leaveServer();
	});
    
    $('.chatbox-input').keypress(function (e) {
        var key = e.which;
        if(key == 13) { // the enter key code
            sendChatMessage($(this).val());
        }
    });
    
    $(".start-game").click(function () {
		if(host) {
            socket.emit('start_game', server);
            sendChatMessage("LETS GET READY TO RUMBLE");
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
    
    socket.on('game_has_started', function () {
        onGameHasStarted();
    });
    
    socket.on('update_player_list', function (data) {
        onPlayerListUpdate(data);
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

function onGameHasStarted() {
    alert("started!");
    $(".start-game").remove();
}

function onPlayerListUpdate(data) {
    $('.player-list ul').html('');
    
    $.each(data, function (index, player) {
        $('.player-list ul').append('<li>' + player.name + ' (host: ' + player.host + ')</li>');
    });
}