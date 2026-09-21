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
const INITIAL_PURSE = 10000; // ₹100 Cr in Lakhs
const SQUAD_MAX = 25;
const PLAYING_11_MIN = 11;   // Minimum threshold to avoid DQ
const MAX_OVERSEAS_SQUAD = 8;
const MAX_OVERSEAS_XI = 4;
const LOWEST_BASE_PRICE = 20; // ₹20 Lakhs floor
const TEAM_CODES = ["CSK", "MI", "RCB", "KKR", "SRH", "DC", "PBKS", "RR", "GT", "LSG"];

const rooms = {};

function getNextBidIncrement(currentBid) {
    if (currentBid < 100) return 5;
    if (currentBid < 500) return 25;
    return 50;
}

// Generates 264 Total Players categorized strictly by sets
function generateStructuredPlayerPool() {
    let pool = [];
    let idCounter = 1;

    // SET 1: MARQUEE TIER (24 Players) - Base: ₹200L
    const marqueeSet = [
        // Batters
        { name: "Virat Kohli", role: "Batsman", country: "IND", isOverseas: false, rating: 98 },
        { name: "Rohit Sharma", role: "Batsman", country: "IND", isOverseas: false, rating: 95 },
        { name: "Suryakumar Yadav", role: "Batsman", country: "IND", isOverseas: false, rating: 96 },
        { name: "Shubman Gill", role: "Batsman", country: "IND", isOverseas: false, rating: 94 },
        { name: "Travis Head", role: "Batsman", country: "AUS", isOverseas: true, rating: 94 },
        { name: "Shreyas Iyer", role: "Batsman", country: "IND", isOverseas: false, rating: 93 },

        // Wicket-keepers
        { name: "Rishabh Pant", role: "Wicket-keeper", country: "IND", isOverseas: false, rating: 96 },
        { name: "Jos Buttler", role: "Wicket-keeper", country: "ENG", isOverseas: true, rating: 95 },
        { name: "Heinrich Klaasen", role: "Wicket-keeper", country: "SA", isOverseas: true, rating: 95 },
        { name: "KL Rahul", role: "Wicket-keeper", country: "IND", isOverseas: false, rating: 94 },
        { name: "Nicholas Pooran", role: "Wicket-keeper", country: "WI", isOverseas: true, rating: 93 },
        { name: "Sanju Samson", role: "Wicket-keeper", country: "IND", isOverseas: false, rating: 92 },

        // All-rounders
        { name: "Hardik Pandya", role: "All-rounder", country: "IND", isOverseas: false, rating: 95 },
        { name: "Ravindra Jadeja", role: "All-rounder", country: "IND", isOverseas: false, rating: 95 },
        { name: "Glenn Maxwell", role: "All-rounder", country: "AUS", isOverseas: true, rating: 92 },
        { name: "Andre Russell", role: "All-rounder", country: "WI", isOverseas: true, rating: 94 },
        { name: "Axar Patel", role: "All-rounder", country: "IND", isOverseas: false, rating: 91 },
        { name: "Liam Livingstone", role: "All-rounder", country: "ENG", isOverseas: true, rating: 90 },

        // Bowlers
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

    // SET 2: CAPPED BATTERS (35 Players)
    for (let i = 1; i <= 35; i++) {
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

    // SET 3: CAPPED WICKET-KEEPERS (25 Players)
    for (let i = 1; i <= 25; i++) {
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

    // SET 4: CAPPED ALL-ROUNDERS (45 Players)
    for (let i = 1; i <= 45; i++) {
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

    // SET 5: CAPPED BOWLERS (55 Players)
    for (let i = 1; i <= 55; i++) {
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

    // SET 6: UNCAPPED TALENTS (80 Players) - Base: ₹20L
    const uncappedRoles = ["Batsman", "Wicket-keeper", "All-rounder", "Bowler"];
    for (let i = 1; i <= 80; i++) {
        const role = uncappedRoles[i % uncappedRoles.length];
        const isOverseas = i % 8 === 0;
        pool.push({
            id: idCounter++,
            name: isOverseas ? `Emerging Overseas Talent #${i}` : `Domestic Talent #${i}`,
            role: role,
            category: `Uncapped ${role}`,
            country: isOverseas ? foreignNations[i % foreignNations.length] : "IND",
            isOverseas: isOverseas,
            basePrice: 20,
            rating: Math.floor(Math.random() * 12) + 70
        });
    }

    return pool; // 24 + 35 + 25 + 45 + 55 + 80 = 264 Players
}

function createRoom(roomCode, hostSocketId) {
    const playerQueue = generateStructuredPlayerPool();

    rooms[roomCode] = {
        code: roomCode,
        host: hostSocketId,
        teams: {}, // Dynamically registered teams
        playerQueue: playerQueue,
        unsoldPool: [],
        currentPlayerIndex: 0,
        timerInterval: null,
        isStarted: false,
        auction: {
            player: playerQueue[0],
            highestBid: playerQueue[0].basePrice,
            highestBidder: "No Bids",
            timer: 12,
            active: false,
            status: "WAITING TO START"
        }
    };
}

// Automatic Disqualification & Best Playing 11 Evaluation
function evaluateWinner(teams) {
    let leaderboard = [];

    for (let key in teams) {
        const team = teams[key];
        
        // RULE: Disqualified if unable to buy at least 11 players
        if (team.squad.length < PLAYING_11_MIN) {
            leaderboard.push({
                teamCode: team.displayName,
                manager: team.claimedByName || "Unclaimed",
                squadCount: team.squad.length,
                overseasCount: team.overseasCount,
                totalRating: 0,
                purseLeft: team.purse,
                finalScore: 0,
                isDisqualified: true,
                statusText: `DISQUALIFIED (< ${PLAYING_11_MIN} players)`
            });
            continue;
        }

        // Calculate Best Playing XI conforming to Max 4 Overseas
        const sortedSquad = [...team.squad].sort((a, b) => b.rating - a.rating);
        let playingXI = [];
        let overseasInXI = 0;

        for (let p of sortedSquad) {
            if (playingXI.length === 11) break;
            if (p.isOverseas) {
                if (overseasInXI < MAX_OVERSEAS_XI) {
                    playingXI.push(p);
                    overseasInXI++;
                }
            } else {
                playingXI.push(p);
            }
        }

        // Fill remainder with domestic players if overseas limit blocked candidates
        if (playingXI.length < 11) {
            for (let p of sortedSquad) {
                if (playingXI.length === 11) break;
                if (!playingXI.includes(p) && !p.isOverseas) {
                    playingXI.push(p);
                }
            }
        }

        const totalRating = playingXI.reduce((sum, p) => sum + p.rating, 0);
        const score = totalRating + Math.floor(team.purse / 100);

        leaderboard.push({
            teamCode: team.displayName,
            manager: team.claimedByName || "Unclaimed",
            squadCount: team.squad.length,
            overseasCount: team.overseasCount,
            totalRating: totalRating,
            purseLeft: team.purse,
            finalScore: score,
            isDisqualified: false,
            statusText: "Qualified"
        });
    }

    // Sort valid teams highest first, placing disqualified teams at the bottom
    leaderboard.sort((a, b) => {
        if (a.isDisqualified && !b.isDisqualified) return 1;
        if (!a.isDisqualified && b.isDisqualified) return -1;
        return b.finalScore - a.finalScore;
    });

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

    const winningTeamKey = room.auction.highestBidder;
    const winningBid = room.auction.highestBid;
    const player = room.auction.player;
    let isSold = false;

    if (winningTeamKey !== "No Bids" && room.teams[winningTeamKey]) {
        const team = room.teams[winningTeamKey];
        team.purse -= winningBid;
        team.spent += winningBid;
        team.squad.push(player);
        if (player.isOverseas) {
            team.overseasCount++;
        }
        room.auction.status = `SOLD to ${team.displayName} for ₹${winningBid}L!`;
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
            teams: rooms[roomCode].teams,
            claimedCount: 0
        });
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
            teams: room.teams,
            teamCodes: TEAM_CODES
        });
        io.to(roomCode).emit('updateTeams', {
            teams: room.teams,
            claimedCount: Object.keys(room.teams).length
        });
    });

    // Dynamic Team Claim with Table Duplication Support
    socket.on('claimTeam', ({ franchiseBase }) => {
        const room = rooms[socket.roomCode];
        if (!room) return;

        if (socket.claimedTeamKey) {
            return socket.emit('errorMsg', `You have already claimed ${room.teams[socket.claimedTeamKey].displayName}.`);
        }

        // Count how many copies of this franchise already exist in room
        const existingCount = Object.values(room.teams).filter(t => t.baseCode === franchiseBase).length;
        const assignedTableNumber = existingCount + 1;
        const uniqueKey = `${franchiseBase}_T${assignedTableNumber}`;
        const displayName = `${franchiseBase} (T${assignedTableNumber})`;

        room.teams[uniqueKey] = {
            baseCode: franchiseBase,
            tableNumber: assignedTableNumber,
            displayName: displayName,
            purse: INITIAL_PURSE,
            spent: 0,
            squad: [],
            overseasCount: 0,
            claimedBy: socket.id,
            claimedByName: socket.username
        };

        socket.claimedTeamKey = uniqueKey;

        socket.emit('teamConfirmed', {
            teamKey: uniqueKey,
            displayName: displayName,
            isStarted: room.isStarted,
            auction: room.auction,
            teams: room.teams,
            currentIndex: room.currentPlayerIndex + 1,
            totalPlayers: room.playerQueue.length
        });

        io.to(socket.roomCode).emit('updateTeams', {
            teams: room.teams,
            claimedCount: Object.keys(room.teams).length
        });
    });

    socket.on('startAuctionByAdmin', () => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.host) return;

        if (room.isStarted) return;
        room.isStarted = true;
        room.auction.active = true;
        room.auction.status = "LIVE";

        io.to(socket.roomCode).emit('auctionStartedNow', {
            auction: room.auction,
            teams: room.teams,
            currentIndex: 1,
            totalPlayers: room.playerQueue.length
        });

        startRoomTimer(socket.roomCode);
    });

    socket.on('placeBid', () => {
        const room = rooms[socket.roomCode];
        if (!room || !room.auction.active || !room.isStarted) return;

        const teamKey = socket.claimedTeamKey;
        if (!teamKey || !room.teams[teamKey]) {
            return socket.emit('errorMsg', "You must claim a franchise before bidding!");
        }

        const team = room.teams[teamKey];
        const currentPlayer = room.auction.player;

        if (team.squad.length >= SQUAD_MAX) {
            return socket.emit('errorMsg', `Squad is at maximum limit (${SQUAD_MAX} players).`);
        }

        if (currentPlayer.isOverseas && team.overseasCount >= MAX_OVERSEAS_SQUAD) {
            return socket.emit('errorMsg', `Overseas quota exceeded! Maximum ${MAX_OVERSEAS_SQUAD} foreign players permitted.`);
        }

        const currentBid = room.auction.highestBid;
        const increment = getNextBidIncrement(currentBid);
        const requiredBid = currentBid + increment;

        if (requiredBid > team.purse) {
            return socket.emit('errorMsg', `Insufficient purse! Required: ₹${requiredBid}L.`);
        }

        // Purse Reserve Calculation: Ensure team can complete the mandatory 11-player Playing XI
        const slotsNeededForMin = Math.max(0, PLAYING_11_MIN - (team.squad.length + 1));
        const minPurseReserve = slotsNeededForMin * LOWEST_BASE_PRICE;
        if ((team.purse - requiredBid) < minPurseReserve) {
            return socket.emit('errorMsg', `Bid blocked! You must reserve at least ₹${minPurseReserve}L to purchase a full Playing XI (11 players) and avoid disqualification.`);
        }

        room.auction.highestBid = requiredBid;
        room.auction.highestBidder = teamKey;
        room.auction.timer = Math.max(room.auction.timer, 5);

        io.to(socket.roomCode).emit('bidUpdated', {
            highestBid: requiredBid,
            highestBidder: team.displayName,
            timer: room.auction.timer
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
        if (room && socket.claimedTeamKey && room.teams[socket.claimedTeamKey]) {
            room.teams[socket.claimedTeamKey].claimedByName = `${room.teams[socket.claimedTeamKey].claimedByName} (Offline)`;
            io.to(socket.roomCode).emit('updateTeams', {
                teams: room.teams,
                claimedCount: Object.keys(room.teams).length
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
