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

// Host of each room
const callHosts = new Map();

// Co-hosts for each room
const callCoHosts = new Map();

// Meeting lock state
const lockedRooms = new Map();

// Chat permission
const chatPermissions = new Map();

// Screen-share permission
const screenSharePermissions = new Map();

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

      let room = callRooms.get(roomId);

      // ---------------------------------------------------
      // CREATE NEW ROOM
      // ---------------------------------------------------

      if (!room) {
        room = new Set();

        callRooms.set(roomId, room);

        // First participant becomes host
        callHosts.set(
          roomId,
          socket.id
        );

        callCoHosts.set(
          roomId,
          new Set()
        );

        lockedRooms.set(
          roomId,
          false
        );

        chatPermissions.set(
          roomId,
          true
        );

        screenSharePermissions.set(
          roomId,
          true
        );
      }

      // ---------------------------------------------------
      // MEETING LOCK
      // ---------------------------------------------------

      const hostId =
        callHosts.get(roomId);

      if (
        lockedRooms.get(roomId) &&
        socket.id !== hostId
      ) {
        socket.emit("call-error", {
          message:
            "This meeting is locked by the host",
        });

        return;
      }

      // ---------------------------------------------------
      // MAX 2 USERS
      // ---------------------------------------------------

      if (room.size >= 2) {
        socket.emit("call-error", {
          message: "This room is full",
        });

        return;
      }

      // ---------------------------------------------------
      // ADD USER
      // ---------------------------------------------------

      room.add(socket.id);

      callRooms.set(
        roomId,
        room
      );

      socket.join(roomId);

      socket.data.roomId =
        roomId;

      socket.data.isHost =
        callHosts.get(roomId) ===
        socket.id;

      socket.data.isCoHost =
        callCoHosts
          .get(roomId)
          ?.has(socket.id) || false;

      socket.data.canChat =
        chatPermissions.get(roomId) !==
        false;

      socket.data.canScreenShare =
        screenSharePermissions.get(roomId) !==
        false;

      console.log(
        `User ${socket.id} joined room ${roomId}`
      );

      // ---------------------------------------------------
      // EXISTING PARTICIPANTS
      // ---------------------------------------------------

      const participants = [
        ...room,
      ].filter(
        (id) => id !== socket.id
      );

      // ---------------------------------------------------
      // SEND ROOM INFORMATION
      // ---------------------------------------------------

      socket.emit(
        "room-joined",
        {
          roomId,
          participants,

          hostId:
            callHosts.get(roomId),

          isHost:
            callHosts.get(roomId) ===
            socket.id,

          isCoHost:
            callCoHosts
              .get(roomId)
              ?.has(socket.id) || false,

          meetingLocked:
            lockedRooms.get(roomId) ||
            false,

          canChat:
            chatPermissions.get(roomId) !==
            false,

          canScreenShare:
            screenSharePermissions.get(roomId) !==
            false,
        }
      );

      // ---------------------------------------------------
      // INFORM EXISTING USERS
      // ---------------------------------------------------

      socket.to(roomId).emit(
        "user-joined",
        {
          socketId:
            socket.id,
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
          sender:
            socket.id,

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
          sender:
            socket.id,

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
          sender:
            socket.id,

          candidate,
        }
      );
    }
  );

  // =======================================================
  // IN-CALL CHAT
  // =======================================================

  socket.on(
    "call-chat-message",
    ({ roomId, message }) => {
      if (
        !roomId ||
        !message?.trim()
      ) {
        return;
      }

      const room =
        callRooms.get(roomId);

      if (
        !room ||
        !room.has(socket.id)
      ) {
        return;
      }

      // Check chat permission
      if (
        chatPermissions.get(roomId) ===
        false
      ) {
        socket.emit(
          "call-error",
          {
            message:
              "Chat has been disabled by the host",
          }
        );

        return;
      }

      io.to(roomId).emit(
        "call-chat-message",
        {
          sender:
            socket.id,

          message:
            message.trim(),

          timestamp:
            Date.now(),
        }
      );
    }
  );

  // =======================================================
  // RAISE HAND
  // =======================================================

  socket.on(
    "raise-hand",
    ({ roomId, raised }) => {
      if (!roomId) {
        return;
      }

      const room =
        callRooms.get(roomId);

      if (
        !room ||
        !room.has(socket.id)
      ) {
        return;
      }

      io.to(roomId).emit(
        "participant-hand",
        {
          socketId:
            socket.id,

          raised:
            Boolean(raised),
        }
      );
    }
  );

  // =======================================================
  // PARTICIPANT MEDIA STATUS
  // =======================================================

  socket.on(
    "participant-media-status",
    ({
      roomId,
      micEnabled,
      cameraEnabled,
    }) => {
      const room =
        callRooms.get(roomId);

      if (
        !room ||
        !room.has(socket.id)
      ) {
        return;
      }

      socket.to(roomId).emit(
        "participant-media-status",
        {
          socketId:
            socket.id,

          micEnabled:
            Boolean(micEnabled),

          cameraEnabled:
            Boolean(cameraEnabled),
        }
      );
    }
  );

  // =======================================================
  // HOST / CO-HOST CHECK
  // =======================================================

  function isHostOrCoHost() {
    const roomId =
      socket.data.roomId;

    if (!roomId) {
      return false;
    }

    const hostId =
      callHosts.get(roomId);

    const coHosts =
      callCoHosts.get(roomId) ||
      new Set();

    return (
      socket.id === hostId ||
      coHosts.has(socket.id)
    );
  }

  // =======================================================
  // HOST MUTE PARTICIPANT
  // =======================================================

  socket.on(
    "host-mute-participant",
    ({ targetId }) => {
      const roomId =
        socket.data.roomId;

      if (
        !roomId ||
        !isHostOrCoHost()
      ) {
        return;
      }

      const room =
        callRooms.get(roomId);

      if (
        !room ||
        !room.has(targetId)
      ) {
        return;
      }

      io.to(targetId).emit(
        "force-mute"
      );
    }
  );

  // =======================================================
  // HOST REMOVE PARTICIPANT
  // =======================================================

  socket.on(
    "host-remove-participant",
    ({ targetId }) => {
      const roomId =
        socket.data.roomId;

      if (
        !roomId ||
        !isHostOrCoHost()
      ) {
        return;
      }

      if (
        targetId ===
        socket.id
      ) {
        return;
      }

      const room =
        callRooms.get(roomId);

      if (
        !room ||
        !room.has(targetId)
      ) {
        return;
      }

      const targetSocket =
        io.sockets.sockets.get(
          targetId
        );

      if (!targetSocket) {
        return;
      }

      io.to(targetId).emit(
        "removed-from-call"
      );

      setTimeout(() => {
        targetSocket.disconnect(
          true
        );
      }, 100);
    }
  );

  // =======================================================
  // LOCK / UNLOCK MEETING
  // =======================================================

  socket.on(
    "host-lock-meeting",
    ({ locked }) => {
      const roomId =
        socket.data.roomId;

      if (!roomId) {
        return;
      }

      // Only actual host can lock
      if (
        callHosts.get(roomId) !==
        socket.id
      ) {
        return;
      }

      const newLocked =
        Boolean(locked);

      lockedRooms.set(
        roomId,
        newLocked
      );

      io.to(roomId).emit(
        "meeting-lock-changed",
        {
          locked:
            newLocked,
        }
      );
    }
  );

  // =======================================================
  // ASSIGN / REMOVE CO-HOST
  // =======================================================

  socket.on(
    "host-set-cohost",
    ({
      targetId,
      isCoHost,
    }) => {
      const roomId =
        socket.data.roomId;

      if (!roomId) {
        return;
      }

      // Only host can manage co-hosts
      if (
        callHosts.get(roomId) !==
        socket.id
      ) {
        return;
      }

      const room =
        callRooms.get(roomId);

      if (
        !room ||
        !room.has(targetId)
      ) {
        return;
      }

      const coHosts =
        callCoHosts.get(roomId) ||
        new Set();

      if (
        Boolean(isCoHost)
      ) {
        coHosts.add(
          targetId
        );
      } else {
        coHosts.delete(
          targetId
        );
      }

      callCoHosts.set(
        roomId,
        coHosts
      );

      const targetSocket =
        io.sockets.sockets.get(
          targetId
        );

      if (targetSocket) {
        targetSocket.data.isCoHost =
          Boolean(isCoHost);
      }

      io.to(roomId).emit(
        "cohost-changed",
        {
          socketId:
            targetId,

          isCoHost:
            Boolean(isCoHost),
        }
      );
    }
  );

  // =======================================================
  // CHAT PERMISSION
  // =======================================================

  socket.on(
    "host-chat-permission",
    ({ allowed }) => {
      const roomId =
        socket.data.roomId;

      if (
        !roomId ||
        !isHostOrCoHost()
      ) {
        return;
      }

      const newAllowed =
        Boolean(allowed);

      chatPermissions.set(
        roomId,
        newAllowed
      );

      const room =
        callRooms.get(roomId);

      if (room) {
        room.forEach(
          (socketId) => {
            const participant =
              io.sockets.sockets.get(
                socketId
              );

            if (participant) {
              participant.data.canChat =
                newAllowed;
            }
          }
        );
      }

      io.to(roomId).emit(
        "chat-permission-changed",
        {
          allowed:
            newAllowed,
        }
      );
    }
  );

  // =======================================================
  // SCREEN SHARE PERMISSION
  // =======================================================

  socket.on(
    "host-screen-share-permission",
    ({ allowed }) => {
      const roomId =
        socket.data.roomId;

      if (
        !roomId ||
        !isHostOrCoHost()
      ) {
        return;
      }

      const newAllowed =
        Boolean(allowed);

      screenSharePermissions.set(
        roomId,
        newAllowed
      );

      const room =
        callRooms.get(roomId);

      if (room) {
        room.forEach(
          (socketId) => {
            const participant =
              io.sockets.sockets.get(
                socketId
              );

            if (participant) {
              participant.data.canScreenShare =
                newAllowed;
            }
          }
        );
      }

      io.to(roomId).emit(
        "screen-share-permission-changed",
        {
          allowed:
            newAllowed,
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

  const wasHost =
    callHosts.get(roomId) ===
    socket.id;

  // Remove participant
  room.delete(socket.id);

  // Remove from co-hosts
  const coHosts =
    callCoHosts.get(roomId);

  if (coHosts) {
    coHosts.delete(
      socket.id
    );
  }

  socket.to(roomId).emit(
    "user-left",
    {
      socketId:
        socket.id,
    }
  );

  // =======================================================
  // ROOM EMPTY
  // =======================================================

  if (room.size === 0) {
    callRooms.delete(
      roomId
    );

    callHosts.delete(
      roomId
    );

    callCoHosts.delete(
      roomId
    );

    lockedRooms.delete(
      roomId
    );

    chatPermissions.delete(
      roomId
    );

    screenSharePermissions.delete(
      roomId
    );
  }

  // =======================================================
  // HOST LEFT
  // =======================================================

  else {
    callRooms.set(
      roomId,
      room
    );

    // Promote remaining participant
    if (wasHost) {
      const newHost =
        [...room][0];

      callHosts.set(
        roomId,
        newHost
      );

      // Clear old co-host status
      callCoHosts.set(
        roomId,
        new Set()
      );

      const newHostSocket =
        io.sockets.sockets.get(
          newHost
        );

      if (newHostSocket) {
        newHostSocket.data.isHost =
          true;

        newHostSocket.data.isCoHost =
          false;
      }

      io.to(roomId).emit(
        "host-changed",
        {
          hostId:
            newHost,
        }
      );
    }
  }

  socket.data.roomId =
    null;

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