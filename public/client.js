var socket = null;

$(document).ready(function () {
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
            // bouw string op
            var message = localStorage.getItem("player") + ": " + $(this).val();
            
            // verstuur het naar de server onder het commando 'send_message'
            socket.emit('send_message', { server: localStorage.getItem("server"), message: message });
        }
    });  
});

// wordt geroepen wanneer we in serverlist.html zitten
function connect() {
    socket = io.connect('http://localhost:3000');
    
    // stuur een 'request_servers' commando naar de server voor een lijst met servers
    socket.emit('request_servers', function (servers) {
        $.each(servers, function (index, server) {
            $('.server-list').append('<li>' + server.name + ', aantal spelers: ' + Object.keys(server.players).length + ' <button class="join-server" data-name="' + server.name + '">join</button></li>');
        });       
    });
}

// wordt geroepen wanneer we in game.html zitten
function joinServer() {
    socket = io.connect('http://localhost:3000');
    
    // stuur een 'join' commando naar de server
    socket.emit('join_server', { 
        server: localStorage.getItem("server"), 
        player: localStorage.getItem("player") 
    });
    
    $(".server-name").html('Je zit in server: ' + localStorage.getItem("server"));
    
    socket.on('message', function (data) {
        onReceivedChatMessage(data);
    });
}

// wordt geroepen wanneer we op disconnect button klikken
function leaveServer() {
    socket.emit('leave_server', localStorage.getItem("server"));
    
    window.location.href = "serverlist.html";
}

// we krijgen een 'message' commando van de server
function onReceivedChatMessage(data) {
    console.log(data);
    $(".chatbox-messages ul").append('<li>' + data + '</li>');
}