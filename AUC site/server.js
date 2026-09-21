<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IPL Mega Auction Live V2</title>
    <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <style>
        :root {
            --bg: #090d16;
            --panel: #111827;
            --panel-border: #1f293d;
            --accent: #f59e0b;
            --green: #10b981;
            --red: #ef4444;
            --blue: #3b82f6;
            --text-main: #f9fafb;
            --text-sub: #9ca3af;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background-color: var(--bg); color: var(--text-main); min-height: 100vh; }
        .container { max-width: 1320px; width: 100%; margin: 0 auto; padding: 20px; }

        header {
            display: flex; justify-content: space-between; align-items: center;
            background: var(--panel); border: 1px solid var(--panel-border);
            padding: 14px 20px; border-radius: 10px; margin-bottom: 25px;
        }
        .logo { font-size: 1.4rem; font-weight: 800; color: var(--accent); }

        .card { background: var(--panel); border: 1px solid var(--panel-border); border-radius: 12px; padding: 24px; margin-bottom: 20px; }
        .auth-container { max-width: 450px; margin: 60px auto; width: 100%; }
        .tab-group { display: flex; gap: 8px; margin-bottom: 20px; }
        .tab-btn { flex: 1; padding: 10px; background: transparent; border: 1px solid var(--panel-border); color: var(--text-sub); border-radius: 6px; cursor: pointer; font-weight: 700; }
        .tab-btn.active { background: var(--accent); color: #000; border-color: var(--accent); }

        .field { margin-bottom: 16px; }
        .field label { display: block; font-size: 0.8rem; color: var(--text-sub); margin-bottom: 6px; text-transform: uppercase; }
        .field input { width: 100%; padding: 12px; background: #090d16; border: 1px solid var(--panel-border); border-radius: 6px; color: #fff; font-size: 1rem; outline: none; }
        .btn-submit { width: 100%; padding: 14px; background: var(--accent); color: #000; border: none; border-radius: 6px; font-size: 1rem; font-weight: 800; cursor: pointer; }

        .franchise-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 15px; margin-top: 25px; }
        .franchise-card { background: var(--panel); border: 2px solid var(--panel-border); border-radius: 10px; padding: 25px 15px; cursor: pointer; text-align: center; }
        .franchise-card:hover { border-color: var(--accent); transform: translateY(-3px); }

        /* Arena Layout */
        .arena-grid { display: grid; grid-template-columns: 1.8fr 1.2fr; gap: 20px; }
        @media (max-width: 950px) { .arena-grid { grid-template-columns: 1fr; } }

        .stage-center { text-align: center; }
        .pill-row { display: flex; justify-content: center; gap: 8px; margin-bottom: 12px; }
        .pill { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; }
        .pill-cat { background: #374151; color: var(--accent); }
        .pill-foreign { background: #1e3a8a; color: #93c5fd; }
        .pill-ind { background: #064e3b; color: #6ee7b7; }

        .player-headline { font-size: 2.3rem; font-weight: 900; margin-bottom: 4px; }
        .player-specs { color: var(--text-sub); font-size: 1rem; margin-bottom: 20px; }

        .bid-monitor { background: #090d16; border: 1px solid var(--panel-border); border-radius: 10px; padding: 20px; margin-bottom: 20px; }
        .bid-price { font-size: 3.2rem; font-weight: 900; color: var(--green); }
        .timer-lead { font-size: 2rem; font-weight: 900; color: var(--red); margin: 15px 0; }

        .control-row { display: flex; gap: 10px; justify-content: center; }
        .btn-bid { flex: 2; padding: 18px; background: var(--green); color: #fff; font-size: 1.3rem; font-weight: 900; border: none; border-radius: 8px; cursor: pointer; }
        .btn-skip { flex: 1; padding: 18px; background: #374151; color: #fff; font-weight: 800; border: none; border-radius: 8px; cursor: pointer; }

        /* Squad Console */
        .my-squad-panel { background: #0c1322; border: 1px solid #1e3a8a; border-radius: 12px; padding: 20px; }
        .metric-bar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0; text-align: center; }
        .metric-card { background: var(--panel); border: 1px solid var(--panel-border); border-radius: 8px; padding: 10px; }
        .squad-roster { max-height: 280px; overflow-y: auto; background: #090d16; border-radius: 6px; padding: 10px; margin-top: 10px; }
        .player-row { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid var(--panel-border); font-size: 0.85rem; }

        /* Playing XI Selection Phase */
        .selection-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 12px; max-height: 420px; overflow-y: auto; padding: 10px; background: #090d16; border-radius: 8px; margin: 15px 0; }
        .pick-card { background: var(--panel); border: 1px solid var(--panel-border); padding: 10px; border-radius: 6px; display: flex; align-items: center; justify-content: space-between; }
        .tag-cap { font-size: 0.75rem; background: #f59e0b; color: #000; padding: 2px 6px; border-radius: 4px; font-weight: 800; cursor: pointer; }
        .tag-vc { font-size: 0.75rem; background: #3b82f6; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 800; cursor: pointer; }

        .hidden { display: none !important; }
    </style>
</head>
<body>

<div class="container">
    <header>
        <div class="logo">🏏 IPL MEGA AUCTION PRO V2</div>
        <div id="server-status" style="font-weight:700; color:var(--text-sub);">Connecting...</div>
    </header>

    <!-- 1. LOGIN -->
    <div id="view-login" class="auth-container">
        <div class="card">
            <div class="tab-group">
                <button id="tab-player" class="tab-btn active" onclick="setTab('player')">Team Manager</button>
                <button id="tab-host" class="tab-btn" onclick="setTab('host')">Host</button>
            </div>
            <div id="form-player">
                <div class="field">
                    <label>Manager Name</label>
                    <input type="text" id="mgr-name" placeholder="Your Name">
                </div>
                <div class="field">
                    <label>Room PIN</label>
                    <input type="text" id="room-pin" placeholder="4-Digit PIN">
                </div>
                <button class="btn-submit" onclick="joinLobby()">Join Game</button>
            </div>
            <div id="form-host" class="hidden">
                <div class="field">
                    <label>Auctioneer Name</label>
                    <input type="text" id="host-name" placeholder="Host Name">
                </div>
                <button class="btn-submit" style="background:var(--blue); color:#fff;" onclick="createAuction()">Create Room</button>
            </div>
        </div>
    </div>

    <!-- 2. TEAM SELECT -->
    <div id="view-team-select" class="hidden">
        <div class="card" style="text-align:center;">
            <h2>Select Franchise Base</h2>
            <div class="franchise-grid" id="franchise-tiles"></div>
        </div>
    </div>

    <!-- 3. ARENA -->
    <div id="view-arena" class="hidden">
        <div class="arena-grid">
            <div class="card stage-center">
                <div class="pill-row">
                    <span class="pill pill-cat" id="player-cat">Marquee</span>
                    <span class="pill pill-ind" id="player-origin">Domestic</span>
                </div>
                <div class="player-headline" id="player-name">Waiting...</div>
                <div class="player-specs" id="player-specs">Loading attributes...</div>

                <div class="bid-monitor">
                    <div style="font-size:0.8rem; color:var(--text-sub);">CURRENT BID</div>
                    <div class="bid-price" id="lead-price">₹0L</div>
                    <div id="lead-team" style="font-weight:700;">No Bids Placed</div>
                </div>

                <div class="timer-lead">⏱ <span id="timer-val">12</span>s</div>

                <div class="control-row">
                    <button class="btn-bid" onclick="placeBid()">RAISE BID 🔨</button>
                    <button class="btn-skip" onclick="skipPlayer()">SKIP ⏩</button>
                </div>

                <div id="host-controls" class="hidden" style="margin-top:15px; display:flex; gap:10px; justify-content:center;">
                    <button style="padding:8px 14px; background:var(--green); color:#fff; border:none; border-radius:6px;" onclick="adminSold()">Hammer (Sold)</button>
                    <button style="padding:8px 14px; background:var(--red); color:#fff; border:none; border-radius:6px;" onclick="adminUnsold()">Hammer (Unsold)</button>
                </div>
            </div>

            <!-- Squad Display -->
            <div>
                <div class="my-squad-panel">
                    <h3 id="my-team-title" style="color:var(--accent);">Squad Tracker</h3>
                    <div class="metric-bar">
                        <div class="metric-card">
                            <span style="font-size:0.75rem; color:var(--text-sub);">Purse</span>
                            <strong id="my-purse" style="color:var(--green);">₹10000L</strong>
                        </div>
                        <div class="metric-card">
                            <span style="font-size:0.75rem; color:var(--text-sub);">Squad (Min 11)</span>
                            <strong id="my-squad-count">0/25</strong>
                        </div>
                        <div class="metric-card">
                            <span style="font-size:0.75rem; color:var(--text-sub);">Foreign (Max 8)</span>
                            <strong id="my-foreign-count">0/8</strong>
                        </div>
                    </div>
                    <div class="squad-roster" id="my-squad-list"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- 4. PLAYING XI SELECTION PHASE -->
    <div id="view-selection-phase" class="hidden">
        <div class="card">
            <h2>Select Playing XI & Dream11 Multipliers</h2>
            <p style="color:var(--text-sub); margin-bottom: 8px;">
                Pick exactly <strong>11 players</strong> (Max 4 Overseas). Assign <strong style="color:var(--accent);">Captain (2.0x Pts)</strong> and <strong style="color:var(--blue);">Vice-Captain (1.5x Pts)</strong>:
            </p>
            <div id="selection-status-counter" style="font-weight: bold; color: var(--green); margin-bottom: 10px;">
                Selected: 0 / 11 Players
            </div>
            
            <div class="selection-grid" id="selection-player-grid"></div>

            <button class="btn-submit" onclick="submitPlayingXI()">Lock Playing XI & Multipliers</button>
        </div>
    </div>
</div>

<script>
    let userId = localStorage.getItem('ipl_auction_uid');
    if (!userId) {
        userId = 'usr_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('ipl_auction_uid', userId);
    }

    const socket = io('https://auction-simulator-3.onrender.com', {
        transports: ['polling', 'websocket'],
        secure: true,
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
    });

    let currentRoom = null;
    let myTeamKey = null;
    let mySquadData = [];

    window.lastTournamentResults = null;

    // Keep Render awake automatically
    setInterval(() => {
        fetch('https://auction-simulator-3.onrender.com/ping')
            .then(() => console.log('Keep-alive ping sent'))
            .catch(err => console.warn('Keep-alive ping error:', err));
    }, 4 * 60 * 1000);

    socket.on('connect', () => {
        document.getElementById('server-status').innerText = '🟢 Connected';
        document.getElementById('server-status').style.color = 'var(--green)';

        const savedRoom = sessionStorage.getItem('active_auction_room');
        if (savedRoom) {
            socket.emit('rejoinSession', { roomCode: savedRoom, userId });
        }
    });

    socket.on('connect_error', (err) => {
        document.getElementById('server-status').innerText = '🟡 Reconnecting...';
        document.getElementById('server-status').style.color = 'var(--accent)';
    });

    socket.on('disconnect', () => {
        document.getElementById('server-status').innerText = '🔴 Disconnected';
        document.getElementById('server-status').style.color = 'var(--red)';
    });

    function setTab(tab) {
        document.getElementById('tab-player').classList.toggle('active', tab === 'player');
        document.getElementById('tab-host').classList.toggle('active', tab === 'host');
        document.getElementById('form-player').classList.toggle('hidden', tab !== 'player');
        document.getElementById('form-host').classList.toggle('hidden', tab !== 'host');
    }

    function createAuction() {
        const username = document.getElementById('host-name').value.trim() || 'Host';
        socket.emit('createRoom', { username, userId });
    }

    function joinLobby() {
        const username = document.getElementById('mgr-name').value.trim();
        const roomCode = document.getElementById('room-pin').value.trim();
        if (!username || !roomCode) return alert('Enter name and 4-digit code');
        sessionStorage.setItem('active_auction_room', roomCode);
        socket.emit('joinRoom', { roomCode, username, userId });
    }

    function claimFranchise(code) {
        socket.emit('claimTeam', { franchiseBase: code });
    }

    function placeBid() { socket.emit('placeBid'); }
    function skipPlayer() { socket.emit('skipForMe'); }
    function adminSold() { socket.emit('adminForceSold'); }
    function adminUnsold() { socket.emit('adminForceUnsold'); }

    // Socket Event Handlers
    socket.on('roomCreated', (data) => {
        currentRoom = data.roomCode;
        sessionStorage.setItem('active_auction_room', data.roomCode);
        document.getElementById('view-login').classList.add('hidden');
        document.getElementById('view-arena').classList.remove('hidden');
        document.getElementById('host-controls').classList.remove('hidden');
        
        if (data.auction && data.auction.player) {
            renderPlayer(data.auction.player, data.currentIndex || 1, data.totalPlayers || 264);
            document.getElementById('lead-price').innerText = `₹${data.auction.highestBid}L`;
            document.getElementById('lead-team').innerText = `Leading: ${data.auction.highestBidder || 'No Bids'}`;
            document.getElementById('timer-val').innerText = data.auction.timer;
        }

        Swal.fire('Room Created', `PIN: ${data.roomCode}`, 'success');
    });

    socket.on('joinedToTeamSelect', (data) => {
        currentRoom = data.roomCode;
        document.getElementById('view-login').classList.add('hidden');
        document.getElementById('view-team-select').classList.remove('hidden');

        const grid = document.getElementById('franchise-tiles');
        grid.innerHTML = '';
        data.teamCodes.forEach(code => {
            const tile = document.createElement('div');
            tile.className = 'franchise-card';
            tile.innerHTML = `<h3>${code}</h3><small style="color:var(--green)">Claim Table Slot</small>`;
            tile.onclick = () => claimFranchise(code);
            grid.appendChild(tile);
        });
    });

    // Instant initial render on team confirmation
    socket.on('teamConfirmed', (data) => {
        myTeamKey = data.teamKey;
        document.getElementById('view-team-select').classList.add('hidden');
        document.getElementById('view-arena').classList.remove('hidden');
        document.getElementById('my-team-title').innerText = `${data.displayName} Console`;

        if (data.auction && data.auction.player) {
            renderPlayer(data.auction.player, data.currentIndex || 1, data.totalPlayers || 264);
            document.getElementById('lead-price').innerText = `₹${data.auction.highestBid}L`;
            document.getElementById('lead-team').innerText = `Leading: ${data.auction.highestBidder || 'No Bids'}`;
            document.getElementById('timer-val').innerText = data.auction.timer;
        }

        if (data.teams && data.teams[myTeamKey]) {
            updateDashboard(data.teams[myTeamKey]);
        }
    });

    socket.on('timerUpdate', val => { document.getElementById('timer-val').innerText = val; });

    socket.on('bidUpdated', data => {
        document.getElementById('lead-price').innerText = `₹${data.highestBid}L`;
        document.getElementById('lead-team').innerText = `Leading: ${data.highestBidder}`;
        document.getElementById('timer-val').innerText = data.timer;
    });

    socket.on('nextPlayer', data => {
        renderPlayer(data.auction.player, data.currentIndex, data.totalPlayers);
        document.getElementById('lead-price').innerText = `₹${data.auction.highestBid}L`;
        document.getElementById('lead-team').innerText = `Leading: ${data.auction.highestBidder || 'No Bids'}`;
        document.getElementById('timer-val').innerText = data.auction.timer;

        if (myTeamKey && data.teams[myTeamKey]) updateDashboard(data.teams[myTeamKey]);
    });

    socket.on('playerResolved', data => {
        if (myTeamKey && data.teams[myTeamKey]) updateDashboard(data.teams[myTeamKey]);
    });

    socket.on('startSelectionPhase', data => {
        document.getElementById('view-arena').classList.add('hidden');
        document.getElementById('view-selection-phase').classList.remove('hidden');

        const myTeam = data.teams[myTeamKey];
        if (!myTeam || myTeam.squad.length < 11) {
            return Swal.fire('Disqualified', 'You did not acquire the minimum 11 players required for a Playing XI.', 'error');
        }

        renderSelectionUI(myTeam.squad);
    });

    function renderPlayer(p, curr, total) {
        document.getElementById('player-cat').innerText = `${p.category} (${curr}/${total})`;
        document.getElementById('player-origin').innerText = p.isOverseas ? `${p.country} ✈️` : 'India 🇮🇳';
        document.getElementById('player-name').innerText = p.name;
        document.getElementById('player-specs').innerText = `Role: ${p.role} | BAT: ${p.bat} | BOWL: ${p.bowl} | FLD: ${p.fld} | Base: ₹${p.basePrice}L`;
    }

    function updateDashboard(team) {
        mySquadData = team.squad;
        document.getElementById('my-purse').innerText = `₹${team.purse}L`;
        document.getElementById('my-squad-count').innerText = `${team.squad.length}/25`;
        document.getElementById('my-foreign-count').innerText = `${team.overseasCount}/8`;

        const list = document.getElementById('my-squad-list');
        list.innerHTML = team.squad.map(p => `
            <div class="player-row">
                <span><strong>${p.name}</strong> (${p.role})</span>
                <span>${p.isOverseas ? '✈️' : '🇮🇳'} Rating: <strong>${p.rating}</strong> | ₹${p.boughtPrice || p.basePrice}L</span>
            </div>
        `).join('');
    }

    function renderSelectionUI(squad) {
        const grid = document.getElementById('selection-player-grid');
        grid.innerHTML = squad.map(p => `
            <div class="pick-card">
                <div>
                    <input type="checkbox" value="${p.id}" class="xi-select" onchange="validateSelectionCount()">
                    <strong style="margin-left:5px;">${p.name}</strong><br>
                    <small style="color:var(--text-sub);">${p.role} | Rat: <strong>${p.rating}</strong> ${p.isOverseas ? '✈️' : ''}</small>
                </div>
                <div style="display:flex; gap:6px;">
                    <label class="tag-cap"><input type="radio" name="captain" value="${p.id}"> 2x C</label>
                    <label class="tag-vc"><input type="radio" name="vice_captain" value="${p.id}"> 1.5x VC</label>
                </div>
            </div>
        `).join('');
        validateSelectionCount();
    }

    function validateSelectionCount() {
        const checked = document.querySelectorAll('.xi-select:checked');
        const counterEl = document.getElementById('selection-status-counter');
        if (counterEl) {
            counterEl.innerText = `Selected: ${checked.length} / 11 Players`;
            counterEl.style.color = checked.length === 11 ? 'var(--green)' : 'var(--accent)';
        }
        if (checked.length > 11) {
            Swal.fire('Limit Reached', 'You can only select exactly 11 players for your Playing XI.', 'warning');
        }
    }

    function submitPlayingXI() {
        const selected = Array.from(document.querySelectorAll('.xi-select:checked')).map(el => parseInt(el.value));
        const captainRadio = document.querySelector('input[name="captain"]:checked');
        const vcRadio = document.querySelector('input[name="vice_captain"]:checked');

        if (selected.length !== 11) {
            return Swal.fire('Incomplete Squad', 'You must select exactly 11 players.', 'warning');
        }
        if (!captainRadio || !vcRadio) {
            return Swal.fire('Multipliers Missing', 'Please select both a Captain (2x) and a Vice-Captain (1.5x).', 'warning');
        }
        if (captainRadio.value === vcRadio.value) {
            return Swal.fire('Duplicate Choice', 'The Captain and Vice-Captain must be two different players.', 'warning');
        }
        if (!selected.includes(parseInt(captainRadio.value)) || !selected.includes(parseInt(vcRadio.value))) {
            return Swal.fire('Invalid Selection', 'Captain and Vice-Captain must both be inside your selected 11 players.', 'warning');
        }

        socket.emit('submitPlaying11', {
            selectedPlayerIds: selected,
            captainId: parseInt(captainRadio.value),
            viceCaptainId: parseInt(vcRadio.value)
        });

        Swal.fire({
            title: 'Playing XI Locked!',
            text: 'Waiting for remaining managers to finalize their teams...',
            icon: 'info',
            showConfirmButton: false,
            allowOutsideClick: false
        });
    }

    socket.on('submissionAccepted', () => {
        console.log('Selection accepted by server.');
    });

    socket.on('finalResultsAnnounced', data => {
        window.lastTournamentResults = data;

        let rows = data.leaderboard.map((t, idx) => `
            <tr style="${t.isDisqualified ? 'background:#450a0a; color:#fca5a5;' : (idx === 0 ? 'background:#064e3b; font-weight:bold;' : '')}">
                <td style="padding:6px;">#${idx + 1} ${t.teamCode}</td>
                <td style="padding:6px;">${t.manager}</td>
                <td style="padding:6px;"><strong>${t.captainName}</strong> (2x)</td>
                <td style="padding:6px;"><strong>${t.vcName}</strong> (1.5x)</td>
                <td style="padding:6px;">₹${t.purseLeft}L</td>
                <td style="padding:6px; color:var(--accent);">${t.isDisqualified ? 'DISQUALIFIED' : t.finalScore}</td>
            </tr>
        `).join('');

        Swal.fire({
            title: '🏆 Tournament Concluded 🏆',
            html: `
                <div style="max-height: 260px; overflow-y: auto; margin-bottom: 15px;">
                    <table style="width:100%; text-align:left; font-size:0.85rem; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--panel-border);">
                                <th>Team</th><th>Manager</th><th>Captain (2x)</th><th>Vice-Captain (1.5x)</th><th>Purse</th><th>Total Score</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div style="display:flex; gap:10px; justify-content:center;">
                    <button onclick="downloadResultsCSV()" style="padding:10px 14px; background:#10b981; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">📊 Download CSV (Excel)</button>
                    <button onclick="downloadResultsJSON()" style="padding:10px 14px; background:#3b82f6; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">📁 Download JSON Backup</button>
                </div>
            `,
            width: '750px',
            showConfirmButton: false,
            allowOutsideClick: false
        });
    });

    function downloadResultsCSV() {
        if (!window.lastTournamentResults) return;
        const { leaderboard, fullTeams } = window.lastTournamentResults;

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Rank,Team,Manager,Status,Final Score,XI Score (with C/VC multipliers),Purse Left (Lakhs),Captain (2x),Vice-Captain (1.5x),Full Acquired Squad\n";

        leaderboard.forEach((t, idx) => {
            const teamDetails = fullTeams ? Object.values(fullTeams).find(ft => ft.displayName === t.teamCode) : null;
            const squadStr = teamDetails && teamDetails.squad 
                ? teamDetails.squad.map(p => `${p.name} [${p.role}, Rating: ${p.rating}, ₹${p.boughtPrice || p.basePrice}L]`).join(" | ")
                : "";

            const row = [
                idx + 1,
                `"${t.teamCode}"`,
                `"${t.manager}"`,
                `"${t.statusText}"`,
                t.finalScore,
                t.playingXIScore || 0,
                t.purseLeft,
                `"${t.captainName}"`,
                `"${t.vcName}"`,
                `"${squadStr}"`
            ];
            csvContent += row.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ipl_auction_results_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function downloadResultsJSON() {
        if (!window.lastTournamentResults) return;
        const blob = new Blob([JSON.stringify(window.lastTournamentResults, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ipl_auction_backup_${Date.now()}.json`;
        a.click();
    }

    socket.on('errorMsg', msg => Swal.fire('Notice', msg, 'warning'));
</script>
</body>
</html>
