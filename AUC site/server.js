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

app.get('/ping', (req, res) => res.status(200).send('pong'));

// Tournament Configuration
const INITIAL_PURSE = 10000;
const SQUAD_MAX = 25;
const SQUAD_MIN = 11;
const MAX_OVERSEAS_SQUAD = 8;
const MAX_OVERSEAS_XI = 4;
const LOWEST_BASE_PRICE = 20;
const TEAM_CODES = ["CSK", "MI", "RCB", "KKR", "SRH", "DC", "PBKS", "RR", "GT", "LSG"];

const rooms = {};

function getNextBidIncrement(currentBid) {
    if (currentBid < 100) return 5;
    if (currentBid < 500) return 25;
    return 50;
}

function generatePlayerPool() {
    let pool = [];
    let idCounter = 1;

    const marquee = [
        { name: "Virat Kohli", role: "Batsman", country: "IND", isOverseas: false, bat: 99, bowl: 30, fld: 95 },
        { name: "Rohit Sharma", role: "Batsman", country: "IND", isOverseas: false, bat: 96, bowl: 25, fld: 88 },
        { name: "Jasprit Bumrah", role: "Bowler", country: "IND", isOverseas: false, bat: 20, bowl: 99, fld: 89 },
        { name: "Suryakumar Yadav", role: "Batsman", country: "IND", isOverseas: false, bat: 97, bowl: 20, fld: 92 },
        { name: "Hardik Pandya", role: "All-rounder", country: "IND", isOverseas: false, bat: 90, bowl: 89, fld: 92 },
        { name: "Ravindra Jadeja", role: "All-rounder", country: "IND", isOverseas: false, bat: 88, bowl: 92, fld: 99 },
        { name: "Rashid Khan", role: "Bowler", country: "AFG", isOverseas: true, bat: 75, bowl: 98, fld: 90 },
        { name: "Heinrich Klaasen", role: "Wicket-keeper", country: "SA", isOverseas: true, bat: 95, bowl: 10, fld: 90 },
        { name: "Travis Head", role: "Batsman", country: "AUS", isOverseas: true, bat: 95, bowl: 55, fld: 88 },
        { name: "Rishabh Pant", role: "Wicket-keeper", country: "IND", isOverseas: false, bat: 94, bowl: 10, fld: 92 },
        { name: "Jos Buttler", role: "Wicket-keeper", country: "ENG", isOverseas: true, bat: 95, bowl: 10, fld: 90 },
        { name: "Mitchell Starc", role: "Bowler", country: "AUS", isOverseas: true, bat: 50, bowl: 94, fld: 85 },
        { name: "Shubman Gill", role: "Batsman", country: "IND", isOverseas: false, bat: 93, bowl: 15, fld: 88 },
        { name: "Nicholas Pooran", role: "Wicket-keeper", country: "WI", isOverseas: true, bat: 94, bowl: 10, fld: 89 },
        { name: "Andre Russell", role: "All-rounder", country: "WI", isOverseas: true, bat: 93, bowl: 88, fld: 86 },
        { name: "Glenn Maxwell", role: "All-rounder", country: "AUS", isOverseas: true, bat: 91, bowl: 80, fld: 94 },
        { name: "Axar Patel", role: "All-rounder", country: "IND", isOverseas: false, bat: 85, bowl: 90, fld: 89 },
        { name: "Mohammed Shami", role: "Bowler", country: "IND", isOverseas: false, bat: 25, bowl: 93, fld: 82 },
        { name: "Yuzvendra Chahal", role: "Bowler", country: "IND", isOverseas: false, bat: 15, bowl: 92, fld: 80 },
        { name: "Arshdeep Singh", role: "Bowler", country: "IND", isOverseas: false, bat: 20, bowl: 91, fld: 85 },
        { name: "KL Rahul", role: "Wicket-keeper", country: "IND", isOverseas: false, bat: 93, bowl: 10, fld: 90 },
        { name: "Sanju Samson", role: "Wicket-keeper", country: "IND", isOverseas: false, bat: 92, bowl: 10, fld: 88 },
        { name: "Shreyas Iyer", role: "Batsman", country: "IND", isOverseas: false, bat: 92, bowl: 20, fld: 87 },
        { name: "Liam Livingstone", role: "All-rounder", country: "ENG", isOverseas: true, bat: 89, bowl: 80, fld: 88 }
    ];

    marquee.forEach(p => {
        const rating = Math.round((p.bat * 0.45) + (p.bowl * 0.45) + (p.fld * 0.1));
        pool.push({ id: idCounter++, ...p, category: "Marquee", basePrice: 200, rating });
    });

    const foreignNations = ["AUS", "ENG", "SA", "WI", "NZ", "AFG"];
    const cappedPrices = [50, 75, 100, 150];

    for (let i = 1; i <= 35; i++) {
        const isOverseas = i % 3 === 0;
        const bat = Math.floor(Math.random() * 14) + 80;
        pool.push({
            id: idCounter++,
            name: isOverseas ? `Intl Batter #${i}` : `Indian Batter #${i}`,
            role: "Batsman", category: "Capped Batter",
            country: isOverseas ? foreignNations[i % foreignNations.length] : "IND",
            isOverseas, basePrice: cappedPrices[i % cappedPrices.length],
            bat, bowl: 25, fld: 80, rating: bat
        });
    }

    for (let i = 1; i <= 25; i++) {
        const isOverseas = i % 3 === 0;
        const bat = Math.floor(Math.random() * 12) + 78;
        pool.push({
            id: idCounter++,
            name: isOverseas ? `Intl Keeper #${i}` : `Indian Keeper #${i}`,
            role: "Wicket-keeper", category: "Capped Wicket-keeper",
            country: isOverseas ? foreignNations[i % foreignNations.length] : "IND",
            isOverseas, basePrice: cappedPrices[i % cappedPrices.length],
            bat, bowl: 10, fld: 88, rating: bat
        });
    }

    for (let i = 1; i <= 45; i++) {
        const isOverseas = i % 2 === 0;
        const bat = Math.floor(Math.random() * 15) + 75;
        const bowl = Math.floor(Math.random() * 15) + 75;
        pool.push({
            id: idCounter++,
            name: isOverseas ? `Intl All-Rounder #${i}` : `Indian All-Rounder #${i}`,
            role: "All-rounder", category: "Capped All-rounder",
            country: isOverseas ? foreignNations[i % foreignNations.length] : "IND",
            isOverseas, basePrice: cappedPrices[i % cappedPrices.length],
            bat, bowl, fld: 80, rating: Math.round((bat + bowl) / 2)
        });
    }

    for (let i = 1; i <= 55; i++) {
        const isOverseas = i % 3 === 0;
        const bowl = Math.floor(Math.random() * 14) + 80;
        pool.push({
            id: idCounter++,
            name: isOverseas ? `Intl Bowler #${i}` : `Indian Bowler #${i}`,
            role: "Bowler", category: "Capped Bowler",
            country: isOverseas ? foreignNations[i % foreignNations.length] : "IND",
            isOverseas, basePrice: cappedPrices[i % cappedPrices.length],
            bat: 25, bowl, fld: 75, rating: bowl
        });
    }

    const uncappedRoles = ["Batsman", "Wicket-keeper", "All-rounder", "Bowler"];
    for (let i = 1; i <= 80; i++) {
        const role = uncappedRoles[i % uncappedRoles.length];
        const isOverseas = i % 8 === 0;
        const rating = Math.floor(Math.random() * 14) + 68;
        pool.push({
            id: idCounter++,
            name: isOverseas ? `Emerging Overseas #${i}` : `Domestic Talent #${i}`,
            role, category: `Uncapped ${role}`,
            country: isOverseas ? foreignNations[i % foreignNations.length] : "IND",
            isOverseas, basePrice: 20,
            bat: rating, bowl: rating, fld: 70, rating
        });
    }

    return pool;
}

