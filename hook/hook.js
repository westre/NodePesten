var gith = require('gith').create(6000);  // run on port 6000
var exec = require('child_process').exec;

gith({
	repo: 'westre/NodePesten'  // the github-user/repo-name
}).on('all', function (payload) {
	
	console.log("push received");
	exec('C:\Program Files\Git\NodePesten\hook\hook.bat ' + payload.branch, function (err, stdout, stderr) {
		if (err) return err;
		console.log(stdout);
		console.log("git deployed to branch " + payload.branch);
	});
});