const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Enable CORS so your Netlify frontend can talk to your Render backend
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

const INITIAL_PURSE = 12000; // ₹120 Crore (in Lakhs)
const SQUAD_MAX = 25;
const TEAM_CODES = ["RCB", "CSK", "MI", "KKR", "SRH", "DC", "PBKS", "RR", "GT", "LSG"];

// Official Retention Slabs (in Lakhs)
const CAPPED_SLABS = [1800, 1400, 1100, 1800, 1400];
const UNCAPPED_SLAB = 400;

const rooms = {};

function getNextBidIncrement(currentBid) {
    if (currentBid < 100) return 5;       // Below ₹1 Cr: +₹5L
    if (currentBid < 200) return 10;      // ₹1 Cr – ₹2 Cr: +₹10L
    if (currentBid < 500) return 25;      // ₹2 Cr – ₹5 Cr: +₹25L
    return 50;                            // Above ₹5 Cr: +₹50L
}

function generate577PlayerPool() {
    const starNames = [
        "Rishabh Pant", "Shreyas Iyer", "KL Rahul", "Yuzvendra Chahal", "Arshdeep Singh",
        "Mitchell Starc", "Jos Buttler", "Mohammed Shami", "Mohammed Siraj", "Liam Livingstone",
        "David Miller", "Kagiso Rabada", "Ravichandran Ashwin", "Marcus Stoinis", "Glenn Maxwell",
        "Venkatesh Iyer", "Quinton de Kock", "Phil Salt", "Josh Hazlewood", "Bhuvneshwar Kumar"
    ];
    const roles = ["Batter", "Bowler", "All-Rounder", "Wicketkeeper"];
    const basePrices = [30, 50, 75, 125, 150, 200];
    let pool = [];

    for (let i = 0; i < starNames.length; i++) {
        pool.push({
            id: i + 1,
            name: starNames[i],
            role: roles[i % 4],
            basePrice: 200,
            rating: Math.floor(Math.random() * 10) + 88,
            isUncapped: false
        });
    }

    for (let i = starNames.length + 1; i <= 577; i++) {
        const assignedRole = roles[Math.floor(Math.random() * roles.length)];
        const assignedPrice = basePrices[Math.floor(Math.random() * basePrices.length)];
        const isUncapped = Math.random() > 0.7;
        pool.push({
            id: i,
            name: `Player #${i} (${assignedRole})`,
            role: assignedRole,
            basePrice: isUncapped ? 30 : assignedPrice,
            rating: Math.floor(Math.random() * 25) + 65,
            isUncapped: isUncapped
        });
    }
    return pool;
}

function createRoom(roomCode, hostSocketId) {
    let t = {};
    TEAM_CODES.forEach(code => {
        t[code] = { 
            purse: INITIAL_PURSE, 
            spent: 0, 
            squad: [], 
            claimedBy: null, 
            claimedByName: null,
            retentionsCount: { capped: 0, uncapped: 0 }
        };
    });

    const playerQueue = generate577PlayerPool();

    rooms[roomCode] = {
        code: roomCode,
        host: hostSocketId,
        teams: t,
        playerQueue: playerQueue,
        currentPlayerIndex: 0,
        timerInterval: null,
        auction: {
            player: playerQueue[0],
            highestBid: playerQueue[0].basePrice,
            highestBidder: "No Bids",
            timer: 8,
            active: true,
            status: "LIVE"
        }
    };
}

function startRoomTimer(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    clearInterval(room.timerInterval);
    room.auction.timer = 8;
    room.auction.active = true;
    room.auction.status = "LIVE";

    room.timerInterval = setInterval(() => {
        if (room.auction.timer > 0) {
            room.auction.timer--;
            io.to(roomCode).emit('timerUpdate', room.auction.timer);
        } else {
            clearInterval(room.timerInterval);
            room.auction.active = false;
            handleAuctionEnd(roomCode);
        }
    }, 1000);
}

