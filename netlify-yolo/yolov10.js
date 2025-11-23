async function initYOLO() {
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  navigator.mediaDevices.getUserMedia({video:true}).then(stream=>{
    video.srcObject = stream;
  });

  // Load ONNX model
  const session = await ort.InferenceSession.create("./model/yolov10n.onnx");

  async function detect() {
    ctx.drawImage(video,0,0,640,480);
    // Placeholder detection logic
    requestAnimationFrame(detect);
  }
  detect();
}