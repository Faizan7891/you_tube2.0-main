import { useRouter } from "next/router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";

const SERVER_URL = "http://localhost:5000";

export default function VideoCall() {
  const router = useRouter();

  const localVideoRef =
    useRef<HTMLVideoElement>(null);

  const remoteVideoRef =
    useRef<HTMLVideoElement>(null);

  const socketRef =
    useRef<Socket | null>(null);

  const peerRef =
    useRef<RTCPeerConnection | null>(null);

  const localStreamRef =
    useRef<MediaStream | null>(null);

  const remoteSocketIdRef =
    useRef<string | null>(null);

  const [roomId, setRoomId] =
    useState("");

  const [status, setStatus] =
    useState("Starting camera...");

  const [error, setError] =
    useState("");

  const [micEnabled, setMicEnabled] =
    useState(true);

  const [cameraEnabled, setCameraEnabled] =
    useState(true);

  const [isScreenSharing, setIsScreenSharing] =
    useState(false);

  const screenStreamRef =
    useRef<MediaStream | null>(null);

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
      const parts =
        router.asPath
          .split("?")[0]
          .split("/")
          .filter(Boolean);

      const callIndex =
        parts.indexOf("call");

      if (
        callIndex !== -1 &&
        parts[callIndex + 1]
      ) {
        id = parts[callIndex + 1];
      }
    }

    if (id) {
      console.log(
        "Room ID:",
        id
      );

      setRoomId(id);
    }
  }, [
    router.isReady,
    router.query.roomId,
    router.asPath,
  ]);

  // ========================================================
  // CREATE PEER
  // ========================================================

  const createPeer = useCallback(
    (
      targetId: string,
      createOffer: boolean
    ) => {
      if (peerRef.current) {
        return peerRef.current;
      }

      const peer =
        new RTCPeerConnection({
          iceServers: [
            {
              urls:
                "stun:stun.l.google.com:19302",
            },
            {
              urls:
                "stun:stun1.l.google.com:19302",
            },
          ],
        });

      peerRef.current = peer;

      // ----------------------------------------------------
      // ADD LOCAL TRACKS
      // ----------------------------------------------------

      const stream =
        localStreamRef.current;

      if (stream) {
        stream
          .getTracks()
          .forEach((track) => {
            peer.addTrack(
              track,
              stream
            );
          });
      }

      // ----------------------------------------------------
      // REMOTE TRACK
      // ----------------------------------------------------

      peer.ontrack = (
        event
      ) => {
        console.log(
          "Remote track received"
        );

        const remoteStream =
          event.streams[0];

        if (
          remoteVideoRef.current &&
          remoteStream
        ) {
          remoteVideoRef.current.srcObject =
            remoteStream;

          remoteVideoRef.current
            .play()
            .catch(() => {});
        }

        setStatus("Connected");
      };

      // ----------------------------------------------------
      // ICE
      // ----------------------------------------------------

      peer.onicecandidate = (
        event
      ) => {
        if (
          !event.candidate
        ) {
          return;
        }

        const socket =
          socketRef.current;

        if (!socket) return;

        socket.emit(
          "ice-candidate",
          {
            target: targetId,
            candidate:
              event.candidate,
          }
        );
      };

      // ----------------------------------------------------
      // CONNECTION STATE
      // ----------------------------------------------------

      peer.onconnectionstatechange =
        () => {
          console.log(
            "WebRTC:",
            peer.connectionState
          );

          if (
            peer.connectionState ===
            "connected"
          ) {
            setStatus(
              "Connected"
            );
          }

          if (
            peer.connectionState ===
            "connecting"
          ) {
            setStatus(
              "Connecting..."
            );
          }

          if (
            peer.connectionState ===
            "disconnected"
          ) {
            setStatus(
              "Connection interrupted"
            );
          }

          if (
            peer.connectionState ===
            "failed"
          ) {
            setStatus(
              "Connection failed"
            );
          }
        };

      // ----------------------------------------------------
      // CREATE OFFER
      // ----------------------------------------------------

      if (createOffer) {
        peer
          .createOffer()
          .then((offer) =>
            peer.setLocalDescription(
              offer
            )
          )
          .then(() => {
            socketRef.current?.emit(
              "offer",
              {
                target: targetId,
                offer:
                  peer.localDescription,
              }
            );
          })
          .catch((err) => {
            console.error(
              "Offer error:",
              err
            );
          });
      }

      return peer;
    },
    []
  );

  // ========================================================
  // START CALL
  // ========================================================

  useEffect(() => {
    if (!roomId) {
      return;
    }

    let cancelled = false;

    const startCall =
      async () => {
        try {
          console.log(
            "Starting call for room:",
            roomId
          );

          setStatus(
            "Requesting camera..."
          );

          // ------------------------------------------------
          // CAMERA + MICROPHONE
          // ------------------------------------------------

          const stream =
            await navigator.mediaDevices.getUserMedia(
              {
                video: true,
                audio: true,
              }
            );

          if (cancelled) {
            stream
              .getTracks()
              .forEach((track) =>
                track.stop()
              );

            return;
          }

          console.log(
            "Camera stream obtained:",
            stream
          );

          localStreamRef.current =
            stream;

          // ------------------------------------------------
          // ATTACH LOCAL VIDEO
          // ------------------------------------------------

          if (
            localVideoRef.current
          ) {
            localVideoRef.current.srcObject =
              stream;

            localVideoRef.current.muted =
              true;

            localVideoRef.current
              .play()
              .catch((err) => {
                console.log(
                  "Local video play:",
                  err
                );
              });
          }

          setStatus(
            "Connecting..."
          );

          // ------------------------------------------------
          // SOCKET
          // ------------------------------------------------

          const socket = io(
            SERVER_URL,
            {
              transports: [
                "websocket",
                "polling",
              ],
            }
          );

          socketRef.current =
            socket;

          socket.on(
            "connect",
            () => {
              console.log(
                "Socket connected:",
                socket.id
              );

              socket.emit(
                "join-call",
                {
                  roomId,
                }
              );
            }
          );

          // =================================================
          // ROOM JOINED
          // =================================================

          socket.on(
            "room-joined",
            ({
              participants,
            }) => {
              console.log(
                "Room joined:",
                participants
              );

              if (
                participants.length ===
                0
              ) {
                setStatus(
                  "Waiting for participant..."
                );

                return;
              }

              const target =
                participants[0];

              remoteSocketIdRef.current =
                target;

              createPeer(
                target,
                true
              );
            }
          );

          // =================================================
          // USER JOINED
          // =================================================

          socket.on(
            "user-joined",
            ({
              socketId,
            }) => {
              console.log(
                "User joined:",
                socketId
              );

              remoteSocketIdRef.current =
                socketId;

              setStatus(
                "Participant joined..."
              );

              // The new user receives the
              // offer from the existing user.
            }
          );

          // =================================================
          // OFFER
          // =================================================

          socket.on(
            "offer",
            async ({
              sender,
              offer,
            }) => {
              console.log(
                "Offer received"
              );

              remoteSocketIdRef.current =
                sender;

              const peer =
                createPeer(
                  sender,
                  false
                );

              try {
                await peer.setRemoteDescription(
                  new RTCSessionDescription(
                    offer
                  )
                );

                const answer =
                  await peer.createAnswer();

                await peer.setLocalDescription(
                  answer
                );

                socket.emit(
                  "answer",
                  {
                    target: sender,
                    answer:
                      peer.localDescription,
                  }
                );
              } catch (err) {
                console.error(
                  "Answer error:",
                  err
                );
              }
            }
          );

          // =================================================
          // ANSWER
          // =================================================

          socket.on(
            "answer",
            async ({
              answer,
            }) => {
              console.log(
                "Answer received"
              );

              if (
                !peerRef.current
              ) {
                return;
              }

              try {
                await peerRef.current.setRemoteDescription(
                  new RTCSessionDescription(
                    answer
                  )
                );

                setStatus(
                  "Connected"
                );
              } catch (err) {
                console.error(
                  "Answer description error:",
                  err
                );
              }
            }
          );

          // =================================================
          // ICE
          // =================================================

          socket.on(
            "ice-candidate",
            async ({
              candidate,
            }) => {
              if (
                !candidate ||
                !peerRef.current
              ) {
                return;
              }

              try {
                await peerRef.current.addIceCandidate(
                  new RTCIceCandidate(
                    candidate
                  )
                );
              } catch (err) {
                console.error(
                  "ICE candidate error:",
                  err
                );
              }
            }
          );

          // =================================================
          // USER LEFT
          // =================================================

          socket.on(
            "user-left",
            () => {
              console.log(
                "Participant left"
              );

              if (
                remoteVideoRef.current
              ) {
                remoteVideoRef.current.srcObject =
                  null;
              }

              peerRef.current?.close();

              peerRef.current =
                null;

              remoteSocketIdRef.current =
                null;

              setStatus(
                "Waiting for participant..."
              );
            }
          );

          // =================================================
          // CALL ERROR
          // =================================================

          socket.on(
            "call-error",
            ({
              message,
            }) => {
              console.error(
                "Call error:",
                message
              );

              setError(
                message
              );

              setStatus(
                "Call error"
              );
            }
          );

          socket.on(
            "disconnect",
            () => {
              console.log(
                "Socket disconnected"
              );
            }
          );
        } catch (err) {
          console.error(
            "Camera error:",
            err
          );

          setError(
            "Unable to access camera or microphone. Check browser permissions."
          );

          setStatus(
            "Camera unavailable"
          );
        }
      };

    startCall();

    // ======================================================
    // CLEANUP
    // ======================================================

    return () => {
      cancelled = true;

      socketRef.current?.emit(
        "leave-call"
      );

      socketRef.current?.disconnect();

      peerRef.current?.close();

      screenStreamRef.current
        ?.getTracks()
        .forEach((track) =>
          track.stop()
        );

      screenStreamRef.current = null;

      localStreamRef.current
        ?.getTracks()
        .forEach((track) =>
          track.stop()
        );

      socketRef.current = null;

      peerRef.current = null;

      localStreamRef.current =
        null;
    };
  }, [
    roomId,
    createPeer,
  ]);

  // ========================================================
  // MICROPHONE
  // ========================================================

  const toggleMicrophone =
    () => {
      const stream =
        localStreamRef.current;

      if (!stream) {
        console.log(
          "No local stream"
        );

        return;
      }

      const tracks =
        stream.getAudioTracks();

      if (!tracks.length) {
        return;
      }

      const newState =
        !tracks[0].enabled;

      tracks.forEach(
        (track) => {
          track.enabled =
            newState;
        }
      );

      setMicEnabled(
        newState
      );

      console.log(
        "Microphone:",
        newState
      );
    };

  // ========================================================
  // CAMERA
  // ========================================================

  const toggleCamera =
    () => {
      const stream =
        localStreamRef.current;

      if (!stream) {
        console.log(
          "No local stream"
        );

        return;
      }

      const tracks =
        stream.getVideoTracks();

      if (!tracks.length) {
        return;
      }

      const newState =
        !tracks[0].enabled;

      tracks.forEach(
        (track) => {
          track.enabled =
            newState;
        }
      );

      setCameraEnabled(
        newState
      );

      console.log(
        "Camera:",
        newState
      );
    };

  // ========================================================
  // SCREEN SHARING
  // ========================================================

  const stopScreenSharing = async () => {
    const screenStream =
      screenStreamRef.current;

    if (!screenStream) {
      return;
    }

    const cameraStream =
      localStreamRef.current;

    const cameraTrack =
      cameraStream?.getVideoTracks()[0] || null;

    const peer = peerRef.current;

    if (peer && cameraTrack) {
      const videoSender =
        peer
          .getSenders()
          .find(
            (sender) =>
              sender.track?.kind === "video"
          );

      if (videoSender) {
        try {
          await videoSender.replaceTrack(
            cameraTrack
          );
        } catch (err) {
          console.error(
            "Failed to restore camera track:",
            err
          );
        }
      }
    }

    screenStream
      .getTracks()
      .forEach((track) => track.stop());

    screenStreamRef.current = null;
    setIsScreenSharing(false);
    setCameraEnabled(true);

    if (localVideoRef.current && cameraStream) {
      localVideoRef.current.srcObject =
        cameraStream;
      localVideoRef.current.muted = true;

      localVideoRef.current
        .play()
        .catch(() => {});
    }
  };

  const startScreenSharing = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError(
        "Screen sharing is not supported by this browser."
      );
      return;
    }

    try {
      setError("");

      const screenStream =
        await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

      const screenTrack =
        screenStream.getVideoTracks()[0];

      if (!screenTrack) {
        screenStream
          .getTracks()
          .forEach((track) => track.stop());
        return;
      }

      screenStreamRef.current = screenStream;

      // Show the shared screen locally.
      if (localVideoRef.current) {
        localVideoRef.current.srcObject =
          screenStream;
        localVideoRef.current.muted = true;

        localVideoRef.current
          .play()
          .catch(() => {});
      }

      // Replace the camera video track on the
      // existing WebRTC connection.
      const peer = peerRef.current;

      if (peer) {
        const videoSender =
          peer
            .getSenders()
            .find(
              (sender) =>
                sender.track?.kind === "video"
            );

        if (videoSender) {
          await videoSender.replaceTrack(
            screenTrack
          );
        } else {
          peer.addTrack(
            screenTrack,
            screenStream
          );
        }
      }

      setIsScreenSharing(true);
      setCameraEnabled(false);

      screenTrack.onended = () => {
        stopScreenSharing();
      };

      console.log(
        "Screen sharing started"
      );
    } catch (err: any) {
      console.error(
        "Screen sharing error:",
        err
      );

      // User cancelling the browser's screen picker
      // is not treated as an application error.
      if (err?.name !== "AbortError") {
        setError(
          "Unable to start screen sharing."
        );
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
  // LEAVE
  // ========================================================

  const leaveCall =
    () => {
      socketRef.current?.emit(
        "leave-call"
      );

      socketRef.current?.disconnect();

      peerRef.current?.close();

      screenStreamRef.current
        ?.getTracks()
        .forEach((track) =>
          track.stop()
        );

      screenStreamRef.current = null;

      localStreamRef.current
        ?.getTracks()
        .forEach((track) =>
          track.stop()
        );

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
          <h1 className="text-xl font-bold">
            Video Call
          </h1>

          <p className="text-sm text-gray-400">
            Room:{" "}
            {roomId || "Loading..."}
          </p>
        </div>

        <div className="text-sm">
          {status}
        </div>

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

          <div className="absolute bottom-4 left-4 rounded-lg bg-black/70 px-3 py-1">
            You
          </div>

        </div>

        {/* REMOTE VIDEO */}

        <div className="relative overflow-hidden rounded-xl bg-gray-900">

          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full min-h-[300px] w-full object-cover"
          />

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

      {/* CONTROLS */}

      <div className="flex justify-center gap-3 border-t border-gray-800 p-6">

        <button
          type="button"
          onClick={
            toggleMicrophone
          }
          className="cursor-pointer rounded-full bg-gray-800 px-6 py-3 text-white hover:bg-gray-700"
        >
          {micEnabled
            ? "🎤 Mute"
            : "🔇 Unmute"}
        </button>

        <button
          type="button"
          onClick={
            toggleCamera
          }
          className="cursor-pointer rounded-full bg-gray-800 px-6 py-3 text-white hover:bg-gray-700"
        >
          {cameraEnabled
            ? "📷 Camera Off"
            : "📷 Camera On"}
        </button>

        <button
          type="button"
          onClick={
            toggleScreenSharing
          }
          className={`cursor-pointer rounded-full px-6 py-3 text-white hover:opacity-90 ${
            isScreenSharing
              ? "bg-orange-600"
              : "bg-gray-800"
          }`}
        >
          {isScreenSharing
            ? "🛑 Stop Sharing"
            : "🖥️ Share Screen"}
        </button>

        <button
          type="button"
          onClick={
            leaveCall
          }
          className="cursor-pointer rounded-full bg-red-600 px-7 py-3 font-semibold text-white hover:bg-red-700"
        >
          📞 Leave
        </button>

      </div>

    </div>
  );
}