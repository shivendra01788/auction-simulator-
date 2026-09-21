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

// Tournament Config
const INITIAL_PURSE = 10000; // ₹100 Cr (in Lakhs)
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

// Department Rating Formula: round((max(bat, bowl) + fld) / 2)
function calculateDepartmentRating(bat, bowl, fld) {
    const strongDept = Math.max(bat, bowl);
    return Math.round((strongDept + fld) / 2);
}

// 264 REAL, AUTHENTIC PLAYERS DATABASE
function generatePlayerPool() {
    let pool = [];
    let idCounter = 1;

    const rawRoster = [
        // ========================================================
        // 1. ALL-STAR SUPER MARQUEE (12 Legends)
        // ========================================================
        { name: "Virat Kohli", role: "Batsman", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 200, bat: 99, bowl: 30, fld: 95 },
        { name: "Rohit Sharma", role: "Batsman", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 200, bat: 97, bowl: 25, fld: 89 },
        { name: "MS Dhoni", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 200, bat: 92, bowl: 10, fld: 98 },
        { name: "Jasprit Bumrah", role: "Bowler", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 200, bat: 25, bowl: 99, fld: 91 },
        { name: "Hardik Pandya", role: "All-rounder", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 200, bat: 92, bowl: 90, fld: 94 },
        { name: "Suryakumar Yadav", role: "Batsman", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 200, bat: 98, bowl: 20, fld: 94 },
        { name: "Ravindra Jadeja", role: "All-rounder", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 200, bat: 89, bowl: 93, fld: 99 },
        { name: "Rishabh Pant", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 200, bat: 96, bowl: 10, fld: 92 },
        { name: "Jos Buttler", role: "Wicket-keeper", country: "ENG", isOverseas: true, category: "Super Marquee (M1)", basePrice: 200, bat: 96, bowl: 10, fld: 90 },
        { name: "Mitchell Starc", role: "Bowler", country: "AUS", isOverseas: true, category: "Super Marquee (M1)", basePrice: 200, bat: 55, bowl: 95, fld: 87 },
        { name: "Shreyas Iyer", role: "Batsman", country: "IND", isOverseas: false, category: "Super Marquee (M1)", basePrice: 200, bat: 94, bowl: 20, fld: 88 },
        { name: "Heinrich Klaasen", role: "Wicket-keeper", country: "SA", isOverseas: true, category: "Super Marquee (M1)", basePrice: 200, bat: 96, bowl: 15, fld: 90 },

        // ========================================================
        // 2. MARQUEE TIER 2 & 3 (12 Players)
        // ========================================================
        { name: "Travis Head", role: "Batsman", country: "AUS", isOverseas: true, category: "Marquee M2", basePrice: 200, bat: 95, bowl: 55, fld: 89 },
        { name: "Rashid Khan", role: "Bowler", country: "AFG", isOverseas: true, category: "Marquee M2", basePrice: 200, bat: 76, bowl: 98, fld: 92 },
        { name: "Shubman Gill", role: "Batsman", country: "IND", isOverseas: false, category: "Marquee M2", basePrice: 200, bat: 94, bowl: 15, fld: 88 },
        { name: "KL Rahul", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Marquee M2", basePrice: 200, bat: 94, bowl: 10, fld: 91 },
        { name: "Arshdeep Singh", role: "Bowler", country: "IND", isOverseas: false, category: "Marquee M2", basePrice: 200, bat: 20, bowl: 93, fld: 87 },
        { name: "Yuzvendra Chahal", role: "Bowler", country: "IND", isOverseas: false, category: "Marquee M2", basePrice: 200, bat: 15, bowl: 94, fld: 82 },
        { name: "Kagiso Rabada", role: "Bowler", country: "SA", isOverseas: true, category: "Marquee M2", basePrice: 200, bat: 35, bowl: 94, fld: 88 },
        { name: "Mohammed Shami", role: "Bowler", country: "IND", isOverseas: false, category: "Marquee M2", basePrice: 200, bat: 25, bowl: 94, fld: 84 },
        { name: "Mohammed Siraj", role: "Bowler", country: "IND", isOverseas: false, category: "Marquee M2", basePrice: 200, bat: 20, bowl: 92, fld: 85 },
        { name: "Liam Livingstone", role: "All-rounder", country: "ENG", isOverseas: true, category: "Marquee M2", basePrice: 200, bat: 90, bowl: 80, fld: 90 },
        { name: "David Miller", role: "Batsman", country: "SA", isOverseas: true, category: "Marquee M2", basePrice: 150, bat: 91, bowl: 10, fld: 91 },
        { name: "Andre Russell", role: "All-rounder", country: "WI", isOverseas: true, category: "Marquee M2", basePrice: 200, bat: 94, bowl: 88, fld: 88 },

        // ========================================================
        // 3. CAPPED BATTERS - SET 1 & 2 (24 Players)
        // ========================================================
        { name: "Yashasvi Jaiswal", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter (BA1)", basePrice: 200, bat: 95, bowl: 20, fld: 89 },
        { name: "Ruturaj Gaikwad", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter (BA1)", basePrice: 200, bat: 93, bowl: 10, fld: 90 },
        { name: "Rinku Singh", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter (BA1)", basePrice: 150, bat: 92, bowl: 20, fld: 94 },
        { name: "Harry Brook", role: "Batsman", country: "ENG", isOverseas: true, category: "Capped Batter (BA1)", basePrice: 200, bat: 90, bowl: 20, fld: 86 },
        { name: "Devon Conway", role: "Batsman", country: "NZ", isOverseas: true, category: "Capped Batter (BA1)", basePrice: 200, bat: 91, bowl: 10, fld: 88 },
        { name: "Jake Fraser-McGurk", role: "Batsman", country: "AUS", isOverseas: true, category: "Capped Batter (BA1)", basePrice: 200, bat: 92, bowl: 20, fld: 88 },
        { name: "Aiden Markram", role: "Batsman", country: "SA", isOverseas: true, category: "Capped Batter (BA1)", basePrice: 200, bat: 89, bowl: 65, fld: 92 },
        { name: "David Warner", role: "Batsman", country: "AUS", isOverseas: true, category: "Capped Batter (BA1)", basePrice: 200, bat: 91, bowl: 15, fld: 88 },
        { name: "Devdutt Padikkal", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter (BA1)", basePrice: 200, bat: 85, bowl: 10, fld: 85 },
        { name: "Rahul Tripathi", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter (BA1)", basePrice: 75, bat: 86, bowl: 10, fld: 88 },
        { name: "Faf du Plessis", role: "Batsman", country: "SA", isOverseas: true, category: "Capped Batter (BA2)", basePrice: 200, bat: 91, bowl: 10, fld: 94 },
        { name: "Glenn Phillips", role: "Batsman", country: "NZ", isOverseas: true, category: "Capped Batter (BA2)", basePrice: 200, bat: 88, bowl: 65, fld: 96 },
        { name: "Rovman Powell", role: "Batsman", country: "WI", isOverseas: true, category: "Capped Batter (BA2)", basePrice: 150, bat: 87, bowl: 50, fld: 87 },
        { name: "Ajinkya Rahane", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter (BA2)", basePrice: 150, bat: 85, bowl: 10, fld: 89 },
        { name: "Prithvi Shaw", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter (BA2)", basePrice: 75, bat: 85, bowl: 10, fld: 81 },
        { name: "Kane Williamson", role: "Batsman", country: "NZ", isOverseas: true, category: "Capped Batter (BA2)", basePrice: 200, bat: 89, bowl: 15, fld: 88 },
        { name: "Mayank Agarwal", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter (BA2)", basePrice: 100, bat: 84, bowl: 10, fld: 84 },
        { name: "Steve Smith", role: "Batsman", country: "AUS", isOverseas: true, category: "Capped Batter (BA2)", basePrice: 200, bat: 90, bowl: 30, fld: 90 },
        { name: "Rajat Patidar", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter (BA2)", basePrice: 100, bat: 89, bowl: 10, fld: 86 },
        { name: "Tilak Varma", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter (BA2)", basePrice: 150, bat: 91, bowl: 40, fld: 88 },
        { name: "Manish Pandey", role: "Batsman", country: "IND", isOverseas: false, category: "Capped Batter (BA2)", basePrice: 75, bat: 83, bowl: 10, fld: 87 },
        { name: "Shimron Hetmyer", role: "Batsman", country: "WI", isOverseas: true, category: "Capped Batter (BA2)", basePrice: 150, bat: 89, bowl: 10, fld: 86 },
        { name: "Tim David", role: "Batsman", country: "AUS", isOverseas: true, category: "Capped Batter (BA2)", basePrice: 200, bat: 89, bowl: 20, fld: 86 },
        { name: "Finn Allen", role: "Batsman", country: "NZ", isOverseas: true, category: "Capped Batter (BA2)", basePrice: 200, bat: 89, bowl: 10, fld: 86 },

        // ========================================================
        // 4. CAPPED WICKET-KEEPERS - SET 1 & 2 (16 Players)
        // ========================================================
        { name: "Phil Salt", role: "Wicket-keeper", country: "ENG", isOverseas: true, category: "Capped Keeper (WK1)", basePrice: 200, bat: 93, bowl: 10, fld: 90 },
        { name: "Ishan Kishan", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Capped Keeper (WK1)", basePrice: 200, bat: 91, bowl: 10, fld: 89 },
        { name: "Quinton de Kock", role: "Wicket-keeper", country: "SA", isOverseas: true, category: "Capped Keeper (WK1)", basePrice: 200, bat: 92, bowl: 10, fld: 91 },
        { name: "Jonny Bairstow", role: "Wicket-keeper", country: "ENG", isOverseas: true, category: "Capped Keeper (WK1)", basePrice: 200, bat: 91, bowl: 10, fld: 88 },
        { name: "Sanju Samson", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Capped Keeper (WK1)", basePrice: 200, bat: 92, bowl: 10, fld: 89 },
        { name: "Nicholas Pooran", role: "Wicket-keeper", country: "WI", isOverseas: true, category: "Capped Keeper (WK1)", basePrice: 200, bat: 94, bowl: 10, fld: 90 },
        { name: "Jitesh Sharma", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Capped Keeper (WK1)", basePrice: 100, bat: 87, bowl: 10, fld: 89 },
        { name: "Rahmanullah Gurbaz", role: "Wicket-keeper", country: "AFG", isOverseas: true, category: "Capped Keeper (WK1)", basePrice: 200, bat: 87, bowl: 10, fld: 87 },
        { name: "Dhruv Jurel", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Capped Keeper (WK2)", basePrice: 150, bat: 88, bowl: 10, fld: 90 },
        { name: "Alex Carey", role: "Wicket-keeper", country: "AUS", isOverseas: true, category: "Capped Keeper (WK2)", basePrice: 100, bat: 85, bowl: 10, fld: 89 },
        { name: "Shai Hope", role: "Wicket-keeper", country: "WI", isOverseas: true, category: "Capped Keeper (WK2)", basePrice: 125, bat: 86, bowl: 10, fld: 87 },
        { name: "Ryan Rickelton", role: "Wicket-keeper", country: "SA", isOverseas: true, category: "Capped Keeper (WK2)", basePrice: 100, bat: 87, bowl: 10, fld: 87 },
        { name: "KS Bharat", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Capped Keeper (WK2)", basePrice: 75, bat: 80, bowl: 10, fld: 88 },
        { name: "Wriddhiman Saha", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Capped Keeper (WK2)", basePrice: 75, bat: 83, bowl: 10, fld: 92 },
        { name: "Matthew Wade", role: "Wicket-keeper", country: "AUS", isOverseas: true, category: "Capped Keeper (WK2)", basePrice: 100, bat: 85, bowl: 10, fld: 87 },
        { name: "Josh Inglis", role: "Wicket-keeper", country: "AUS", isOverseas: true, category: "Capped Keeper (WK2)", basePrice: 200, bat: 89, bowl: 10, fld: 89 },

        // ========================================================
        // 5. CAPPED ALL-ROUNDERS - SET 1 & 2 (24 Players)
        // ========================================================
        { name: "Glenn Maxwell", role: "All-rounder", country: "AUS", isOverseas: true, category: "Capped All-rounder (AL1)", basePrice: 200, bat: 92, bowl: 81, fld: 94 },
        { name: "Marcus Stoinis", role: "All-rounder", country: "AUS", isOverseas: true, category: "Capped All-rounder (AL1)", basePrice: 200, bat: 90, bowl: 83, fld: 88 },
        { name: "Axar Patel", role: "All-rounder", country: "IND", isOverseas: false, category: "Capped All-rounder (AL1)", basePrice: 200, bat: 86, bowl: 91, fld: 90 },
        { name: "Sunil Narine", role: "All-rounder", country: "WI", isOverseas: true, category: "Capped All-rounder (AL1)", basePrice: 200, bat: 89, bowl: 94, fld: 87 },
        { name: "Venkatesh Iyer", role: "All-rounder", country: "IND", isOverseas: false, category: "Capped All-rounder (AL1)", basePrice: 200, bat: 89, bowl: 65, fld: 86 },
        { name: "Ravichandran Ashwin", role: "All-rounder", country: "IND", isOverseas: false, category: "Capped All-rounder (AL1)", basePrice: 200, bat: 75, bowl: 92, fld: 82 },
        { name: "Mitchell Marsh", role: "All-rounder", country: "AUS", isOverseas: true, category: "Capped All-rounder (AL1)", basePrice: 200, bat: 90, bowl: 82, fld: 87 },
        { name: "Harshal Patel", role: "All-rounder", country: "IND", isOverseas: false, category: "Capped All-rounder (AL1)", basePrice: 200, bat: 62, bowl: 91, fld: 85 },
        { name: "Rachin Ravindra", role: "All-rounder", country: "NZ", isOverseas: true, category: "Capped All-rounder (AL1)", basePrice: 150, bat: 89, bowl: 78, fld: 88 },
        { name: "Sam Curran", role: "All-rounder", country: "ENG", isOverseas: true, category: "Capped All-rounder (AL2)", basePrice: 200, bat: 86, bowl: 88, fld: 88 },
        { name: "Marco Jansen", role: "All-rounder", country: "SA", isOverseas: true, category: "Capped All-rounder (AL2)", basePrice: 125, bat: 78, bowl: 90, fld: 87 },
        { name: "Daryl Mitchell", role: "All-rounder", country: "NZ", isOverseas: true, category: "Capped All-rounder (AL2)", basePrice: 200, bat: 88, bowl: 70, fld: 89 },
        { name: "Krunal Pandya", role: "All-rounder", country: "IND", isOverseas: false, category: "Capped All-rounder (AL2)", basePrice: 200, bat: 83, bowl: 86, fld: 86 },
        { name: "Nitish Rana", role: "All-rounder", country: "IND", isOverseas: false, category: "Capped All-rounder (AL2)", basePrice: 150, bat: 87, bowl: 60, fld: 86 },
        { name: "Washington Sundar", role: "All-rounder", country: "IND", isOverseas: false, category: "Capped All-rounder (AL2)", basePrice: 200, bat: 83, bowl: 88, fld: 87 },
        { name: "Shardul Thakur", role: "All-rounder", country: "IND", isOverseas: false, category: "Capped All-rounder (AL2)", basePrice: 200, bat: 78, bowl: 87, fld: 84 },
        { name: "Shivam Dube", role: "All-rounder", country: "IND", isOverseas: false, category: "Capped All-rounder (AL2)", basePrice: 150, bat: 91, bowl: 65, fld: 82 },
        { name: "Cameron Green", role: "All-rounder", country: "AUS", isOverseas: true, category: "Capped All-rounder (AL2)", basePrice: 200, bat: 90, bowl: 85, fld: 90 },
        { name: "Moeen Ali", role: "All-rounder", country: "ENG", isOverseas: true, category: "Capped All-rounder (AL2)", basePrice: 150, bat: 86, bowl: 85, fld: 87 },
        { name: "Rahul Tewatia", role: "All-rounder", country: "IND", isOverseas: false, category: "Capped All-rounder (AL2)", basePrice: 100, bat: 86, bowl: 75, fld: 83 },
        { name: "Jason Holder", role: "All-rounder", country: "WI", isOverseas: true, category: "Capped All-rounder (AL2)", basePrice: 150, bat: 80, bowl: 87, fld: 86 },
        { name: "Kyle Mayers", role: "All-rounder", country: "WI", isOverseas: true, category: "Capped All-rounder (AL2)", basePrice: 150, bat: 86, bowl: 78, fld: 84 },
        { name: "Romario Shepherd", role: "All-rounder", country: "WI", isOverseas: true, category: "Capped All-rounder (AL2)", basePrice: 150, bat: 85, bowl: 83, fld: 84 },
        { name: "Aaron Hardie", role: "All-rounder", country: "AUS", isOverseas: true, category: "Capped All-rounder (AL2)", basePrice: 125, bat: 84, bowl: 82, fld: 86 },

        // ========================================================
        // 6. CAPPED FAST BOWLERS - SET 1 & 2 (24 Players)
        // ========================================================
        { name: "Trent Boult", role: "Bowler", country: "NZ", isOverseas: true, category: "Capped Bowler (FA1)", basePrice: 200, bat: 20, bowl: 94, fld: 89 },
        { name: "Josh Hazlewood", role: "Bowler", country: "AUS", isOverseas: true, category: "Capped Bowler (FA1)", basePrice: 200, bat: 20, bowl: 94, fld: 87 },
        { name: "Pat Cummins", role: "Bowler", country: "AUS", isOverseas: true, category: "Capped Bowler (FA1)", basePrice: 200, bat: 78, bowl: 94, fld: 89 },
        { name: "Khaleel Ahmed", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Bowler (FA1)", basePrice: 200, bat: 15, bowl: 89, fld: 83 },
        { name: "Avesh Khan", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Bowler (FA1)", basePrice: 200, bat: 20, bowl: 89, fld: 84 },
        { name: "Prasidh Krishna", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Bowler (FA1)", basePrice: 200, bat: 15, bowl: 88, fld: 83 },
        { name: "T Natarajan", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Bowler (FA1)", basePrice: 200, bat: 15, bowl: 91, fld: 83 },
        { name: "Anrich Nortje", role: "Bowler", country: "SA", isOverseas: true, category: "Capped Bowler (FA1)", basePrice: 200, bat: 20, bowl: 92, fld: 85 },
        { name: "Deepak Chahar", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Bowler (FA2)", basePrice: 200, bat: 65, bowl: 89, fld: 85 },
        { name: "Bhuvneshwar Kumar", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Bowler (FA2)", basePrice: 200, bat: 35, bowl: 90, fld: 87 },
        { name: "Lockie Ferguson", role: "Bowler", country: "NZ", isOverseas: true, category: "Capped Bowler (FA2)", basePrice: 200, bat: 25, bowl: 90, fld: 85 },
        { name: "Gerald Coetzee", role: "Bowler", country: "SA", isOverseas: true, category: "Capped Bowler (FA2)", basePrice: 125, bat: 50, bowl: 90, fld: 86 },
        { name: "Mukesh Kumar", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Bowler (FA2)", basePrice: 200, bat: 15, bowl: 88, fld: 83 },
        { name: "Tushar Deshpande", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Bowler (FA2)", basePrice: 100, bat: 20, bowl: 87, fld: 83 },
        { name: "Spencer Johnson", role: "Bowler", country: "AUS", isOverseas: true, category: "Capped Bowler (FA2)", basePrice: 200, bat: 20, bowl: 89, fld: 84 },
        { name: "Nuwan Thushara", role: "Bowler", country: "SL", isOverseas: true, category: "Capped Bowler (FA2)", basePrice: 100, bat: 15, bowl: 89, fld: 83 },
        { name: "Nandre Burger", role: "Bowler", country: "SA", isOverseas: true, category: "Capped Bowler (FA2)", basePrice: 125, bat: 25, bowl: 89, fld: 85 },
        { name: "Akash Deep", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Bowler (FA2)", basePrice: 100, bat: 30, bowl: 88, fld: 84 },
        { name: "Alzarri Joseph", role: "Bowler", country: "WI", isOverseas: true, category: "Capped Bowler (FA2)", basePrice: 150, bat: 25, bowl: 88, fld: 84 },
        { name: "Sandeep Sharma", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Bowler (FA2)", basePrice: 100, bat: 15, bowl: 88, fld: 84 },
        { name: "Gus Atkinson", role: "Bowler", country: "ENG", isOverseas: true, category: "Capped Bowler (FA2)", basePrice: 200, bat: 45, bowl: 89, fld: 85 },
        { name: "Reece Topley", role: "Bowler", country: "ENG", isOverseas: true, category: "Capped Bowler (FA2)", basePrice: 75, bat: 15, bowl: 88, fld: 82 },
        { name: "Jason Behrendorff", role: "Bowler", country: "AUS", isOverseas: true, category: "Capped Bowler (FA2)", basePrice: 150, bat: 15, bowl: 88, fld: 83 },
        { name: "Jhye Richardson", role: "Bowler", country: "AUS", isOverseas: true, category: "Capped Bowler (FA2)", basePrice: 150, bat: 35, bowl: 88, fld: 84 },

        // ========================================================
        // 7. CAPPED SPINNERS - SET 1 & 2 (18 Players)
        // ========================================================
        { name: "Kuldeep Yadav", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Spinner (SP1)", basePrice: 200, bat: 25, bowl: 94, fld: 84 },
        { name: "Varun Chakravarthy", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Spinner (SP1)", basePrice: 200, bat: 15, bowl: 93, fld: 82 },
        { name: "Ravi Bishnoi", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Spinner (SP1)", basePrice: 200, bat: 20, bowl: 91, fld: 89 },
        { name: "Noor Ahmad", role: "Bowler", country: "AFG", isOverseas: true, category: "Capped Spinner (SP1)", basePrice: 200, bat: 20, bowl: 91, fld: 85 },
        { name: "Wanindu Hasaranga", role: "Bowler", country: "SL", isOverseas: true, category: "Capped Spinner (SP1)", basePrice: 200, bat: 75, bowl: 92, fld: 88 },
        { name: "Maheesh Theekshana", role: "Bowler", country: "SL", isOverseas: true, category: "Capped Spinner (SP1)", basePrice: 200, bat: 20, bowl: 89, fld: 81 },
        { name: "Adam Zampa", role: "Bowler", country: "AUS", isOverseas: true, category: "Capped Spinner (SP1)", basePrice: 200, bat: 20, bowl: 92, fld: 84 },
        { name: "Rahul Chahar", role: "Bowler", country: "IND", isOverseas: false, category: "Capped Spinner (SP1)", basePrice: 100, bat: 25, bowl: 87, fld: 86 },
        { name: "Allah Ghazanfar", role: "Bowler", country: "AFG", isOverseas: true, category: "Capped Spinner (SP2)", basePrice: 75, bat: 20, bowl: 88, fld: 84 },
        { name: "Akeal Hosein", role: "Bowler", country: "WI", isOverseas: true, category: "Capped Spinner (SP2)", basePrice: 150, bat: 65, bowl: 88, fld: 87 },
        { name: "Keshav Maharaj", role: "Bowler", country: "SA", isOverseas: true, category: "Capped Spinner (SP2)", basePrice: 75, bat: 50, bowl: 89, fld: 86 },
        { name: "Mujeeb Ur Rahman", role: "Bowler", country: "AFG", isOverseas: true, category: "Capped Spinner (SP2)", basePrice: 200, bat: 20, bowl: 89, fld: 83 },
        { name: "Adil Rashid", role: "Bowler", country: "ENG", isOverseas: true, category: "Capped Spinner (SP2)", basePrice: 200, bat: 30, bowl: 91, fld: 84 },
        { name: "Waqar Salamkheil", role: "Bowler", country: "AFG", isOverseas: true, category: "Capped Spinner (SP2)", basePrice: 75, bat: 15, bowl: 86, fld: 82 },
        { name: "Vijayakanth Viyaskanth", role: "Bowler", country: "SL", isOverseas: true, category: "Capped Spinner (SP2)", basePrice: 75, bat: 15, bowl: 86, fld: 82 },
        { name: "Mitchell Santner", role: "Bowler", country: "NZ", isOverseas: true, category: "Capped Spinner (SP2)", basePrice: 100, bat: 70, bowl: 89, fld: 92 },
        { name: "Tabraiz Shamsi", role: "Bowler", country: "SA", isOverseas: true, category: "Capped Spinner (SP2)", basePrice: 75, bat: 15, bowl: 88, fld: 81 },
        { name: "Todd Murphy", role: "Bowler", country: "AUS", isOverseas: true, category: "Capped Spinner (SP2)", basePrice: 75, bat: 20, bowl: 85, fld: 82 },

        // ========================================================
        // 8. UNCAPPED INDIAN STARS (60 Players)
        // ========================================================
        { name: "Abhishek Sharma", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 92, bowl: 70, fld: 88 },
        { name: "Nitish Kumar Reddy", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 89, bowl: 82, fld: 89 },
        { name: "Mayank Yadav", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 30, bat: 15, bowl: 92, fld: 84 },
        { name: "Harshit Rana", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 30, bat: 60, bowl: 89, fld: 85 },
        { name: "Ayush Badoni", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batsman", basePrice: 30, bat: 86, bowl: 50, fld: 87 },
        { name: "Nehal Wadhera", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batsman", basePrice: 30, bat: 87, bowl: 30, fld: 88 },
        { name: "Angkrish Raghuvanshi", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batsman", basePrice: 30, bat: 86, bowl: 20, fld: 88 },
        { name: "Sameer Rizvi", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batsman", basePrice: 30, bat: 84, bowl: 20, fld: 85 },
        { name: "Ashutosh Sharma", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 88, bowl: 20, fld: 85 },
        { name: "Shashank Singh", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batsman", basePrice: 30, bat: 88, bowl: 30, fld: 86 },
        { name: "Vaibhav Arora", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 30, bat: 20, bowl: 85, fld: 82 },
        { name: "Akash Madhwal", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 30, bat: 15, bowl: 85, fld: 82 },
        { name: "Kumar Kushagra", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Uncapped Keeper", basePrice: 30, bat: 83, bowl: 10, fld: 85 },
        { name: "Robin Minz", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Uncapped Keeper", basePrice: 30, bat: 84, bowl: 10, fld: 86 },
        { name: "Anuj Rawat", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Uncapped Keeper", basePrice: 30, bat: 83, bowl: 10, fld: 86 },
        { name: "Suyash Sharma", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 30, bat: 10, bowl: 85, fld: 82 },
        { name: "Yash Thakur", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 30, bat: 15, bowl: 85, fld: 82 },
        { name: "Simarjeet Singh", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 30, bat: 20, bowl: 86, fld: 83 },
        { name: "Rasikh Salam Dar", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 30, bat: 25, bowl: 86, fld: 83 },
        { name: "Riyan Parag", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 91, bowl: 75, fld: 90 },
        { name: "Prabhsimran Singh", role: "Wicket-keeper", country: "IND", isOverseas: false, category: "Uncapped Keeper", basePrice: 30, bat: 87, bowl: 10, fld: 86 },
        { name: "Harpreet Brar", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 75, bowl: 85, fld: 86 },
        { name: "Naman Dhir", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 85, bowl: 65, fld: 88 },
        { name: "Mahipal Lomror", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 50, bat: 84, bowl: 60, fld: 84 },
        { name: "Abdul Samad", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 85, bowl: 50, fld: 85 },
        { name: "Vijay Shankar", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 83, bowl: 70, fld: 85 },
        { name: "Yash Dhull", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batter", basePrice: 30, bat: 84, bowl: 20, fld: 86 },
        { name: "Abhinav Manohar", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batter", basePrice: 30, bat: 84, bowl: 20, fld: 85 },
        { name: "Karun Nair", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batter", basePrice: 30, bat: 83, bowl: 10, fld: 84 },
        { name: "Anmolpreet Singh", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batter", basePrice: 30, bat: 82, bowl: 10, fld: 83 },
        { name: "Atharva Taide", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batter", basePrice: 30, bat: 83, bowl: 20, fld: 84 },
        { name: "Mohit Sharma", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 50, bat: 25, bowl: 88, fld: 84 },
        { name: "Kartik Tyagi", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 40, bat: 20, bowl: 85, fld: 82 },
        { name: "Vijaykumar Vyshak", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 30, bat: 25, bowl: 85, fld: 83 },
        { name: "Piyush Chawla", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Spinner", basePrice: 50, bat: 45, bowl: 86, fld: 80 },
        { name: "Shreyas Gopal", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Spinner", basePrice: 30, bat: 55, bowl: 84, fld: 83 },
        { name: "Mayank Markande", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Spinner", basePrice: 30, bat: 20, bowl: 85, fld: 82 },
        { name: "Karn Sharma", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Spinner", basePrice: 50, bat: 45, bowl: 85, fld: 82 },
        { name: "Kumar Kartikeya", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Spinner", basePrice: 30, bat: 20, bowl: 84, fld: 82 },
        { name: "Manav Suthar", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Spinner", basePrice: 30, bat: 40, bowl: 84, fld: 83 },
        { name: "Arjun Tendulkar", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 30, bat: 35, bowl: 82, fld: 82 },
        { name: "Tanush Kotian", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 75, bowl: 83, fld: 84 },
        { name: "Kamlesh Nagarkoti", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 30, bat: 30, bowl: 84, fld: 88 },
        { name: "Shivam Mavi", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 50, bat: 40, bowl: 84, fld: 84 },
        { name: "Chetan Sakariya", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 50, bat: 20, bowl: 84, fld: 82 },
        { name: "Mukesh Choudhary", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 30, bat: 20, bowl: 85, fld: 83 },
        { name: "Anshul Kamboj", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 65, bowl: 87, fld: 84 },
        { name: "Swapnil Singh", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 78, bowl: 82, fld: 84 },
        { name: "Anukul Roy", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 75, bowl: 82, fld: 87 },
        { name: "Swastik Chhikara", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batter", basePrice: 30, bat: 83, bowl: 10, fld: 83 },
        { name: "Shaik Rasheed", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batter", basePrice: 30, bat: 82, bowl: 10, fld: 85 },
        { name: "Priyam Garg", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batter", basePrice: 30, bat: 82, bowl: 10, fld: 84 },
        { name: "Sachin Baby", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batter", basePrice: 30, bat: 82, bowl: 30, fld: 84 },
        { name: "Rishi Dhawan", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 76, bowl: 83, fld: 83 },
        { name: "Rajvardhan Hangargekar", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 65, bowl: 84, fld: 84 },
        { name: "Sanvir Singh", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 78, bowl: 75, fld: 84 },
        { name: "Suyash Prabhudessai", role: "All-rounder", country: "IND", isOverseas: false, category: "Uncapped All-rounder", basePrice: 30, bat: 81, bowl: 40, fld: 87 },
        { name: "Mohsin Khan", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 30, bat: 20, bowl: 87, fld: 83 },
        { name: "Yash Dayal", role: "Bowler", country: "IND", isOverseas: false, category: "Uncapped Bowler", basePrice: 30, bat: 15, bowl: 86, fld: 83 },
        { name: "Shahrukh Khan", role: "Batsman", country: "IND", isOverseas: false, category: "Uncapped Batsman", basePrice: 30, bat: 85, bowl: 40, fld: 84 },

        // ========================================================
        // 9. ACCELERATED INTERNATIONAL STARS (96 Players)
        // ========================================================
        { name: "Dewald Brevis", role: "Batsman", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 86, bowl: 30, fld: 86 },
        { name: "Sherfane Rutherford", role: "Batsman", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 150, bat: 87, bowl: 40, fld: 87 },
        { name: "Tymal Mills", role: "Bowler", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 150, bat: 15, bowl: 87, fld: 82 },
        { name: "Riley Meredith", role: "Bowler", country: "AUS", isOverseas: true, category: "Overseas Capped", basePrice: 150, bat: 15, bowl: 87, fld: 82 },
        { name: "Daniel Sams", role: "All-rounder", country: "AUS", isOverseas: true, category: "Overseas Capped", basePrice: 150, bat: 78, bowl: 86, fld: 86 },
        { name: "Michael Bracewell", role: "All-rounder", country: "NZ", isOverseas: true, category: "Overseas Capped", basePrice: 150, bat: 84, bowl: 82, fld: 86 },
        { name: "Jimmy Neesham", role: "All-rounder", country: "NZ", isOverseas: true, category: "Overseas Capped", basePrice: 150, bat: 85, bowl: 82, fld: 86 },
        { name: "Tim Southee", role: "Bowler", country: "NZ", isOverseas: true, category: "Overseas Capped", basePrice: 150, bat: 45, bowl: 88, fld: 85 },
        { name: "Kyle Jamieson", role: "Bowler", country: "NZ", isOverseas: true, category: "Overseas Capped", basePrice: 150, bat: 55, bowl: 87, fld: 84 },
        { name: "Dilshan Madushanka", role: "Bowler", country: "SL", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 15, bowl: 88, fld: 82 },
        { name: "Dushmantha Chameera", role: "Bowler", country: "SL", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 20, bowl: 88, fld: 82 },
        { name: "Dasun Shanaka", role: "All-rounder", country: "SL", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 82, bowl: 75, fld: 85 },
        { name: "Charith Asalanka", role: "Batsman", country: "SL", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 84, bowl: 50, fld: 85 },
        { name: "Pathum Nissanka", role: "Batsman", country: "SL", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 86, bowl: 10, fld: 84 },
        { name: "Kusal Mendis", role: "Wicket-keeper", country: "SL", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 86, bowl: 10, fld: 86 },
        { name: "Sikandar Raza", role: "All-rounder", country: "ZIM", isOverseas: true, category: "Overseas Capped", basePrice: 125, bat: 86, bowl: 84, fld: 86 },
        { name: "Blessing Muzarabani", role: "Bowler", country: "ZIM", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 15, bowl: 86, fld: 82 },
        { name: "Richard Ngarava", role: "Bowler", country: "ZIM", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 20, bowl: 86, fld: 82 },
        { name: "Shakib Al Hasan", role: "All-rounder", country: "BAN", isOverseas: true, category: "Overseas Capped", basePrice: 100, bat: 85, bowl: 88, fld: 86 },
        { name: "Mustafizur Rahman", role: "Bowler", country: "BAN", isOverseas: true, category: "Overseas Capped", basePrice: 200, bat: 15, bowl: 90, fld: 82 },
        { name: "Taskin Ahmed", role: "Bowler", country: "BAN", isOverseas: true, category: "Overseas Capped", basePrice: 100, bat: 20, bowl: 88, fld: 82 },
        { name: "Shoriful Islam", role: "Bowler", country: "BAN", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 15, bowl: 86, fld: 82 },
        { name: "Litton Das", role: "Wicket-keeper", country: "BAN", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 84, bowl: 10, fld: 86 },
        { name: "Najmul Hossain Shanto", role: "Batsman", country: "BAN", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 83, bowl: 20, fld: 84 },
        { name: "Towhid Hridoy", role: "Batsman", country: "BAN", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 84, bowl: 10, fld: 84 },
        { name: "Mohammad Nabi", role: "All-rounder", country: "AFG", isOverseas: true, category: "Overseas Capped", basePrice: 150, bat: 84, bowl: 84, fld: 86 },
        { name: "Fazalhaq Farooqi", role: "Bowler", country: "AFG", isOverseas: true, category: "Overseas Capped", basePrice: 100, bat: 15, bowl: 89, fld: 82 },
        { name: "Azmatullah Omarzai", role: "All-rounder", country: "AFG", isOverseas: true, category: "Overseas Capped", basePrice: 150, bat: 86, bowl: 85, fld: 86 },
        { name: "Gulbadin Naib", role: "All-rounder", country: "AFG", isOverseas: true, category: "Overseas Capped", basePrice: 100, bat: 83, bowl: 82, fld: 85 },
        { name: "Naveen-ul-Haq", role: "Bowler", country: "AFG", isOverseas: true, category: "Overseas Capped", basePrice: 150, bat: 20, bowl: 88, fld: 84 },
        { name: "Ibrahim Zadran", role: "Batsman", country: "AFG", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 86, bowl: 10, fld: 85 },
        { name: "Rahmat Shah", role: "Batsman", country: "AFG", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 82, bowl: 30, fld: 83 },
        { name: "Karim Janat", role: "All-rounder", country: "AFG", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 81, bowl: 79, fld: 84 },
        { name: "Qais Ahmad", role: "Bowler", country: "AFG", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 30, bowl: 85, fld: 82 },
        { name: "Rilee Rossouw", role: "Batsman", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 200, bat: 88, bowl: 10, fld: 86 },
        { name: "Wayne Parnell", role: "All-rounder", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 100, bat: 65, bowl: 85, fld: 83 },
        { name: "Lungi Ngidi", role: "Bowler", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 100, bat: 20, bowl: 88, fld: 82 },
        { name: "Sisanda Magala", role: "Bowler", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 30, bowl: 85, fld: 81 },
        { name: "George Linde", role: "All-rounder", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 78, bowl: 82, fld: 85 },
        { name: "Dwaine Pretorius", role: "All-rounder", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 78, bowl: 84, fld: 84 },
        { name: "Wiaan Mulder", role: "All-rounder", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 81, bowl: 81, fld: 84 },
        { name: "Corbin Bosch", role: "All-rounder", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 75, bowl: 82, fld: 83 },
        { name: "Andile Phehlukwayo", role: "All-rounder", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 78, bowl: 83, fld: 83 },
        { name: "Junior Dala", role: "Bowler", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 15, bowl: 84, fld: 81 },
        { name: "Beuran Hendricks", role: "Bowler", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 20, bowl: 84, fld: 82 },
        { name: "Lizaad Williams", role: "Bowler", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 15, bowl: 85, fld: 82 },
        { name: "Matthew Breetzke", role: "Batsman", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 83, bowl: 10, fld: 84 },
        { name: "Tony de Zorzi", role: "Batsman", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 83, bowl: 10, fld: 83 },
        { name: "Keegan Petersen", role: "Batsman", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 82, bowl: 10, fld: 85 },
        { name: "Zubayr Hamza", role: "Batsman", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 81, bowl: 10, fld: 83 },
        { name: "Senuran Muthusamy", role: "All-rounder", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 75, bowl: 83, fld: 83 },
        { name: "Kyle Verreynne", role: "Wicket-keeper", country: "SA", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 82, bowl: 10, fld: 86 },
        { name: "Oshane Thomas", role: "Bowler", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 15, bowl: 85, fld: 80 },
        { name: "Sheldon Cottrell", role: "Bowler", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 25, bowl: 85, fld: 83 },
        { name: "Fabian Allen", role: "All-rounder", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 80, bowl: 82, fld: 94 },
        { name: "Keemo Paul", role: "All-rounder", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 78, bowl: 83, fld: 84 },
        { name: "Hayden Walsh Jr.", role: "Bowler", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 45, bowl: 84, fld: 88 },
        { name: "Brandon King", role: "Batsman", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 85, bowl: 10, fld: 84 },
        { name: "Evin Lewis", role: "Batsman", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 100, bat: 86, bowl: 10, fld: 83 },
        { name: "Johnson Charles", role: "Wicket-keeper", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 84, bowl: 10, fld: 83 },
        { name: "Odean Smith", role: "All-rounder", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 81, bowl: 82, fld: 83 },
        { name: "Ramon Simmonds", role: "Bowler", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 15, bowl: 83, fld: 81 },
        { name: "Obed McCoy", role: "Bowler", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 20, bowl: 86, fld: 82 },
        { name: "Jayden Seales", role: "Bowler", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 20, bowl: 85, fld: 82 },
        { name: "Gudakesh Motie", role: "Bowler", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 55, bowl: 87, fld: 85 },
        { name: "Alick Athanaze", role: "Batsman", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 83, bowl: 40, fld: 84 },
        { name: "Kavem Hodge", role: "All-rounder", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 80, bowl: 78, fld: 84 },
        { name: "Dominic Drakes", role: "All-rounder", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 75, bowl: 83, fld: 84 },
        { name: "Matthew Forde", role: "All-rounder", country: "WI", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 76, bowl: 84, fld: 84 },
        { name: "Mark Wood", role: "Bowler", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 200, bat: 20, bowl: 94, fld: 85 },
        { name: "Chris Woakes", role: "All-rounder", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 200, bat: 78, bowl: 88, fld: 88 },
        { name: "Olly Stone", role: "Bowler", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 15, bowl: 86, fld: 82 },
        { name: "Luke Wood", role: "Bowler", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 25, bowl: 86, fld: 82 },
        { name: "Brydon Carse", role: "All-rounder", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 100, bat: 74, bowl: 86, fld: 84 },
        { name: "Will Jacks", role: "All-rounder", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 200, bat: 91, bowl: 72, fld: 90 },
        { name: "Tom Banton", role: "Wicket-keeper", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 100, bat: 85, bowl: 10, fld: 86 },
        { name: "Sam Billings", role: "Wicket-keeper", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 100, bat: 85, bowl: 10, fld: 88 },
        { name: "Ben Duckett", role: "Batsman", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 150, bat: 88, bowl: 10, fld: 85 },
        { name: "Zak Crawley", role: "Batsman", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 100, bat: 86, bowl: 10, fld: 86 },
        { name: "Dan Lawrence", role: "All-rounder", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 83, bowl: 74, fld: 86 },
        { name: "Jordan Cox", role: "Wicket-keeper", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 83, bowl: 10, fld: 87 },
        { name: "Jamie Overton", role: "All-rounder", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 100, bat: 82, bowl: 84, fld: 86 },
        { name: "Richard Gleeson", role: "Bowler", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 15, bowl: 86, fld: 82 },
        { name: "David Willey", role: "All-rounder", country: "ENG", isOverseas: true, category: "Overseas Capped", basePrice: 150, bat: 76, bowl: 86, fld: 86 },
        { name: "Ben Dwarshuis", role: "Bowler", country: "AUS", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 25, bowl: 85, fld: 82 },
        { name: "Nathan Ellis", role: "Bowler", country: "AUS", isOverseas: true, category: "Overseas Capped", basePrice: 125, bat: 20, bowl: 89, fld: 86 },
        { name: "Sean Abbott", role: "All-rounder", country: "AUS", isOverseas: true, category: "Overseas Capped", basePrice: 150, bat: 75, bowl: 86, fld: 86 },
        { name: "Moises Henriques", role: "All-rounder", country: "AUS", isOverseas: true, category: "Overseas Capped", basePrice: 100, bat: 82, bowl: 80, fld: 86 },
        { name: "Ben McDermott", role: "Wicket-keeper", country: "AUS", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 84, bowl: 10, fld: 85 },
        { name: "D'Arcy Short", role: "All-rounder", country: "AUS", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 84, bowl: 70, fld: 84 },
        { name: "Ashton Agar", role: "All-rounder", country: "AUS", isOverseas: true, category: "Overseas Capped", basePrice: 100, bat: 72, bowl: 86, fld: 88 },
        { name: "Andrew Tye", role: "Bowler", country: "AUS", isOverseas: true, category: "Overseas Capped", basePrice: 100, bat: 30, bowl: 86, fld: 82 },
        { name: "Billy Stanlake", role: "Bowler", country: "AUS", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 15, bowl: 85, fld: 80 },
        { name: "Kane Richardson", role: "Bowler", country: "AUS", isOverseas: true, category: "Overseas Capped", basePrice: 150, bat: 20, bowl: 86, fld: 82 },
        { name: "Josh Philippe", role: "Wicket-keeper", country: "AUS", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 84, bowl: 10, fld: 86 },
        { name: "Chris Green", role: "All-rounder", country: "AUS", isOverseas: true, category: "Overseas Capped", basePrice: 75, bat: 74, bowl: 83, fld: 88 }
    ];

    rawRoster.forEach(player => {
        pool.push({
            id: idCounter++,
            ...player,
            rating: calculateDepartmentRating(player.bat, player.bowl, player.fld)
        });
    });

    return pool; // Exactly 264 Real Players
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
                pts = pts * 2.0; // 2x Multiplier
                captainName = player.name;
            } else if (team.viceCaptainId === player.id) {
                pts = pts * 1.5; // 1.5x Multiplier
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
