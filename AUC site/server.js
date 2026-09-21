const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

// Official IPL Parameters
const INITIAL_PURSE = 10000; // ₹100 Crore in Lakhs
const SQUAD_MAX = 25;
const SQUAD_MIN = 18;
const MAX_OVERSEAS = 8;       // Official IPL Limit: Max 8 Foreign Players per squad
const LOWEST_BASE_PRICE = 20; // ₹20L minimum floor
const TEAM_CODES = ["CSK", "MI", "RCB", "KKR", "SRH", "DC", "PBKS", "RR", "GT", "LSG"];

const rooms = {};

function getNextBidIncrement(currentBid) {
    if (currentBid < 100) return 5;       // Up to ₹1 Cr: +₹5L
    if (currentBid < 500) return 25;      // ₹1 Cr – ₹5 Cr: +₹25L
    return 50;                            // Above ₹5 Cr: +₹50L
}

function generateStructuredPlayerPool() {
    let pool = [];
    let idCounter = 1;

    // 1. Marquee Tier with explicit Overseas (Foreign) flags
    const marquee = [
        { name: "Rishabh Pant", role: "Wicket-keeper", country: "IND", isOverseas: false, rating: 95 },
        { name: "Shreyas Iyer", role: "Batsman", country: "IND", isOverseas: false, rating: 93 },
        { name: "Mitchell Starc", role: "Bowler", country: "AUS", isOverseas: true, rating: 94 },
        { name: "Jos Buttler", role: "Wicket-keeper", country: "ENG", isOverseas: true, rating: 94 },
        { name: "Yuzvendra Chahal", role: "Bowler", country: "IND", isOverseas: false, rating: 91 },
        { name: "Arshdeep Singh", role: "Bowler", country: "IND", isOverseas: false, rating: 90 },
        { name: "KL Rahul", role: "Wicket-keeper", country: "IND", isOverseas: false, rating: 93 },
        { name: "Mohammed Shami", role: "Bowler", country: "IND", isOverseas: false, rating: 92 },
        { name: "Glenn Maxwell", role: "All-rounder", country: "AUS", isOverseas: true, rating: 91 },
        { name: "Liam Livingstone", role: "All-rounder", country: "ENG", isOverseas: true, rating: 89 }
    ];

    marquee.forEach(p => {
        pool.push({
            id: idCounter++,
            name: p.name,
            role: p.role,
            category: "Marquee",
            country: p.country,
            isOverseas: p.isOverseas,
            basePrice: 200,
            rating: p.rating
        });
    });

    // 2. Capped Tier
    const cappedRoles = ["Batsman", "Bowler", "All-rounder", "Wicket-keeper"];
    const cappedPrices = [50, 75, 100, 150];
    const foreignNations = ["AUS", "ENG", "SA", "WI", "NZ", "AFG"];

    for (let i = 1; i <= 60; i++) {
        const isOverseas = Math.random() < 0.35; // ~35% overseas players
        pool.push({
            id: idCounter++,
            name: isOverseas ? `International Star #${i}` : `Indian Capped #${i}`,
            role: cappedRoles[i % cappedRoles.length],
            category: "Capped",
            country: isOverseas ? foreignNations[i % foreignNations.length] : "IND",
            isOverseas: isOverseas,
            basePrice: cappedPrices[i % cappedPrices.length],
            rating: Math.floor(Math.random() * 14) + 80
        });
    }

    // 3. Uncapped Tier
    for (let i = 1; i <= 80; i++) {
        const isOverseas = Math.random() < 0.15;
        pool.push({
            id: idCounter++,
            name: isOverseas ? `Overseas Talent #${i}` : `Domestic Talent #${i}`,
            role: cappedRoles[i % cappedRoles.length],
            category: "Uncapped",
            country: isOverseas ? foreignNations[i % foreignNations.length] : "IND",
            isOverseas: isOverseas,
            basePrice: 20,
            rating: Math.floor(Math.random() * 15) + 68
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
            overseasCount: 0,
            claimedBy: null, 
            claimedByName: null
        };
    });

    const playerQueue = generateStructuredPlayerPool();

    rooms[roomCode] = {
        code: roomCode,
        host: hostSocketId,
        teams: t,
        playerQueue: playerQueue,
        unsoldPool: [],
        currentPlayerIndex: 0,
        timerInterval: null,
        auction: {
            player: playerQueue[0],
            highestBid: playerQueue[0].basePrice,
            highestBidder: "No Bids",
            timer: 12,
            active: true,
            status: "LIVE"
        }
    };
}

function evaluateWinner(teams) {
    let leaderboard = [];
    for (let code in teams) {
        const team = teams[code];
        const totalRating = team.squad.reduce((sum, p) => sum + p.rating, 0);
        const score = totalRating + Math.floor(team.purse / 100);
        leaderboard.push({
            teamCode: code,
            manager: team.claimedByName || "Unclaimed",
            squadCount: team.squad.length,
            overseasCount: team.overseasCount,
            totalRating: totalRating,
            purseLeft: team.purse,
            finalScore: score
        });
    }
    leaderboard.sort((a, b) => b.finalScore - a.finalScore);
    return leaderboard;
}

