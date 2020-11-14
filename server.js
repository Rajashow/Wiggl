const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const hostname = "127.0.0.1";
const port = 3000;
const { v4: uuidV4 } = require("uuid");

app.get("/", (req, res) => {
  res.redirect(`/${uuidV4()}`);
});

/** returns website title?
redirects to root websit?
gets request to uuid? is it for random rooms for users?*/
app.get("/", (req, res) => {
  res.redirect(`/${uuidV4()}`);
});

/** Redirects to different rooms as well? */
app.get("/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

/** socket.io IO */
io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).broadcast.emit("user-connected", userId);

    socket.on("disconnect", () => {
      socket.to(roomId).broadcast.emit("user-disconnected", userId);
    });
  });
});

/** choose a port */
server.listen(port, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
