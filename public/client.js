$(document).ready(function () {
	var socket = null;
	
	$("#connect").click(function () {
		socket = io.connect('http://localhost:3000');
		
		// stuur een 'join' commando naar de server
		socket.emit('join', {
			name: 'patty'
		});
		
		// vang alle commando's met 'chat', zodat we het kunnen lezen van de server
		socket.on('chat', function (data) {
			alert("Chat message van server: " + data.message);
		});
		
		$(this).remove();
	});
});