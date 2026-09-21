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

// Framework Core Parameters
const INITIAL_PURSE = 10000; // ₹100 Crore in Lakhs
const SQUAD_MAX = 25;
const SQUAD_MIN = 18;
const LOWEST_BASE_PRICE = 20; // ₹20 Lakhs lowest tier
const TEAM_CODES = ["CSK", "MI", "RCB", "KKR", "SRH", "DC", "PBKS", "RR", "GT", "LSG"];

const rooms = {};

// Bid Increment Slabs
function getNextBidIncrement(currentBid) {
    if (currentBid < 100) return 5;       // Up to ₹1 Cr: +₹5L
    if (currentBid < 500) return 25;      // ₹1 Cr – ₹5 Cr: +₹25L
    return 50;                            // Above ₹5 Cr: +₹50L
}

// Player Pool: Marquee -> Capped -> Uncapped
function generateStructuredPlayerPool() {
    let pool = [];
    let idCounter = 1;

    // Set 1: Marquee Tier (Base ₹2 Cr)
    const marquee = [
        { name: "Rishabh Pant", role: "Wicket-keeper", rating: 95 },
        { name: "Shreyas Iyer", role: "Batsman", rating: 93 },
        { name: "Mitchell Starc", role: "Bowler", rating: 94 },
        { name: "Jos Buttler", role: "Wicket-keeper", rating: 94 },
        { name: "Yuzvendra Chahal", role: "Bowler", rating: 91 },
        { name: "Arshdeep Singh", role: "Bowler", rating: 90 },
        { name: "KL Rahul", role: "Wicket-keeper", rating: 93 },
        { name: "Mohammed Shami", role: "Bowler", rating: 92 },
        { name: "Glenn Maxwell", role: "All-rounder", rating: 91 },
        { name: "Liam Livingstone", role: "All-rounder", rating: 89 }
    ];
    marquee.forEach(p => {
        pool.push({
            id: idCounter++,
            name: p.name,
            role: p.role,
            category: "Marquee",
            basePrice: 200,
            rating: p.rating
        });
    });

    // Set 2: Capped Tier (Base ₹50L - ₹1.5 Cr)
    const cappedRoles = ["Batsman", "Bowler", "All-rounder", "Wicket-keeper"];
    const cappedPrices = [50, 75, 100, 150];
    for (let i = 1; i <= 100; i++) {
        const role = cappedRoles[i % cappedRoles.length];
        const basePrice = cappedPrices[i % cappedPrices.length];
        pool.push({
            id: idCounter++,
            name: `Capped Player #${i}`,
            role: role,
            category: "Capped",
            basePrice: basePrice,
            rating: Math.floor(Math.random() * 15) + 78
        });
    }

    // Set 3: Uncapped Tier (Base ₹20L - ₹30L)
    const uncappedPrices = [20, 30];
    for (let i = 1; i <= 120; i++) {
        const role = cappedRoles[i % cappedRoles.length];
        const basePrice = uncappedPrices[i % uncappedPrices.length];
        pool.push({
            id: idCounter++,
            name: `Uncapped Talent #${i}`,
            role: role,
            category: "Uncapped",
            basePrice: basePrice,
            rating: Math.floor(Math.random() * 18) + 65
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

function evaluateAuctionWinner(teams) {
    let leaderboard = [];
    for (let code in teams) {
        const team = teams[code];
        const totalRating = team.squad.reduce((sum, p) => sum + p.rating, 0);
        const score = totalRating + Math.floor(team.purse / 100);
        leaderboard.push({
            teamCode: code,
            manager: team.claimedByName || "Unclaimed",
            squadCount: team.squad.length,
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
        room.teams[winningTeam].purse -= winningBid;
        room.teams[winningTeam].spent += winningBid;
        room.teams[winningTeam].squad.push(player);
        room.auction.status = `SOLD to ${winningTeam} for ₹${winningBid}L!`;
        isSold = true;

        io.to(roomCode).emit('logEvent', {
            type: 'SOLD',
            text: `🔨 SOLD: ${player.name} (${player.role} - ${player.category}) to ${winningTeam} for ₹${winningBid}L`
        });
    } else {
        room.auction.status = "UNSOLD";
        room.unsoldPool.push(player);
        io.to(roomCode).emit('logEvent', {
            type: 'UNSOLD',
            text: `❌ UNSOLD: ${player.name} (${player.category}) enters re-auction pool`
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
            const leaderboard = evaluateAuctionWinner(room.teams);
            const winner = leaderboard[0];
            io.to(roomCode).emit('auctionFinished', {
                winner: winner,
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
        if (!room) return socket.emit('errorMsg', "Room code not found!");

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
            return socket.emit('errorMsg', `You already manage ${socket.claimedTeam}. Mid-game switching is forbidden.`);
        }

        if (room.currentPlayerIndex > 0 || room.auction.highestBidder !== "No Bids") {
            return socket.emit('errorMsg', "Franchise selection is locked once live bidding starts.");
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

    socket.on('placeBid', () => {
        const room = rooms[socket.roomCode];
        if (!room || !room.auction.active) return;

        const bidderName = socket.claimedTeam;
        if (!bidderName) return socket.emit('errorMsg', "Claim a team before placing bids!");

        const team = room.teams[bidderName];
        if (team.squad.length >= SQUAD_MAX) return socket.emit('errorMsg', `Squad is at capacity (${SQUAD_MAX} players).`);

        const currentBid = room.auction.highestBid;
        const increment = getNextBidIncrement(currentBid);
        const requiredBid = currentBid + increment;

        if (requiredBid > team.purse) {
            return socket.emit('errorMsg', `Insufficient purse! Need ₹${requiredBid}L.`);
        }

        const slotsNeededForMin = Math.max(0, SQUAD_MIN - (team.squad.length + 1));
        const minPurseReserveRequired = slotsNeededForMin * LOWEST_BASE_PRICE;
        const purseRemainingAfterBid = team.purse - requiredBid;

        if (purseRemainingAfterBid < minPurseReserveRequired) {
            return socket.emit('errorMsg', `Bid rejected! You must keep ₹${minPurseReserveRequired}L in reserve to complete the minimum ${SQUAD_MIN} player squad.`);
        }

        room.auction.highestBid = requiredBid;
        room.auction.highestBidder = bidderName;
        room.auction.timer = Math.max(room.auction.timer, 5);

        io.to(socket.roomCode).emit('bidUpdated', room.auction);
        io.to(socket.roomCode).emit('logEvent', {
            type: 'BID',
            text: `💰 BID: ${bidderName} raised to ₹${requiredBid}L (+₹${increment}L)`
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
