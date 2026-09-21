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

const INITIAL_PURSE = 10000;
const SQUAD_MAX = 25;
const SQUAD_MIN = 18;
const MAX_OVERSEAS = 8;
const LOWEST_BASE_PRICE = 20;
const TEAM_CODES = ["CSK", "MI", "RCB", "KKR", "SRH", "DC", "PBKS", "RR", "GT", "LSG"];

const rooms = {};

function getNextBidIncrement(currentBid) {
    if (currentBid < 100) return 5;
    if (currentBid < 500) return 25;
    return 50;
}

function generateStructuredPlayerPool() {
    let pool = [];
    let idCounter = 1;

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

    const cappedRoles = ["Batsman", "Bowler", "All-rounder", "Wicket-keeper"];
    const cappedPrices = [50, 75, 100, 150];
    const foreignNations = ["AUS", "ENG", "SA", "WI", "NZ", "AFG"];

    for (let i = 1; i <= 60; i++) {
        const isOverseas = Math.random() < 0.35;
        pool.push({
            id: idCounter++,
            name: isOverseas ? `International Star #${i}` : `Indian Star #${i}`,
            role: cappedRoles[i % cappedRoles.length],
            category: "Capped",
            country: isOverseas ? foreignNations[i % foreignNations.length] : "IND",
            isOverseas: isOverseas,
            basePrice: cappedPrices[i % cappedPrices.length],
            rating: Math.floor(Math.random() * 14) + 80
        });
    }

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
    } else {
        room.auction.status = "UNSOLD";
        room.unsoldPool.push(player);
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
            room.auction.status = "AUCTION COMPLETED";
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
        socket.isHost = true;

        socket.emit('roomCreated', {
            roomCode,
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
        socket.isHost = false;

        socket.emit('joinedToTeamSelect', {
            roomCode,
            teams: room.teams
        });
        io.to(roomCode).emit('updateTeams', room.teams);
    });

    socket.on('claimTeam', ({ teamCode }) => {
        const room = rooms[socket.roomCode];
        if (!room) return;

        if (socket.claimedTeam) {
            return socket.emit('errorMsg', `You have already selected ${socket.claimedTeam}.`);
        }

        if (room.teams[teamCode].claimedBy) {
            return socket.emit('errorMsg', `${teamCode} is already selected by ${room.teams[teamCode].claimedByName}! Please pick another team.`);
        }

        room.teams[teamCode].claimedBy = socket.id;
        room.teams[teamCode].claimedByName = socket.username;
        socket.claimedTeam = teamCode;

        socket.emit('teamConfirmed', {
            teamCode: teamCode,
            auction: room.auction,
            teams: room.teams,
            currentIndex: room.currentPlayerIndex + 1,
            totalPlayers: room.playerQueue.length
        });

        io.to(socket.roomCode).emit('updateTeams', room.teams);
    });

    socket.on('placeBid', () => {
        const room = rooms[socket.roomCode];
        if (!room || !room.auction.active) return;

        const bidderName = socket.claimedTeam;
        if (!bidderName) return socket.emit('errorMsg', "You must select a team before bidding!");

        const team = room.teams[bidderName];
        const currentPlayer = room.auction.player;

        if (team.squad.length >= SQUAD_MAX) {
            return socket.emit('errorMsg', `Squad is at capacity (${SQUAD_MAX} players max).`);
        }

        if (currentPlayer.isOverseas && team.overseasCount >= MAX_OVERSEAS) {
            return socket.emit('errorMsg', `Overseas quota full! Maximum ${MAX_OVERSEAS} foreign players allowed.`);
        }

        const currentBid = room.auction.highestBid;
        const increment = getNextBidIncrement(currentBid);
        const requiredBid = currentBid + increment;

        if (requiredBid > team.purse) {
            return socket.emit('errorMsg', `Insufficient purse! Need ₹${requiredBid}L.`);
        }

        const slotsNeededForMin = Math.max(0, SQUAD_MIN - (team.squad.length + 1));
        const minPurseReserve = slotsNeededForMin * LOWEST_BASE_PRICE;
        if ((team.purse - requiredBid) < minPurseReserve) {
            return socket.emit('errorMsg', `Bid blocked! You must reserve ₹${minPurseReserve}L to fill a minimum ${SQUAD_MIN} player squad.`);
        }

        room.auction.highestBid = requiredBid;
        room.auction.highestBidder = bidderName;
        room.auction.timer = Math.max(room.auction.timer, 5);

        io.to(socket.roomCode).emit('bidUpdated', room.auction);
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