function handleAuctionEnd(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    const winningTeam = room.auction.highestBidder;
    const winningBid = room.auction.highestBid;
    const player = room.auction.player;
    let isSold = false;

    if (winningTeam !== "No Bids" && room.teams[winningTeam]) {
        room.teams[winningTeam].purse -= winningBid;
        room.teams[winningTeam].spent += winningBid;
        room.teams[winningTeam].squad.push(player);
        room.auction.status = `SOLD to ${winningTeam} for ₹${winningBid}L!`;
        isSold = true;

        io.to(roomCode).emit('logEvent', {
            type: 'SOLD',
            text: `🔨 SOLD: ${player.name} to ${winningTeam} for ₹${winningBid}L`
        });
    } else {
        room.auction.status = `UNSOLD!`;
        io.to(roomCode).emit('logEvent', {
            type: 'UNSOLD',
            text: `❌ UNSOLD: ${player.name} goes unsold`
        });
    }

    io.to(roomCode).emit('auctionEnded', {
        status: room.auction.status,
        isSold: isSold,
        teams: room.teams
    });

    setTimeout(() => {
        room.currentPlayerIndex++;
        if (room.currentPlayerIndex < room.playerQueue.length) {
            const nextPlayer = room.playerQueue[room.currentPlayerIndex];
            room.auction = {
                player: nextPlayer,
                highestBid: nextPlayer.basePrice,
                highestBidder: "No Bids",
                timer: 8,
                active: true,
                status: "LIVE"
            };
            io.to(roomCode).emit('nextPlayer', { 
                auction: room.auction, 
                teams: room.teams, 
                currentIndex: room.currentPlayerIndex + 1 
            });
            startRoomTimer(roomCode);
        } else {
            room.auction.status = "MEGA AUCTION COMPLETED!";
            io.to(roomCode).emit('auctionFinished', { teams: room.teams });
        }
    }, 2500);
}

