const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

// 1. Enable CORS for HTTP traffic
app.use(
  cors({
    origin: "*", // Allows requests from Vercel, Netlify, or local dev
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

// 2. Health check route (vital for waking up sleeping Render instances)
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Cricket Auction Simulator Server is running!",
    timestamp: new Date().toISOString(),
  });
});

// 3. Attach Node HTTP Server to Express
const server = http.createServer(app);

// 4. Attach Socket.io with explicit fallback transports
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  // CRITICAL FOR RENDER: Start with polling to bypass proxy/firewall limits, then upgrade to WebSockets
  transports: ["polling", "websocket"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// In-memory store for auction room state
const auctionRooms = {};

// 5. Socket.io Event Pipelines
io.on("connection", (socket) => {
  console.log(`[+] Client connected: ${socket.id} (Via: ${socket.conn.transport.name})`);

  // Detect and log transport upgrade (polling -> websocket)
  socket.conn.on("upgrade", (transport) => {
    console.log(`[^] Transport upgraded for ${socket.id} to: ${transport.name}`);
  });

  // Event: Join Room
  socket.on("join_room", (roomId) => {
    socket.join(roomId);

    if (!auctionRooms[roomId]) {
      auctionRooms[roomId] = {
        currentBid: 0,
        highestBidder: "No bids yet",
      };
    }

    console.log(`[Room] ${socket.id} joined room: ${roomId}`);

    // Send the current room state back to the newly joined client
    socket.emit("room_state", auctionRooms[roomId]);

    // Broadcast user join to other room participants
    const totalUsers = io.sockets.adapter.rooms.get(roomId)?.size || 1;
    io.to(roomId).emit("user_joined", { userId: socket.id, totalUsers });
  });

  // Event: Place Bid
  socket.on("place_bid", ({ roomId, amount, bidderName }) => {
    const room = auctionRooms[roomId];
    if (room && Number(amount) > Number(room.currentBid)) {
      room.currentBid = Number(amount);
      room.highestBidder = bidderName || "Anonymous";

      console.log(`[Bid] Room: ${roomId} | Bidder: ${room.highestBidder} | Amount: ₹${room.currentBid}L`);

      io.to(roomId).emit("bid_updated", {
        currentBid: room.currentBid,
        highestBidder: room.highestBidder,
        timestamp: new Date().toISOString(),
      });
    } else {
      socket.emit("bid_error", "Bid must be strictly higher than the current bid.");
    }
  });

  // Event: Disconnect
  socket.on("disconnect", (reason) => {
    console.log(`[-] Client disconnected: ${socket.id} (Reason: ${reason})`);
  });
});

// 6. Bind to 0.0.0.0 and process.env.PORT (Render mandatory rule)
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server actively running on http://0.0.0.0:${PORT}`);
});