function startRoomTimer(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    clearInterval(room.timerInterval);
    room.auction.timer = 12;
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
        const team = room.teams[winningTeam];
        team.purse -= winningBid;
        team.spent += winningBid;
        team.squad.push(player);
        if (player.isOverseas) {
            team.overseasCount++;
        }
        room.auction.status = `SOLD to ${winningTeam} for ₹${winningBid}L!`;
        isSold = true;

        io.to(roomCode).emit('logEvent', {
            type: 'SOLD',
            text: `🔨 SOLD: ${player.name} (${player.country}) to ${winningTeam} for ₹${winningBid}L`
        });
    } else {
        room.auction.status = "UNSOLD";
        room.unsoldPool.push(player);
        io.to(roomCode).emit('logEvent', {
            type: 'UNSOLD',
            text: `❌ UNSOLD: ${player.name} enters re-auction`
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
                timer: 12,
                active: true,
                status: "LIVE"
            };
            io.to(roomCode).emit('nextPlayer', {
                auction: room.auction,
                teams: room.teams,
                currentIndex: room.currentPlayerIndex + 1,
                totalPlayers: room.playerQueue.length
            });
            startRoomTimer(roomCode);
        } else {
            room.auction.status = "MEGA AUCTION COMPLETED!";
            const leaderboard = evaluateWinner(room.teams);
            io.to(roomCode).emit('auctionFinished', {
                winner: leaderboard[0],
                leaderboard: leaderboard,
                teams: room.teams
            });
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
            currentIndex: 1,
            totalPlayers: rooms[roomCode].playerQueue.length
        });
        startRoomTimer(roomCode);
    });

    socket.on('joinRoom', ({ roomCode, username }) => {
        const room = rooms[roomCode];
        if (!room) return socket.emit('errorMsg', "Invalid 4-digit Room Code!");

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.username = username;

        socket.emit('roomJoined', {
            roomCode,
            isHost: socket.id === room.host,
            auction: room.auction,
            teams: room.teams,
            currentIndex: room.currentPlayerIndex + 1,
            totalPlayers: room.playerQueue.length
        });
        io.to(roomCode).emit('updateTeams', room.teams);
    });

    socket.on('claimTeam', ({ teamCode }) => {
        const room = rooms[socket.roomCode];
        if (!room) return;

        if (socket.claimedTeam) {
            return socket.emit('errorMsg', `You already manage ${socket.claimedTeam}. Team switching is disabled.`);
        }

        // Rule: First come, first served
        if (!room.teams[teamCode].claimedBy) {
            room.teams[teamCode].claimedBy = socket.id;
            room.teams[teamCode].claimedByName = socket.username;
            socket.claimedTeam = teamCode;
            socket.emit('teamAssigned', teamCode);
            io.to(socket.roomCode).emit('updateTeams', room.teams);
        } else {
            socket.emit('errorMsg', `${teamCode} is already taken by ${room.teams[teamCode].claimedByName}!`);
        }
    });

    socket.on('placeBid', () => {
        const room = rooms[socket.roomCode];
        if (!room || !room.auction.active) return;

        const bidderName = socket.claimedTeam;
        if (!bidderName) return socket.emit('errorMsg', "You must claim a franchise before bidding!");

        const team = room.teams[bidderName];
        const currentPlayer = room.auction.player;

        // Validation 1: Squad Full Check
        if (team.squad.length >= SQUAD_MAX) {
            return socket.emit('errorMsg', `Squad is at max limit (${SQUAD_MAX} players).`);
        }

        // Validation 2: Overseas Player Quota Check (Max 8)
        if (currentPlayer.isOverseas && team.overseasCount >= MAX_OVERSEAS) {
            return socket.emit('errorMsg', `Overseas quota exceeded! Maximum ${MAX_OVERSEAS} foreign players allowed.`);
        }

        const currentBid = room.auction.highestBid;
        const increment = getNextBidIncrement(currentBid);
        const requiredBid = currentBid + increment;

        // Validation 3: Direct purse check
        if (requiredBid > team.purse) {
            return socket.emit('errorMsg', `Insufficient purse! Need ₹${requiredBid}L.`);
        }

        // Validation 4: Minimum squad reserve safety check
        const slotsNeededForMin = Math.max(0, SQUAD_MIN - (team.squad.length + 1));
        const minPurseReserveRequired = slotsNeededForMin * LOWEST_BASE_PRICE;
        if ((team.purse - requiredBid) < minPurseReserveRequired) {
            return socket.emit('errorMsg', `Bid blocked! You must reserve ₹${minPurseReserveRequired}L to fill minimum ${SQUAD_MIN} players.`);
        }

        room.auction.highestBid = requiredBid;
        room.auction.highestBidder = bidderName;
        room.auction.timer = Math.max(room.auction.timer, 5); // Anti-sniping buffer

        io.to(socket.roomCode).emit('bidUpdated', room.auction);
        io.to(socket.roomCode).emit('logEvent', {
            type: 'BID',
            text: `💰 BID: ${bidderName} placed ₹${requiredBid}L (+₹${increment}L)`
        });
    });

    socket.on('adminForceSold', () => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.host || !room.auction.active) return;
        clearInterval(room.timerInterval);
        room.auction.active = false;
        handleAuctionEnd(socket.roomCode);
    });

    socket.on('adminForceUnsold', () => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.host || !room.auction.active) return;
        clearInterval(room.timerInterval);
        room.auction.active = false;
        room.auction.highestBidder = "No Bids";
        handleAuctionEnd(socket.roomCode);
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
