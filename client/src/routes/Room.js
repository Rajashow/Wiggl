import io from "socket.io-client";
import * as bodyPix from "@tensorflow-models/body-pix";
import React, { useRef, useEffect } from "react";
// import takitaki from ".";

const Room = (props) => {
  const userVideo = useRef();
  const socketRef = useRef();
  const partnerVideo = useRef();
  const peerRef = useRef();
  const otherUser = useRef();
  const userStream = useRef();
  let ran_once = false;
  let net = null;
  const OUTPUT_STRIDE = 16;
  const SEGMENTATION_THRESHOLD = 0.1;
  const RAINBOW = [
    [110, 64, 170],
    [106, 72, 183],
    [100, 81, 196],
    [92, 91, 206],
    [84, 101, 214],
    [75, 113, 221],
    [66, 125, 224],
    [56, 138, 226],
    [48, 150, 224],
    [40, 163, 220],
    [33, 176, 214],
    [29, 188, 205],
    [26, 199, 194],
    [26, 210, 182],
    [28, 219, 169],
    [33, 227, 155],
    [41, 234, 141],
    [51, 240, 128],
    [64, 243, 116],
    [79, 246, 105],
    [96, 247, 97],
    [115, 246, 91],
    [134, 245, 88],
    [155, 243, 88],
  ];
  const pixelCellWidth = 10.0;

  const canvas1 = <canvas id="c1" />;
  const canvas2 = <canvas id="c2" />;
  const canvas3 = <canvas id="c3" />;

  const v1 = (
    <video style={{ display: "none" }} id="me" autoPlay ref={userVideo} />
  );
  const v2 = (
    <video style={{ display: "none" }} id="other" autoPlay ref={partnerVideo} />
  );
  const v3 = (
    <video
      autoPlay
      loop
      id="dance_hidden"
      src="https://i.imgur.com/MCB77Uw.mp4"
      style={{ display: "none" }}
      crossOrigin="Anonymous"
    />
  );
  async function drawDance(playbackVideo, canvas, opacity) {
    playbackVideo.play();

    const partSegment = await net.segmentPersonParts(
      playbackVideo,
      OUTPUT_STRIDE,
      SEGMENTATION_THRESHOLD
    );

    const colorParts = bodyPix.toColoredPartMask(partSegment, RAINBOW);
    bodyPix.drawPixelatedMask(
      canvas,
      playbackVideo,
      colorParts,
      opacity,
      0,
      true,
      pixelCellWidth
    );
  }

  function createPeer(userID) {
    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.stunprotocol.org",
        },
        {
          urls: "turn:numb.viagenie.ca",
          credential: "muazkh",
          username: "webrtc@live.com",
        },
      ],
    });

    peer.onicecandidate = handleICECandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

    return peer;
  }

  function handleNegotiationNeededEvent(userID) {
    peerRef.current
      .createOffer()
      .then((offer) => {
        return peerRef.current.setLocalDescription(offer);
      })
      .then(() => {
        const payload = {
          target: userID,
          caller: socketRef.current.id,
          sdp: peerRef.current.localDescription,
        };
        socketRef.current.emit("offer", payload);
      })
      .catch((e) => console.log(e));
  }

  function handleReceiveCall(incoming) {
    peerRef.current = createPeer();
    const desc = new RTCSessionDescription(incoming.sdp);
    peerRef.current
      .setRemoteDescription(desc)
      .then(() => {
        userStream.current
          .getTracks()
          .forEach((track) =>
            peerRef.current.addTrack(track, userStream.current)
          );
      })
      .then(() => {
        return peerRef.current.createAnswer();
      })
      .then((answer) => {
        return peerRef.current.setLocalDescription(answer);
      })
      .then(() => {
        const payload = {
          target: incoming.caller,
          caller: socketRef.current.id,
          sdp: peerRef.current.localDescription,
        };
        socketRef.current.emit("answer", payload);
      });
  }

  function handleAnswer(message) {
    const desc = new RTCSessionDescription(message.sdp);
    peerRef.current.setRemoteDescription(desc).catch((e) => console.log(e));
  }

  function handleICECandidateEvent(e) {
    if (e.candidate) {
      const payload = {
        target: otherUser.current,
        candidate: e.candidate,
      };
      socketRef.current.emit("ice-candidate", payload);
    }
  }

  function handleNewICECandidateMsg(incoming) {
    const candidate = new RTCIceCandidate(incoming);

    peerRef.current.addIceCandidate(candidate).catch((e) => console.log(e));
  }

  function handleTrackEvent(e) {
    partnerVideo.current.srcObject = e.streams[0];
  }
  function callUser(userID) {
    peerRef.current = createPeer(userID);
    userStream.current
      .getTracks()
      .forEach((track) => peerRef.current.addTrack(track, userStream.current));
  }
  useEffect(() => {
    bodyPix.load().then((net_) => {
      net = net_;
      navigator.mediaDevices
        .getUserMedia({ audio: true, video: true })
        .then((stream) => {
          userVideo.current.srcObject = stream;
          userStream.current = stream;

          socketRef.current = io.connect("/");
          socketRef.current.emit("join room", props.match.params.roomID);

          socketRef.current.on("other user", (userID) => {
            callUser(userID);
            otherUser.current = userID;
          });

          socketRef.current.on("user joined", (userID) => {
            otherUser.current = userID;
          });

          socketRef.current.on("offer", handleReceiveCall);

          socketRef.current.on("answer", handleAnswer);

          socketRef.current.on("ice-candidate", handleNewICECandidateMsg);
        });

      let init_video = (vid) => {
        vid.pause();
        vid.width = 640;
        vid.height = 480;
      };
      if (!ran_once) {
        ran_once = true;
        setInterval(function () {
          var mePlaybackVideo = document.getElementById("me");
          var otherPlaybackVideo = document.getElementById("other");
          var dancePlaybackVideo = document.getElementById("dance_hidden");
          init_video(dancePlaybackVideo);
          let opacity = 1;
          if (mePlaybackVideo.readyState === 4) {
            drawDance(mePlaybackVideo, document.getElementById("c1"), opacity);
          }
          drawDance(dancePlaybackVideo, document.getElementById("c2"), opacity);
        }, 200);
      }
    });
  }, []);

  return (
    <div>
      {v1}
      {v2}
      {v3}
      {canvas1}
      {canvas2}
      {canvas3}
    </div>
  );
};

export default Room;