function createRoom(roomCode, hostSocketId) {
    const playerQueue = generatePlayerPool();
    rooms[roomCode] = {
        code: roomCode,
        host: hostSocketId,
        teams: {},
        playerQueue,
        unsoldPool: [],
        currentPlayerIndex: 0,
        timerInterval: null,
        phase: "AUCTION",
        skippedBy: new Set(),
        auction: {
            player: playerQueue[0],
            highestBid: playerQueue[0].basePrice,
            highestBidder: "No Bids",
            timer: 12,
            active: true
        }
    };
}

function startRoomTimer(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    clearInterval(room.timerInterval);
    room.auction.timer = 12;
    room.auction.active = true;
    room.skippedBy.clear();

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
        team.squad.push({ ...player, boughtPrice: winningBid });
        if (player.isOverseas) team.overseasCount++;
        isSold = true;
        room.auction.status = `SOLD to ${team.displayName} for ₹${winningBid}L!`;
    } else {
        room.unsoldPool.push(player);
        room.auction.status = `UNSOLD: ${player.name}`;
    }

    io.to(roomCode).emit('playerResolved', {
        status: room.auction.status,
        isSold,
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
                active: true
            };
            io.to(roomCode).emit('nextPlayer', {
                auction: room.auction,
                teams: room.teams,
                currentIndex: room.currentPlayerIndex + 1,
                totalPlayers: room.playerQueue.length
            });
            startRoomTimer(roomCode);
        } else {
            room.phase = "SELECTION";
            io.to(roomCode).emit('startSelectionPhase', { teams: room.teams });
        }
    }, 2500);
}

