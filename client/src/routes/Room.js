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
  var score1 = 0;
  var score2 = 0;
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
    if (playbackVideo.readyState === 4) {
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
      if (typeof partSegment == "undefined") {
        return null;
      } else {
        return partSegment['allPoses'][0];
      }
    } else {
      return null;
    }
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

  function calculateScoreForPose(referencePose, userPose) {
    function dotProduct(x1, y1, x2, y2) {
      return (x1 * x2) + (y1 * y2);
    }
    // Math time!
    var poses = new Array(referencePose.keypoints.length);
    var referenceXTotal = 0;
    var referenceYTotal = 0;
    var userXTotal = 0;
    var userYTotal = 0;

    // Get the average of both wireframes' x and y values
    var i;
    for (i = 0; i < poses.length; i++) {
        poses[i] = [referencePose.keypoints[i], userPose.keypoints[i]];
        //console.log(poses[i][0]['position']['x'])
        referenceXTotal += poses[i][0]['position']['x'];
        referenceYTotal += poses[i][0]['position']['y'];
        userXTotal += poses[i][1]['position']['x'];
        userYTotal += poses[i][1]['position']['x'];
    }

    const referenceXMean = referenceXTotal / poses.length
    const referenceYMean = referenceYTotal / poses.length
    const userXMean = userXTotal / poses.length
    const userYMean = userYTotal / poses.length

    // Standardize these so that the positions are centered around (0,0)
    var standardizedPoses = new Array(poses.length);

    for (i = 0; i < poses.length; i++) {
        standardizedPoses[i] = 
        [
            {
                'whichPose': 'reference', 'part': poses[i][0]['part'], 'position': 
                {
                    'x': poses[i][0]['position']['x'] - referenceXMean, 'y': poses[i][0]['position']['y'] - referenceYMean
                }
            },
            {
                'whichPose': 'user', 'part': poses[i][1]['part'], 'position': 
                {
                    'x': poses[i][1]['position']['x'] - userXMean, 'y': poses[i][1]['position']['y'] - userYMean
                }
            }
        ];
    }
    
    //console.log(standardizedPoses);

    // Now normalize these vectors
    var normalizedPoses = new Array(poses.length);

    for (i = 0; i < poses.length; i++) {
        var [referenceXValue, referenceYValue] = [standardizedPoses[i][0]['position']['x'], standardizedPoses[i][0]['position']['y']];
        var referenceVectorMagnitude = Math.sqrt(Math.pow(referenceXValue, 2) + Math.pow(referenceYValue, 2));
        var [referenceNormalizedX, referenceNormalizedY] = [referenceXValue / referenceVectorMagnitude, referenceYValue / referenceVectorMagnitude];

        var [userXValue, userYValue] = [standardizedPoses[i][1]['position']['x'], standardizedPoses[i][1]['position']['y']];
        var userVectorMagnitude = Math.sqrt(Math.pow(userXValue, 2) + Math.pow(userYValue, 2));
        var [userNormalizedX, userNormalizedY] = [userXValue / userVectorMagnitude, userYValue / userVectorMagnitude];
        

        normalizedPoses[i] = 
        { 
            'referencePose': 
            {
                'part': standardizedPoses[i][0]['part'], 'position': 
                    {
                        'x': referenceNormalizedX, 'y': referenceNormalizedY
                    }
            },
            'userPose':
            {
                'part': standardizedPoses[i][1]['part'], 'position': 
                    {
                        'x': userNormalizedX, 'y': userNormalizedY
                    }
            }
        }
    }
    //console.log(normalizedPoses)

    /*
      * The positions are now all the same magnitude and centered around (0,0).
      * Take the dot product to get the angle between the vectors, that tells you how
      * close one wireframe is to another
      * 
      * Trying to do so in a way that is efficient and concise!
      */

      var dotproductTotal = 0;
      var mA = 0;
      var mB = 0;
      for (i = 0; i < normalizedPoses.length; i++) {
          var aX = normalizedPoses[i]['referencePose']['position']['x'];
          var aY = normalizedPoses[i]['referencePose']['position']['y'];
          var bX = normalizedPoses[i]['userPose']['position']['x'];
          var bY = normalizedPoses[i]['userPose']['position']['y'];
          
          dotproductTotal += dotProduct(aX, aY, bX, bY);
          mA += Math.sqrt((aX * aX) + (aY * aY));
          mB += Math.sqrt((bX * bX) + (bY * bY));
      }
      mA = Math.sqrt(mA);
      mB = Math.sqrt(mB);
      /*
      * The higher this value, the more similar the user pose is to the the reference pose.
      * ~.95 is a perfect score
      */
      var similarity = (dotproductTotal) / ((mA) * (mB));

      // Need to provide a "score" given different levels of similarity

      const PERFECT = .95;
      const GREAT = .9;
      const GOOD = .85;
      const OK = .8;

      var score;
      if (similarity >= PERFECT) {
        score = 1000;
      } else if (similarity >= GREAT) {
        score = 750;
      } else if (similarity >= GOOD) {
        score = 500;
      } else if (similarity >= OK) {
        score = 300;
      } else {
        score = 0;
      }
      console.log(similarity)
      return score;
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
          init_video(mePlaybackVideo);
          init_video(otherPlaybackVideo);
          let opacity = 1;
          drawDance(mePlaybackVideo, document.getElementById("c1"), opacity).then((pose1) => {
            drawDance(dancePlaybackVideo, document.getElementById("c2"), opacity).then((referencePose) => {
                if (pose1 != null && referencePose != null) {
                  score1 += calculateScoreForPose(referencePose, pose1);
                }
            });
          });
          console.log("Score for player 1: " + score1);
          /*
          TODO: draw a second person and account for their score
          var pose2 = drawDance(otherPlaybackVideo, document.getElementById("c3"), opacity);
          if (pose2 != null) {
            score2 += calculateScoreForPose(referencePose, pose2);
            console.log("Score for player 2: " + score2)    ;
          }
          */    
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
