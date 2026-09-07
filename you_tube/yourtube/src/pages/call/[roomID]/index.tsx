import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SERVER_URL = "http://localhost:5000";

const formatCallDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds,
  ).padStart(2, "0")}`;
};

export default function VideoCall() {
  const router = useRouter();

  const localVideoRef = useRef<HTMLVideoElement>(null);

  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const socketRef = useRef<Socket | null>(null);

  const peerRef = useRef<RTCPeerConnection | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);

  const remoteSocketIdRef = useRef<string | null>(null);

  const [roomId, setRoomId] = useState("");

  const [status, setStatus] = useState("Starting camera...");

  const [error, setError] = useState("");

  const [micEnabled, setMicEnabled] = useState(true);

  const [cameraEnabled, setCameraEnabled] = useState(true);

  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const screenStreamRef = useRef<MediaStream | null>(null);

  const [showParticipants, setShowParticipants] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);

  const [showChat, setShowChat] = useState(false);

  const [handRaised, setHandRaised] = useState(false);

  const [raisedHands, setRaisedHands] = useState<string[]>([]);
  const [remoteHandRaised, setRemoteHandRaised] = useState(false);

  const [remoteMicEnabled, setRemoteMicEnabled] = useState(true);
  const [remoteCameraEnabled, setRemoteCameraEnabled] = useState(true);
  const [isRemoteSpeaking, setIsRemoteSpeaking] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("Good");

  const [chatMessage, setChatMessage] = useState("");
  const [callDuration, setCallDuration] = useState(0);

  const [chatMessages, setChatMessages] = useState<
    {
      sender: string;
      message: string;
      timestamp: number;
    }[]
  >([]);

  // ========================================================
  // GET ROOM ID
  // ========================================================

  useEffect(() => {
    if (!router.isReady) return;

    let id = "";

    if (typeof router.query.roomId === "string") {
      id = router.query.roomId;
    }

    // Fallback: get room ID directly from URL
    if (!id && router.asPath) {
      const parts = router.asPath.split("?")[0].split("/").filter(Boolean);

      const callIndex = parts.indexOf("call");

      if (callIndex !== -1 && parts[callIndex + 1]) {
        id = parts[callIndex + 1];
      }
    }

    if (id) {
      console.log("Room ID:", id);

      setRoomId(id);
    }
  }, [router.isReady, router.query.roomId, router.asPath]);

  // ========================================================
  // CREATE PEER
  // ========================================================

  const createPeer = useCallback((targetId: string, createOffer: boolean) => {
    if (peerRef.current) {
      return peerRef.current;
    }

    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
        {
          urls: "stun:stun1.l.google.com:19302",
        },
      ],
   
    });

   peer.oniceconnectionstatechange = () => {
  const state = peer.iceConnectionState;

  if (
    state === "connected" ||
    state === "completed"
  ) {
    setConnectionQuality("Good");
  } else if (state === "checking") {
    setConnectionQuality("Fair");
  } else if (
    state === "disconnected" ||
    state === "failed"
  ) {
    setConnectionQuality("Poor");
  }
};
    peerRef.current = peer;

    // ----------------------------------------------------
    // ADD LOCAL TRACKS
    // ----------------------------------------------------

    const stream = localStreamRef.current;

    if (stream) {
      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });
    }

    // ----------------------------------------------------
    // REMOTE TRACK
    // ----------------------------------------------------

   peer.ontrack = (event) => {
  console.log("Remote track received");

  const remoteStream = event.streams[0];

  if (remoteVideoRef.current && remoteStream) {
    remoteVideoRef.current.srcObject = remoteStream;

    // ==========================================
    // REMOTE SPEAKING DETECTION
    // ==========================================

    const audioTrack =
      remoteStream.getAudioTracks()[0];

    if (audioTrack) {
      const audioContext =
        new AudioContext();

      const analyser =
        audioContext.createAnalyser();

      analyser.fftSize = 256;

      const source =
        audioContext.createMediaStreamSource(
          remoteStream
        );

      source.connect(analyser);

      const data =
        new Uint8Array(
          analyser.frequencyBinCount
        );

      const detectSpeaking = () => {
        analyser.getByteFrequencyData(data);

        const volume =
          data.reduce(
            (sum, value) => sum + value,
            0
          ) / data.length;

        setIsRemoteSpeaking(
          volume > 20
        );

        requestAnimationFrame(
          detectSpeaking
        );
      };

      detectSpeaking();
    }

    remoteVideoRef.current
      .play()
      .catch(() => {});
  }

  setStatus("Connected");
};

    // ----------------------------------------------------
    // ICE
    // ----------------------------------------------------

    peer.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      const socket = socketRef.current;

      if (!socket) return;

      socket.emit("ice-candidate", {
        target: targetId,
        candidate: event.candidate,
      });
    };

    // ----------------------------------------------------
    // CONNECTION STATE
    // ----------------------------------------------------

    peer.onconnectionstatechange = () => {
      console.log("WebRTC:", peer.connectionState);

      if (peer.connectionState === "connected") {
        setStatus("Connected");
      }

      if (peer.connectionState === "connecting") {
        setStatus("Connecting...");
      }

      if (peer.connectionState === "disconnected") {
        setStatus("Connection interrupted");
      }

      if (peer.connectionState === "failed") {
        setStatus("Connection failed");
      }
    };

    // ----------------------------------------------------
    // CREATE OFFER
    // ----------------------------------------------------

    if (createOffer) {
      peer
        .createOffer()
        .then((offer) => peer.setLocalDescription(offer))
        .then(() => {
          socketRef.current?.emit("offer", {
            target: targetId,
            offer: peer.localDescription,
          });
        })
        .catch((err) => {
          console.error("Offer error:", err);
        });
    }

    return peer;
  }, []);

  // ========================================================
  // START CALL
  // ========================================================

  useEffect(() => {
    if (!roomId) {
      return;
    }

    let cancelled = false;

    const startCall = async () => {
      try {
        console.log("Starting call for room:", roomId);

        setStatus("Requesting camera...");

        // ------------------------------------------------
        // CAMERA + MICROPHONE
        // ------------------------------------------------

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());

          return;
        }

        console.log("Camera stream obtained:", stream);

        localStreamRef.current = stream;

        // ------------------------------------------------
        // ATTACH LOCAL VIDEO
        // ------------------------------------------------

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;

          localVideoRef.current.muted = true;

          localVideoRef.current.play().catch((err) => {
            console.log("Local video play:", err);
          });
        }

        setStatus("Connecting...");

        // ------------------------------------------------
        // SOCKET
        // ------------------------------------------------

        const socket = io(SERVER_URL, {
          transports: ["websocket", "polling"],
        });

        socketRef.current = socket;

        socket.on("connect", () => {
          console.log("Socket connected:", socket.id);

          socket.emit("join-call", {
            roomId,
          });
        });

        // =================================================
        // ROOM JOINED
        // =================================================
        socket.on(
          "participant-media-status",
          ({ socketId, micEnabled, cameraEnabled }) => {
            if (socketId !== socketRef.current?.id) {
              setRemoteMicEnabled(micEnabled);
              setRemoteCameraEnabled(cameraEnabled);
            }
          },
        );

        socket.on("room-joined", ({ participants }) => {
          console.log("Room joined:", participants);
          setParticipants(participants);

          if (participants.length === 0) {
            setStatus("Waiting for participant...");

            return;
          }

          const target = participants[0];

          remoteSocketIdRef.current = target;

          createPeer(target, true);
        });

        const durationInterval = window.setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);

        // =================================================
        // USER JOINED
        // =================================================

        socket.on("user-joined", ({ socketId }) => {
          console.log("User joined:", socketId);

          setParticipants((current) => {
            if (current.includes(socketId)) {
              return current;
            }

            return [...current, socketId];
          });

          remoteSocketIdRef.current = socketId;

          setStatus("Participant joined...");

          // The new user receives the
          // offer from the existing user.
        });

        // =================================================
        // RAISE HAND - RECEIVE FROM OTHER PARTICIPANT
        // =================================================

        socket.on("participant-hand", ({ socketId, raised }) => {
          console.log("Participant hand:", socketId, raised);

          // If this event belongs to the other participant,
          // update the remote video indicator.
          if (socketRef.current && socketId !== socketRef.current.id) {
            setRemoteHandRaised(Boolean(raised));
          }

          // Keep participant list status
          setRaisedHands((current) => {
            if (raised) {
              if (current.includes(socketId)) {
                return current;
              }

              return [...current, socketId];
            }

            return current.filter((id) => id !== socketId);
          });
        });
        // =================================================
        // OFFER
        // =================================================

        socket.on("offer", async ({ sender, offer }) => {
          console.log("Offer received");

          remoteSocketIdRef.current = sender;

          const peer = createPeer(sender, false);

          try {
            await peer.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await peer.createAnswer();

            await peer.setLocalDescription(answer);

            socket.emit("answer", {
              target: sender,
              answer: peer.localDescription,
            });
          } catch (err) {
            console.error("Answer error:", err);
          }
        });

        // =================================================
        // ANSWER
        // =================================================

        socket.on("answer", async ({ answer }) => {
          console.log("Answer received");

          if (!peerRef.current) {
            return;
          }

          try {
            await peerRef.current.setRemoteDescription(
              new RTCSessionDescription(answer),
            );

            setStatus("Connected");
          } catch (err) {
            console.error("Answer description error:", err);
          }
        });

        // =================================================
        // ICE
        // =================================================

        socket.on("ice-candidate", async ({ candidate }) => {
          if (!candidate || !peerRef.current) {
            return;
          }

          try {
            await peerRef.current.addIceCandidate(
              new RTCIceCandidate(candidate),
            );
          } catch (err) {
            console.error("ICE candidate error:", err);
          }
        });

        // =================================================
        // IN-CALL CHAT
        // =================================================

        socket.on("call-chat-message", ({ sender, message, timestamp }) => {
          setChatMessages((current) => [
            ...current,
            {
              sender,
              message,
              timestamp,
            },
          ]);
        });

        // =================================================
        // RAISE HAND
        // =================================================

        socket.on("participant-hand", ({ socketId, raised }) => {
          setRaisedHands((current) => {
            if (raised) {
              if (current.includes(socketId)) {
                return current;
              }

              return [...current, socketId];
            }

            return current.filter((id) => id !== socketId);
          });
        });
        // =================================================
        // USER LEFT
        // =================================================

        socket.on("user-left", () => {
          console.log("Participant left");

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }

          peerRef.current?.close();

          peerRef.current = null;

          remoteSocketIdRef.current = null;

          setStatus("Waiting for participant...");
        });

        // =================================================
        // CALL ERROR
        // =================================================

        socket.on("call-error", ({ message }) => {
          console.error("Call error:", message);

          setError(message);

          setStatus("Call error");
        });

        socket.on("disconnect", () => {
          console.log("Socket disconnected");
        });
      } catch (err) {
        console.error("Camera error:", err);

        setError(
          "Unable to access camera or microphone. Check browser permissions.",
        );

        setStatus("Camera unavailable");
      }
    };

    startCall();

    // ======================================================
    // CLEANUP
    // ======================================================

    return () => {
      cancelled = true;

      socketRef.current?.emit("leave-call");

      socketRef.current?.disconnect();

      peerRef.current?.close();

      screenStreamRef.current?.getTracks().forEach((track) => track.stop());

      screenStreamRef.current = null;

      localStreamRef.current?.getTracks().forEach((track) => track.stop());

      socketRef.current = null;

      peerRef.current = null;

      localStreamRef.current = null;
    };
  }, [roomId, createPeer]);

  // ========================================================
  // MICROPHONE
  // ========================================================

  const toggleMicrophone = () => {
    const stream = localStreamRef.current;

    if (!stream) {
      console.log("No local stream");

      return;
    }

    const tracks = stream.getAudioTracks();

    if (!tracks.length) {
      return;
    }

    const newState = !tracks[0].enabled;

    tracks.forEach((track) => {
      track.enabled = newState;
    });

    setMicEnabled(newState);

    console.log("Microphone:", newState);
  };

  // ========================================================
  // CAMERA
  // ========================================================

  const toggleCamera = () => {
    const stream = localStreamRef.current;

    if (!stream) {
      console.log("No local stream");

      return;
    }

    const tracks = stream.getVideoTracks();

    if (!tracks.length) {
      return;
    }

    const newState = !tracks[0].enabled;

    tracks.forEach((track) => {
      track.enabled = newState;
    });

    setCameraEnabled(newState);

    console.log("Camera:", newState);
  };

  // ========================================================
  // SCREEN SHARING
  // ========================================================

  const stopScreenSharing = async () => {
    const screenStream = screenStreamRef.current;

    if (!screenStream) {
      return;
    }

    const cameraStream = localStreamRef.current;

    const cameraTrack = cameraStream?.getVideoTracks()[0] || null;

    const peer = peerRef.current;

    if (peer && cameraTrack) {
      const videoSender = peer
        .getSenders()
        .find((sender) => sender.track?.kind === "video");

      if (videoSender) {
        try {
          await videoSender.replaceTrack(cameraTrack);
        } catch (err) {
          console.error("Failed to restore camera track:", err);
        }
      }
    }

    screenStream.getTracks().forEach((track) => track.stop());

    screenStreamRef.current = null;
    setIsScreenSharing(false);
    setCameraEnabled(true);

    if (localVideoRef.current && cameraStream) {
      localVideoRef.current.srcObject = cameraStream;
      localVideoRef.current.muted = true;

      localVideoRef.current.play().catch(() => {});
    }
  };

  const startScreenSharing = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Screen sharing is not supported by this browser.");
      return;
    }

    try {
      setError("");

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = screenStream.getVideoTracks()[0];

      if (!screenTrack) {
        screenStream.getTracks().forEach((track) => track.stop());
        return;
      }

      screenStreamRef.current = screenStream;

      // Show the shared screen locally.
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
        localVideoRef.current.muted = true;

        localVideoRef.current.play().catch(() => {});
      }

      // Replace the camera video track on the
      // existing WebRTC connection.
      const peer = peerRef.current;

      if (peer) {
        const videoSender = peer
          .getSenders()
          .find((sender) => sender.track?.kind === "video");

        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          peer.addTrack(screenTrack, screenStream);
        }
      }

      setIsScreenSharing(true);
      setCameraEnabled(false);

      screenTrack.onended = () => {
        stopScreenSharing();
      };

      console.log("Screen sharing started");
    } catch (err: any) {
      console.error("Screen sharing error:", err);

      // User cancelling the browser's screen picker
      // is not treated as an application error.
      if (err?.name !== "AbortError") {
        setError("Unable to start screen sharing.");
      }
    }
  };

  const toggleScreenSharing = async () => {
    if (isScreenSharing) {
      await stopScreenSharing();
    } else {
      await startScreenSharing();
    }
  };

  // ========================================================
  // SEND CHAT MESSAGE
  // ========================================================

  const sendChatMessage = () => {
    const message = chatMessage.trim();

    if (!message) {
      return;
    }

    if (!socketRef.current) {
      return;
    }

    socketRef.current.emit("call-chat-message", {
      roomId,
      message,
    });

    setChatMessage("");
  };

  // ========================================================
  // TOGGLE RAISE HAND
  // ========================================================

  const toggleRaiseHand = () => {
    const nextState = !handRaised;

    setHandRaised(nextState);

    socketRef.current?.emit("raise-hand", {
      roomId,
      raised: nextState,
    });
  };

  const sendMediaStatus = () => {
  if (!socketRef.current) return;

  socketRef.current.emit(
    "participant-media-status",
    {
      roomId,
      micEnabled:
        localStreamRef.current?.getAudioTracks()[0]
          ?.enabled ?? false,
      cameraEnabled:
        localStreamRef.current?.getVideoTracks()[0]
          ?.enabled ?? false,
    }
  );
};

sendMediaStatus();

  // ========================================================
  // LEAVE
  // ========================================================

  const leaveCall = () => {
    socketRef.current?.emit("leave-call");

    socketRef.current?.disconnect();

    peerRef.current?.close();

    screenStreamRef.current?.getTracks().forEach((track) => track.stop());

    screenStreamRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());

    router.push("/");
  };

  // ========================================================
  // UI
  // ========================================================

  return (
    <div className="min-h-screen bg-black text-white">
      {/* HEADER */}

      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">Video Call</h1>

          <p className="text-sm text-gray-400">
            Room: {roomId || "Loading..."}
          </p>

          <div className="text-sm text-gray-400">
            Call duration: {formatCallDuration(callDuration)}
          </div>
        </div>
        <div className="text-sm text-gray-400">
  Connection: {connectionQuality}
</div>

        <div className="text-sm">{status}</div>
      </div>

      {/* ERROR */}

      {error && (
        <div className="mx-6 mt-4 rounded-lg bg-red-900/50 p-3 text-red-300">
          {error}
        </div>
      )}

      {/* VIDEO GRID */}

      <div className="grid min-h-[70vh] gap-4 p-6 md:grid-cols-2">
        {/* LOCAL VIDEO */}

        <div className="relative overflow-hidden rounded-xl bg-gray-900">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="h-full min-h-[300px] w-full object-cover"
          />

          {handRaised && (
            <div className="absolute right-4 top-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-500 text-3xl shadow-lg">
              ✋
            </div>
          )}

          <div className="absolute bottom-4 left-4 rounded-lg bg-black/70 px-3 py-1">
            You
          </div>
        </div>

     
        {/* REMOTE VIDEO */}

        {isRemoteSpeaking && (
  <div className="absolute inset-0 pointer-events-none rounded-xl border-4 border-green-400" />
)}




        <div className="relative overflow-hidden rounded-xl bg-gray-900">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full min-h-[300px] w-full object-cover"
          />

          {remoteHandRaised && (
            <div className="absolute right-4 top-4 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500 text-4xl shadow-xl">
              ✋
            </div>
          )}

          {!remoteVideoRef.current?.srcObject && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              Waiting for participant...
            </div>
          )}

          <div className="absolute bottom-4 left-4 rounded-lg bg-black/70 px-3 py-1">
            Participant
          </div>
        </div>
      </div>

      {showParticipants && (
        <div className="mx-6 mb-4 rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Participants</h2>

            <button
              type="button"
              onClick={() => setShowParticipants(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-gray-800 p-3">
              <div>
                <p className="font-medium">You</p>

                <p className="text-xs text-gray-400">
                  {micEnabled ? "🎤 Microphone on" : "🔇 Microphone off"}
                </p>
              </div>

              <span>{cameraEnabled ? "📷" : "🚫📷"}</span>
            </div>

            {participants.map((participant) => (
              <div
                key={participant}
                className="flex items-center justify-between rounded-lg bg-gray-800 p-3"
              >
                <div>
                  <p className="font-medium">Participant</p>

                  <p className="max-w-[250px] truncate text-xs text-gray-400">
                    {participant}
                  </p>

                  {raisedHands.includes(participant) && (
                    <p className="mt-1 text-xs text-yellow-400">
                      ✋ Hand raised
                    </p>
                  )}
                </div>

                <span>👤</span>
              </div>
            ))}

            {participants.length === 0 && (
              <p className="text-sm text-gray-500">No other participants</p>
            )}
          </div>
        </div>
      )}

      
      {showChat && (
        <div className="mx-6 mb-4 flex h-[400px] flex-col rounded-xl border border-gray-800 bg-gray-900">
          {/* HEADER */}

          <div className="flex items-center justify-between border-b border-gray-800 p-4">
            <h2 className="font-semibold">In-call Chat</h2>

            <button
              type="button"
              onClick={() => setShowChat(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* MESSAGES */}

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {chatMessages.length === 0 && (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                No messages yet
              </div>
            )}

            {chatMessages.map((chat, index) => {
              const isMe = chat.sender === socketRef.current?.id;

              return (
                <div
                  key={`${chat.timestamp}-${index}`}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-xl px-4 py-2 ${
                      isMe ? "bg-blue-600" : "bg-gray-800"
                    }`}
                  >
                    <p className="break-words text-sm">{chat.message}</p>

                    <p className="mt-1 text-[10px] opacity-60">
                      {new Date(chat.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* INPUT */}

          <div className="flex gap-2 border-t border-gray-800 p-3">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendChatMessage();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 rounded-lg bg-gray-800 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:ring-1 focus:ring-blue-500"
            />

            <button
              type="button"
              onClick={sendChatMessage}
              className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
            >
              Send
            </button>
          </div>
        </div>
      )}
      {/* CONTROLS */}

      <div className="flex justify-center gap-3 border-t border-gray-800 p-6">
        <button
          type="button"
          onClick={toggleMicrophone}
          className="cursor-pointer rounded-full bg-gray-800 px-6 py-3 text-white hover:bg-gray-700"
        >
          {micEnabled ? "🎤 Mute" : "🔇 Unmute"}
        </button>

        <button
          type="button"
          onClick={toggleCamera}
          className="cursor-pointer rounded-full bg-gray-800 px-6 py-3 text-white hover:bg-gray-700"
        >
          {cameraEnabled ? "📷 Camera Off" : "📷 Camera On"}
        </button>

        <button
          type="button"
          onClick={toggleScreenSharing}
          className={`cursor-pointer rounded-full px-6 py-3 text-white hover:opacity-90 ${
            isScreenSharing ? "bg-orange-600" : "bg-gray-800"
          }`}
        >
          {isScreenSharing ? "🛑 Stop Sharing" : "🖥️ Share Screen"}
        </button>

        <button
          type="button"
          onClick={leaveCall}
          className="cursor-pointer rounded-full bg-red-600 px-7 py-3 font-semibold text-white hover:bg-red-700"
        >
          📞 Leave
        </button>

        <button
          type="button"
          onClick={() => setShowParticipants((current) => !current)}
          className="cursor-pointer rounded-full bg-gray-800 px-6 py-3 text-white hover:bg-gray-700"
        >
          👥 Participants ({participants.length + 1})
        </button>

        <button
          type="button"
          onClick={() => setShowChat((current) => !current)}
          className="cursor-pointer rounded-full bg-gray-800 px-6 py-3 text-white hover:bg-gray-700"
        >
          💬 Chat ({chatMessages.length})
        </button>

        <button
          type="button"
          onClick={toggleRaiseHand}
          className={`cursor-pointer rounded-full px-6 py-3 text-white ${
            handRaised
              ? "bg-yellow-600 hover:bg-yellow-700"
              : "bg-gray-800 hover:bg-gray-700"
          }`}
        >
          {handRaised ? "✋ Lower Hand" : "✋ Raise Hand"}
        </button>
      </div>
    </div>
  );
}
