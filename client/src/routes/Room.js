import io from "socket.io-client";
import * as bodyPix from "@tensorflow-models/body-pix";
import React, { useRef, useEffect } from "react";

const Room = (props) => {
  const userVideo = useRef();
  const socketRef = useRef();
  const partnerVideo = useRef();
  const peerRef = useRef();
  const otherUser = useRef();
  const userStream = useRef();
  const canvas1 = <canvas id="c2" />;
  const v3 = (
    <video id="hidden_vid" autoPlay src="https://i.imgur.com/sRqLSbt.mp4" />
  );
  const v1 = <video autoPlay ref={userVideo} />;
  const v2 = <video autoPlay ref={partnerVideo} />;
  //   const net = bodyPix.load();

  async function draw(playbackVideo, canvas, opacity) {
    const OUTPUT_STRIDE = 16;
    const SEGMENTATION_THRESHOLD = 0.5;
    const net = await bodyPix.load();
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
    const partSegment = net.segmentPersonParts(
      playbackVideo,
      OUTPUT_STRIDE,
      SEGMENTATION_THRESHOLD
    );
    const foregroundColor = { r: 255, g: 255, b: 255, a: 255 };
    const backgroundColor = { r: 0, g: 0, b: 0, a: 255 };
    const pixelCellWidth = 10.0;
    // const mask = bodyPix.toMask(
    //   partSegment,
    //   foregroundColor,
    //   backgroundColor,
    //   true
    // );

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
    bodyPix.drawMask(canvas, playbackVideo, colorParts, opacity);
  }
  function callUser(userID) {
    peerRef.current = createPeer(userID);
    userStream.current
      .getTracks()
      .forEach((track) => peerRef.current.addTrack(track, userStream.current));
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
  useEffect(() => {
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

    var playbackVideo = document.getElementById("hidden_vid");
    playbackVideo.style.display = "hidden";
    playbackVideo.width = 640;
    playbackVideo.height = 480;
    draw(playbackVideo, document.getElementById("c2"), 0.7);
    // extractFramesFromVideo("https://i.imgur.com/sRqLSbt.mp4");
  }, []);

  //   async function extractFramesFromVideo(videoUrl, fps = 1) {
  //     return new Promise(async (resolve) => {
  //       // fully download it first (no buffering):
  //       let videoBlob = await fetch(videoUrl).then((r) => r.blob());
  //       let videoObjectUrl = URL.createObjectURL(videoBlob);
  //       let hiddenv1 = document.createElement("video");
  //       let seekResolve;
  //       hiddenv1.addEventListener("seeked", async function () {
  //         if (seekResolve) seekResolve();
  //       });

  //       hiddenv1.src = videoObjectUrl;

  //       // workaround chromium metadata bug (https://stackoverflow.com/q/38062864/993683)
  //       while (
  //         (hiddenv1.duration === Infinity || isNaN(hiddenv1.duration)) &&
  //         hiddenv1.readyState < 2
  //       ) {
  //         await new Promise((r) => setTimeout(r, 1000));
  //         hiddenv1.currentTime = 10000000 * Math.random();
  //       }
  //       let duration = hiddenv1.duration;
  //       let canvas = document.getElementById("c2");
  //       let context = canvas.getContext("2d");
  //       let [w, h] = [hiddenv1.videoWidth, hiddenv1.videoHeight];
  //       canvas.width = w;
  //       canvas.height = h;

  //       let frames = [];
  //       let interval = 1 / fps;
  //       let currentTime = 0;

  //       while (currentTime < duration) {
  //         hiddenv1.currentTime = currentTime;
  //         await new Promise((r) => (seekResolve = r));

  //         context.drawImage(hiddenv1, 0, 0, w, h);
  //         const newImg = document.getElementById("bob");
  //         // newImg.src = canvas.toDataURL();
  //         draw(newImg, canvas, 0.7);
  //         let base64ImageData = canvas.toDataURL();
  //         frames.push(base64ImageData);

  //         currentTime += interval;
  //       }
  //       resolve(frames);
  //     });
  //   }
  return (
    <div>
      {v1}
      {v2}
      {v3}
      {canvas1}
    </div>
  );
};

export default Room;
