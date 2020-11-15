import React from "react";

import io from "socket.io-client";
import * as bodyPix from "@tensorflow-models/body-pix";
// import { op } from "@tensorflow/tfjs-core";

class Room extends React.Component {
  constructor(props) {
    super(props);
    // const mobileNetMultiplier = 0.5;
    // const outputStride = 16;

    // const pixelCellWidth = 10.0;

    // bodyPix.drawPixelatedMask(
    //   canvas,
    //   state.video,
    //   coloredPartImageData,
    //   guiState.partMap.opacity,
    //   maskBlurAmount,
    //   flipHorizontally,
    //   pixelCellWidth
    // );
    this.state = {
      userVideo: React.createRef(),
      partnerVideo: React.createRef(),
      peerRef: React.createRef(),
      socketRef: React.createRef(),
      otherUser: React.createRef(),
      userStream: React.createRef(),
      net: bodyPix.load(),
    };
  }

  async getPartSegmentation(img) {
    const OUTPUT_STRIDE = 16;
    const SEGMENTATION_THRESHOLD = 0.5;

    return this.state.net.estimatePartSegmentation(
      img,
      OUTPUT_STRIDE,
      SEGMENTATION_THRESHOLD
    );
  }

  getColoredParts(partSegmentation) {
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
    return this.state.net.toColoredPartImageData(partSegmentation, RAINBOW);
  }

  drawColorOnCanvas(canvas, img, coloredPart, opacity) {
    bodyPix.drawMask(canvas, img, coloredPart, opacity);
  }

  componentDidMount() {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        var temp_userVideo = { ...this.state.userVideo };
        temp_userVideo.current.srcObject = stream;
        this.setState({ userVideo: temp_userVideo });
        //   this.state.userVideo.current.srcObject = stream;

        // this.state.userStream.current = stream;
        var temp_userStream = { ...this.state.userStream };
        temp_userStream.current = stream;
        this.setState({ userStream: temp_userStream });
        //this.state.socketRef.current = io.connect("/");
        var temp_socketRef = { ...this.state.socketRef };
        temp_socketRef.current = io.connect("/");
        this.setState({ socketRef: temp_socketRef });

        this.state.socketRef.current.emit(
          "join room",
          this.props.match.params.roomID
        );

        this.state.socketRef.current.on("other user", (userID) => {
          this.callUser(userID);
          //this.state.otherUser.current = userID;
          var temp_otherUser = { ...this.state.otherUser };
          temp_otherUser.current = userID;
          this.setState({ otherUser: temp_otherUser });
        });

        this.state.socketRef.current.on("user joined", (userID) => {
          //this.state.otherUser.current = userID;
          var temp_otherUser = { ...this.state.otherUser };
          temp_otherUser.current = userID;
          this.setState({ otherUser: temp_otherUser });
        });

        this.state.socketRef.current.on("offer", this.handleReceiveCall);

        this.state.socketRef.current.on("answer", this.handleAnswer);

        this.state.socketRef.current.on(
          "ice-candidate",
          this.handleNewICECandidateMsg
        );
      });
  }

  callUser(userID) {
    //this.state.peerRef.current = this.createPeer(userID);
    var temp_peerRef = { ...this.state.peerRef };
    temp_peerRef.current = this.createPeer(userID);
    this.setState({ peerRef: temp_peerRef });

    this.state.userStream.current
      .getTracks()
      .forEach((track) =>
        this.state.peerRef.current.addTrack(
          track,
          this.state.userStream.current
        )
      );
  }

  createPeer(userID) {
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

    peer.onicecandidate = this.handleICECandidateEvent;
    peer.ontrack = this.handleTrackEvent;
    peer.onnegotiationneeded = () => this.handleNegotiationNeededEvent(userID);

    return peer;
  }

  handleNegotiationNeededEvent(userID) {
    this.state.peerRef.current
      .createOffer()
      .then((offer) => {
        return this.state.peerRef.current.setLocalDescription(offer);
      })
      .then(() => {
        const payload = {
          target: userID,
          caller: this.state.socketRef.current.id,
          sdp: this.state.peerRef.current.localDescription,
        };
        this.state.socketRef.current.emit("offer", payload);
      })
      .catch((e) => console.log(e));
  }

  handleReceiveCall(incoming) {
    //this.state.peerRef.current = this.createPeer();
    var temp_peerRef = { ...this.state.peerRef };
    temp_peerRef.current = this.createPeer();
    this.setState({ peerRef: temp_peerRef });
    const desc = new RTCSessionDescription(incoming.sdp);
    this.state.peerRef.current
      .setRemoteDescription(desc)
      .then(() => {
        this.state.userStream.current
          .getTracks()
          .forEach((track) =>
            this.state.peerRef.current.addTrack(
              track,
              this.state.userStream.current
            )
          );
      })
      .then(() => {
        return this.state.peerRef.current.createAnswer();
      })
      .then((answer) => {
        return this.state.peerRef.current.setLocalDescription(answer);
      })
      .then(() => {
        const payload = {
          target: incoming.caller,
          caller: this.state.socketRef.current.id,
          sdp: this.state.peerRef.current.localDescription,
        };
        this.state.socketRef.current.emit("answer", payload);
      });
  }

  handleAnswer(message) {
    const desc = new RTCSessionDescription(message.sdp);
    this.state.peerRef.current
      .setRemoteDescription(desc)
      .catch((e) => console.log(e));
  }

  handleICECandidateEvent(state) {
    return (e) => {
      if (e.candidate) {
        console.log(e);
        console.log(this);
        const payload = {
          target: state.otherUser.current,
          candidate: e.candidate,
        };
        state.socketRef.current.emit("ice-candidate", payload);
      }
    };
  }

  handleNewICECandidateMsg(incoming) {
    const candidate = new RTCIceCandidate(incoming);

    this.state.peerRef.current
      .addIceCandidate(candidate)
      .catch((e) => console.log(e));
  }

  handleTrackEvent(e) {
    //   double check this
    // this.state.partnerVideo.current.srcObject = e.streams[0];
    var temp_partnerVideo = { ...this.state.partnerVideo };
    temp_partnerVideo.current = e.streams[0];
    this.setState({ partnerVideo: temp_partnerVideo });
  }

  render() {
    return (
      <div>
        <video autoPlay ref={this.state.userVideo} />
        <video autoPlay ref={this.state.partnerVideo} />
      </div>
    );
  }
}

export default Room;
