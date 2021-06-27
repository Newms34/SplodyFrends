;(function() {
"use strict";

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
            latencyColor: 'hsl(0,100,50)',
            lastLatency: 400,
            msgTimeout: null,
            player: {
                playerId: Math.floor(Math.random() * 999999999999).toString(32),
                avatar: {
                    color: null
                },
                pos: {
                    x: 0,
                    y: 0
                },
                hp: 1,//most skills kill in 1 hit. a few in the future may change this
                ammo: [-1, 0, 0, 0, 0, 0, 0],//-1 = infinite. Others are as normal
                stunnedCounter: 0,
                score: 0,
            },
            statusEffects: [{
                icon: 'eye-slash',
                title: 'Invisible',
                desc: 'This skill is invisible to other players. Shhh!'
            }, {
                icon: 'skull-crossbones',
                title: 'Trap',
                desc: 'This skill is a trap and is triggered by walking over it. Watch your step!'
            }, {
                icon: 'meteor',
                title: 'Damaging',
                desc: 'This skill does damage!'
            }, {
                icon: 'exclamation-circle',
                title: 'Status Effect',
                desc: 'This skill causes a status effect change, either to you or another player!'
            },],
            ammoCat: [{
                name: 'Bomb',
                desc: "A regular bomb. Destroys the row and column it's in, up to 10 tiles away",
                effects: [0, 0, 1, 0],
                cssClass: 'is-danger',
                icon: 'bomb'
            }, {
                name: 'Mega Bomb',
                desc: "A huge bomb. Destroys the area around the player in a 4-tile radius nearly instantly. Kills the player.",
                effects: [0, 0, 1, 0],
                cssClass: 'is-danger',
                icon: 'radiation-alt'
            }, {
                name: 'Shield',
                desc: "Protects the player from 1 attack, and then expires. Prevents bomb/trap placement. Expires automatically after 5 seconds if not used.",
                effects: [0, 0, 0, 1],
                cssClass: 'is-shield',
                icon: 'shield-alt'
            }, {
                name: 'Fire Trap',
                desc: "Invisible to others. Placed on ground. Trigger effect: Causes an explosion that kills the target.",
                effects: [1, 1, 1, 0],
                cssClass: 'is-danger',
                icon: 'fire'
            }, {
                name: 'Ice Trap',
                desc: "Invisible to others. Placed on ground. Trigger effect: Freezes the ground, making it extra slippery and preventing players from stopping on this tile.",
                effects: [1, 1, 0, 0],
                cssClass: 'is-link',
                icon: 'snowflake'
            }, {
                name: 'Shock Trap',
                desc: "Invisible to others. Placed on ground. Trigger effect: Stuns player, preventing any action for 2 seconds",
                effects: [1, 1, 0, 1],
                cssClass: 'is-info',
                icon: 'bolt'
            }, {
                name: '"Mud" Trap',
                desc: "Invisible to others. Placed on ground. Trigger effect: Fills all empty tiles in a 5-foot radius from the target with 'mud'.",
                effects: [1, 1, 0, 0],
                cssClass: 'is-brown',
                icon: 'poo'
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
                this.alert.title = title;
                this.alert.body = body;
                this.alert.show = true;
                if (!!lasts && typeof lasts == "number") {
                    clearInterval(this.msgTimeout);
                    this.msgTimeout = setTimeout(() => {
                        this.alert.show = false;
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
                console.log('removed this fn!')
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
            handleKeyDown(e) {
                if (this.player.hp == 0) {
                    return false;
                }
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
                        player: this.player.playerId,
                        dir: dir,
                        room: this.room.id
                    })
                }
            },
            handleKeyUp(e) {
                /* 
                    87:up,83:down, 65:left,68:right
                    49-57: 1-9, 48:0
                    */
                if (this.player.hp == 0) {
                    return false;
                }

                if ([48, 49, 50, 51, 52, 53, 54, 55, 56, 57].includes(e.which)) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.attemptFire(e.which - 49)
                }
            },
            explode(y, x) {
                // console.log('explosion happens')

                return deadCells;
            },
            nuke(x, y) {
                console.log('nuke currently disabled!')
                return [];
            },
            showContents(cell, player) {
                console.log(cell, player, cell.animClasses && cell.animClasses.join(' '))
            }
        },
        computed: {
            mapDisp: function () {
                return this.room.map.map(q => q.join(''));
            }
        },
        created() {
            socket.on('misfire', ammo => {
                console.log('attempted', null)
                return this.doMsg('Out of Ammo', `You have no more ${this.ammoCat[ammo].name}s!`, 2000);
            });
            socket.on('shieldLock', () => {
                console.log('attempted', null)
                return this.doMsg('Cannot Place Weapons', `You cannot place bombs or traps while shielded.`, 2000);
            });
            socket.on('changeAmmo', p => {
                this.player.ammo[p.ammo] += p.subtract ? -1 : 1;
                // console.log(`Got new ${this.ammoCat[p.ammo].name}! Player now`, this.player)
            });
            socket.on('disconnect', () => {
                if (!!this.askingReload) return false;
                this.askReload();
            });
            socket.on('connect_failed', () => {
                if (!!this.askingReload) return false;
                this.askReload();
            });
            socket.on('hb', u => {
                if (this.player.playerId === u) {
                    socket.emit('hbr', u)
                }
            });
            socket.on('greetz', p => {
                console.log('Connected! You are', p.player.playerId)
                this.player.avatar.color = p.player.color;
                this.room.id = p.room;
                socket.emit('getBoard', { room: p.room })
            });

            socket.on('boardUpd', ub => {
                if (this.room.id !== ub.room) return false;
                console.log('BOARD NOW', ub);
                this.room.map = ub.map;
                this.players = ub.players;
                this.player = Object.assign(this.player, ub.players.find(q => q.playerId == this.player.playerId));
            });
            socket.on('explosion', e => {
                console.log('EXPLOSON!', e);
                if (e.deadPlayers.includes(this.player.playerId)) {
                    this.player.hp = 0;
                    this.doMsg('Dead!', 'You died!', 0)
                }
            })
            socket.on('dead', p => {
                this.player.hp = 0;
                this.doMsg('You died!', `You died due to a: ${p.reason}, placed by ${p.killer}`, 5000)
            })
            socket.emit('hello', this.player.playerId)
            window.addEventListener('keyup', this.handleKeyUp)
            window.addEventListener('keydown', this.handleKeyDown)

            //hb2 test
            socket.on('healthPingResponse', (d) => {
                // console.log('RESPONSE DELAY',performance.now()-d.time,'FOR',d.u)
                this.lastLatency = Math.round(performance.now() - d.time);
                let lateMeasure = 120 * (400 - Math.min(this.lastLatency, 400)) / 400;
                this.latencyColor = `hsl(${lateMeasure},100%,50%)`;
            })
            setInterval(() => {
                socket.emit('healthPing', { u: this.player.playerId, time: performance.now() })
            }, 100)
        }
    }).$mount('#main')
}());
