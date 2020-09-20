const socket = io(),
    main = new Vue({
        data: {
            players: [],
            isNamed: false,
            player: {
                id: Math.floor(Math.random() * 999999999999).toString(32),
                avatar:{
                    icon:null,
                    color:null
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
                desc: "Invisible to other players. Placed on ground. Arms after 2 seconds. When triggered, causes an explosion that slows the target's movement by 50% for 6 seconds.",
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
            room:{
                id:null,
                map:Array(20).fill(1).map(rw=>Array(20).fill('_'))
            },
            askingReload:false,
        },
        methods: {
            doMsg(title, body, lasts) {
                const self = this;
                self.alert.title = title;
                self.alert.body = body;
                self.alert.show = true;
                if (!!lasts && typeof lasts == "number") {
                    setTimeout(function () {
                        self.alert.show = false;
                    }, lasts)
                }
            },
            fire(amNum) {
                let ammo = this.ammoCat[amNum];
                if (!this.player.ammo[amNum]) {
                    return this.doMsg('Out of Ammo', `You have no more ${ammo.name}s!`, 2000);
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
            cellBg(symb){
                if(symb=='#'){
                    return 'dirt';
                }else if(symb=='*'){
                    return 'rock';
                }else{
                    if(symb=='_'){
                        return 'open';
                    }
                    return 'prize';
                }
            },
            hasPlayer(x,y){
                return this.players.find(p=>p.pos.x==x && p.pos.y==y);
            }
        },
        created() {
            socket.on('updatePlayers', p => {
                this.updatePlayers(p);
            });
            socket.on('attack', p => {
                this.receiveAttack(p);
            });
            socket.on('disconnect', d => {
                if(!!this.askingReload) return false;
               this.askReload();
            });
            socket.on('connect_failed', d => {
                if(!!this.askingReload) return false;
               this.askReload();
            });
            socket.on('hb', u => {
               if(this.player.id===u){
                   socket.emit('hbr',u)
               }
            });
            socket.on('greetz', p => {
                // console.log('placing icon and color for',p.player, 'this player',this.player.id,'same?',p.player.playerId ==this.player.id)
                if(p.player.playerId != this.player.id) return false;
                console.log('Gz u connected ^-^. You are', p)
                this.player.avatar.icon = p.player.icon;
                this.player.avatar.color = p.player.color;
                this.room.id=p.room;
                socket.emit('getBoard',{playerId:this.player.id,room:p.room})
            });

            socket.on('boardUpd', ub => {
                if(this.room.id !== ub.room) return false;
                console.log('BOARD NOW',ub)
                this.room.map = ub.map;
                this.players = ub.players;
             });
            socket.emit('hello', this.player.id)
        }
    }).$mount('#main')