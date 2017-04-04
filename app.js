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
var ARENA_WIDTH = 1200;
var ARENA_HEIGHT = 600;
var LINE_WIDTH = 3;

var Entity = function(){
	var colorPallet = ['Cyan', 'DeepPink', 'FireBrick', 'Gold', 'GreenYellow', 'Lime', 'Magenta', 'OrangeRed', 'LightSeaGreen', 'Red']
	var self = {
		x:ARENA_WIDTH * Math.random(),
		y:ARENA_HEIGHT * Math.random(),
		color:colorPallet[Math.floor(Math.random() *10)],
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
		if(self.x > ARENA_WIDTH || self.x < 0){
			self.destroy();
		} else if(self.y > ARENA_HEIGHT || self.y < 0){
			self.destroy();
		}
		
	}
	self.getDistance = function(entity){
		return Math.sqrt(Math.pow(self.x-entity.x,2) + Math.pow(self.y-entity.y,2));
	}
	self.getDirection = function(entity){
		return Math.atan2(self.y-entity.y, self.x-entity.x);
	}
	self.getVelocityDiff = function(entity){
		return Math.sqrt(Math.pow(self.spdX-entity.spdX,2) + Math.pow(self.spdY-entity.spdY, 2));
	}
	self.getVelocity = function(){
		return Math.sqrt(Math.pow(self.spdX,2) + Math.pow(self.spdY, 2));
	}
	return self;
}

var Player = function(id, name){
	var self = Entity()
	var init_mass = 100;
	var init_radius = 5;
	var init_acceleration = 100;
	self.id = id;
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.maxSpd = 10;
	self.acceleration = init_acceleration;
	self.radius = init_radius;
	self.mass = init_mass;
	self.name = name;
	var orbitConstant = 10;
	var absorbFactor = 1.1;
	var collisitonFactor =.5;
	
	var super_update = self.update;
	self.update = function(){
		self.updateSpd();
		super_update();
		
		for(var i in Player.list){
			var player = Player.list[i];
			if(self !== player && self.getDistance(player) < player.radius + self.radius + LINE_WIDTH){	
				if(self.mass > player.mass * absorbFactor){ //self will absorb player					 
					 self.mass += player.mass;
					 self.recalculateAfterMassChange();
					 player.destroy();	
				} else if (player.mass >= self.mass * absorbFactor){ //we are big enough to live
					var impactDirection = self.getDirection(player);
					var selfMagnitude = (collisitonFactor * player.mass * self.getVelocityDiff(player)) / self.mass;
					self.spdX += selfMagnitude * Math.cos(impactDirection);
					self.spdY += selfMagnitude * Math.sin(impactDirection);	
				}
			} else if(self !== player && self.getDistance(player) < (2*player.radius + orbitConstant)){
				self.mass++;
				self.recalculateAfterMassChange();
				player.mass--;
				player.recalculateAfterMassChange();
			}
		}
	}
	
	
	self.updateSpd = function(){
		//speed changes due to player controls
		if(self.pressingRight)
			self.spdX = self.spdX + self.acceleration / self.mass;
		else if(self.pressingLeft)
			self.spdX = self.spdX - self.acceleration / self.mass;
		
		if(self.pressingUp)
			self.spdY = self.spdY - self.acceleration / self.mass;
		else if(self.pressingDown)
			self.spdY = self.spdY + self.acceleration / self.mass;

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
					self.spdX -= attractionMagnitude * (player.mass / self.mass) * Math.cos(angle);
					self.spdY -= attractionMagnitude * (player.mass / self.mass) * Math.sin(angle);	
				}
			}
		}
	}
	self.recalculateAfterMassChange = function(){
		self.radius = Math.sqrt(self.mass/Math.PI);
		self.acceleration = init_acceleration;
	}
	self.destroy = function(){
		self.x = ARENA_WIDTH * Math.random();
		self.y = ARENA_HEIGHT * Math.random();
		self.spdX = 0;
		self.spdY = 0;
		self.radius = init_radius;
		self.mass = init_mass;
		self.accelleration = 100;
	}
	Player.list[id] = self;
	return self;
}
Player.list = {};
Player.onConnect = function(socket, name){
	var player = Player(socket.id, name);
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
	socket.emit('init', {selfId: socket.id});
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
			id:player.id,
			x:player.x,
			y:player.y,
			color:player.color,
			radius:player.radius,
			mass:player.mass
		});		
	}
	return pack;
}


var Food = function(){
	var self = Entity();
	self.id = Math.random();
	self.x = Math.random() * ARENA_WIDTH;
	self.y = Math.random() * ARENA_HEIGHT;
	
	var super_update = self.update;
	self.update = function(){
		super_update();
		
		for(var i in Player.list){
			var player = Player.list[i];
			if(self.getDistance(player) < player.radius + LINE_WIDTH){
				player.mass += Math.max(25, player.mass / 100);
				player.recalculateAfterMassChange();
				delete Food.list[self.id];
			}
		}
	}
	Food.list[self.id] = self;
	return self;
}
Food.list = {};

Food.update = function(){
	if(Math.random() < .1 && Object.keys(Food.list).length < 200){
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
	
	socket.on('play',function(data){
			var name = data.name;
			console.log("player " + name + " joined");
			Player.onConnect(socket, name);
	});
	
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