function calculateFinalStandings(room) {
    let leaderboard = [];

    for (let key in room.teams) {
        const team = room.teams[key];
        
        if (team.squad.length < SQUAD_MIN) {
            leaderboard.push({
                teamCode: team.displayName,
                manager: team.claimedByName,
                squadCount: team.squad.length,
                isDisqualified: true,
                finalScore: 0,
                purseLeft: team.purse,
                captainName: "None",
                vcName: "None",
                playingXIScore: 0,
                squad: team.squad,
                statusText: "DISQUALIFIED (< 11 Players)"
            });
            continue;
        }

        let xi = team.submittedXI;
        if (!xi || xi.length !== 11) {
            xi = [...team.squad].sort((a, b) => b.rating - a.rating).slice(0, 11);
            team.captainId = xi[0].id;
            team.viceCaptainId = xi[1].id;
        }

        let playingXIRating = 0;
        let captainName = "None";
        let vcName = "None";

        xi.forEach(player => {
            let pts = player.rating;
            if (team.captainId === player.id) {
                pts = pts * 2.0;
                captainName = player.name;
            } else if (team.viceCaptainId === player.id) {
                pts = pts * 1.5;
                vcName = player.name;
            }
            playingXIRating += pts;
        });

        const purseBonus = Math.floor(team.purse / 100);
        const finalScore = Math.round(playingXIRating) + purseBonus;

        leaderboard.push({
            teamCode: team.displayName,
            manager: team.claimedByName,
            squadCount: team.squad.length,
            isDisqualified: false,
            finalScore,
            purseLeft: team.purse,
            captainName,
            vcName,
            playingXIScore: Math.round(playingXIRating),
            squad: team.squad,
            statusText: "Qualified"
        });
    }

    leaderboard.sort((a, b) => {
        if (a.isDisqualified && !b.isDisqualified) return 1;
        if (!a.isDisqualified && b.isDisqualified) return -1;
        return b.finalScore - a.finalScore;
    });

    return leaderboard;
}

