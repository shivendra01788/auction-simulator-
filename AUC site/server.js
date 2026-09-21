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
const LOWEST_BASE_PRICE = 20; // ₹20 Lakhs floor
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

    // SET 1: EXPANDED MARQUEE PLAYERS (24 Stars) - Base: ₹200L (₹2 Cr)
    const marqueeSet = [
        // Marquee Batters
        { name: "Virat Kohli", role: "Batsman", country: "IND", isOverseas: false, rating: 98 },
        { name: "Rohit Sharma", role: "Batsman", country: "IND", isOverseas: false, rating: 95 },
        { name: "Suryakumar Yadav", role: "Batsman", country: "IND", isOverseas: false, rating: 96 },
        { name: "Shubman Gill", role: "Batsman", country: "IND", isOverseas: false, rating: 94 },
        { name: "Travis Head", role: "Batsman", country: "AUS", isOverseas: true, rating: 94 },
        { name: "Shreyas Iyer", role: "Batsman", country: "IND", isOverseas: false, rating: 93 },

        // Marquee Wicket-keepers
        { name: "Rishabh Pant", role: "Wicket-keeper", country: "IND", isOverseas: false, rating: 96 },
        { name: "Jos Buttler", role: "Wicket-keeper", country: "ENG", isOverseas: true, rating: 95 },
        { name: "Heinrich Klaasen", role: "Wicket-keeper", country: "SA", isOverseas: true, rating: 95 },
        { name: "KL Rahul", role: "Wicket-keeper", country: "IND", isOverseas: false, rating: 94 },
        { name: "Nicholas Pooran", role: "Wicket-keeper", country: "WI", isOverseas: true, rating: 93 },
        { name: "Sanju Samson", role: "Wicket-keeper", country: "IND", isOverseas: false, rating: 92 },

        // Marquee All-rounders
        { name: "Hardik Pandya", role: "All-rounder", country: "IND", isOverseas: false, rating: 95 },
        { name: "Ravindra Jadeja", role: "All-rounder", country: "IND", isOverseas: false, rating: 95 },
        { name: "Glenn Maxwell", role: "All-rounder", country: "AUS", isOverseas: true, rating: 92 },
        { name: "Andre Russell", role: "All-rounder", country: "WI", isOverseas: true, rating: 94 },
        { name: "Axar Patel", role: "All-rounder", country: "IND", isOverseas: false, rating: 91 },
        { name: "Liam Livingstone", role: "All-rounder", country: "ENG", isOverseas: true, rating: 90 },

        // Marquee Bowlers
        { name: "Jasprit Bumrah", role: "Bowler", country: "IND", isOverseas: false, rating: 99 },
        { name: "Rashid Khan", role: "Bowler", country: "AFG", isOverseas: true, rating: 97 },
        { name: "Mitchell Starc", role: "Bowler", country: "AUS", isOverseas: true, rating: 94 },
        { name: "Mohammed Shami", role: "Bowler", country: "IND", isOverseas: false, rating: 93 },
        { name: "Yuzvendra Chahal", role: "Bowler", country: "IND", isOverseas: false, rating: 92 },
        { name: "Arshdeep Singh", role: "Bowler", country: "IND", isOverseas: false, rating: 91 }
    ];

    marqueeSet.forEach(p => {
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

    const foreignNations = ["AUS", "ENG", "SA", "WI", "NZ", "AFG"];
    const cappedPrices = [50, 75, 100, 150];

    // SET 2: CAPPED BATTERS (15 Players)
    for (let i = 1; i <= 15; i++) {
        const isOverseas = i % 3 === 0;
        pool.push({
            id: idCounter++,
            name: isOverseas ? `Intl Batter #${i}` : `Indian Batter #${i}`,
            role: "Batsman",
            category: "Capped Batter",
            country: isOverseas ? foreignNations[i % foreignNations.length] : "IND",
            isOverseas: isOverseas,
            basePrice: cappedPrices[i % cappedPrices.length],
            rating: Math.floor(Math.random() * 10) + 82
        });
    }

    // SET 3: CAPPED WICKET-KEEPERS (15 Players)
    for (let i = 1; i <= 15; i++) {
        const isOverseas = i % 3 === 0;
        pool.push({
            id: idCounter++,
            name: isOverseas ? `Intl Keeper #${i}` : `Indian Keeper #${i}`,
            role: "Wicket-keeper",
            category: "Capped Wicket-keeper",
            country: isOverseas ? foreignNations[i % foreignNations.length] : "IND",
            isOverseas: isOverseas,
            basePrice: cappedPrices[i % cappedPrices.length],
            rating: Math.floor(Math.random() * 10) + 82
        });
    }

    // SET 4: CAPPED ALL-ROUNDERS (25 Players)
    for (let i = 1; i <= 25; i++) {
        const isOverseas = i % 2 === 0;
        pool.push({
            id: idCounter++,
            name: isOverseas ? `Intl All-Rounder #${i}` : `Indian All-Rounder #${i}`,
            role: "All-rounder",
            category: "Capped All-rounder",
            country: isOverseas ? foreignNations[i % foreignNations.length] : "IND",
            isOverseas: isOverseas,
            basePrice: cappedPrices[i % cappedPrices.length],
            rating: Math.floor(Math.random() * 12) + 80
        });
    }

    // SET 5: CAPPED BOWLERS (25 Players)
    for (let i = 1; i <= 25; i++) {
        const isOverseas = i % 3 === 0;
        pool.push({
            id: idCounter++,
            name: isOverseas ? `Intl Bowler #${i}` : `Indian Bowler #${i}`,
            role: "Bowler",
            category: "Capped Bowler",
            country: isOverseas ? foreignNations[i % foreignNations.length] : "IND",
            isOverseas: isOverseas,
            basePrice: cappedPrices[i % cappedPrices.length],
            rating: Math.floor(Math.random() * 12) + 81
        });
    }

    // SET 6: UNCAPPED TALENTS (45 Players) - Base: ₹20L
    const uncappedRoles = ["Batsman", "Wicket-keeper", "All-rounder", "Bowler"];
    for (let i = 1; i <= 45; i++) {
        const role = uncappedRoles[i % uncappedRoles.length];
        const isOverseas = i % 8 === 0;
        pool.push({
            id: idCounter++,
            name: isOverseas ? `Emerging Intl Talent #${i}` : `Domestic Talent #${i}`,
            role: role,
            category: `Uncapped ${role}`,
            country: isOverseas ? foreignNations[i % foreignNations.length] : "IND",
            isOverseas: isOverseas,
            basePrice: 20,
            rating: Math.floor(Math.random() * 12) + 70
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
