var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);

var teamsObjectUpdater = require('./teamsObjectUpdater');
var secrets = require('./secrets'),
  mailListenerSettings = require('./secrets/mailListenerSettings.js');
var TextService = require('./textService');
var textService = new TextService(mailListenerSettings);

var teams = [];

var names = JSON.parse('{"teams":[{"name":"B1"},{"name":"B2"},{"name":"G1"},{"name":"G2"},{"name":"R1"}],"missions":[{"name":"M1","code":"Statue"},{"name":"M2","code":"Aquatics"},{"name":"M3","code":"Turtle"},{"name":"M4","code":"Castle"},{"name":"M5","code":"Silly"},{"name":"M6","code":"Oars"}]}');
var routes = JSON.parse('[[0,1,2,3,5,4],[1,4,3,5,2,0],[3,2,5,4,0,1],[2,5,4,0,1,3],[5,3,0,1,4,2]]');
var perTeamMessages = JSON.parse('{"formatErrorMessage":[{"delay":0,"message":"I don\'t understand the text you entered. Looks like it\'s in the wrong format.\\n(TEAMID CODEWORD)"}],"teamNotFoundMessage":[{"delay":0,"message":"I can\'t find which unit you are a part of. Your text might be in the wrong format.\\n(TEAMID CODEWORD) Make sure your TEAMID is correct."}],"noMissionMessage":[{"delay":0,"message":"Your mission has ended."}],"finishMessage":[{"delay":0,"message":"Perfect, I just got some new intel for you. And you now have some cracking to do. I\'ve sent it over to HQ, get there as fast as you can!"}],"teamOnlineMessage":[{"delay":0,"message":"Cool, I got you guys all set up and ready to go. Best of luck."}],"offlineHelpMessage":[{"delay":0,"message":"Enter your unit id and then ONLINE to start. (TEAMID ONLINE)"}]}');
var perMissionMessages = JSON.parse('[{"clue":[{"delay":0,"message":"They help form new memories, otherwise known as aquatic steeds."}],"skipHint":[{"delay":0,"message":"Skip Hint 1"}]},{"clue":[{"delay":0,"message":"An athenaeum is the place to look, now look into the Holy Book. Hidden in the song of songs, windows high and windows long."}],"skipHint":[{"delay":0,"message":"Skip Hint 2"}]},{"clue":[{"delay":0,"message":"Who is it that rows quickly with four oars but never comes out from under his own roof?"}],"skipHint":[{"delay":0,"message":"Skip Hint 3"}]},{"clue":[{"delay":0,"message":"Once again to the Holy Book and then you will see, 8 then 32 the son of Zebedee."}],"skipHint":[{"delay":0,"message":"Skip Hint 4"}]},{"clue":[{"delay":0,"message":"Said to be with a prison design, you\'ll find the next code on the bulletin inside."}],"skipHint":[{"delay":0,"message":"Skip Hint 5"}]},{"clue":[{"delay":0,"message":"https://www.youtube.com/watch?v=7otAJa3jui8"}],"skipHint":[{"delay":0,"message":"Skip Hint 6"}]}]');
var perStoryMessages = JSON.parse('[{"storyLine":[{"delay":0,"message":"I\'ll need you guys to collect some code words for me to regain entry into the surveillance system. Here\'s what I have for you to find the first one:"}],"incorrectLine":[{"delay":0,"message":"That doesn\'t seem to be working. Are you sure you\'re giving me the right code?"}]},{"storyLine":[{"delay":0,"message":"Looking good so far, I\'ve gained entry into the first encrypted database. I\'m stuck with this message now:"}],"incorrectLine":[{"delay":0,"message":"I cannot decrypt the second database with that code. Are you sure that\'s the right one?"}]},{"storyLine":[{"delay":0,"message":"Second encrypted database decrypted. Looks like there is one more left:"}],"incorrectLine":[{"delay":0,"message":"It\'s not working. Are you sure you\'re giving me the right code?"}]},{"storyLine":[{"delay":0,"message":"Great that did the trick. I\'m into the system. SECURE MESSAGE FOLLOWS"},{"delay":2000,"message":"Secure Message Link: http://videomessage"}],"incorrectLine":[{"delay":0,"message":"I\'m looking through the surveillance footage right now. But I don\'t think you gave me the right code. Are you sure that\'s the right one?"}]},{"storyLine":[{"delay":0,"message":"The surveillance isn\'t showing much useful footage. I\'m trying to remember what the rest of these codes are for... Anyways, someone left this note in my office earlier:"}],"incorrectLine":[{"delay":0,"message":"It\'s not working. Are you sure you\'re giving me the right code?"}]},{"storyLine":[{"delay":0,"message":"I\'m gathering some more intel, the surveillance footage isn\'t giving us anything helpful. Though the codes do seem to align in some strange way... Another lead:"}],"incorrectLine":[{"delay":0,"message":"It\'s not working. Are you sure you\'re giving me the right code? Hurry, we are running out of time!"}]}]');

teams = teamsObjectUpdater.initializeTeams(names, routes, perTeamMessages, perMissionMessages, perStoryMessages);

// Serve the /web folder as static files.
app.use(express.static('web'));

app.get('/', function(req, res){
  res.sendFile('web/missioncontrol.html', { root: __dirname });
});

io.on('connection', function(socket){
  console.log('a user connected');
  socket.emit('status-update', JSON.stringify(teams));

  socket.on('advanceMission', function(teamNum){
    console.log('advance: ' + teamNum);
    teams = teamsObjectUpdater.advanceMission(teamNum);
    io.emit('status-update', JSON.stringify(teams));
  });

  socket.on('skipMission', function(teamNum){
    console.log('skip: ' + teamNum);
    teams = teamsObjectUpdater.skipMission(teamNum);
    io.emit('status-update', JSON.stringify(teams));
  });

  socket.on('backMission', function(teamNum){
    console.log('back: ' + teamNum);
    teams = teamsObjectUpdater.backMission(teamNum);
    io.emit('status-update', JSON.stringify(teams));
  });

  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
});

textService.start();

textService.on('server:connected', function () {
  console.log('textService started');
});

textService.on('server:disconnected', function () {
  
});

textService.on('received', function (addresses, text, subjectLine) {
  console.log('received message: ' + JSON.stringify(text));
  io.emit('notification', JSON.parse('{ "subject": "' + subjectLine + '", "body": ' + JSON.stringify(text) + '}'));
  var responseMessages = teamsObjectUpdater.checkCode(text);
  io.emit('status-update', JSON.stringify(teamsObjectUpdater.getTeams()));
  for (var messageNum in responseMessages) {
    console.log(responseMessages[messageNum]);
    setTimeout(function (addressesJson, responseMessagesString) {
      textService.sendText(JSON.parse(addressesJson), responseMessagesString);
    }, responseMessages[messageNum].delay, JSON.stringify(addresses), responseMessages[messageNum].message);
  }
  
});

http.listen(7000, function(){
  console.log('listening on *:7000');
});
