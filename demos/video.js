
function segmentBodyInRealTime() {
    const canvas = document.getElementById('output');
    const canvas2 = document.getElementById('output2');
    // since images are being fed from a webcam
  
    async function bodySegmentationFrame() {
      // if changing the model or the camera, wait a second for it to complete
      // then try again.
      if (state.changingArchitecture || state.changingMultiplier ||
          state.changingCamera || state.changingStride ||
          state.changingQuantBytes) {
        console.log('load model...');
        loadBodyPix();
        state.changingArchitecture = false;
        state.changingMultiplier = false;
        state.changingStride = false;
        state.changingQuantBytes = false;
      }
  
      // Begin monitoring code for frames per second
      stats.begin();
  
      const flipHorizontally = guiState.flipHorizontal;
  
      switch (guiState.estimate) {
        case 'segmentation':
          const multiPersonSegmentation = await estimateSegmentation();
          switch (guiState.segmentation.effect) {
            case 'mask':
              const ctx = canvas.getContext('2d');
              const ctx2 = canvas2.getContext('2d');
              const foregroundColor = {r: 255, g: 255, b: 255, a: 255};
              const backgroundColor = {r: 0, g: 0, b: 0, a: 255};
              const mask = bodyPix.toMask(
                  multiPersonSegmentation, foregroundColor, backgroundColor,
                  true);
  
              bodyPix.drawMask(
                  canvas, state.video, mask, guiState.segmentation.opacity,
                  guiState.segmentation.maskBlurAmount, flipHorizontally);
              bodyPix.drawMask(
                  canvas2, state.playbackVideo, mask, guiState.segmentation.opacity,
                  guiState.segmentation.maskBlurAmount, flipHorizontally);
              drawPoses(multiPersonSegmentation, flipHorizontally, ctx);
              drawPoses(multiPersonSegmentation, flipHorizontally, ctx2);
              break;
            case 'bokeh':
              bodyPix.drawBokehEffect(
                  canvas, state.video, multiPersonSegmentation,
                  +guiState.segmentation.backgroundBlurAmount,
                  guiState.segmentation.edgeBlurAmount, flipHorizontally);
              bodyPix.drawBokehEffect(
                  canvas2, state.playbackVideo, multiPersonSegmentation,
                  +guiState.segmentation.backgroundBlurAmount,
                  guiState.segmentation.edgeBlurAmount, flipHorizontally);
              break;
          }
  
          break;
        case 'partmap':
          const ctx = canvas.getContext('2d');
          const ctx2 = canvas2.getContext('2d');
          const multiPersonPartSegmentation = await estimatePartSegmentation();
          const coloredPartImageData = bodyPix.toColoredPartMask(
              multiPersonPartSegmentation,
              partColorScales[guiState.partMap.colorScale]);
  
          const maskBlurAmount = 0;
          switch (guiState.partMap.effect) {
            case 'pixelation':
              const pixelCellWidth = 10.0;
  
              bodyPix.drawPixelatedMask(
                  canvas, state.video, coloredPartImageData,
                  guiState.partMap.opacity, maskBlurAmount, flipHorizontally,
                  pixelCellWidth);
              bodyPix.drawPixelatedMask(
                  canvas2, state.video, coloredPartImageData,
                  guiState.partMap.opacity, maskBlurAmount, flipHorizontally,
                  pixelCellWidth);
              break;
            case 'partMap':
              bodyPix.drawMask(
                  canvas, state.video, coloredPartImageData, guiState.opacity,
                  maskBlurAmount, flipHorizontally);
              bodyPix.drawMask(
                  canvas2, state.video, coloredPartImageData, guiState.opacity,
                  maskBlurAmount, flipHorizontally);
              break;
            case 'blurBodyPart':
              const blurBodyPartIds = [0, 1];
              bodyPix.blurBodyPart(
                  canvas, state.video, multiPersonPartSegmentation,
                  blurBodyPartIds, guiState.partMap.blurBodyPartAmount,
                  guiState.partMap.edgeBlurAmount, flipHorizontally);
              bodyPix.blurBodyPart(
                  canvas2, state.video, multiPersonPartSegmentation,
                  blurBodyPartIds, guiState.partMap.blurBodyPartAmount,
                  guiState.partMap.edgeBlurAmount, flipHorizontally);
          }
          drawPoses(multiPersonPartSegmentation, flipHorizontally, ctx);
          drawPoses(multiPersonPartSegmentation, flipHorizontally, ctx2);
          break;
        default:
          break;
      }
  
      // End monitoring code for frames per second
      stats.end();
  
      requestAnimationFrame(bodySegmentationFrame);
    }
  
    bodySegmentationFrame();
  }