io.on('connection', (socket) => {
    socket.on('rejoinSession', ({ roomCode, userId }) => {
        const room = rooms[roomCode];
        if (!room) return socket.emit('errorMsg', "Room session expired.");

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.userId = userId;

        for (let key in room.teams) {
            if (room.teams[key].userId === userId) {
                room.teams[key].claimedBy = socket.id;
                socket.claimedTeamKey = key;
                break;
            }
        }

        socket.emit('rejoinedSuccess', {
            phase: room.phase,
            auction: room.auction,
            teams: room.teams,
            myTeamKey: socket.claimedTeamKey,
            currentIndex: room.currentPlayerIndex + 1,
            totalPlayers: room.playerQueue.length
        });
    });

    socket.on('createRoom', ({ username, userId }) => {
        const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        createRoom(roomCode, socket.id);
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.userId = userId;
        socket.isHost = true;

        socket.emit('roomCreated', { 
            roomCode, 
            teams: rooms[roomCode].teams,
            auction: rooms[roomCode].auction,
            currentIndex: 1,
            totalPlayers: rooms[roomCode].playerQueue.length
        });

        startRoomTimer(roomCode);
    });

    socket.on('joinRoom', ({ roomCode, username, userId }) => {
        const room = rooms[roomCode];
        if (!room) return socket.emit('errorMsg', "Invalid 4-Digit Room Code.");

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.userId = userId;
        socket.username = username;

        socket.emit('joinedToTeamSelect', {
            roomCode,
            teams: room.teams,
            teamCodes: TEAM_CODES
        });
    });

    socket.on('claimTeam', ({ franchiseBase }) => {
        const roomCode = socket.roomCode;
        const room = rooms[roomCode];
        if (!room) return socket.emit('errorMsg', "Session not found.");

        const count = Object.values(room.teams).filter(t => t.baseCode === franchiseBase).length;
        const tableNumber = count + 1;
        const uniqueKey = `${franchiseBase}_T${tableNumber}`;
        const displayName = `${franchiseBase} (T${tableNumber})`;

        room.teams[uniqueKey] = {
            baseCode: franchiseBase,
            tableNumber,
            displayName,
            purse: INITIAL_PURSE,
            spent: 0,
            squad: [],
            overseasCount: 0,
            claimedBy: socket.id,
            userId: socket.userId,
            claimedByName: socket.username,
            submittedXI: null,
            captainId: null,
            viceCaptainId: null
        };

        socket.claimedTeamKey = uniqueKey;

        socket.emit('teamConfirmed', {
            teamKey: uniqueKey,
            displayName,
            phase: room.phase,
            teams: room.teams,
            auction: room.auction,
            currentIndex: room.currentPlayerIndex + 1,
            totalPlayers: room.playerQueue.length
        });

        io.to(roomCode).emit('updateTeams', {
            teams: room.teams,
            claimedCount: Object.keys(room.teams).length
        });
    });

    socket.on('placeBid', () => {
        const roomCode = socket.roomCode;
        const room = rooms[roomCode];
        if (!room || !room.auction.active) return;

        const teamKey = socket.claimedTeamKey;
        if (!teamKey || !room.teams[teamKey]) {
            return socket.emit('errorMsg', "You must claim a team before bidding!");
        }

        const team = room.teams[teamKey];
        const player = room.auction.player;

        if (team.squad.length >= SQUAD_MAX) {
            return socket.emit('errorMsg', `Squad is full (${SQUAD_MAX} max).`);
        }
        if (player.isOverseas && team.overseasCount >= MAX_OVERSEAS_SQUAD) {
            return socket.emit('errorMsg', `Overseas quota full (${MAX_OVERSEAS_SQUAD} max).`);
        }

        const nextBid = room.auction.highestBid + getNextBidIncrement(room.auction.highestBid);
        if (nextBid > team.purse) {
            return socket.emit('errorMsg', `Insufficient purse! Need ₹${nextBid}L.`);
        }

        const slotsNeeded = Math.max(0, SQUAD_MIN - (team.squad.length + 1));
        if ((team.purse - nextBid) < (slotsNeeded * LOWEST_BASE_PRICE)) {
            return socket.emit('errorMsg', "Bid blocked: Must reserve funds to build 11-player squad.");
        }

        room.auction.highestBid = nextBid;
        room.auction.highestBidder = teamKey;
        room.auction.timer = Math.max(room.auction.timer, 5);

        io.to(roomCode).emit('bidUpdated', {
            highestBid: nextBid,
            highestBidder: team.displayName,
            timer: room.auction.timer
        });
    });

    socket.on('skipForMe', () => {
        const room = rooms[socket.roomCode];
        if (!room || !room.auction.active) return;

        room.skippedBy.add(socket.claimedTeamKey);
        const totalManagers = Object.keys(room.teams).length;

        if (room.skippedBy.size >= totalManagers && room.auction.highestBidder === "No Bids") {
            room.auction.timer = 1;
        }
    });

    socket.on('submitPlaying11', ({ selectedPlayerIds, captainId, viceCaptainId }) => {
        const room = rooms[socket.roomCode];
        if (!room || !socket.claimedTeamKey) return;

        const team = room.teams[socket.claimedTeamKey];
        if (selectedPlayerIds.length !== 11) {
            return socket.emit('errorMsg', "Choose exactly 11 players.");
        }
        if (!captainId || !viceCaptainId || captainId === viceCaptainId) {
            return socket.emit('errorMsg', "Captain and Vice-Captain must be different players.");
        }

        const selectedPlayers = team.squad.filter(p => selectedPlayerIds.includes(p.id));
        const overseasCount = selectedPlayers.filter(p => p.isOverseas).length;

        if (overseasCount > MAX_OVERSEAS_XI) {
            return socket.emit('errorMsg', `Max ${MAX_OVERSEAS_XI} overseas players allowed in Playing XI.`);
        }

        team.submittedXI = selectedPlayers;
        team.captainId = captainId;
        team.viceCaptainId = viceCaptainId;

        socket.emit('submissionAccepted');

        const qualified = Object.values(room.teams).filter(t => t.squad.length >= SQUAD_MIN);
        const allSubmitted = qualified.every(t => t.submittedXI !== null);

        if (allSubmitted) {
            room.phase = "RESULT";
            const leaderboard = calculateFinalStandings(room);
            io.to(socket.roomCode).emit('finalResultsAnnounced', { 
                leaderboard,
                fullTeams: room.teams,
                roomCode: socket.roomCode 
            });
        }
    });

    socket.on('adminForceSold', () => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.host || !room.auction.active) return;
        clearInterval(room.timerInterval);
        handleAuctionEnd(socket.roomCode);
    });

    socket.on('adminForceUnsold', () => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.host || !room.auction.active) return;
        clearInterval(room.timerInterval);
        room.auction.highestBidder = "No Bids";
        handleAuctionEnd(socket.roomCode);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
