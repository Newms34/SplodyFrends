//helper stuff
const randoId = () => Math.floor(Math.random() * 9999999999).toString(32),
    getRand = a => a[Math.floor(Math.random() * a.length)],
    colors = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'purple', 'white'],
    devMode = false;


class Room {
    /*
    each 'room' is a separate instance of the game.
    it includes the players IN that room, a custom-shuffled list of colors, and, of course, the board itself.
    */
    constructor(id) {
        this.roomId = id;
        this.board = new Board();
        this.players = [];
        this.created = Date.now();
        this.colors = colors.sort((a, b) => Math.random() > 0.5 ? 1 : -1)
        // console.log('ROOM BOARD', this.board.map)
    }
}

class Cell {
    constructor(type) {
        this.type = type;
        this.placedBy = null;
        this.weaponType = null;
        this.countDown = null;
        this.animClasses= [];
        this.slippery = false;
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
                let type = '_';
                if (Math.random() > 0.6) {
                    //space or powerup
                    type = Math.random() > 0.9 ? '?' : '_';
                } else {
                    //dirt or rock
                    type = Math.random() > 0.8 ? '*' : '#'
                }
                return new Cell(type)
            })
        })
    }
}

class Player {
    constructor(id, color) {
        this.playerId = id;
        this.color = color;
        this.stunnedCounter = 0;
        this.shielded = false;
        this.pos = { x: 0, y: 0 };
        this.ammo = [-1, 0, 0, 0, 0, 0, 0];//this "version" of the ammo count is the "real" one; the one on the front end is just for convenience!
        if (devMode) {
            this.ammo = [-1, 5, 5, 5, 5, 5, 5]
        }
    }
}
class GameCtrl {
    constructor(io) {
        this.io = io;
        this.rooms = [];
        this.allNames = [];//list of all 'names' (ids) for reference
        this.rooms.push(new Room(randoId()));
        this.io.on('connection', socket => {
            this.handleConnect(socket);
        })
        setInterval(() => {
            this.heartbeat();
            this.checkRooms();
            // this.checkStatuses()
        }, 100);
    }
    checkRooms() {
        for (let room of this.rooms) {
            // console.log(room.roomId)
            this.getBombCells(room.board.map, room.roomId)
            room.players.forEach(p => {
                if (p.stunnedCounter > 0) {
                    p.stunnedCounter -= 100;
                    if (p.stunnedCounter <= 100) {
                        this.updateBoard(room.roomId);
                    }
                } else {
                    p.stunnedCounter = 0;
                }
            })
        }
    }
    dist(a, b) {
        return Math.hypot(Math.abs(b.y - a.y), Math.abs(b.x - a.x))
    }
    movePlayer(p, socket, slipperyMove) {
        const room = this.rooms.find(r => r.roomId == p.room),//the full game room
            playerObj = room.players.find(pl => pl.playerId == p.player),//our player object
            map = room.board.map,
            otherPlayers = room.players.filter(pl => pl.playerId != p.player).map(p => [p.pos.x, p.pos.y]),//cannot move onto other players!
            currPos = [playerObj.pos.x, playerObj.pos.y];
        if (playerObj.stunnedCounter > 0) {
            //cannot move if stunnedCounter!
            console.log('stunned!');
            return false;
        }
        if (p.dir == 'up') {
            currPos[1]--;
        } else if (p.dir == 'down') {
            currPos[1]++;
        } else if (p.dir == 'left') {
            currPos[0]--;
        } else {
            currPos[0]++;
        }
        if (!map[currPos[1]] || !map[currPos[1]][currPos[0]]) {
            //position doesn't exist!
            console.log('target cell does not exist!')
            return false;
        } else if (otherPlayers.some(opos => opos[0] == currPos[0] && opos[1] == currPos[1])) {
            //would move onto other player
            console.log('overlapping players!')
            return false;
        } else {
            //can move!
            let targCell = map[currPos[1]][currPos[0]];
            if (targCell.type == '*') return false;//rock, so cannot move
            if (targCell.type == '#') {
                //dirt; break, then allow move next turn
                map[currPos[1]][currPos[0]].type = 'X';
                this.updateBoard(room.roomId)
            } else if (targCell.type == 'X' || targCell.type == '_' || targCell.type == '?') {
                playerObj.pos.x = currPos[0];
                playerObj.pos.y = currPos[1];
                // console.log('okay to move! moving...',playerObj.pos,room.players)
                if (targCell.type == 'X') {
                    //broken dirt, so replace with open
                    targCell.type = Math.random() > 0.9 ? '?' : '_';
                }
                //now, handle any prize cells
                if (targCell.type == '?') {
                    const ammoType = 1 + Math.floor(Math.random() * 6);//may need to rework this to adjust frequency later!
                    playerObj.ammo[ammoType]++;
                    socket.emit('changeAmmo', { player: p.player, ammo: ammoType, subtract: false })
                    targCell.type = '_';
                }
                //handle any traps
                if (targCell.weaponType > 2 && targCell.weaponType < 7 && (p.player != targCell.placedBy || devMode)) {
                    //trap!
                    let trapType = targCell.weaponType - 2;
                    console.log('user', p, 'triggered a trap!', targCell, trapType)
                    if (trapType == 1) {
                        socket.emit('dead', { player: p.player, reason: 'fire trap' });
                    } else if (trapType == 2) {
                        console.log('ice!')
                        targCell.slippery = true;
                    } else if (trapType == 3) {
                        console.log('shock!')
                        playerObj.stunnedCounter = 3000;
                        socket.emit('shock', { player: p.player, amt: 3000 });
                    } else if (trapType == 4) {
                        // const dirtyCells = [];
                        for (let y = 0; y < map.length; y++) {
                            for (let x = 0; x < map[0].length; x++) {
                                if (this.dist({ x: x, y: y }, { x: currPos[0], y: currPos[1] }) <= 5 && (currPos[0] != x || currPos[1] != y)) {
                                    let dirtyCell = map[y][x];
                                    if (dirtyCell.type != '#' && dirtyCell.type != '*') {
                                        dirtyCell.type = '#';
                                    }
                                }
                            }
                        }
                    }
                    //remove trap, since it's been triggered
                    targCell.weaponType = null;
                    // targCell.slippery = false;
                    targCell.placedBy = null;
                }
                if (targCell.slippery) {
                    console.log('slippery! player sliding in direction', p.dir)
                    targCell.slippery = false;
                    this.movePlayer(p, socket, true);
                }
                //finally, send updated board
                this.updateBoard(room.roomId)
            }
        }
    }
    handleConnect(socket) {
        socket.on('hello', n => {
            //'hello' is a new player connecting
            // console.log('user', n, 'connected!', self)
            if (!this.allNames.includes(n)) {
                //player NOT yet placed (should always trigger!)
                const playerRoom = this.placePlayer(n);
                socket.emit('greetz', playerRoom)
            }
        });
        socket.on('hbr', u => {
            // heartbeat: see if user is still connected!
            const upd = Date.now()
            this.allNames.find(q => q.id == u).lastUpdate = upd;
            const badUsers = this.allNames.filter(u => upd - u.lastUpdate > 1000);
            badUsers.forEach(usr => this.removeUser(usr));
        });
        socket.on('tryMove', p => {
            /* 
                1. find out if player is stunnedCounter
                2. find out if player can re: blocking (i.e., room Array for them does not have obstruction in that direction)
            */

            this.movePlayer(p, socket);
        })
        socket.on('getBoard', ur => {
            this.updateBoard(ur.room);
        })
        socket.on('killCells', k => {
            let room = this.rooms.find(q => q.roomId == k.room);
            console.log(k.cells.length);
            k.cells.forEach(p => {
                // console.log('trying to find cell',p)
                let c = room.board.map[p[0]] && room.board.map[p[0]][p[1]]
                if (!c) return false;
                c.type = '_';
                //remove ice, destroy bombs if present
                c.slippery = false;
                if (c.weaponType === 0 || c.weaponType === 1) {
                    c.weaponType = null;
                }
                room.players.forEach(pl => {
                    if (pl.pos.x == p[1] && pl.pos.y == p[0]) {
                        socket.emit('dead', { player: pl.playerId, reason: 'bomb' });
                    }
                })
            })
            this.updateBoard(k.room);
        })
        socket.on('attemptFire', d => {
            const playerRoom = this.allNames.find(q => q.id == d.player.playerId).roomId,
                room = this.rooms.find(r => r.roomId == playerRoom),//the full game room
                playerObj = room.players.find(pl => pl.playerId == d.player.playerId),//our player object
                map = room.board.map;
            if (!!d.ammo && !playerObj.ammo[d.ammo]) {
                //not regular bomb, no ammo
                return this.io.emit('misfire', d);
            }
            let theCell = map[playerObj.pos.y][playerObj.pos.x];
            if (!!d.ammo) {
                //first, decrease ammo count by 1 if not reg bomb
                playerObj.ammo[d.ammo]--;
            }
            console.log('player attempted to place ammo #', d.ammo, 'at', playerObj.pos)
            theCell.weaponType = d.ammo;
            theCell.placedBy = d.player.playerId;
            if (d.ammo === 0) {
                theCell.countDown = 3000;
            } else if (d.ammo == 1) {
                theCell.countDown = 500;
            }
            // socket.emit('fired', d)
            socket.emit('changeAmmo', { player: d.player.playerId, ammo: d.ammo, subtract: true })
            this.updateBoard(room.roomId)
        })
    }
    updateBoard(rid) {
        const room = this.rooms.find(r => r.roomId == rid);//the full game room
        this.io.emit('boardUpd', {
            map: room.board.map,
            room: room.roomId,
            players: room.players,
            // hasBombs:getBombCells(map)
        });
    }
    getBombCells(m, r) {
        //find any cells with bombs
        let y, x, c;
        for (y = 0; y < m.length; y++) {
            for (x = 0; x < m[0].length; x++) {
                c = m[y][x];
                if (c.weaponType === 0 || c.weaponType == 1) {
                    //bomb or sac
                    c.countDown -= 100;
                    if (c.countDown < 1) {
                        console.log('cell', x, y, 'goes boom!');
                        // this.io.emit('boom', {
                        //     room: r,
                        //     x: x,
                        //     y: y,
                        //     type: c.weaponType
                        // })
                        this.boom({ x, y }, r, m, c.weaponType)
                        c.placedBy = null;
                        c.weaponType = null;
                        c.countDown = null;
                    }
                }
            }
        }
    }
    boom(cell, roomId, map, boomType) {
        let deadCells = null,
            deadPlayers = null;
        if (boomType === 0) {
            //regular bomb; cross shape up to 10 tiles away
            console.log('Cell', cell, 'exploded in room', roomId, 'with type Bomb')
            deadPlayers = this.explodeRegular(cell.y, cell.x, roomId);
            // deadPlayers = this.findDead(roomId, deadCells);
            this.updateBoard(roomId);
            setTimeout(()=>{
                this.animateCells(roomId,map,['burned','fallout'],[3000,3000],['boom-horiz','boom-vert','boom-rad-sm'])
            },900)
            
        }
        else if (boomType === 1) {
            //sac
            console.log('Cell', cell, 'exploded in room', roomId, 'with type Sac')
            deadPlayers = this.explodeNuke(cell.y, cell.x, roomId);
            // deadPlayers = this.findDead(roomId, deadCells);
            this.updateBoard(roomId);
            setTimeout(()=>{
                this.animateCells(roomId,map,['burned','fallout'],[6000,6000],['boom-radial'])
            },1500)
        }
        this.io.emit('explosion', {
            //data of the explosion, including who was hit
            roomId: roomId,
            // deadCells: deadCells,
            deadPlayers: deadPlayers,
            center: cell,
            type: boomType
        })
        
        // setTimeout(()=>{
        //     //after 1s (time for "explosion" to clear, get new board)
        //     this.io.emit('boardUpd', { room: this.room.id })
        // },1000)
        // console.log(this.rooms.find(q=>q.roomId==room))
    }
    explodeNuke(cy, cx, roomId) {
        //    let [cx, cy] = [y, x];
        console.log('x', cx, 'y', cy)
        let room = this.rooms.find(q => q.roomId == roomId),
            deadP = [];
        console.log('map', room.board.map.length, 'by', room.board.map[0].length)
        for (let y = 0; y < room.board.map.length; y++) {
            for (let x = 0; x < room.board.map[0].length; x++) {
                let c = room.board.map[y][x];
                if (this.dist({ x: x, y: y }, { x: cx, y: cy }) < 4) {
                    c.weaponType = null;
                    c.placedBy = null;
                    c.type = '_';
                    c.animClasses.push('boom-radial');
                    let candP = room.players.find(p => p.pos.y == y && p.pos.x == x)
                    if (!!candP && !deadP.includes(candP.playerId)) {
                        candP.hp=0;
                        deadP.push(candP.playerId);
                    }
                }
            }
        }
        return deadP;
    }
    explodeRegular(y, x, roomId) {
        let remains = {
            left: 10,
            right: 10,
            up: 10,
            down: 10,
        },
            newPos = {
                left: [y, x],
                right: [y, x],
                up: [y, x],
                down: [y, x]
            },
            // deadCells = [[y, x]],
            deadP = [],
            room = this.rooms.find(q => q.roomId == roomId),
            dirs = ['left', 'right', 'up', 'down'];
        room.board.map[y][x].animClasses.push('boom-rad-sm')
        let candP = room.players.find(p => p.pos.y == y && p.pos.x == x);
        if (!!candP) deadP.push(candP.playerId)
        room.board.map[y][x].boomStyle = 3;
        //up to 10 in each direction
        while (Object.values(remains).some(q => q > 0)) {
            newPos.left[0]--;
            newPos.right[0]++;
            newPos.up[1]--;
            newPos.down[1]++;
            dirs.forEach(d => {
                remains[d]--;
                if (remains[d] > 0) {
                    //still explosion "charge" left in this direction
                    let cell = room.board.map[newPos[d][0]] && room.board.map[newPos[d][0]][newPos[d][1]],
                        candP = room.players.find(p => p.pos.y == newPos[d][0] && p.pos.x == newPos[d][1]);
                    if (!cell) {
                        //off board; set to 0
                        remains[d] = 0;
                    } else {
                        if (cell.type == '#' || cell.type == '*') {
                            //rock and dirt require 1 extra 'charge'
                            remains[d]--;
                        }
                        cell.type = '_';
                        if (d == 'left' || d == 'right') {
                            cell.animClasses.push('boom-vert')
                        } else {
                            cell.animClasses.push('boom-horiz')
                        }
                        if (!!candP && !deadP.includes(candP.playerId)){
                            candP.hp=0;
                            deadP.push(candP.playerId);
                        }
                    }
                    // deadCells.push(...newPos[d])
                }
            })
        }
        return deadP;
    }
    animateCells(roomId, map, classes, delays, old) {
        console.log('room',roomId,'classes',classes,'delays',delays,'Old arr',old)
        // console.log(delays.shift())
        // return false;
        let currClass = classes.shift() || '',
            currDelay = delays.length?delays.shift():null;
        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[0].length; x++) {
                if (map[y] && map[y][x] && map[y][x].animClasses && old.some(c=>map[y][x].animClasses.includes(c))) {
                    //an animated cell
                    map[y][x].animClasses = map[y][x].animClasses.filter(q => !old.includes(q))
                    map[y][x].animClasses.push(currClass);
                    //remove old classes, insert the latest new one
                }
            }
        }
        this.updateBoard(roomId)
        if (currDelay!==null) {
            //still delays left to go thru. Note we don't require classes, as the final "delay" can lead to removal of all classes
            setTimeout(() => {
                this.animateCells(roomId, map, classes, delays, [currClass])
            }, currDelay)
        }
    }
    findDead(rid, dead) {
        const room = this.rooms.find(q => q.roomId == rid);
        return room.players.filter(p => {
            return dead.some(c => {
                // console.log('comparing cell', c, 'and player', p.pos)
                return c[0] == p.pos.y && c[1] == p.pos.x;
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
        console.log('trying to place player with id', id)
        let color = theRoom.colors[theRoom.players.length % theRoom.colors.length];
        let np = new Player(id, color);
        theRoom.players.push(np)
        // console.log(theRoom.board.map)
        let possRooms = [];
        //find all empty cells (no dirt, rock, prizes, or other players)
        for (let y = 0; y < 20; y++) {
            for (let x = 0; x < 20; x++) {
                if (theRoom.board.map[y][x] && theRoom.board.map[y][x].type == '_' && !theRoom.players.find(p => p.pos.x != x && p.pos.y != y)) {
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
    removeUser(u) {
        let remRoom = this.rooms.find(r => r.roomId == u.roomId)
        remRoom.players = remRoom.players.filter(usr => usr.playerId != u.id);
        this.allNames = this.allNames.filter(q => q.id !== u.id);
        console.log('users now', this.allNames, 'removed', u.id, 'from room', u.roomId)
        this.updateBoard(u.roomId);
    }
}


module.exports = GameCtrl;