io.on('connection', (socket) => {

    socket.on('createRoom', ({ username }) => {
        const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        createRoom(roomCode, socket.id);
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.username = username;

        socket.emit('roomJoined', {
            roomCode,
            isHost: true,
            auction: rooms[roomCode].auction,
            teams: rooms[roomCode].teams,
            currentIndex: 1
        });
        startRoomTimer(roomCode);
    });

    socket.on('joinRoom', ({ roomCode, username }) => {
        const room = rooms[roomCode];
        if (!room) return socket.emit('errorMsg', "Room code not found!");

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.username = username;

        socket.emit('roomJoined', {
            roomCode,
            isHost: socket.id === room.host,
            auction: room.auction,
            teams: room.teams,
            currentIndex: room.currentPlayerIndex + 1
        });

        io.to(roomCode).emit('updateTeams', room.teams);
    });

    socket.on('claimTeam', ({ teamCode }) => {
        const room = rooms[socket.roomCode];
        if (!room) return;

        for (let code in room.teams) {
            if (room.teams[code].claimedBy === socket.id) {
                room.teams[code].claimedBy = null;
                room.teams[code].claimedByName = null;
            }
        }

        if (!room.teams[teamCode].claimedBy) {
            room.teams[teamCode].claimedBy = socket.id;
            room.teams[teamCode].claimedByName = socket.username;
            socket.claimedTeam = teamCode;
            socket.emit('teamAssigned', teamCode);
        } else {
            socket.emit('errorMsg', `${teamCode} is already claimed by ${room.teams[teamCode].claimedByName}!`);
        }

        io.to(socket.roomCode).emit('updateTeams', room.teams);
    });

    socket.on('retainPlayer', ({ isUncapped }) => {
        const room = rooms[socket.roomCode];
        if (!room) return;

        const teamCode = socket.claimedTeam;
        if (!teamCode) return socket.emit('errorMsg', "You must claim a franchise first!");

        const team = room.teams[teamCode];
        const totalRetained = team.retentionsCount.capped + team.retentionsCount.uncapped;

        if (totalRetained >= 6) return socket.emit('errorMsg', "Max 6 Retentions allowed per team!");

        let cost = 0;
        if (isUncapped) {
            if (team.retentionsCount.uncapped >= 2) return socket.emit('errorMsg', "Max 2 Uncapped Retentions allowed!");
            cost = UNCAPPED_SLAB;
        } else {
            if (team.retentionsCount.capped >= 5) return socket.emit('errorMsg', "Max 5 Capped Retentions allowed!");
            cost = CAPPED_SLABS[team.retentionsCount.capped];
        }

        if (team.purse < cost) return socket.emit('errorMsg', `Insufficient purse! Need ₹${cost}L for retention.`);

        const retainedPlayer = {
            id: 9000 + Math.floor(Math.random() * 900),
            name: `${teamCode} Core Retained #${totalRetained + 1}`,
            role: isUncapped ? "Uncapped Prospect" : "Capped Star",
            basePrice: cost,
            rating: isUncapped ? 78 : 92,
            isUncapped: isUncapped
        };

        team.purse -= cost;
        team.spent += cost;
        team.squad.push(retainedPlayer);
        if (isUncapped) team.retentionsCount.uncapped++;
        else team.retentionsCount.capped++;

        io.to(socket.roomCode).emit('updateTeams', room.teams);
        io.to(socket.roomCode).emit('logEvent', {
            type: 'RETENTION',
            text: `🔒 RETENTION: ${teamCode} retained ${retainedPlayer.name} for ₹${cost}L`
        });
    });

    socket.on('placeBid', () => {
        const room = rooms[socket.roomCode];
        if (!room || !room.auction.active) return;

        const bidderName = socket.claimedTeam;
        if (!bidderName) return socket.emit('errorMsg', "You must claim a franchise before bidding!");

        const team = room.teams[bidderName];
        if (team.squad.length >= SQUAD_MAX) return socket.emit('errorMsg', `Squad full (${SQUAD_MAX} players)!`);

        const currentBid = room.auction.highestBid;
        const increment = getNextBidIncrement(currentBid);
        const requiredBid = currentBid + increment;

        if (requiredBid > team.purse) return socket.emit('errorMsg', `Insufficient purse! Need ₹${requiredBid}L.`);

        room.auction.highestBid = requiredBid;
        room.auction.highestBidder = bidderName;
        room.auction.timer = 6;

        io.to(socket.roomCode).emit('bidUpdated', room.auction);
        io.to(socket.roomCode).emit('logEvent', {
            type: 'BID',
            text: `💰 BID: ${bidderName} raised bid to ₹${requiredBid}L (+₹${increment}L)`
        });
    });

    socket.on('adminAutoBid', () => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.host || !room.auction.active) return;

        const currentBid = room.auction.highestBid;
        const increment = getNextBidIncrement(currentBid);
        const requiredBid = currentBid + increment;

        const availableTeams = TEAM_CODES.filter(code => 
            room.teams[code].squad.length < SQUAD_MAX && 
            room.teams[code].purse >= requiredBid
        );

        if (availableTeams.length > 0) {
            const randomTeam = availableTeams[Math.floor(Math.random() * availableTeams.length)];
            room.auction.highestBid = requiredBid;
            room.auction.highestBidder = randomTeam;
            room.auction.timer = 5;

            io.to(socket.roomCode).emit('bidUpdated', room.auction);
            io.to(socket.roomCode).emit('logEvent', {
                type: 'BID',
                text: `🤖 BID (SIM): ${randomTeam} raised bid to ₹${requiredBid}L (+₹${increment}L)`
            });
        }
    });

    socket.on('adminFastForward', ({ count }) => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.host) return;

        for (let i = 0; i < count; i++) {
            if (room.currentPlayerIndex >= room.playerQueue.length - 1) break;
            const p = room.playerQueue[room.currentPlayerIndex];
            const eligible = TEAM_CODES.filter(c => room.teams[c].squad.length < SQUAD_MAX && room.teams[c].purse >= p.basePrice);
            
            if (eligible.length > 0 && Math.random() > 0.3) {
                const buyer = eligible[Math.floor(Math.random() * eligible.length)];
                room.teams[buyer].purse -= p.basePrice;
                room.teams[buyer].spent += p.basePrice;
                room.teams[buyer].squad.push(p);
            }
            room.currentPlayerIndex++;
        }

        const currentP = room.playerQueue[room.currentPlayerIndex];
        room.auction = {
            player: currentP,
            highestBid: currentP.basePrice,
            highestBidder: "No Bids",
            timer: 8,
            active: true,
            status: "LIVE"
        };
        io.to(socket.roomCode).emit('nextPlayer', { auction: room.auction, teams: room.teams, currentIndex: room.currentPlayerIndex + 1 });
        startRoomTimer(socket.roomCode);
    });

    socket.on('disconnect', () => {
        const room = rooms[socket.roomCode];
        if (room) {
            for (let code in room.teams) {
                if (room.teams[code].claimedBy === socket.id) {
                    room.teams[code].claimedBy = null;
                    room.teams[code].claimedByName = null;
                }
            }
            io.to(socket.roomCode).emit('updateTeams', room.teams);
        }
    });
});

// CRITICAL RENDER FIX: Must use dynamic port process.env.PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));