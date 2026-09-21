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

const INITIAL_PURSE = 12000; // ₹120 Crore (in Lakhs)[cite: 1]
const SQUAD_MAX = 25;        //[cite: 1]
const SQUAD_MIN = 15;        // Mandatory minimum squad floor to prevent under-bidding
const LOWEST_BASE_PRICE = 30; // ₹30L minimum base price in the pool[cite: 1]
const TEAM_CODES = ["RCB", "CSK", "MI", "KKR", "SRH", "DC", "PBKS", "RR", "GT", "LSG"]; //[cite: 1]

const rooms = {};

function getNextBidIncrement(currentBid) {
    if (currentBid < 100) return 5;       // Below ₹1 Cr: +₹5L[cite: 1]
    if (currentBid < 200) return 10;      // ₹1 Cr – ₹2 Cr: +₹10L
    if (currentBid < 500) return 25;      // ₹2 Cr – ₹5 Cr: +₹25L[cite: 1]
    return 50;                            // Above ₹5 Cr: +₹50L[cite: 1]
}

function generate577PlayerPool() {
    const marqueePlayers = [
        { name: "Rishabh Pant", role: "Wicketkeeper", basePrice: 200, rating: 95 },
        { name: "Shreyas Iyer", role: "Batter", basePrice: 200, rating: 92 },
        { name: "KL Rahul", role: "Wicketkeeper", basePrice: 200, rating: 93 },
        { name: "Yuzvendra Chahal", role: "Bowler", basePrice: 200, rating: 91 },
        { name: "Arshdeep Singh", role: "Bowler", basePrice: 200, rating: 90 },
        { name: "Mitchell Starc", role: "Bowler", basePrice: 200, rating: 94 },
        { name: "Jos Buttler", role: "Wicketkeeper", basePrice: 200, rating: 94 },
        { name: "Mohammed Shami", role: "Bowler", basePrice: 200, rating: 92 },
        { name: "Mohammed Siraj", role: "Bowler", basePrice: 200, rating: 89 },
        { name: "Liam Livingstone", role: "All-Rounder", basePrice: 200, rating: 88 },
        { name: "David Miller", role: "Batter", basePrice: 150, rating: 89 },
        { name: "Kagiso Rabada", role: "Bowler", basePrice: 200, rating: 91 },
        { name: "Ravichandran Ashwin", role: "All-Rounder", basePrice: 200, rating: 88 },
        { name: "Marcus Stoinis", role: "All-Rounder", basePrice: 150, rating: 87 },
        { name: "Glenn Maxwell", role: "All-Rounder", basePrice: 200, rating: 90 },
        { name: "Venkatesh Iyer", role: "All-Rounder", basePrice: 150, rating: 86 },
        { name: "Quinton de Kock", role: "Wicketkeeper", basePrice: 150, rating: 90 },
        { name: "Phil Salt", role: "Wicketkeeper", basePrice: 150, rating: 89 },
        { name: "Josh Hazlewood", role: "Bowler", basePrice: 200, rating: 91 },
        { name: "Bhuvneshwar Kumar", role: "Bowler", basePrice: 150, rating: 87 }
    ];

    const roles = ["Batter", "Bowler", "All-Rounder", "Wicketkeeper"];
    const basePrices = [30, 50, 75, 125, 150, 200];
    let pool = [];

    for (let i = 0; i < marqueePlayers.length; i++) {
        pool.push({
            id: i + 1,
            name: marqueePlayers[i].name,
            role: marqueePlayers[i].role,
            basePrice: marqueePlayers[i].basePrice,
            rating: marqueePlayers[i].rating,
            isUncapped: false
        });
    }

    for (let i = marqueePlayers.length + 1; i <= 577; i++) {
        const assignedRole = roles[Math.floor(Math.random() * roles.length)];
        const assignedPrice = basePrices[Math.floor(Math.random() * basePrices.length)];
        const isUncapped = Math.random() > 0.7;
        pool.push({
            id: i,
            name: `Player #${i}`,
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
            claimedByName: null
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

function evaluateAuctionWinner(teams) {
    let leaderboard = [];

    for (let code in teams) {
        const team = teams[code];
        const totalRating = team.squad.reduce((sum, p) => sum + p.rating, 0);
        const squadCount = team.squad.length;
        let totalScore = totalRating + Math.floor(team.purse / 100);

        leaderboard.push({
            teamCode: code,
            manager: team.claimedByName || "AI / Unclaimed",
            squadCount: squadCount,
            totalRating: totalRating,
            purseLeft: team.purse,
            finalScore: totalScore
        });
    }

    leaderboard.sort((a, b) => b.finalScore - a.finalScore);
    return leaderboard;
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
            text: `🔨 SOLD: ${player.name} (${player.role}) to ${winningTeam} for ₹${winningBid}L`
        });
    } else {
        room.auction.status = `UNSOLD!`;[cite: 1]
        io.to(roomCode).emit('logEvent', {
            type: 'UNSOLD',
            text: `❌ UNSOLD: ${player.name} (${player.role}) goes unsold`
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
            const leaderboard = evaluateAuctionWinner(room.teams);
            const winner = leaderboard[0];

            io.to(roomCode).emit('auctionFinished', { 
                status: `🏆 AUCTION OVER! WINNER: ${winner.teamCode} (${winner.manager}) with Score ${winner.finalScore}!`,
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

        if (socket.claimedTeam) {
            return socket.emit('errorMsg', `You have already claimed ${socket.claimedTeam}! Team switching mid-game is disabled.`);
        }

        if (room.currentPlayerIndex > 0 || room.auction.highestBidder !== "No Bids") {
            return socket.emit('errorMsg', "Team selection is locked once active bidding begins!");
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
        if (!bidderName) return socket.emit('errorMsg', "You must claim a franchise before bidding!");

        const team = room.teams[bidderName];
        if (team.squad.length >= SQUAD_MAX) return socket.emit('errorMsg', `Squad full (${SQUAD_MAX} players)![cite: 1]`);

        const currentBid = room.auction.highestBid;
        const increment = getNextBidIncrement(currentBid);
        const requiredBid = currentBid + increment;

        // 1. Check direct purse affordability
        if (requiredBid > team.purse) {
            return socket.emit('errorMsg', `Insufficient purse! Need ₹${requiredBid}L.`);
        }

        // 2. CRITICAL FRAMEWORK RULE: Minimum Squad Purse Reservation Check[cite: 1]
        // Formula: Remaining Purse after purchase must be enough to buy remaining min slots at base price (₹30L)
        const slotsNeededToReachMin = Math.max(0, SQUAD_MIN - (team.squad.length + 1));
        const reservedPurseNeeded = slotsNeededToReachMin * LOWEST_BASE_PRICE;
        const purseAfterBid = team.purse - requiredBid;

        if (purseAfterBid < reservedPurseNeeded) {
            return socket.emit('errorMsg', `Bid blocked! You must reserve funds to fill a minimum squad of ${SQUAD_MIN} players.`);
        }

        room.auction.highestBid = requiredBid;
        room.auction.highestBidder = bidderName;
        
        // Timer Soft Extension: If bid is placed with <= 3 seconds remaining, extend back to 5 seconds
        if (room.auction.timer <= 3) {
            room.auction.timer = 5;
        } else {
            room.auction.timer = Math.max(room.auction.timer, 5);
        }

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

        const availableTeams = TEAM_CODES.filter(code => {
            const team = room.teams[code];
            const slotsNeededToReachMin = Math.max(0, SQUAD_MIN - (team.squad.length + 1));
            const reservedPurseNeeded = slotsNeededToReachMin * LOWEST_BASE_PRICE;
            return team.squad.length < SQUAD_MAX && 
                   team.purse >= requiredBid &&
                   (team.purse - requiredBid >= reservedPurseNeeded);
        });

        if (availableTeams.length > 0) {
            const randomTeam = availableTeams[Math.floor(Math.random() * availableTeams.length)];
            room.auction.highestBid = requiredBid;
            room.auction.highestBidder = randomTeam;
            room.auction.timer = Math.max(room.auction.timer, 5);

            io.to(socket.roomCode).emit('bidUpdated', room.auction);
            io.to(socket.roomCode).emit('logEvent', {
                type: 'BID',
                text: `🤖 BID (SIM): ${randomTeam} raised bid to ₹${requiredBid}L (+₹${increment}L)`
            });
        }
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
