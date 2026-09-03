import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import dns from "dns";
import path from "path";
import http from "http";
import { Server } from "socket.io";

import userroutes from "./routes/auth.js";
import videoroutes from "./routes/video.js";
import likeroutes from "./routes/like.js";
import watchlaterroutes from "./routes/watchlater.js";
import historyrroutes from "./routes/history.js";
import commentroutes from "./routes/comment.js";
import commentReactionRoutes from "./routes/commentReaction.js";
import translationRoutes from "./routes/translation.js";
import captchaRoutes from "./routes/captcha.js";
import downloadRoutes from "./routes/download.js";
import securityRoutes from "./routes/security.js";
import subscriptionRoutes from "./routes/subscription.js";

import {
  processExpiredSubscriptions,
} from "./controllers/subscription.js";

// =========================================================
// DNS
// =========================================================

dns.setServers(["1.1.1.1", "8.8.8.8"]);

dotenv.config();

const app = express();

// =========================================================
// MIDDLEWARE
// =========================================================

app.use(cors());

app.use(
  express.json({
    limit: "30mb",
  })
);

app.use(
  express.urlencoded({
    limit: "30mb",
    extended: true,
  })
);

app.use(bodyParser.json());

// =========================================================
// STATIC FILES
// =========================================================

app.use(
  "/uploads",
  express.static(path.join("uploads"))
);

app.use(
  "/subtitles",
  express.static(path.join("subtitles"))
);

// =========================================================
// HOME
// =========================================================

app.get("/", (req, res) => {
  res.send("You tube backend is working");
});

// =========================================================
// EXISTING ROUTES
// =========================================================

app.use("/user", userroutes);

app.use("/video", videoroutes);

app.use("/like", likeroutes);

app.use("/watch", watchlaterroutes);

app.use("/history", historyrroutes);

app.use("/comment", commentroutes);

app.use(
  "/comment-reaction",
  commentReactionRoutes
);

app.use(
  "/translation",
  translationRoutes
);

app.use(
  "/captcha",
  captchaRoutes
);

app.use(
  "/download",
  downloadRoutes
);

app.use(
  "/subscription",
  subscriptionRoutes
);

app.use(
  "/security",
  securityRoutes
);

// =========================================================
// HTTP SERVER
// =========================================================

const server = http.createServer(app);

// =========================================================
// SOCKET.IO
// =========================================================

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// =========================================================
// VIDEO CALL ROOMS
// =========================================================

const callRooms = new Map();

// =========================================================
// SOCKET CONNECTION
// =========================================================

io.on("connection", (socket) => {
  console.log(
    "Video call socket connected:",
    socket.id
  );

  // =======================================================
  // JOIN CALL
  // =======================================================

  socket.on("join-call", ({ roomId }) => {
    try {
      if (!roomId) {
        socket.emit("call-error", {
          message: "Room ID is required",
        });

        return;
      }

      const room =
        callRooms.get(roomId) || new Set();

      // ---------------------------------------------------
      // MAX 2 USERS FOR 7.1
      // ---------------------------------------------------

      if (room.size >= 2) {
        socket.emit("call-error", {
          message: "This room is full",
        });

        return;
      }

      room.add(socket.id);

      callRooms.set(
        roomId,
        room
      );

      socket.join(roomId);

      socket.data.roomId = roomId;

      console.log(
        `User ${socket.id} joined room ${roomId}`
      );

      // ---------------------------------------------------
      // SEND EXISTING PARTICIPANTS TO NEW USER
      // ---------------------------------------------------

      const participants = [
        ...room,
      ].filter(
        (id) => id !== socket.id
      );

      socket.emit(
        "room-joined",
        {
          roomId,
          participants,
        }
      );

      // ---------------------------------------------------
      // INFORM EXISTING USERS
      // ---------------------------------------------------

      socket.to(roomId).emit(
        "user-joined",
        {
          socketId: socket.id,
        }
      );

    } catch (error) {
      console.error(
        "Join call error:",
        error
      );

      socket.emit(
        "call-error",
        {
          message:
            "Unable to join call",
        }
      );
    }
  });

  // =======================================================
  // WEBRTC OFFER
  // =======================================================

  socket.on(
    "offer",
    ({ target, offer }) => {
      if (!target || !offer) {
        return;
      }

      io.to(target).emit(
        "offer",
        {
          sender: socket.id,
          offer,
        }
      );
    }
  );

  // =======================================================
  // WEBRTC ANSWER
  // =======================================================

  socket.on(
    "answer",
    ({ target, answer }) => {
      if (!target || !answer) {
        return;
      }

      io.to(target).emit(
        "answer",
        {
          sender: socket.id,
          answer,
        }
      );
    }
  );

  // =======================================================
  // ICE CANDIDATE
  // =======================================================

  socket.on(
    "ice-candidate",
    ({ target, candidate }) => {
      if (!target || !candidate) {
        return;
      }

      io.to(target).emit(
        "ice-candidate",
        {
          sender: socket.id,
          candidate,
        }
      );
    }
  );

  // =======================================================
  // LEAVE CALL
  // =======================================================

  socket.on(
    "leave-call",
    () => {
      removeUserFromCall(socket);
    }
  );

  // =======================================================
  // DISCONNECT
  // =======================================================

  socket.on(
    "disconnect",
    () => {
      console.log(
        "Video call socket disconnected:",
        socket.id
      );

      removeUserFromCall(socket);
    }
  );
});

// =========================================================
// REMOVE USER FROM CALL
// =========================================================

function removeUserFromCall(socket) {
  const roomId =
    socket.data.roomId;

  if (!roomId) {
    return;
  }

  const room =
    callRooms.get(roomId);

  if (!room) {
    return;
  }

  room.delete(socket.id);

  socket.to(roomId).emit(
    "user-left",
    {
      socketId: socket.id,
    }
  );

  if (room.size === 0) {
    callRooms.delete(roomId);
  } else {
    callRooms.set(
      roomId,
      room
    );
  }

  socket.data.roomId = null;

  console.log(
    `User ${socket.id} left room ${roomId}`
  );
}

// =========================================================
// PORT
// =========================================================

const PORT =
  process.env.PORT || 5000;

// =========================================================
// START HTTP + SOCKET.IO SERVER
// =========================================================

server.listen(
  PORT,
  () => {
    console.log(
      `server running on port ${PORT}`
    );

    console.log(
      "Socket.IO video calling enabled"
    );
  }
);

// =========================================================
// MONGODB
// =========================================================

const DBURL =
  process.env.DB_URL;

mongoose
  .connect(DBURL)
  .then(() => {
    console.log(
      "Mongodb connected"
    );

    // Check expired subscriptions immediately
    processExpiredSubscriptions();

    // Check every hour
    setInterval(() => {
      processExpiredSubscriptions();
    }, 60 * 60 * 1000);
  })
  .catch((error) => {
    console.log(error);
  });