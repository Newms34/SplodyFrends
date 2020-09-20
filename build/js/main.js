class Trap {
    constructor(player, type) {
        this.player = player;//id of player that placed it. if == this player, trap is visible and does NOT trigger
        this.type = type;
    }
    trigger(player, cell, other) {
        if (this.type == 'fire') {
            //fire: kill
            player.health = 0;
        } else if (this.type == 'ice') {
            //ice: slide
            cell = 'S';//S for Slippery
        } else if (this.type == 'shock') {
            //ice: slide
            player.stunned = true;
        } else if (this.type == 'mud') {
            //ice: slide
            other = 'mud';
        }
    }
}
const socket = io(),
    main = new Vue({
        data: {
            players: [],
            isNamed: false,
            msgTimeout: null,
            player: {
                id: Math.floor(Math.random() * 999999999999).toString(32),
                avatar: {
                    color: null
                },
                pos: {
                    x: 0,
                    y: 0
                },
                health: 1,//most skills kill in 1 hit. a few in the future may change this
                ammo: [-1, 0, 0, 0, 0, 0, 0]//-1 = infinite. Others are as normal
            },
            ammoCat: [{
                name: 'Bomb',
                desc: "A generic bomb. Destroys the row and column it's in, up to 10 tiles away",
                icon: 'bomb'
            }, {
                name: 'Sacrifice Bomb',
                desc: "A huge bomb. Destroys the area around the player in a 7-tile radius instantly. Kills the player.",
                icon: 'skull'
            }, {
                name: 'Shield',
                desc: "Protects the player from 1 bomb explosion, and then expires. Prevents bomb/trap placement. Expires automatically after 5 seconds if not used.",
                icon: 'shield-alt'
            }, {
                name: 'Fire Trap',
                desc: "Invisible to other players. Placed on ground. Arms after 2 seconds. When triggered, causes an explosion that kills the target.",
                icon: 'fire'
            }, {
                name: 'Ice Trap',
                desc: "Invisible to other players. Placed on ground. Arms after 2 seconds. When triggered, causes an explosion that freezes the ground, making it extra slippery and preventing players from stopping on this tile.",
                icon: 'snowflake'
            }, {
                name: 'Shock Trap',
                desc: "Invisible to other players. Placed on ground. Arms after 2 seconds. When triggered, causes an explosion that prevents the player from moving or acting for 2 second",
                icon: 'bolt'
            }, {
                name: 'Mud Trap',
                desc: "Invisible to other players. Placed on ground. Arms after 2 seconds. When triggered, causes an explosion that fills all empty tiles in a 5-foot radius from the target with dirt.",
                icon: 'mountain'
            }],
            alert: {
                title: null,
                body: null,
                show: false,
            },
            room: {
                id: null,
                map: Array(20).fill(1).map(rw => Array(20).fill('_'))
            },
            askingReload: false,
        },
        methods: {
            doMsg(title, body, lasts) {
                const self = this;
                self.alert.title = title;
                self.alert.body = body;
                self.alert.show = true;
                if (!!lasts && typeof lasts == "number") {
                    clearInterval(this.msgTimeout);
                    this.msgTimeout = setTimeout(function () {
                        self.alert.show = false;
                    }, lasts)
                }
            },
            attemptFire(amNum) {
                socket.emit('attemptFire', {
                    player: this.player,
                    ammo: amNum
                })
            },
            fire(amNum) {
                let ammo = this.ammoCat[amNum];
                if (!this.player.ammo[amNum]) {
                    return this.doMsg('Out of Ammo', `You have no more ${ammo.name}s!`, 2000);
                }
                if (amNum > 0) {
                    //if not regular bomb;
                    this.player.ammo[amNum]--;
                }
                console.log('would fire', ammo.name)
            },
            updatePlayers(p) {

            },
            receiveAttack(p) {

            },
            askReload() {
                this.askingReload = true;
                bulmabox.confirm('Disconnected!', "You've lost connection with the SplodyFrends server! Would you like to refresh the page and try to reconnect?", r => {
                    if (!!r) {
                        window.location.reload();
                    }
                })
            },
            cellBg(symb) {
                if (symb == '#') {
                    return 'dirt';
                } else if (symb == 'X') {
                    return 'dirt-cracked';
                } else if (symb == '*') {
                    return 'rock';
                } else {
                    //open or prize
                    if (symb == '?') {
                        return 'prize';
                    }
                    return 'open';
                }
            },
            hasPlayer(x, y) {
                // console.log('x',x,'y',y,'players',this.players)
                return this.players.find(p => p.pos.x == x && p.pos.y == y);
            },
            handleKey(e) {
                /* 
                    87:up,83:down, 65:left,68:right
                    49-57: 1-9, 48:0
                    */
                const self = this;
                if ([65, 68, 83, 87].includes(e.which)) {
                    //movement
                    e.preventDefault();
                    e.stopPropagation();
                    let dir = null;
                    if (e.which == 87) {
                        dir = 'up';
                    } else if (e.which == 83) {
                        dir = 'down';
                    } else if (e.which == 65) {
                        dir = 'left';
                    } else {
                        dir = 'right';
                    }
                    socket.emit('tryMove', {
                        player: self.player.id,
                        dir: dir
                    })
                } else if ([48, 49, 50, 51, 52, 53, 54, 55, 56, 57].includes(e.which)) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.attemptFire(e.which - 49)
                }
            },
            explode(y,x) {
                // console.log('explosion happens')
                let remains = {
                        left: 10,
                        right: 10,
                        up: 10,
                        down: 10,
                    }, 
                    leftPos = [x,y],
                    upPos = [x,y],
                    rightPos = [x,y],
                    downPos = [x,y],
                    deadCells=[[x,y]];
                
                this.room.map[x][y].boomStyle=3;
                //up to 10 in each direction
                while (remains.up>0 || remains.left>0 || remains.right>0 || remains.down>0) {
                    if(remains.left>0){
                        remains.left--;
                        leftPos[0]--;
                        let leftCell = this.room.map[leftPos[0]] && this.room.map[leftPos[0]][leftPos[1]];
                        if(!leftCell){
                            remains.left=0;
                        }else{
                            if(leftCell.type=='#' || leftCell.type=='*'){
                                remains.left--;
                            }
                            leftCell.type='_';
                            leftCell.boomStyle=1;
                        }
                        deadCells.push([...leftPos]);
                    }
                    if(remains.right>0){
                        remains.right--;
                        rightPos[0]++;
                        let rightCell = this.room.map[rightPos[0]] && this.room.map[rightPos[0]][rightPos[1]];
                        if(!rightCell){
                            remains.right=0;
                        }else{
                            if(rightCell.type=='#' || rightCell.type=='*'){
                                remains.right--;
                            }
                            rightCell.type='_';
                            rightCell.boomStyle=1;
                        }
                        deadCells.push([...rightPos]);
                    }
                    if(remains.up>0){0
                        remains.up--;
                        upPos[1]--;
                        let upCell = this.room.map[upPos[0]] && this.room.map[upPos[0]][upPos[1]];
                        if(!upCell){
                            remains.up=0;
                        }else{
                            if(upCell.type=='#' || upCell.type=='*'){
                                remains.up--;
                            }
                            upCell.type='_';
                            upCell.boomStyle=2;
                        }
                        deadCells.push([...upPos]);
                    }
                    if(remains.down>0){0
                        remains.down--;
                        downPos[1]++;
                        let downCell = this.room.map[downPos[0]] && this.room.map[downPos[0]][downPos[1]];
                        if(!downCell){
                            remains.down=0;
                        }else{
                            if(downCell.type=='#' || downCell.type=='*'){
                                remains.down--;
                            }
                            downCell.type='_';
                            downCell.boomStyle=2;
                        }
                        deadCells.push([...downPos]);
                    }
                }
                return deadCells;
            },
            nuke(x,y){
                console.log('nuke currently disabled!')
                return [];
            }
        },
        computed: {
            mapDisp: function () {
                return this.room.map.map(q => q.join(''));
            }
        },
        created() {
            socket.on('updatePlayers', p => {
                this.updatePlayers(p);
            });
            socket.on('attack', p => {
                //incoming attack
                this.receiveAttack(p);
            });
            socket.on('misfire', p => {
                if (p.player.id != this.player.id) return false;
                console.log('attempted', null)
                return this.doMsg('Out of Ammo', `You have no more ${this.ammoCat[p.ammo].name}s!`, 2000);
            });
            socket.on('changeAmmo', p => {
                if (p.player != this.player.id) return false;
                this.player.ammo[p.ammo] += p.subtract ? -1 : 1;
                // console.log(`Got new ${this.ammoCat[p.ammo].name}! Player now`, this.player)
            });
            socket.on('disconnect', d => {
                if (!!this.askingReload) return false;
                this.askReload();
            });
            socket.on('connect_failed', d => {
                if (!!this.askingReload) return false;
                this.askReload();
            });
            socket.on('hb', u => {
                if (this.player.id === u) {
                    socket.emit('hbr', u)
                }
            });
            socket.on('greetz', p => {
                // console.log('placing color for',p.player, 'this player',this.player.id,'same?',p.player.playerId ==this.player.id)
                if (p.player.playerId != this.player.id) return false;
                console.log('Gz u connected ^-^. You are', p)
                this.player.avatar.color = p.player.color;
                this.room.id = p.room;
                socket.emit('getBoard', { room: p.room })
            });

            socket.on('boardUpd', ub => {
                if (this.room.id !== ub.room) return false;
                // console.log('BOARD NOW', ub);
                this.room.map = ub.map;
                this.players = ub.players;
            });
            socket.on('boom', b => {
                if (this.room.id != b.room) return false;
                console.log('cell goes boom!', b)
                this.room.map[b.y][b.x].weaponType = null;
                this.room.map[b.y][b.x].placedBy = null;
                if (b.type === 0) {
                    let deadCells=this.explode(b.x, b.y);
                    setTimeout(()=>{
                        socket.emit('killCells',{room:this.room.id,cells:deadCells})
                    },1000)
                } else if (b.type === 1) {
                    let deadCells = this.nuke(b.x, b.y)
                    setTimeout(()=>{
                        socket.emit('killCells',{room:this.room.id,cells:deadCells})
                    },1000)
                }
            })
            socket.on('dead',p=>{
                if(this.player.id==p){
                    this.doMsg('You died!',"ono u ded bro",2000)
                }
            })
            socket.emit('hello', this.player.id)
            window.addEventListener('keyup', this.handleKey)
        }
    }).$mount('#main')