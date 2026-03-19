require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { nanoid } = require("nanoid");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

// ✅ Allow all origins — fixes CORS completely
app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const server = http.createServer(app);

// ✅ Allow all origins for Socket.io too
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms = {};

const USER_COLORS = [
  "#f87171", "#fb923c", "#facc15", "#4ade80",
  "#34d399", "#22d3ee", "#818cf8", "#e879f9",
  "#f472b6", "#a78bfa",
];
const userColorMap = {};
const getColor = (username) => {
  if (!userColorMap[username]) {
    const idx = Object.keys(userColorMap).length % USER_COLORS.length;
    userColorMap[username] = USER_COLORS[idx];
  }
  return userColorMap[username];
};

// Health check — keeps Render awake
app.get("/", (req, res) => res.json({ status: "RuuSpace server is running 🚀" }));

app.post("/create-room", (req, res) => {
  const roomId = nanoid(6).toUpperCase();
  rooms[roomId] = { messages: [], users: [] };
  res.json({ roomId });
});

app.get("/room/:id", (req, res) => {
  const room = rooms[req.params.id];
  room ? res.json({ exists: true }) : res.status(404).json({ exists: false });
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const baseUrl = process.env.SERVER_URL || "http://localhost:3001";
  const url = `${baseUrl}/uploads/${req.file.filename}`;
  const isImage = req.file.mimetype.startsWith("image/");
  res.json({ url, name: req.file.originalname, isImage });
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, username }) => {
    if (!rooms[roomId]) return socket.emit("error", "Room not found");

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.username = username;

    const color = getColor(username);
    rooms[roomId].users = rooms[roomId].users.filter((u) => u.username !== username);
    rooms[roomId].users.push({ username, color });

    socket.emit("chat-history", rooms[roomId].messages);
    io.to(roomId).emit("user-joined", { username, color, users: rooms[roomId].users });
  });

  socket.on("send-message", ({ roomId, message, username, fileUrl, fileName, isImage, replyTo }) => {
    const color = getColor(username);
    const msg = {
      id: nanoid(8),
      username,
      color,
      message,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      isImage: isImage || false,
      replyTo: replyTo || null,
      time: new Date().toISOString(),
      reactions: {},
    };
    rooms[roomId]?.messages.push(msg);
    io.to(roomId).emit("receive-message", msg);
  });

  socket.on("typing", ({ roomId, username }) => {
    socket.to(roomId).emit("user-typing", { username });
  });

  socket.on("stop-typing", ({ roomId, username }) => {
    socket.to(roomId).emit("user-stop-typing", { username });
  });

  socket.on("react-message", ({ roomId, msgId, emoji, username }) => {
    const room = rooms[roomId];
    if (!room) return;
    const msg = room.messages.find((m) => m.id === msgId);
    if (!msg) return;
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
    const idx = msg.reactions[emoji].indexOf(username);
    if (idx === -1) msg.reactions[emoji].push(username);
    else msg.reactions[emoji].splice(idx, 1);
    if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
    io.to(roomId).emit("message-reacted", { msgId, reactions: msg.reactions });
  });

  socket.on("delete-message", ({ roomId, msgId, username }) => {
    const room = rooms[roomId];
    if (!room) return;
    const msg = room.messages.find((m) => m.id === msgId);
    if (!msg || msg.username !== username) return;
    msg.deleted = true;
    msg.message = "";
    msg.fileUrl = null;
    io.to(roomId).emit("message-deleted", { msgId });
  });

  socket.on("edit-message", ({ roomId, msgId, username, newMessage }) => {
    const room = rooms[roomId];
    if (!room) return;
    const msg = room.messages.find((m) => m.id === msgId);
    if (!msg || msg.username !== username || msg.deleted) return;
    msg.message = newMessage;
    msg.edited = true;
    io.to(roomId).emit("message-edited", { msgId, newMessage });
  });

  socket.on("disconnect", () => {
    const { roomId, username } = socket.data;
    if (roomId && rooms[roomId]) {
      rooms[roomId].users = rooms[roomId].users.filter((u) => u.username !== username);
      io.to(roomId).emit("user-left", { username, users: rooms[roomId].users });
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`✅ RuuSpace server running on port ${PORT}`));