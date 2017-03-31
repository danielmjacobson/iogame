//app.js
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(process.env.PORT || 3000);
console.log("Server started.");
var SOCKET_LIST = {};
var GRAVITATIONAL_ATTRACTION_CONSTANT = '200.0';
var ARENA_SIZE = 500;
var ABSORB_FACTOR = 2;

var Entity = function(){
	var colorPallet = ['red','orange','yellow','light green','blue','cyan','magenta'];
	var self = {
		x:ARENA_SIZE * Math.random(),
		y:ARENA_SIZE * Math.random(),
		color:colorPallet[Math.floor(Math.random() *7)],
		spdX:0,
		spdY:0,
		id:"",
	}
	self.update = function(){
		self.updatePosition();
	}
	self.updatePosition = function(){
		self.x += self.spdX;
		self.y += self.spdY;
		
		//set barriers at current arena size
		if(self.x > ARENA_SIZE || self.x < 0){
			self.destroy();
		} else if(self.y > ARENA_SIZE || self.y < 0){
			self.destroy();
		}
		
	}
	self.getDistance = function(entity){
		return Math.sqrt(Math.pow(self.x-entity.x,2) + Math.pow(self.y-entity.y,2));
	}
	self.getDirection = function(entity){
		return Math.atan2(Math.pow(self.y-entity.y,2), Math.pow(self.x-entity.x,2));
	}
	self.getVelocityDiff = function(entity){
		return Math.sqrt(Math.pow(self.spdX-entity.spdX,2) + Math.pow(self.spdY-entity.spdY, 2));
	}
	self.destroy = function(){
		self.x = ARENA_SIZE * Math.random();
		self.y = ARENA_SIZE * Math.random();
		self.spdX = 0;
		self.spdY = 0;
	}
	return self;
}

var Player = function(id){
	var self = Entity();
	self.id = id;
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.maxSpd = 10;
	self.acceleration = 1;
	self.radius = 4;
	self.mass = 50;
	
	var super_update = self.update;
	self.update = function(){
		self.updateSpd();
		super_update();
		
		for(var i in Player.list){
			var player = Player.list[i];
			var line_width = 3;
			if(self !== player && self.getDistance(player) < player.radius + self.radius + line_width){
				var impactDirection = self.getDirection(player);
				var selfMagnitude = (player.mass * self.getVelocityDiff(player)) / self.mass;
				self.spdX += selfMagnitude * Math.cos(impactDirection);
				self.spdY += selfMagnitude * Math.sin(impactDirection);
				console.log("impactdirection: " + impactDirection);			
				/*var otherMagnitude = (self.mass * self.getVelocityDiff(player)) / player.mass;
				player.spdX -= otherMagnitude * Math.cos(impactDirection);
				player.spdY -= otherMagnitude * Math.sin(impactDirection);
				*/
				
				if(self.mass > player.mass * ABSORB_FACTOR){					 
					 self.mass += player.mass;
					 player.destroy;					 
				}				
			}
		}
	}
	
	
	self.updateSpd = function(){
		//speed changes due to player controls
		if(self.pressingRight)
			self.spdX = self.spdX + self.acceleration;
		else if(self.pressingLeft)
			self.spdX = self.spdX - self.acceleration;
		else
			self.spdX = self.spdX; //can add passive decelleration later
		
		if(self.pressingUp)
			self.spdY = self.spdY - self.acceleration;
		else if(self.pressingDown)
			self.spdY = self.spdY + self.acceleration;
		else
			self.spdY = self.spdY; //can add passive decelleration later

		//speed change due to gravity
		//this is where im concerned about performance issues big O(n^2) try to think of better solution
		for(var i in Player.list){	
			var player = Player.list[i];
			if(player.id !== self.id){
				var xDisp = self.x - player.x;
				var yDisp = self.y - player.y;
				var distance = Math.sqrt(Math.pow(xDisp, 2) + Math.pow(yDisp, 2));
				var angle = Math.atan2(yDisp, xDisp);
				if(distance > 10){ //TODO: need to set minimal interaction distnace to avoid craziness
					var attractionMagnitude = GRAVITATIONAL_ATTRACTION_CONSTANT / Math.pow(distance, 2); //add mass calculation later when mass is 
					//self.spdX -= attractionMagnitude * (player.mass / self.mass) * Math.cos(angle);
					//self.spdY -= attractionMagnitude * (player.mass / self.mass) * Math.sin(angle);	
				}
			}
		}
	}
	Player.list[id] = self;
	return self;
}
Player.list = {};
Player.onConnect = function(socket){
	var player = Player(socket.id);
	socket.on('keyPress',function(data){
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
	});
}
Player.onDisconnect = function(socket){
	delete Player.list[socket.id];
}
Player.update = function(){
	var pack = [];
	for(var i in Player.list){
		var player = Player.list[i];
		player.update();	
		pack.push({
			x:player.x,
			y:player.y,
			color:player.color,
			radius:player.radius
		});		
	}
	return pack;
}


var Food = function(){
	var self = Entity();
	self.id = Math.random();
	self.x = Math.random() * ARENA_SIZE;
	self.y = Math.random() * ARENA_SIZE;
	
	var super_update = self.update;
	self.update = function(){
		super_update();
		
		for(var i in Player.list){
			var player = Player.list[i];
			if(self.getDistance(player) < player.radius + 1){
				player.mass += 9;
				player.radius = Math.floor(Math.sqrt(player.mass/Math.PI));
				player.acceleration = 50 / player.mass;
				delete Food.list[self.id];
			}
		}
	}
	Food.list[self.id] = self;
	return self;
}
Food.list = {};

Food.update = function(){
	if(Math.random() < .04 * Player.list.length){
		Food();
	}	
	var pack = [];
	for(var i in Food.list){
		var food = Food.list[i];
		food.update();
		pack.push({
			x:food.x,
			y:food.y,
		});		
	}
	return pack;
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;
	
	Player.onConnect(socket);
	
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});
	
	
	
	
});

setInterval(function(){
	var pack = {
		player:Player.update(),
		food:Food.update(),
	}
	
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions',pack);
	}
},1000/25);