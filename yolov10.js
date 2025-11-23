// yolov10.js - loads ONNX model and uses SimpleTracker for tracking
// NOTE: This file assumes you have an ONNX model at ./model/yolov10n.onnx
// The model must output detections in format: [{x1,y1,x2,y2,score,label}, ...]
// If your exported model uses different tensors, adapt `runModel` accordingly.

// Tracker (Simple IOU-based SORT-like)
/* global SimpleTracker */
const tracker = new SimpleTracker({ iouThreshold: 0.3, maxAge: 30, minHits: 1 });

async function initYOLO() {
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  navigator.mediaDevices.getUserMedia({video:true}).then(stream=>{
    video.srcObject = stream;
  });

  // Try to load ONNX Runtime if available; if not, detection will be skipped.
  let session = null;
  try {
    session = await ort.InferenceSession.create("./model/yolov10n.onnx");
    console.log("Model loaded.");
  } catch (e) {
    console.warn("ONNX model not loaded (placeholder). Detection will be mocked for demo.", e);
  }

  async function runModel(imageData) {
    // Placeholder: adapt this function to your model's input/output
    // For now we return a mock detection to demonstrate tracking
    if (!session) {
      // return an example detection every few frames (mock)
      return [{ x1: 100, y1: 100, x2: 220, y2: 280, score: 0.85, label: "person" }];
    }
    // Real model inference should go here: preprocess imageData -> tensor -> session.run -> postprocess
    // TODO: implement model-specific preprocessing & postprocessing
    return [];
  }

  function drawDetections(tracks) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(video,0,0,canvas.width,canvas.height);

    for (const t of tracks) {
      const b = t.bbox;
      ctx.strokeStyle = 'lime';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
      ctx.fillStyle = 'lime';
      ctx.font = '16px Arial';
      const txt = `${t.bbox.label || 'obj'} ID:${t.id} ${t.bbox.score? (t.bbox.score*100).toFixed(0)+'%':''}`;
      ctx.fillText(txt, b.x1+4, b.y1+18);
    }
  }

  function saveTracksToFirebase(tracks) {
    if (typeof db === 'undefined') return;
    const now = Date.now();
    for (const t of tracks) {
      if (!t.confirmed) continue;
      db.ref("tracks").push({
        id: t.id,
        label: t.bbox.label || null,
        score: t.bbox.score || null,
        bbox: t.bbox,
        time: now
      });
    }
  }

  async function detectLoop() {
    // draw video to canvas, get image data, run model -> get detections -> update tracker
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);

    const detections = await runModel(imageData); // array of {x1,y1,x2,y2,score,label}
    const tracks = tracker.update(detections);

    drawDetections(tracks);
    saveTracksToFirebase(tracks);

    requestAnimationFrame(detectLoop);
  }

  detectLoop();
}
