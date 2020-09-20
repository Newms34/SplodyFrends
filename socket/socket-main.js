//helper stuff
const randoId = () => Math.floor(Math.random() * 9999999999).toString(32),
    getRand = a => a[Math.floor(Math.random() * a.length)],
    icons = ['cat', 'crow', 'dog', 'dragon', 'fish', 'frog', 'hippo', 'horse', 'kiwi-bird', 'otter', 'robot', 'spider', 'user-astronaut'],
    colors = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'purple', 'white'],
    fs = require('fs');


class Room {
    /*
    each 'room' is a separate instance of the game.
    it includes the players IN that room, a custom-shuffled list of icons and colors, and, of course, the board itself.
    */
    constructor(id) {
        this.roomId = id;
        this.board = new Board();
        this.players = [];
        this.icons = icons.sort((a, b) => Math.random() > 0.5 ? 1 : -1)
        this.colors = colors.sort((a, b) => Math.random() > 0.5 ? 1 : -1)
        // console.log('ROOM BOARD', this.board.map)
    }
}

class Board {
    constructor() {
        this.height = 20;
        this.width = 20;
        /* MAP KEY:
         _ : empty space
         # : dirt (destroyable with normal bombs)
         * : rock (destroyable ONLY with sac bombs)
         ? : powerup. Dirt also has chance to leave powerups
        */
        this.map = Array(this.height).fill(1).map(row => {
            return Array(this.width).fill(1).map(c => {
                if (Math.random() > 0.6) {
                    //space or powerup
                    return Math.random() > 0.9 ? '?' : '_';
                } else {
                    //dirt or rock
                    return Math.random() > 0.8 ? '*' : '#'
                }
            })
        })
    }
}

class Player {
    constructor(id, icon, color) {
        this.playerId = id;
        this.icon = icon;
        this.color = color;
        this.stunned = false;
        this.shielded = false;
        this.pos = { x: 0, y: 0 };
        this.ammo = [-1, 0, 0, 0, 0, 0, 0];//this "version" of the ammo count is the "real" one; the one on the front end is just for convenience!
    }
}
class GameCtrl {
    constructor(io) {
        this.io = io;
        this.rooms = [];
        this.allNames = [];//list of all 'names' (ids) for reference
        this.rooms.push(new Room(randoId()))
        const self = this;
        this.io.on('connection', function (socket) {
            self.handleConnect(socket, self);
        })
        setInterval(function () {
            self.heartbeat();
        }, 100);
    }
    handleConnect(socket, self) {
        socket.on('hello', function (n) {
            //'hello' is a new player connecting
            // console.log('user', n, 'connected!', self)
            if (!self.allNames.includes(n)) {
                //player NOT yet placed (should always trigger!)
                const playerRoom = self.placePlayer(n);
                socket.emit('greetz', playerRoom)
            }
        });
        socket.on('hbr', function (u) {
            // heartbeat: see if user is still connected!
            const upd = Date.now()
            self.allNames.find(q => q.id == u).lastUpdate = upd;
            const badUsers = self.allNames.filter(u => upd - u.lastUpdate > 1000);
            badUsers.forEach(usr => self.removeUser(usr, self));
        });
        socket.on('movePlayer', p => {
            /* 
                1. find out if player is stunned
                2. find out if player can re: blocking (i.e., room Array for them does not have obstruction in that direction)
            */
        })
        socket.on('getBoard', ur => {
            //get room id, send board
            // console.log()
            const theRoom = self.rooms.find(q => q.roomId == ur.room);
            socket.emit('boardUpd', {
                map: theRoom.board.map,
                room: theRoom.roomId,
                players: theRoom.players
            });
        })
    }
    placePlayer(id) {
        let theRoom = this.rooms[this.rooms.length - 1];
        if (!theRoom || theRoom.players.length > 5) {
            //too many players; create new room OR no rooms yet
            theRoom = new Room(randoId());
            this.rooms.push(theRoom);
        }
        console.log('p length before',theRoom.players.length)
        let icon = theRoom.icons[theRoom.players.length % theRoom.icons.length];
        let color = theRoom.colors[theRoom.players.length % theRoom.colors.length];
        let np = new Player(id, icon, color);
        theRoom.players.push(np)
        console.log('p length after',theRoom.players.length)
        // console.log(theRoom.board.map)
        let possRooms = [];
        //find all empty cells (no dirt, rock, or prizes)
        for (let y = 0; y < 20; y++) {
            for (let x = 0; x < 20; x++) {
                if (theRoom.board.map[y][x] && theRoom.board.map[y][x] == '_' && !theRoom.players.find(p => p.pos.x != x && p.pos.y != y)) {
                    possRooms.push({ x, y })
                }
            }
        }
        // console.log('POSSIBLE ROOMS',possRooms)
        np.pos = possRooms[Math.floor(Math.random() * possRooms.length)]
        this.allNames.push({
            id: id,
            lastUpdate: Date.now(),
            roomId: theRoom.roomId
        });
        return { room: theRoom.roomId, player: np };
    }
    heartbeat() {
        this.allNames.forEach(n => {
            this.io.emit('hb', n.id);
        })
    }
    removeUser(u, self) {
        let remRoom = self.rooms.find(r => r.roomId == u.roomId)
        remRoom.players = remRoom.players.filter(usr => usr.playerId != u.id);
        self.allNames = self.allNames.filter(q => q.id !== u.id);
        console.log('users now', self.allNames, 'removed', u.id,'from room',u.roomId)
        const theRoom = self.rooms.find(q => q.roomId == u.roomId);
        this.io.emit('boardUpd', {
            map: theRoom.board.map,
            room: theRoom.roomId,
            players: theRoom.players
        });
    }
}


module.exports = GameCtrl;