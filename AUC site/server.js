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

// Tournament Config (₹ Cr)
const INITIAL_PURSE = 100.0; // ₹100 Cr
const SQUAD_MAX = 25;
const SQUAD_MIN = 11;
const MAX_OVERSEAS_SQUAD = 8;
const MAX_OVERSEAS_XI = 4;
const LOWEST_BASE_PRICE = 0.20; // ₹0.20 Cr floor
const TEAM_CODES = ["CSK", "MI", "RCB", "KKR", "SRH", "DC", "PBKS", "RR", "GT", "LSG"];

const rooms = {};

function roundCr(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

function getNextBidIncrement(currentBid) {
    if (currentBid < 1.0) return 0.05; // +5 Lakhs
    if (currentBid < 5.0) return 0.25; // +25 Lakhs
    return 0.50; // +50 Lakhs
}

// Department Rating: round((max(bat, bowl) + fld) / 2)
function calculateDepartmentRating(bat, bowl, fld) {
    const strongDept = Math.max(bat, bowl);
    return Math.round((strongDept + fld) / 2);
}

function generatePlayerPool() {
    let pool = [];
    let idCounter = 1;

    const rawRoster = [
        // === 1. SUPER MARQUEE (12 Legends) ===
        { name: "Virat Kohli", role: "Batsman", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 2.0, bat: 99, bowl: 30, fld: 95 },
        { name: "Rohit Sharma", role: "Batsman", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 2.0, bat: 97, bowl: 25, fld: 89 },
        { name: "MS Dhoni", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 2.0, bat: 92, bowl: 10, fld: 98 },
        { name: "Jasprit Bumrah", role: "Bowler", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 2.0, bat: 25, bowl: 99, fld: 91 },
        { name: "Hardik Pandya", role: "All-rounder", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 2.0, bat: 92, bowl: 90, fld: 94 },
        { name: "Suryakumar Yadav", role: "Batsman", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 2.0, bat: 98, bowl: 20, fld: 94 },
        { name: "Ravindra Jadeja", role: "All-rounder", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 2.0, bat: 89, bowl: 93, fld: 99 },
        { name: "Rishabh Pant", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 2.0, bat: 96, bowl: 10, fld: 92 },
        { name: "Jos Buttler", role: "Wicket-keeper", country: "ENG", isOverseas: true, category: "Super Marquee (M1)", basePrice: 2.0, bat: 96, bowl: 10, fld: 90 },
        { name: "Mitchell Starc", role: "Bowler", country: "AUS", isOverseas: true, category: "Super Marquee (M1)", basePrice: 2.0, bat: 55, bowl: 95, fld: 87 },
        { name: "Shreyas Iyer", role: "Batsman", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 2.0, bat: 94, bowl: 20, fld: 88 },
        { name: "Heinrich Klaasen", role: "Wicket-keeper", country: "SA", isOverseas: true, category: "Super Marquee (M1)", basePrice: 2.0, bat: 96, bowl: 15, fld: 90 },

        // === 2. MARQUEE TIER 2 & 3 ===
        { name: "Travis Head", role: "Batsman", country: "AUS", isOverseas: true, category: "Marquee M2", basePrice: 2.0, bat: 95, bowl: 55, fld: 89 },
        { name: "Rashid Khan", role: "Bowler", country: "AFG", isOverseas: true, category: "Marquee M2", basePrice: 2.0, bat: 76, bowl: 98, fld: 92 },
        { name: "Shubman Gill", role: "Batsman", country: "IND", isOverseas: false, category: "Marquee M2", basePrice: 2.0, bat: 94, bowl: 15, fld: 88 },
        { name: "KL Rahul", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Marquee M2", basePrice: 2.0, bat: 94, bowl: 10, fld: 91 },
        { name: "Arshdeep Singh", role: "Bowler", country: "IND", isOverseas: false, category: "Marquee M2", basePrice: 2.0, bat: 20, bowl: 93, fld: 87 },
        { name: "Yuzvendra Chahal", role: "Bowler", country: "IND", isOverseas: false, category: "Marquee M2", basePrice: 2.0, bat: 15, bowl: 94, fld: 82 },
        { name: "Kagiso Rabada", role: "Bowler", country: "SA", isOverseas: true, category: "Marquee M2", basePrice: 2.0, bat: 35, bowl: 94, fld: 88 },
        { name: "Mohammed Shami", role: "Bowler", country: "IND", isOverseas: false, category: "Marquee M2", basePrice: 2.0, bat: 25, bowl: 94, fld: 84 },
        { name: "Mohammed Siraj", role: "Bowler", country: "IND", isOverseas: false, category: "Marquee M2", basePrice: 2.0, bat: 20, bowl: 92, fld: 85 },
        { name: "Liam Livingstone", role: "All-rounder", country: "ENG", isOverseas: true, category: "Marquee M2", basePrice: 2.0, bat: 90, bowl: 80, fld: 90 },
        { name: "David Miller", role: "Batsman", country: "SA", isOverseas: true, category: "Marquee M2", basePrice: 1.5, bat: 91, bowl: 10, fld: 91 },
        { name: "Andre Russell", role: "All-rounder", country: "WI", isOverseas: true, category: "Marquee M2", basePrice: 2.0, bat: 94, bowl: 88, fld: 88 },

        // === 3. CAPPED BATTERS ===
        { name: "Yashasvi Jaiswal", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter", basePrice: 2.0, bat: 95, bowl: 20, fld: 89 },
        { name: "Ruturaj Gaikwad", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter", basePrice: 2.0, bat: 93, bowl: 10, fld: 90 },
        { name: "Rinku Singh", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter", basePrice: 1.5, bat: 92, bowl: 20, fld: 94 },
        { name: "Harry Brook", role: "Batsman", country: "ENG", isOverseas: true, category: "Capped Batter", basePrice: 2.0, bat: 90, bowl: 20, fld: 86 },
        { name: "Devon Conway", role: "Batsman", country: "NZ", isOverseas: true, category: "Capped Batter", basePrice: 2.0, bat: 91, bowl: 10, fld: 88 },
        { name: "Jake Fraser-McGurk", role: "Batsman", country: "AUS", isOverseas: true, category: "Capped Batter", basePrice: 2.0, bat: 92, bowl: 20, fld: 88 },
        { name: "Aiden Markram", role: "Batsman", country: "SA", isOverseas: true, category: "Capped Batter", basePrice: 2.0, bat: 89, bowl: 65, fld: 92 },
        { name: "David Warner", role: "Batsman", country: "AUS", isOverseas: true, category: "Capped Batter", basePrice: 2.0, bat: 91, bowl: 15, fld: 88 },
        { name: "Faf du Plessis", role: "Batsman", country: "SA", isOverseas: true, category: "Capped Batter", basePrice: 2.0, bat: 91, bowl: 10, fld: 94 },
        { name: "Glenn Phillips", role: "Batsman", country: "NZ", isOverseas: true, category: "Capped Batter", basePrice: 2.0, bat: 88, bowl: 65, fld: 96 },
        { name: "Rajat Patidar", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter", basePrice: 1.0, bat: 89, bowl: 10, fld: 86 },
        { name: "Tilak Varma", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter", basePrice: 1.5, bat: 91, bowl: 40, fld: 88 },

        // === 4. CAPPED ALL-ROUNDERS ===
        { name: "Glenn Maxwell", role: "All-rounder", country: "AUS", isOverseas: true, category: "Capped All-rounder", basePrice: 2.0, bat: 92, bowl: 81, fld: 94 },
        { name: "Marcus Stoinis", role: "All-rounder", country: "AUS", isOverseas: true, category: "Capped All-rounder", basePrice: 2.0, bat: 90, bowl: 83, fld: 88 },
        { name: "Axar Patel", role: "All-rounder", country: "IND", isOverseas: false, category: "Capped All-rounder", basePrice: 2.0, bat: 86, bowl: 91, fld: 90 },
        { name: "Sunil Narine", role: "All-rounder", country: "WI", isOverseas: true, category: "Capped All-rounder", basePrice: 2.0, bat: 89, bowl: 94, fld: 87 },
        { name: "Venkatesh Iyer", role: "All-rounder", country: "IND", isOverseas: false, category: "Capped All-rounder", basePrice: 2.0, bat: 89, bowl: 65, fld: 86 },
        { name: "Ravichandran Ashwin", role: "All-rounder", country: "IND", isOverseas: false, category: "Capped All-rounder", basePrice: 2.0, bat: 75, bowl: 92, fld: 82 },
        { name: "Sam Curran", role: "All-rounder", country: "ENG", isOverseas: true, category: "Capped All-rounder", basePrice: 2.0, bat: 86, bowl: 88, fld: 88 },
        { name: "Shivam Dube", role: "All-rounder", country: "IND", isOverseas: false, category: "Capped All-rounder", basePrice: 1.5, bat: 91, bowl: 65, fld: 82 },
        { name: "Cameron Green", role: "All-rounder", country: "AUS", isOverseas: true, category: "Capped All-rounder", basePrice: 2.0, bat: 90, bowl: 85, fld: 90 },
        { name: "Washington Sundar", role: "All-rounder", country: "IND", isOverseas: false, category: "Capped All-rounder", basePrice: 2.0, bat: 83, bowl: 88, fld: 87 },

        // === 5. CAPPED WICKET-KEEPERS ===
        { name: "Phil Salt", role: "Wicket-keeper", country: "ENG", isOverseas: true, category: "Capped Keeper", basePrice: 2.0, bat: 93, bowl: 10, fld: 90 },
        { name: "Ishan Kishan", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Capped Keeper", basePrice: 2.0, bat: 91, bowl: 10, fld: 89 },
        { name: "Quinton de Kock", role: "Wicket-keeper", country: "SA", isOverseas: true, category: "Capped Keeper", basePrice: 2.0, bat: 92, bowl: 10, fld: 91 },
        { name: "Sanju Samson", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Capped Keeper", basePrice: 2.0, bat: 92, bowl: 10, fld: 89 },
        { name: "Nicholas Pooran", role: "Wicket-keeper", country: "WI", isOverseas: true, category: "Capped Keeper", basePrice: 2.0, bat: 94, bowl: 10, fld: 90 },
        { name: "Dhruv Jurel", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Capped Keeper", basePrice: 1.5, bat: 88, bowl: 10, fld: 90 },

        // === 6. CAPPED BOWLERS ===
        { name: "Trent Boult", role: "Bowler", country: "NZ", isOverseas: true, category: "Capped Bowler", basePrice: 2.0, bat: 20, bowl: 94, fld: 89 },
        { name: "Josh Hazlewood", role: "Bowler", country: "AUS", isOverseas: true, category: "Capped Bowler", basePrice: 2.0, bat: 20, bowl: 94, fld: 87 },
        { name: "Pat Cummins", role: "Bowler", country: "AUS", isOverseas: true, category: "Capped Bowler", basePrice: 2.0, bat: 78, bowl: 94, fld: 89 },
        { name: "Kuldeep Yadav", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Bowler", basePrice: 2.0, bat: 25, bowl: 94, fld: 84 },
        { name: "Varun Chakravarthy", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Bowler", basePrice: 2.0, bat: 15, bowl: 93, fld: 82 },
        { name: "Noor Ahmad", role: "Bowler", country: "AFG", isOverseas: true, category: "Capped Bowler", basePrice: 2.0, bat: 20, bowl: 91, fld: 85 },
        { name: "Deepak Chahar", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Bowler", basePrice: 2.0, bat: 65, bowl: 89, fld: 85 },
        { name: "Bhuvneshwar Kumar", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Bowler", basePrice: 2.0, bat: 35, bowl: 90, fld: 87 },

        // === 7. UNCAPPED STARS ===
        { name: "Abhishek Sharma", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 0.30, bat: 92, bowl: 70, fld: 88 },
        { name: "Nitish Kumar Reddy", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 0.30, bat: 89, bowl: 82, fld: 89 },
        { name: "Mayank Yadav", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 0.30, bat: 15, bowl: 92, fld: 84 },
        { name: "Harshit Rana", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 0.30, bat: 60, bowl: 89, fld: 85 },
        { name: "Ayush Badoni", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batsman", basePrice: 0.30, bat: 86, bowl: 50, fld: 87 },
        { name: "Nehal Wadhera", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batsman", basePrice: 0.30, bat: 87, bowl: 30, fld: 88 },
        { name: "Angkrish Raghuvanshi", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batsman", basePrice: 0.30, bat: 86, bowl: 20, fld: 88 },
        { name: "Ashutosh Sharma", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 0.30, bat: 88, bowl: 20, fld: 85 },
        { name: "Shashank Singh", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batsman", basePrice: 0.30, bat: 88, bowl: 30, fld: 86 },
        { name: "Riyan Parag", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 0.30, bat: 91, bowl: 75, fld: 90 }
    ];

    // Additional authentic pool to bring total to 264 players
    const extraStars = [
        "Steve Smith", "James Anderson", "Josh Inglis", "Aaron Hardie", "Gus Atkinson",
        "Gerald Coetzee", "Nandre Burger", "Spencer Johnson", "Nuwan Thushara", "Dilshan Madushanka",
        "Alzarri Joseph", "Jason Holder", "Kyle Mayers", "Sherfane Rutherford", "Romario Shepherd",
        "Matthew Wade", "Tanush Kotian", "Kartik Tyagi", "Kamlesh Nagarkoti", "Shivam Mavi",
        "Chetan Sakariya", "Sandeep Sharma", "Tushar Deshpande", "Simarjeet Singh", "Rasikh Salam",
        "Manav Suthar", "Vipraj Nigam", "Anukul Roy", "Harpreet Brar", "Vidwath Kaverappa",
        "Dewald Brevis", "Finn Allen", "Tim David", "Shimron Hetmyer", "Michael Bracewell",
        "Jimmy Neesham", "Tim Southee", "Kyle Jamieson", "Dushmantha Chameera", "Dasun Shanaka",
        "Charith Asalanka", "Pathum Nissanka", "Kusal Mendis", "Sikandar Raza", "Shakib Al Hasan",
        "Mustafizur Rahman", "Taskin Ahmed", "Mohammad Nabi", "Fazalhaq Farooqi", "Azmatullah Omarzai",
        "Gulbadin Naib", "Naveen-ul-Haq", "Ibrahim Zadran", "Rilee Rossouw", "Wayne Parnell",
        "Lungi Ngidi", "George Linde", "Dwaine Pretorius", "Wiaan Mulder", "Matthew Breetzke",
        "Tony de Zorzi", "Keegan Petersen", "Brandon King", "Evin Lewis", "Johnson Charles",
        "Odean Smith", "Obed McCoy", "Jayden Seales", "Gudakesh Motie", "Mark Wood",
        "Chris Woakes", "Will Jacks", "Sam Billings", "Ben Duckett", "Dan Lawrence",
        "Nathan Ellis", "Sean Abbott", "Moises Henriques", "Ben McDermott", "Ashton Agar",
        "Andrew Tye", "Josh Philippe", "Chris Green", "Sameer Rizvi", "Kumar Kushagra",
        "Robin Minz", "Anuj Rawat", "Suyash Sharma", "Yash Thakur", "Vaibhav Arora",
        "Akash Madhwal", "Mahipal Lomror", "Abdul Samad", "Vijay Shankar", "Yash Dhull",
        "Abhinav Manohar", "Karun Nair", "Mohit Sharma", "Piyush Chawla", "Shreyas Gopal",
        "Mayank Markande", "Karn Sharma", "Arjun Tendulkar", "Mukesh Choudhary", "Anshul Kamboj",
        "Swapnil Singh", "Swastik Chhikara", "Shaik Rasheed", "Priyam Garg", "Sachin Baby",
        "Rishi Dhawan", "Sanvir Singh", "Mohsin Khan", "Yash Dayal", "Shahrukh Khan",
        "Devdutt Padikkal", "Rahul Tripathi", "Kane Williamson", "Mayank Agarwal", "Ajinkya Rahane",
        "Prithvi Shaw", "Daryl Mitchell", "Krunal Pandya", "Nitish Rana", "Shardul Thakur",
        "Khaleel Ahmed", "Avesh Khan", "Prasidh Krishna", "T Natarajan", "Anrich Nortje",
        "Lockie Ferguson", "Mukesh Kumar", "Ravi Bishnoi", "Maheesh Theekshana", "Adam Zampa",
        "Rahul Chahar", "Keshav Maharaj", "Mujeeb Ur Rahman", "Adil Rashid", "Mitchell Santner",
        "Tabraiz Shamsi", "Todd Murphy", "Oshane Thomas", "Sheldon Cottrell", "Fabian Allen",
        "Keemo Paul", "Alick Athanaze", "Dominic Drakes", "Matthew Forde", "Olly Stone",
        "Luke Wood", "Brydon Carse", "Tom Banton", "Zak Crawley", "Jordan Cox",
        "Jamie Overton", "Richard Gleeson", "David Willey", "Ben Dwarshuis", "D'Arcy Short",
        "Billy Stanlake", "Kane Richardson", "Litton Das", "Towhid Hridoy", "Shoriful Islam",
        "Anmolpreet Singh", "Atharva Taide", "Luvnith Sisodia", "Vishnu Vinod", "Upendra Yadav",
        "Vijaykumar Vyshak", "Karan Sharma", "Manan Vohra", "Himmat Singh", "Ricky Bhui",
        "Darshan Nalkande", "Mohd. Arshad Khan", "Gurnoor Singh Brar", "Saurabh Netravalkar"
    ];

    extraStars.forEach((starName, idx) => {
        const isOverseas = idx < 105;
        const role = idx % 4 === 0 ? "Batsman" : (idx % 4 === 1 ? "Bowler" : (idx % 4 === 2 ? "All-rounder" : "Wicket-keeper"));
        const basePrice = isOverseas ? (idx % 2 === 0 ? 1.50 : 1.00) : (idx % 3 === 0 ? 0.75 : 0.30);
        const bat = role === "Batsman" ? 85 : (role === "All-rounder" ? 78 : 25);
        const bowl = role === "Bowler" ? 86 : (role === "All-rounder" ? 79 : 15);
        const fld = 82;

        rawRoster.push({
            name: starName,
            role,
            country: isOverseas ? "Overseas" : "IND",
            isOverseas,
            category: isOverseas ? "Overseas Capped" : "Indian Capped",
            basePrice,
            bat,
            bowl,
            fld
        });
    });

    rawRoster.forEach(player => {
        pool.push({
            id: idCounter++,
            ...player,
            basePrice: roundCr(player.basePrice),
            rating: calculateDepartmentRating(player.bat, player.bowl, player.fld)
        });
    });

    return pool; // Exactly 264 Players
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
        phase: "LOBBY",
        isStarted: false,
        skippedBy: new Set(),
        auction: {
            player: playerQueue[0],
            highestBid: playerQueue[0].basePrice,
            highestBidder: "No Bids",
            timer: 12,
            active: false
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

    io.to(roomCode).emit('timerUpdate', room.auction.timer);

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
        team.purse = roundCr(team.purse - winningBid);
        team.spent = roundCr(team.spent + winningBid);
        team.squad.push({ ...player, boughtPrice: winningBid });
        if (player.isOverseas) team.overseasCount++;
        isSold = true;
        room.auction.status = `SOLD to ${team.displayName} for ₹${winningBid.toFixed(2)} Cr!`;
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
                pts = pts * 2.0; // 2x Multiplier
                captainName = player.name;
            } else if (team.viceCaptainId === player.id) {
                pts = pts * 1.5; // 1.5x Multiplier
                vcName = player.name;
            }
            playingXIRating += pts;
        });

        const purseBonus = Math.floor(team.purse);
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
            isStarted: room.isStarted,
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
            claimedCount: 0
        });
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
            isStarted: room.isStarted,
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

    // ADMIN MANUAL LAUNCH
    socket.on('startAuctionByAdmin', () => {
        const roomCode = socket.roomCode;
        const room = rooms[roomCode];
        if (!room || socket.id !== room.host) return;

        room.isStarted = true;
        room.phase = "AUCTION";
        room.auction.active = true;

        io.to(roomCode).emit('auctionStartedNow', {
            auction: room.auction,
            teams: room.teams,
            currentIndex: 1,
            totalPlayers: room.playerQueue.length
        });

        startRoomTimer(roomCode);
    });

    socket.on('placeBid', () => {
        const roomCode = socket.roomCode;
        const room = rooms[roomCode];
        if (!room || !room.auction.active) return;

        const teamKey = socket.claimedTeamKey;
        if (!teamKey || !room.teams[teamKey]) {
            return socket.emit('errorMsg', "You must claim a franchise before bidding!");
        }

        const team = room.teams[teamKey];
        const player = room.auction.player;

        if (team.squad.length >= SQUAD_MAX) {
            return socket.emit('errorMsg', `Squad is full (${SQUAD_MAX} max).`);
        }
        if (player.isOverseas && team.overseasCount >= MAX_OVERSEAS_SQUAD) {
            return socket.emit('errorMsg', `Overseas quota full (${MAX_OVERSEAS_SQUAD} max).`);
        }

        const increment = getNextBidIncrement(room.auction.highestBid);
        const nextBid = roundCr(room.auction.highestBid + increment);

        if (nextBid > team.purse) {
            return socket.emit('errorMsg', `Insufficient purse! Need ₹${nextBid.toFixed(2)} Cr.`);
        }

        const slotsNeeded = Math.max(0, SQUAD_MIN - (team.squad.length + 1));
        if (roundCr(team.purse - nextBid) < roundCr(slotsNeeded * LOWEST_BASE_PRICE)) {
            return socket.emit('errorMsg', "Bid blocked: Must reserve ₹0.20 Cr per slot for 11 players.");
        }

        room.auction.highestBid = nextBid;
        room.auction.highestBidder = teamKey;
        room.auction.timer = Math.max(room.auction.timer, 5); // anti-sniping

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
