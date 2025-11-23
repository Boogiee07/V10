// tracker.js - simple SORT-like tracker (IOU matching) with persistent IDs
// This is NOT full DeepSORT (no appearance embeddings), but is a lightweight tracker
// that assigns stable IDs using IOU + simple track lifecycle management.
// To upgrade to DeepSORT, provide an appearance embedding function and a proper
// Kalman filter for motion prediction.

function iou(boxA, boxB) {
  const xA = Math.max(boxA.x1, boxB.x1);
  const yA = Math.max(boxA.y1, boxB.y1);
  const xB = Math.min(boxA.x2, boxB.x2);
  const yB = Math.min(boxA.y2, boxB.y2);
  const interW = Math.max(0, xB - xA);
  const interH = Math.max(0, yB - yA);
  const interArea = interW * interH;
  const boxAArea = (boxA.x2 - boxA.x1) * (boxA.y2 - boxA.y1);
  const boxBArea = (boxB.x2 - boxB.x1) * (boxB.y2 - boxB.y1);
  const union = boxAArea + boxBArea - interArea;
  return union === 0 ? 0 : interArea / union;
}

class SimpleTracker {
  constructor({ iouThreshold = 0.3, maxAge = 30, minHits = 1 } = {}) {
    this.iouThreshold = iouThreshold;
    this.maxAge = maxAge;   // frames to keep alive without match
    this.minHits = minHits; // minimum hits to consider confirmed
    this.tracks = [];       // {id, bbox, age, hits, lastSeenFrame}
    this._nextId = 1;
    this._frameCount = 0;
  }

  _createTrack(bbox) {
    const t = {
      id: this._nextId++,
      bbox: bbox,          // {x1,y1,x2,y2,score,label}
      age: 0,
      hits: 1,
      lastSeenFrame: this._frameCount
    };
    this.tracks.push(t);
    return t;
  }

  _removeStaleTracks() {
    this.tracks = this.tracks.filter(t => (this._frameCount - t.lastSeenFrame) <= this.maxAge);
  }

  update(detections) {
    // detections: array of {x1,y1,x2,y2,score,label}
    this._frameCount += 1;
    const matches = [];
    const unmatchedDetections = new Set(detections.map((d,i)=>i));
    const unmatchedTracks = new Set(this.tracks.map((t,i)=>i));

    // Compute IoU matrix
    const iouMatrix = [];
    for (let i=0;i<this.tracks.length;i++) {
      const row = [];
      for (let j=0;j<detections.length;j++) {
        row.push(iou(this.tracks[i].bbox, detections[j]));
      }
      iouMatrix.push(row);
    }

    // Greedy matching by highest IoU
    if (this.tracks.length>0 && detections.length>0) {
      // create list of (trackIdx, detIdx, iou) and sort desc
      const pairs = [];
      for (let i=0;i<iouMatrix.length;i++) {
        for (let j=0;j<iouMatrix[i].length;j++) {
          pairs.push({i,j,val:iouMatrix[i][j]});
        }
      }
      pairs.sort((a,b)=>b.val - a.val);
      for (const p of pairs) {
        if (p.val < this.iouThreshold) break;
        if (unmatchedTracks.has(p.i) && unmatchedDetections.has(p.j)) {
          // match
          matches.push([p.i,p.j]);
          unmatchedTracks.delete(p.i);
          unmatchedDetections.delete(p.j);
        }
      }
    }

    // Update matched tracks
    for (const [tIdx, dIdx] of matches) {
      const tr = this.tracks[tIdx];
      const det = detections[dIdx];
      tr.bbox = det;
      tr.hits += 1;
      tr.lastSeenFrame = this._frameCount;
    }

    // Create new tracks for unmatched detections
    for (const dIdx of unmatchedDetections) {
      this._createTrack(detections[dIdx]);
    }

    // Age unmatched tracks
    for (let ti=0; ti<this.tracks.length; ti++) {
      const tr = this.tracks[ti];
      if (tr.lastSeenFrame !== this._frameCount) {
        tr.age += 1;
      } else {
        tr.age = 0;
      }
    }

    // Remove stale tracks
    this._removeStaleTracks();

    // Prepare output: confirmed and tentative tracks
    const output = [];
    for (const tr of this.tracks) {
      const confirmed = tr.hits >= this.minHits;
      output.push({
        id: tr.id,
        bbox: tr.bbox,
        confirmed,
        age: tr.age
      });
    }
    return output;
  }
}

// Export (for modules or direct include)
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = { SimpleTracker };
} else {
  window.SimpleTracker = SimpleTracker;
}
