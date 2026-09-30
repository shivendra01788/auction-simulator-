const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const VERSION = '3.0.0';   // pause + skip fix + hammer feedback + hologram

const app = express();
const server = http.createServer(app);

// Default transports (websocket + polling fallback). Longer timeouts survive flaky mobile networks.
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 25000,
    pingTimeout: 60000
});

io.engine.on('connection_error', (err) => {
    console.log('[conn error]', err.code, err.message);
});

// Serve the NEWEST index.html, whether it sits in /public or right next to server.js.
// (Prevents a stale copy in /public from hiding an updated one.)
function pickIndexFile() {
    const candidates = [path.join(__dirname, 'public', 'index.html'), path.join(__dirname, 'index.html')]
        .filter(p => fs.existsSync(p));
    candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return candidates[0] || null;
}
app.get(['/', '/index.html'], (req, res) => {
    const file = pickIndexFile();
    if (!file) return res.status(404).send('index.html not found (put it next to server.js or in /public).');
    res.set('Cache-Control', 'no-store');
    res.sendFile(file);
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('/ping', (req, res) => res.status(200).send('pong'));

// ---------- Tournament config (in Crores) ----------
const INITIAL_PURSE = 100.0;
const SQUAD_MAX = 25;
const SQUAD_MIN = 11;
const MAX_OVERSEAS_SQUAD = 8;
const MAX_OVERSEAS_XI = 4;
const LOWEST_BASE_PRICE = 0.20;
const TEAM_CODES = ["CSK", "MI", "RCB", "KKR", "SRH", "DC", "PBKS", "RR", "GT", "LSG"];

const rooms = {};

function roundCr(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

function getNextBidIncrement(currentBid) {
    if (currentBid < 1.0) return 0.05;
    if (currentBid < 5.0) return 0.25;
    return 0.50;
}

// Department rating: round((max(bat, bowl) + fld) / 2)
function calculateDepartmentRating(bat, bowl, fld) {
    return Math.round((Math.max(bat, bowl) + fld) / 2);
}

// ---------- Player pool ----------
const ROLE_NAMES = { B: "Batsman", W: "Wicket-keeper", A: "All-rounder", O: "Bowler", S: "Bowler" };
const UNCAPPED_CAT = { B: "Uncapped Batter", W: "Uncapped Keeper", A: "Uncapped All-rounder", O: "Uncapped Bowler", S: "Uncapped Spinner" };

const ROSTER_GROUPS = [
    { cat: "Super Marquee (M1)", rows: [
        ["Virat Kohli","B","IND",2.0,99,30,95], ["Rohit Sharma","B","IND",2.0,97,25,89],
        ["MS Dhoni","W","IND",2.0,92,10,98], ["Jasprit Bumrah","O","IND",2.0,25,99,91],
        ["Hardik Pandya","A","IND",2.0,92,90,94], ["Suryakumar Yadav","B","IND",2.0,98,20,94],
        ["Ravindra Jadeja","A","IND",2.0,89,93,99], ["Rishabh Pant","W","IND",2.0,96,10,92],
        ["Jos Buttler","W","ENG",2.0,96,10,90], ["Mitchell Starc","O","AUS",2.0,55,95,87],
        ["Shreyas Iyer","B","IND",2.0,94,20,88], ["Heinrich Klaasen","W","SA",2.0,96,15,90]
    ]},
    { cat: "Marquee M2", rows: [
        ["Travis Head","B","AUS",2.0,95,55,89], ["Rashid Khan","O","AFG",2.0,76,98,92],
        ["Shubman Gill","B","IND",2.0,94,15,88], ["KL Rahul","W","IND",2.0,94,10,91],
        ["Arshdeep Singh","O","IND",2.0,20,93,87], ["Yuzvendra Chahal","O","IND",2.0,15,94,82],
        ["Kagiso Rabada","O","SA",2.0,35,94,88], ["Mohammed Shami","O","IND",2.0,25,94,84],
        ["Mohammed Siraj","O","IND",2.0,20,92,85], ["Liam Livingstone","A","ENG",2.0,90,80,90],
        ["David Miller","B","SA",1.5,91,10,91], ["Andre Russell","A","WI",2.0,94,88,88]
    ]},
    { cat: "Capped Batter (BA1)", rows: [
        ["Yashasvi Jaiswal","B","IND",2.0,95,20,89], ["Ruturaj Gaikwad","B","IND",2.0,93,10,90],
        ["Rinku Singh","B","IND",1.5,92,20,94], ["Harry Brook","B","ENG",2.0,90,20,86],
        ["Devon Conway","B","NZ",2.0,91,10,88], ["Jake Fraser-McGurk","B","AUS",2.0,92,20,88],
        ["Aiden Markram","B","SA",2.0,89,65,92], ["David Warner","B","AUS",2.0,91,15,88],
        ["Devdutt Padikkal","B","IND",2.0,85,10,85], ["Rahul Tripathi","B","IND",0.75,86,10,88]
    ]},
    { cat: "Capped Batter (BA2)", rows: [
        ["Faf du Plessis","B","SA",2.0,91,10,94], ["Glenn Phillips","B","NZ",2.0,88,65,96],
        ["Rovman Powell","B","WI",1.5,87,50,87], ["Ajinkya Rahane","B","IND",1.5,85,10,89],
        ["Prithvi Shaw","B","IND",0.75,85,10,81], ["Kane Williamson","B","NZ",2.0,89,15,88],
        ["Mayank Agarwal","B","IND",1.0,84,10,84], ["Steve Smith","B","AUS",2.0,90,30,90],
        ["Rajat Patidar","B","IND",1.0,89,10,86], ["Tilak Varma","B","IND",1.5,91,40,88],
        ["Manish Pandey","B","IND",0.75,83,10,87], ["Shimron Hetmyer","B","WI",1.5,89,10,86],
        ["Tim David","B","AUS",2.0,89,20,86], ["Finn Allen","B","NZ",2.0,89,10,86]
    ]},
    { cat: "Capped Keeper (WK1)", rows: [
        ["Phil Salt","W","ENG",2.0,93,10,90], ["Ishan Kishan","W","IND",2.0,91,10,89],
        ["Quinton de Kock","W","SA",2.0,92,10,91], ["Jonny Bairstow","W","ENG",2.0,91,10,88],
        ["Sanju Samson","W","IND",2.0,92,10,89], ["Nicholas Pooran","W","WI",2.0,94,10,90],
        ["Jitesh Sharma","W","IND",1.0,87,10,89], ["Rahmanullah Gurbaz","W","AFG",2.0,87,10,87]
    ]},
    { cat: "Capped Keeper (WK2)", rows: [
        ["Dhruv Jurel","W","IND",1.5,88,10,90], ["Alex Carey","W","AUS",1.0,85,10,89],
        ["Shai Hope","W","WI",1.25,86,10,87], ["Ryan Rickelton","W","SA",1.0,87,10,87],
        ["KS Bharat","W","IND",0.75,80,10,88], ["Wriddhiman Saha","W","IND",0.75,83,10,92],
        ["Matthew Wade","W","AUS",1.0,85,10,87], ["Josh Inglis","W","AUS",2.0,89,10,89]
    ]},
    { cat: "Capped All-rounder (AL1)", rows: [
        ["Glenn Maxwell","A","AUS",2.0,92,81,94], ["Marcus Stoinis","A","AUS",2.0,90,83,88],
        ["Axar Patel","A","IND",2.0,86,91,90], ["Sunil Narine","A","WI",2.0,89,94,87],
        ["Venkatesh Iyer","A","IND",2.0,89,65,86], ["Ravichandran Ashwin","A","IND",2.0,75,92,82],
        ["Mitchell Marsh","A","AUS",2.0,90,82,87], ["Harshal Patel","A","IND",2.0,62,91,85],
        ["Rachin Ravindra","A","NZ",1.5,89,78,88]
    ]},
    { cat: "Capped All-rounder (AL2)", rows: [
        ["Sam Curran","A","ENG",2.0,86,88,88], ["Marco Jansen","A","SA",1.25,78,90,87],
        ["Daryl Mitchell","A","NZ",2.0,88,70,89], ["Krunal Pandya","A","IND",2.0,83,86,86],
        ["Nitish Rana","A","IND",1.5,87,60,86], ["Washington Sundar","A","IND",2.0,83,88,87],
        ["Shardul Thakur","A","IND",2.0,78,87,84], ["Shivam Dube","A","IND",1.5,91,65,82],
        ["Cameron Green","A","AUS",2.0,90,85,90], ["Moeen Ali","A","ENG",1.5,86,85,87],
        ["Rahul Tewatia","A","IND",1.0,86,75,83], ["Jason Holder","A","WI",1.5,80,87,86],
        ["Kyle Mayers","A","WI",1.5,86,78,84], ["Romario Shepherd","A","WI",1.5,85,83,84],
        ["Aaron Hardie","A","AUS",1.25,84,82,86]
    ]},
    { cat: "Capped Bowler (FA1)", rows: [
        ["Trent Boult","O","NZ",2.0,20,94,89], ["Josh Hazlewood","O","AUS",2.0,20,94,87],
        ["Pat Cummins","O","AUS",2.0,78,94,89], ["Khaleel Ahmed","O","IND",2.0,15,89,83],
        ["Avesh Khan","O","IND",2.0,20,89,84], ["Prasidh Krishna","O","IND",2.0,15,88,83],
        ["T Natarajan","O","IND",2.0,15,91,83], ["Anrich Nortje","O","SA",2.0,20,92,85]
    ]},
    { cat: "Capped Bowler (FA2)", rows: [
        ["Deepak Chahar","O","IND",2.0,65,89,85], ["Bhuvneshwar Kumar","O","IND",2.0,35,90,87],
        ["Lockie Ferguson","O","NZ",2.0,25,90,85], ["Gerald Coetzee","O","SA",1.25,50,90,86],
        ["Mukesh Kumar","O","IND",2.0,15,88,83], ["Tushar Deshpande","O","IND",1.0,20,87,83],
        ["Spencer Johnson","O","AUS",2.0,20,89,84], ["Nuwan Thushara","O","SL",1.0,15,89,83],
        ["Nandre Burger","O","SA",1.25,25,89,85], ["Akash Deep","O","IND",1.0,30,88,84],
        ["Alzarri Joseph","O","WI",1.5,25,88,84], ["Sandeep Sharma","O","IND",1.0,15,88,84],
        ["Gus Atkinson","O","ENG",2.0,45,89,85], ["Reece Topley","O","ENG",0.75,15,88,82],
        ["Jason Behrendorff","O","AUS",1.5,15,88,83], ["Jhye Richardson","O","AUS",1.5,35,88,84]
    ]},
    { cat: "Capped Spinner (SP1)", rows: [
        ["Kuldeep Yadav","O","IND",2.0,25,94,84], ["Varun Chakravarthy","O","IND",2.0,15,93,82],
        ["Ravi Bishnoi","O","IND",2.0,20,91,89], ["Noor Ahmad","O","AFG",2.0,20,91,85],
        ["Wanindu Hasaranga","O","SL",2.0,75,92,88], ["Maheesh Theekshana","O","SL",2.0,20,89,81],
        ["Adam Zampa","O","AUS",2.0,20,92,84], ["Rahul Chahar","O","IND",1.0,25,87,86]
    ]},
    { cat: "Capped Spinner (SP2)", rows: [
        ["Allah Ghazanfar","O","AFG",0.75,20,88,84], ["Akeal Hosein","O","WI",1.5,65,88,87],
        ["Keshav Maharaj","O","SA",0.75,50,89,86], ["Mujeeb Ur Rahman","O","AFG",2.0,20,89,83],
        ["Adil Rashid","O","ENG",2.0,30,91,84], ["Waqar Salamkheil","O","AFG",0.75,15,86,82],
        ["Vijayakanth Viyaskanth","O","SL",0.75,15,86,82], ["Mitchell Santner","O","NZ",1.0,70,89,92],
        ["Tabraiz Shamsi","O","SA",0.75,15,88,81], ["Todd Murphy","O","AUS",0.75,20,85,82]
    ]},
    // Uncapped Indians: category derived from role code
    { cat: null, rows: [
        ["Abhishek Sharma","A","IND",0.30,92,70,88], ["Nitish Kumar Reddy","A","IND",0.30,89,82,89],
        ["Mayank Yadav","O","IND",0.30,15,92,84], ["Harshit Rana","O","IND",0.30,60,89,85],
        ["Ayush Badoni","B","IND",0.30,86,50,87], ["Nehal Wadhera","B","IND",0.30,87,30,88],
        ["Angkrish Raghuvanshi","B","IND",0.30,86,20,88], ["Sameer Rizvi","B","IND",0.30,84,20,85],
        ["Ashutosh Sharma","A","IND",0.30,88,20,85], ["Shashank Singh","B","IND",0.30,88,30,86],
        ["Vaibhav Arora","O","IND",0.30,20,85,82], ["Akash Madhwal","O","IND",0.30,15,85,82],
        ["Kumar Kushagra","W","IND",0.30,83,10,85], ["Robin Minz","W","IND",0.30,84,10,86],
        ["Anuj Rawat","W","IND",0.30,83,10,86], ["Suyash Sharma","O","IND",0.30,10,85,82],
        ["Yash Thakur","O","IND",0.30,15,85,82], ["Simarjeet Singh","O","IND",0.30,20,86,83],
        ["Rasikh Salam Dar","O","IND",0.30,25,86,83], ["Riyan Parag","A","IND",0.30,91,75,90],
        ["Prabhsimran Singh","W","IND",0.30,87,10,86], ["Harpreet Brar","A","IND",0.30,75,85,86],
        ["Naman Dhir","A","IND",0.30,85,65,88], ["Mahipal Lomror","A","IND",0.50,84,60,84],
        ["Abdul Samad","A","IND",0.30,85,50,85], ["Vijay Shankar","A","IND",0.30,83,70,85],
        ["Yash Dhull","B","IND",0.30,84,20,86], ["Abhinav Manohar","B","IND",0.30,84,20,85],
        ["Karun Nair","B","IND",0.30,83,10,84], ["Anmolpreet Singh","B","IND",0.30,82,10,83],
        ["Atharva Taide","B","IND",0.30,83,20,84], ["Mohit Sharma","O","IND",0.50,25,88,84],
        ["Kartik Tyagi","O","IND",0.40,20,85,82], ["Vijaykumar Vyshak","O","IND",0.30,25,85,83],
        ["Piyush Chawla","S","IND",0.50,45,86,80], ["Shreyas Gopal","S","IND",0.30,55,84,83],
        ["Mayank Markande","S","IND",0.30,20,85,82], ["Karn Sharma","S","IND",0.50,45,85,82],
        ["Kumar Kartikeya","S","IND",0.30,20,84,82], ["Manav Suthar","S","IND",0.30,40,84,83],
        ["Arjun Tendulkar","O","IND",0.30,35,82,82], ["Tanush Kotian","A","IND",0.30,75,83,84],
        ["Kamlesh Nagarkoti","O","IND",0.30,30,84,88], ["Shivam Mavi","O","IND",0.50,40,84,84],
        ["Chetan Sakariya","O","IND",0.50,20,84,82], ["Mukesh Choudhary","O","IND",0.30,20,85,83],
        ["Anshul Kamboj","A","IND",0.30,65,87,84], ["Swapnil Singh","A","IND",0.30,78,82,84],
        ["Anukul Roy","A","IND",0.30,75,82,87], ["Swastik Chhikara","B","IND",0.30,83,10,83],
        ["Shaik Rasheed","B","IND",0.30,82,10,85], ["Priyam Garg","B","IND",0.30,82,10,84],
        ["Sachin Baby","B","IND",0.30,82,30,84], ["Rishi Dhawan","A","IND",0.30,76,83,83],
        ["Rajvardhan Hangargekar","A","IND",0.30,65,84,84], ["Sanvir Singh","A","IND",0.30,78,75,84],
        ["Suyash Prabhudessai","A","IND",0.30,81,40,87], ["Mohsin Khan","O","IND",0.30,20,87,83],
        ["Yash Dayal","O","IND",0.30,15,86,83], ["Shahrukh Khan","B","IND",0.30,85,40,84],
        ["Luvnith Sisodia","W","IND",0.30,80,10,83], ["Vishnu Vinod","W","IND",0.30,82,10,85],
        ["Upendra Yadav","W","IND",0.30,80,10,84], ["Karan Sharma","A","IND",0.30,78,75,83],
        ["Manan Vohra","B","IND",0.30,82,10,83], ["Himmat Singh","B","IND",0.30,81,10,83],
        ["Ricky Bhui","B","IND",0.30,82,10,84], ["Darshan Nalkande","A","IND",0.30,60,83,82],
        ["Mohd. Arshad Khan","A","IND",0.30,72,84,83], ["Gurnoor Singh Brar","O","IND",0.30,20,84,82]
    ]},
    { cat: "Overseas Capped", rows: [
        ["Dewald Brevis","B","SA",0.75,86,30,86], ["Sherfane Rutherford","B","WI",1.5,87,40,87],
        ["Tymal Mills","O","ENG",1.5,15,87,82], ["Riley Meredith","O","AUS",1.5,15,87,82],
        ["Daniel Sams","A","AUS",1.5,78,86,86], ["Michael Bracewell","A","NZ",1.5,84,82,86],
        ["Jimmy Neesham","A","NZ",1.5,85,82,86], ["Tim Southee","O","NZ",1.5,45,88,85],
        ["Kyle Jamieson","O","NZ",1.5,55,87,84], ["Dilshan Madushanka","O","SL",0.75,15,88,82],
        ["Dushmantha Chameera","O","SL",0.75,20,88,82], ["Dasun Shanaka","A","SL",0.75,82,75,85],
        ["Charith Asalanka","B","SL",0.75,84,50,85], ["Pathum Nissanka","B","SL",0.75,86,10,84],
        ["Kusal Mendis","W","SL",0.75,86,10,86], ["Sikandar Raza","A","ZIM",1.25,86,84,86],
        ["Blessing Muzarabani","O","ZIM",0.75,15,86,82], ["Richard Ngarava","O","ZIM",0.75,20,86,82],
        ["Shakib Al Hasan","A","BAN",1.0,85,88,86], ["Mustafizur Rahman","O","BAN",2.0,15,90,82],
        ["Taskin Ahmed","O","BAN",1.0,20,88,82], ["Shoriful Islam","O","BAN",0.75,15,86,82],
        ["Litton Das","W","BAN",0.75,84,10,86], ["Najmul Hossain Shanto","B","BAN",0.75,83,20,84],
        ["Towhid Hridoy","B","BAN",0.75,84,10,84], ["Mohammad Nabi","A","AFG",1.5,84,84,86],
        ["Fazalhaq Farooqi","O","AFG",1.0,15,89,82], ["Azmatullah Omarzai","A","AFG",1.5,86,85,86],
        ["Gulbadin Naib","A","AFG",1.0,83,82,85], ["Naveen-ul-Haq","O","AFG",1.5,20,88,84],
        ["Ibrahim Zadran","B","AFG",0.75,86,10,85], ["Rahmat Shah","B","AFG",0.75,82,30,83],
        ["Karim Janat","A","AFG",0.75,81,79,84], ["Qais Ahmad","O","AFG",0.75,30,85,82],
        ["Rilee Rossouw","B","SA",2.0,88,10,86], ["Wayne Parnell","A","SA",1.0,65,85,83],
        ["Lungi Ngidi","O","SA",1.0,20,88,82], ["Sisanda Magala","O","SA",0.75,30,85,81],
        ["George Linde","A","SA",0.75,78,82,85], ["Dwaine Pretorius","A","SA",0.75,78,84,84],
        ["Wiaan Mulder","A","SA",0.75,81,81,84], ["Corbin Bosch","A","SA",0.75,75,82,83],
        ["Andile Phehlukwayo","A","SA",0.75,78,83,83], ["Junior Dala","O","SA",0.75,15,84,81],
        ["Beuran Hendricks","O","SA",0.75,20,84,82], ["Lizaad Williams","O","SA",0.75,15,85,82],
        ["Matthew Breetzke","B","SA",0.75,83,10,84], ["Tony de Zorzi","B","SA",0.75,83,10,83],
        ["Keegan Petersen","B","SA",0.75,82,10,85], ["Zubayr Hamza","B","SA",0.75,81,10,83],
        ["Senuran Muthusamy","A","SA",0.75,75,83,83], ["Kyle Verreynne","W","SA",0.75,82,10,86],
        ["Oshane Thomas","O","WI",0.75,15,85,80], ["Sheldon Cottrell","O","WI",0.75,25,85,83],
        ["Fabian Allen","A","WI",0.75,80,82,94], ["Keemo Paul","A","WI",0.75,78,83,84],
        ["Hayden Walsh Jr.","O","WI",0.75,45,84,88], ["Brandon King","B","WI",0.75,85,10,84],
        ["Evin Lewis","B","WI",1.0,86,10,83], ["Johnson Charles","W","WI",0.75,84,10,83],
        ["Odean Smith","A","WI",0.75,81,82,83], ["Ramon Simmonds","O","WI",0.75,15,83,81],
        ["Obed McCoy","O","WI",0.75,20,86,82], ["Jayden Seales","O","WI",0.75,20,85,82],
        ["Gudakesh Motie","O","WI",0.75,55,87,85], ["Alick Athanaze","B","WI",0.75,83,40,84],
        ["Kavem Hodge","A","WI",0.75,80,78,84], ["Dominic Drakes","A","WI",0.75,75,83,84],
        ["Matthew Forde","A","WI",0.75,76,84,84], ["Mark Wood","O","ENG",2.0,20,94,85],
        ["Chris Woakes","A","ENG",2.0,78,88,88], ["Olly Stone","O","ENG",0.75,15,86,82],
        ["Luke Wood","O","ENG",0.75,25,86,82], ["Brydon Carse","A","ENG",1.0,74,86,84],
        ["Will Jacks","A","ENG",2.0,91,72,90], ["Tom Banton","W","ENG",1.0,85,10,86],
        ["Sam Billings","W","ENG",1.0,85,10,88], ["Ben Duckett","B","ENG",1.5,88,10,85],
        ["Zak Crawley","B","ENG",1.0,86,10,86], ["Dan Lawrence","A","ENG",0.75,83,74,86],
        ["Jordan Cox","W","ENG",0.75,83,10,87], ["Jamie Overton","A","ENG",1.0,82,84,86],
        ["Richard Gleeson","O","ENG",0.75,15,86,82], ["David Willey","A","ENG",1.5,76,86,86],
        ["Ben Dwarshuis","O","AUS",0.75,25,85,82], ["Nathan Ellis","O","AUS",1.25,20,89,86],
        ["Sean Abbott","A","AUS",1.5,75,86,86], ["Moises Henriques","A","AUS",1.0,82,80,86],
        ["Ben McDermott","W","AUS",0.75,84,10,85], ["D'Arcy Short","A","AUS",0.75,84,70,84],
        ["Ashton Agar","A","AUS",1.0,72,86,88], ["Andrew Tye","O","AUS",1.0,30,86,82],
        ["Billy Stanlake","O","AUS",0.75,15,85,80], ["Kane Richardson","O","AUS",1.5,20,86,82],
        ["Josh Philippe","W","AUS",0.75,84,10,86], ["Chris Green","A","AUS",0.75,74,83,88],
        ["Saurabh Netravalkar","O","USA",0.50,30,86,84]
    ]}
];

function generatePlayerPool() {
    const pool = [];
    const seen = new Set();
    let id = 1;

    ROSTER_GROUPS.forEach(group => {
        group.rows.forEach(([name, code, country, basePrice, bat, bowl, fld]) => {
            if (seen.has(name)) return;
            seen.add(name);
            pool.push({
                id: id++,
                name,
                role: ROLE_NAMES[code],
                country,
                isOverseas: country !== "IND",
                category: group.cat || UNCAPPED_CAT[code],
                basePrice: roundCr(basePrice),
                bat, bowl, fld,
                rating: calculateDepartmentRating(bat, bowl, fld)
            });
        });
    });

    return pool;
}

// ---------- Room helpers ----------
function createRoom(roomCode, hostSocketId, hostUserId) {
    const playerQueue = generatePlayerPool();
    rooms[roomCode] = {
        code: roomCode,
        host: hostSocketId,
        hostUserId,
        teams: {},
        playerQueue,
        unsoldPool: [],
        currentPlayerIndex: 0,
        timerInterval: null,
        phase: "LOBBY",
        isStarted: false,
        skippedBy: new Set(),
        paused: false,
        pendingAdvance: false,
        auction: {
            player: playerQueue[0],
            highestBid: playerQueue[0].basePrice,
            highestBidder: "No Bids",
            timer: 12,
            active: false
        }
    };
}

// Starts a FRESH 12s countdown for the player now on the block
function startRoomTimer(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    room.auction.timer = 12;
    room.auction.active = true;
    room.skippedBy.clear();

    io.to(roomCode).emit('timerUpdate', room.auction.timer);
    io.to(roomCode).emit('skipUpdate', { skipped: 0, total: Object.keys(room.teams).length });
    runRoomTimer(roomCode);
}

// (Re)starts the 1-second ticking WITHOUT resetting the remaining time (used by resume)
function runRoomTimer(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    clearInterval(room.timerInterval);
    if (room.paused) return;

    room.timerInterval = setInterval(() => {
        if (room.paused) return;
        if (room.auction.timer > 0) {
            room.auction.timer--;
            io.to(roomCode).emit('timerUpdate', room.auction.timer);
        } else {
            clearInterval(room.timerInterval);
            handleAuctionEnd(roomCode);
        }
    }, 1000);
}

function advanceToNextPlayer(roomCode) {
    const room = rooms[roomCode];
    // Guard if phase changed (e.g. host ended auction during the resolution delay)
    if (!room || room.phase !== "AUCTION") return;

    room.pendingAdvance = false;
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
}

function handleAuctionEnd(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    if (!room.auction.active) return;
    room.auction.active = false;
    clearInterval(room.timerInterval);

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
        if (room.phase !== "AUCTION") return;
        // If the host paused during the result screen, wait here until they resume
        room.pendingAdvance = true;
        if (!room.paused) advanceToNextPlayer(roomCode);
    }, 2500);
}

// Ends the current player early when every team has either skipped or is already the leader.
function checkAllPassed(roomCode) {
    const room = rooms[roomCode];
    if (!room || !room.auction.active || room.paused) return;

    const keys = Object.keys(room.teams);
    if (keys.length === 0) return;

    const leader = room.auction.highestBidder;
    const everyoneDone = keys.every(k => k === leader || room.skippedBy.has(k));
    if (everyoneDone) handleAuctionEnd(roomCode);
}

// Returns the room only if this socket is the host; otherwise tells the user why.
function requireHost(socket) {
    const room = rooms[socket.roomCode];
    if (!room) { socket.emit('errorMsg', "Room not found. Refresh the page to reconnect."); return null; }
    if (socket.id !== room.host) {
        socket.emit('errorMsg', "This device isn't linked as the host any more (another tab/device took over). Refresh this page to regain host control.");
        return null;
    }
    return room;
}

function calculateFinalStandings(room) {
    const leaderboard = [];

    for (const key in room.teams) {
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
                pts *= 2.0;
                captainName = player.name;
            } else if (team.viceCaptainId === player.id) {
                pts *= 1.5;
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

// ---------- Sockets ----------
io.on('connection', (socket) => {
    console.log(`[+] ${socket.id} (${socket.conn.transport.name})`);
    socket.emit('serverInfo', { version: VERSION });

    socket.on('disconnect', (reason) => {
        console.log(`[-] ${socket.id} (${reason})`);
    });

    socket.on('rejoinSession', ({ roomCode, userId, username, asHost }) => {
        const room = rooms[roomCode];
        if (!room) return socket.emit('sessionExpired', "Room session expired.");

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.userId = userId;
        if (username) socket.username = username;

        // Host reconnect: restore control on the new socket id
        // (only when this tab says it WAS the host - otherwise a player tab opened in the
        //  same browser would steal host control from the real host)
        if (asHost && room.hostUserId === userId) {
            room.host = socket.id;
            socket.isHost = true;
        }

        // Player reconnect: re-attach to their franchise (never for the host socket)
        for (const key in room.teams) {
            if (!socket.isHost && room.teams[key].userId === userId) {
                room.teams[key].claimedBy = socket.id;
                socket.claimedTeamKey = key;
                socket.username = room.teams[key].claimedByName;
                break;
            }
        }

        socket.emit('rejoinedSuccess', {
            roomCode,
            phase: room.phase,
            isStarted: room.isStarted,
            isHost: room.host === socket.id,
            auction: room.auction,
            teams: room.teams,
            teamCodes: TEAM_CODES,
            paused: room.paused,
            iSkipped: !!socket.claimedTeamKey && room.skippedBy.has(socket.claimedTeamKey),
            myTeamKey: socket.claimedTeamKey || null,
            currentIndex: room.currentPlayerIndex + 1,
            totalPlayers: room.playerQueue.length
        });

        if (room.phase === "RESULT") {
            socket.emit('finalResultsAnnounced', {
                leaderboard: calculateFinalStandings(room),
                fullTeams: room.teams,
                roomCode
            });
        }
    });

    socket.on('createRoom', ({ username, userId }) => {
        const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        createRoom(roomCode, socket.id, userId);
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
        if (!TEAM_CODES.includes(franchiseBase)) return socket.emit('errorMsg', "Unknown franchise.");

        for (const key in room.teams) {
            if (room.teams[key].userId === socket.userId) {
                room.teams[key].claimedBy = socket.id;
                socket.claimedTeamKey = key;
                return socket.emit('teamConfirmed', {
                    teamKey: key,
                    displayName: room.teams[key].displayName,
                    phase: room.phase,
                    isStarted: room.isStarted,
                    teams: room.teams,
                    auction: room.auction,
                    paused: room.paused,
                    iSkipped: room.skippedBy.has(key),
                    currentIndex: room.currentPlayerIndex + 1,
                    totalPlayers: room.playerQueue.length
                });
            }
        }

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
            paused: room.paused,
            iSkipped: false,
            currentIndex: room.currentPlayerIndex + 1,
            totalPlayers: room.playerQueue.length
        });

        io.to(roomCode).emit('updateTeams', {
            teams: room.teams,
            claimedCount: Object.keys(room.teams).length
        });
    });

    socket.on('startAuctionByAdmin', () => {
        const roomCode = socket.roomCode;
        const room = rooms[roomCode];
        if (!room || socket.id !== room.host || room.isStarted) return;

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
        if (room.paused) return socket.emit('errorMsg', "The auction is paused by the host.");

        const teamKey = socket.claimedTeamKey;
        if (!teamKey || !room.teams[teamKey]) {
            return socket.emit('errorMsg', "You must claim a franchise before bidding!");
        }
        if (room.skippedBy.has(teamKey)) {
            return socket.emit('errorMsg', "You skipped this player - wait for the next one.");
        }

        if (room.auction.highestBidder === teamKey) return;

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
        room.auction.timer = Math.max(room.auction.timer, 10);

        io.to(roomCode).emit('bidUpdated', {
            highestBid: nextBid,
            highestBidder: team.displayName,
            timer: room.auction.timer
        });
    });

    socket.on('skipForMe', () => {
        const roomCode = socket.roomCode;
        const room = rooms[roomCode];
        if (!room || !room.auction.active) return;
        if (room.paused) return socket.emit('errorMsg', "The auction is paused by the host.");

        const teamKey = socket.claimedTeamKey;
        if (!teamKey || !room.teams[teamKey]) {
            return socket.emit('errorMsg', "You must claim a franchise first.");
        }
        if (room.auction.highestBidder === teamKey) {
            return socket.emit('errorMsg', "You're the highest bidder - you can't skip this player.");
        }

        room.skippedBy.add(teamKey);
        socket.emit('skipAck');
        io.to(roomCode).emit('skipUpdate', {
            skipped: room.skippedBy.size,
            total: Object.keys(room.teams).length
        });

        // Everyone else has passed -> hammer falls straight away
        checkAllPassed(roomCode);
    });

    socket.on('submitPlaying11', ({ selectedPlayerIds, captainId, viceCaptainId }) => {
        const room = rooms[socket.roomCode];
        if (!room || !socket.claimedTeamKey || room.phase !== "SELECTION") return;

        const team = room.teams[socket.claimedTeamKey];
        if (!Array.isArray(selectedPlayerIds) || selectedPlayerIds.length !== 11) {
            return socket.emit('errorMsg', "Choose exactly 11 players.");
        }
        if (!captainId || !viceCaptainId || captainId === viceCaptainId) {
            return socket.emit('errorMsg', "Captain and Vice-Captain must be different players.");
        }
        if (!selectedPlayerIds.includes(captainId) || !selectedPlayerIds.includes(viceCaptainId)) {
            return socket.emit('errorMsg', "Captain and Vice-Captain must be inside your Playing XI.");
        }

        const selectedPlayers = team.squad.filter(p => selectedPlayerIds.includes(p.id));
        if (selectedPlayers.length !== 11) {
            return socket.emit('errorMsg', "Selection contains players not in your squad.");
        }

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
        const room = requireHost(socket);
        if (!room) return;
        if (!room.auction.active) return socket.emit('errorMsg', "No player is on the block right now - wait for the next one.");
        if (room.auction.highestBidder === "No Bids") {
            return socket.emit('errorMsg', "There are no bids yet, so there's no buyer. Use 'Hammer (Unsold)' instead.");
        }
        handleAuctionEnd(socket.roomCode);
    });

    socket.on('adminForceUnsold', () => {
        const room = requireHost(socket);
        if (!room) return;
        if (!room.auction.active) return socket.emit('errorMsg', "No player is on the block right now - wait for the next one.");
        room.auction.highestBidder = "No Bids";
        handleAuctionEnd(socket.roomCode);
    });

    socket.on('adminPause', () => {
        const room = requireHost(socket);
        if (!room) return;
        if (room.phase !== "AUCTION") return socket.emit('errorMsg', "The auction isn't running.");
        if (room.paused) return;

        room.paused = true;
        clearInterval(room.timerInterval);
        io.to(socket.roomCode).emit('auctionPaused', { timer: room.auction.timer });
    });

    socket.on('adminResume', () => {
        const room = requireHost(socket);
        if (!room) return;
        if (!room.paused) return;

        room.paused = false;
        io.to(socket.roomCode).emit('auctionResumed', { timer: room.auction.timer });

        if (room.pendingAdvance) {
            advanceToNextPlayer(socket.roomCode);          // result screen finished while paused
        } else if (room.auction.active) {
            runRoomTimer(socket.roomCode);                 // continue from the frozen time
        }
    });

    // ADMIN END AUCTION EARLY
    socket.on('adminEndAuction', () => {
        const room = requireHost(socket);
        if (!room) return;
        if (room.phase !== "AUCTION") return socket.emit('errorMsg', "The auction isn't running.");

        clearInterval(room.timerInterval);
        room.auction.active = false;
        room.paused = false;
        room.pendingAdvance = false;
        room.phase = "SELECTION";

        io.to(socket.roomCode).emit('auctionEndedByAdmin');
        io.to(socket.roomCode).emit('startSelectionPhase', { teams: room.teams });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server v${VERSION} running on http://0.0.0.0:${PORT}`);
    console.log(`Serving index.html from: ${pickIndexFile()}`);
    console.log(`Player pool: ${generatePlayerPool().length} unique players`);
});
