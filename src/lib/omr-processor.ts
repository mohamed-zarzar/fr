/**
 * OMR (Optical Mark Recognition) Processor
 *
 * Processes a photographed answer sheet image to detect filled bubbles.
 * Precisely calibrated to match the layout of PrintAnswerSheet.tsx.
 *
 * Pipeline:
 * 1. Draw image to canvas, convert to grayscale
 * 2. Otsu binarization (for corner detection only)
 * 3. Detect 4 corner alignment markers with centroid refinement
 * 4. Auto-calibrate vertical grid offset
 * 5. Sample each bubble using grayscale intensity (not binary)
 * 6. Per-row relative thresholding to determine filled bubbles
 * 7. Return detected answers with confidence scores
 */

export interface OMRResult {
  /** question number (1-100) -> selected option ('A','B','C','D') or null */
  answers: Record<number, string | null>;
  /** Questions where detection was ambiguous (multiple fills or uncertain) */
  flaggedQuestions: number[];
  /** Confidence score 0-1 for overall detection quality */
  confidence: number;
  /** Debug: processed image as data URL */
  debugImageUrl?: string;
}

interface Point {
  x: number;
  y: number;
}

interface MarkerCorners {
  topLeft: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomRight: Point;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;
const ROWS_PER_COLUMN = 25;
const COLUMNS = 4;
const TOTAL_QUESTIONS = 100;

// ════════════════════════════════════════════════════════════════════
// Physical Layout Constants (mm)
// All relative to TL marker center.
// Derived from PrintAnswerSheet.tsx CSS at 96 DPI (1px = 0.2646mm).
// ════════════════════════════════════════════════════════════════════

// Distance between marker centers
const SPAN_X_MM = 190; // TL→TR (page 210mm, markers at 10mm from each edge)
const SPAN_Y_MM = 277; // TL→BL (page 297mm, markers at 10mm from each edge)

// Column positions (left edge from TL marker center X)
// Content left = 12mm page padding - 10mm marker center = 2mm
// Column width = (186mm content - 3 * 1.587mm gap) / 4 = 45.31mm
// Column gap = 6px = 1.587mm
const CONTENT_LEFT_MM = 2.0;
const COL_WIDTH_MM = 45.31;
const COL_GAP_MM = 1.587;
const COL_LEFT_MM = [
  CONTENT_LEFT_MM,
  CONTENT_LEFT_MM + COL_WIDTH_MM + COL_GAP_MM,
  CONTENT_LEFT_MM + 2 * (COL_WIDTH_MM + COL_GAP_MM),
  CONTENT_LEFT_MM + 3 * (COL_WIDTH_MM + COL_GAP_MM),
]; // ≈ [2.0, 48.9, 95.8, 142.7]

// Bubble center X offsets within each column (from column left edge, in mm)
// Computed from CSS: col-border(0.264) + row-pad(1.058) + q-num(5.819)
//   + centering-offset(8.375) + half-bubble(2.117) = 17.63mm
// Bubble step: 16px + 4px gap = 20px = 5.291mm
const BUBBLE_CX_IN_COL_MM = [17.63, 22.92, 28.21, 33.50]; // A, B, C, D

// Vertical grid positions
// Content top from marker: 18mm page padding - 10mm marker = 8mm
// Header elements (sheet-header + info-fields + instructions) ≈ 46mm
// Column header height ≈ 4.5mm
// Row height: 16px bubble + 3.6px padding + 0.5px border ≈ 20.1px = 5.32mm
// First data row center Y from TL marker: 8 + 46 + 4.5 + 5.32/2 = 61.2mm
const GRID_FIRST_ROW_CY_MM = 61.2;
const ROW_HEIGHT_MM = 5.32;

// Bubble physical dimensions
const BUBBLE_DIAMETER_MM = 4.233; // 16px CSS
const SAMPLE_RADIUS_MM = BUBBLE_DIAMETER_MM / 2 * 0.45; // inner 45% to avoid border

// ════════════════════════════════════════════════════════════════════
// Relative thresholding parameters
// ════════════════════════════════════════════════════════════════════

// A bubble is "filled" if its mean intensity drops below background by this much
const MIN_CONTRAST = 30; // absolute intensity units (0-255)
const RELATIVE_DROP = 0.15; // 15% relative drop from background

// ════════════════════════════════════════════════════════════════════
// Main Processing Function
// ════════════════════════════════════════════════════════════════════

export async function processAnswerSheet(
  imageSource: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  questionCount: number
): Promise<OMRResult> {
  // Step 1: Draw to canvas and get image data
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  let srcWidth: number, srcHeight: number;
  if (imageSource instanceof HTMLVideoElement) {
    srcWidth = imageSource.videoWidth;
    srcHeight = imageSource.videoHeight;
  } else if (imageSource instanceof HTMLImageElement) {
    srcWidth = imageSource.naturalWidth;
    srcHeight = imageSource.naturalHeight;
  } else {
    srcWidth = imageSource.width;
    srcHeight = imageSource.height;
  }

  // Higher resolution for better accuracy
  const MAX_DIM = 1600;
  const scale = Math.min(MAX_DIM / srcWidth, MAX_DIM / srcHeight, 1);
  canvas.width = Math.round(srcWidth * scale);
  canvas.height = Math.round(srcHeight * scale);

  ctx.drawImage(imageSource, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  // Step 2: Convert to grayscale
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // Step 3: Binary threshold (for corner detection only)
  const threshold = computeOtsuThreshold(gray);
  const binary = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    binary[i] = gray[i] < threshold ? 1 : 0;
  }

  // Step 4: Detect corner markers
  let corners = detectCornerMarkers(binary, width, height);
  if (!corners) {
    // Fallback: assume image tightly frames the sheet
    const m = Math.round(Math.min(width, height) * 0.04);
    corners = {
      topLeft: { x: m, y: m },
      topRight: { x: width - m, y: m },
      bottomLeft: { x: m, y: height - m },
      bottomRight: { x: width - m, y: height - m },
    };
  }

  // Step 5: Auto-calibrate Y offset by trying several offsets
  const yOffsets = [-8, -4, -2, 0, 2, 4, 8];
  let bestOffset = 0;
  let bestScore = -Infinity;
  const sampleR = computeSampleRadiusPx(corners);

  for (const offset of yOffsets) {
    // const score = evaluateYOffset(gray, width, height, corners, questionCount, offset, sampleR);
    // console.log(`Offset: ${offset}, Score: ${score}`);
    // if (score > bestScore) {
    //   bestScore = score;
    //   bestOffset = offset;
    // }
    bestScore = evaluateYOffset(gray, width, height, corners, questionCount, -2, sampleR);
    bestOffset = -10;
  }

  // Step 6: Extract answers using best Y offset
  return extractAnswers(gray, width, height, corners, questionCount, bestOffset, sampleR, ctx, canvas);
}

// ════════════════════════════════════════════════════════════════════
// Otsu Threshold
// ════════════════════════════════════════════════════════════════════

function computeOtsuThreshold(gray: Uint8Array): number {
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) {
    histogram[gray[i]]++;
  }

  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i];

  let sumBg = 0;
  let weightBg = 0;
  let maxVariance = 0;
  let bestThreshold = 128;

  for (let t = 0; t < 256; t++) {
    weightBg += histogram[t];
    if (weightBg === 0) continue;

    const weightFg = total - weightBg;
    if (weightFg === 0) break;

    sumBg += t * histogram[t];
    const meanBg = sumBg / weightBg;
    const meanFg = (sumAll - sumBg) / weightFg;
    const variance = weightBg * weightFg * (meanBg - meanFg) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      bestThreshold = t;
    }
  }

  return bestThreshold;
}

// ════════════════════════════════════════════════════════════════════
// Corner Marker Detection
// ════════════════════════════════════════════════════════════════════

function detectCornerMarkers(
  binary: Uint8Array,
  width: number,
  height: number
): MarkerCorners | null {
  const searchSize = Math.round(Math.min(width, height) * 0.15);
  const minMarkerSize = Math.round(Math.min(width, height) * 0.02);
  const maxMarkerSize = Math.round(Math.min(width, height) * 0.08);

  const findMarkerInRegion = (
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): Point | null => {
    let bestDensity = 0;
    let bestCenter: Point | null = null;
    let bestSize = 0;
    const step = Math.max(2, Math.round(minMarkerSize / 3));

    for (let y = startY; y < endY - minMarkerSize; y += step) {
      for (let x = startX; x < endX - minMarkerSize; x += step) {
        for (let size = minMarkerSize; size <= maxMarkerSize; size += step) {
          if (x + size > endX || y + size > endY) continue;

          let darkCount = 0;
          let totalCount = 0;
          for (let dy = 0; dy < size; dy += 2) {
            for (let dx = 0; dx < size; dx += 2) {
              const px = x + dx;
              const py = y + dy;
              if (px < width && py < height) {
                totalCount++;
                if (binary[py * width + px]) darkCount++;
              }
            }
          }

          const density = darkCount / totalCount;
          if (density > 0.7 && density > bestDensity) {
            bestDensity = density;
            bestCenter = { x: x + size / 2, y: y + size / 2 };
            bestSize = size;
          }
        }
      }
    }

    // Refine with centroid of dark pixels in the detected marker area
    if (bestCenter && bestSize > 0) {
      bestCenter = refineCentroid(binary, width, height, bestCenter, bestSize * 0.7);
    }

    return bestCenter;
  };

  const tl = findMarkerInRegion(0, 0, searchSize, searchSize);
  const tr = findMarkerInRegion(width - searchSize, 0, width, searchSize);
  const bl = findMarkerInRegion(0, height - searchSize, searchSize, height);
  const br = findMarkerInRegion(width - searchSize, height - searchSize, width, height);

  if (!tl || !tr || !bl || !br) return null;

  return { topLeft: tl, topRight: tr, bottomLeft: bl, bottomRight: br };
}

/**
 * Refine marker center by computing the centroid of dark pixels
 */
function refineCentroid(
  binary: Uint8Array,
  width: number,
  height: number,
  approx: Point,
  searchRadius: number
): Point {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  const r = Math.round(searchRadius);

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const px = Math.round(approx.x + dx);
      const py = Math.round(approx.y + dy);
      if (px >= 0 && px < width && py >= 0 && py < height) {
        if (binary[py * width + px]) {
          sumX += px;
          sumY += py;
          count++;
        }
      }
    }
  }

  if (count === 0) return approx;
  return { x: sumX / count, y: sumY / count };
}

// ════════════════════════════════════════════════════════════════════
// Coordinate Mapping
// ════════════════════════════════════════════════════════════════════

/**
 * Map normalized coordinates (0-1 in marker-bounded space) to image pixels
 * using bilinear interpolation from the 4 corner markers.
 */
function mapPoint(corners: MarkerCorners, nx: number, ny: number): Point {
  const { topLeft: tl, topRight: tr, bottomLeft: bl, bottomRight: br } = corners;
  const topX = tl.x + (tr.x - tl.x) * nx;
  const topY = tl.y + (tr.y - tl.y) * nx;
  const botX = bl.x + (br.x - bl.x) * nx;
  const botY = bl.y + (br.y - bl.y) * nx;
  return {
    x: topX + (botX - topX) * ny,
    y: topY + (botY - topY) * ny,
  };
}

/**
 * Get the image-space center of a specific bubble.
 */
function getBubbleCenter(
  corners: MarkerCorners,
  col: number,
  row: number,
  opt: number,
  yOffsetMM: number
): Point {
  const x_mm = COL_LEFT_MM[col] + BUBBLE_CX_IN_COL_MM[opt];
  const y_mm = GRID_FIRST_ROW_CY_MM + row * ROW_HEIGHT_MM + yOffsetMM;
  return mapPoint(corners, x_mm / SPAN_X_MM, y_mm / SPAN_Y_MM);
}

/**
 * Compute the sample radius in pixels based on the marker span.
 */
function computeSampleRadiusPx(corners: MarkerCorners): number {
  const markerSpanPx = Math.hypot(
    corners.topRight.x - corners.topLeft.x,
    corners.topRight.y - corners.topLeft.y
  );
  return Math.max(3, Math.round((SAMPLE_RADIUS_MM / SPAN_X_MM) * markerSpanPx));
}

// ════════════════════════════════════════════════════════════════════
// Grayscale Sampling
// ════════════════════════════════════════════════════════════════════

/**
 * Sample mean grayscale intensity in a circular region.
 * Lower values = darker = more likely filled.
 */
function sampleMeanIntensity(
  gray: Uint8Array,
  width: number,
  height: number,
  center: Point,
  radius: number
): number {
  let sum = 0;
  let count = 0;
  const r = Math.max(2, Math.round(radius));

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const px = Math.round(center.x + dx);
      const py = Math.round(center.y + dy);
      if (px >= 0 && px < width && py >= 0 && py < height) {
        sum += gray[py * width + px];
        count++;
      }
    }
  }

  return count > 0 ? sum / count : 255;
}

// ════════════════════════════════════════════════════════════════════
// Y-Offset Calibration
// ════════════════════════════════════════════════════════════════════

/**
 * Evaluate a Y offset by computing the average per-row contrast
 * (difference between lightest and darkest bubble in each row).
 * Higher contrast means the sampling positions are better aligned with actual bubbles.
 */
function evaluateYOffset(
  gray: Uint8Array,
  width: number,
  height: number,
  corners: MarkerCorners,
  questionCount: number,
  yOffsetMM: number,
  sampleR: number
): number {
  const count = Math.min(questionCount, TOTAL_QUESTIONS);
  let totalContrast = 0;

  for (let q = 1; q <= count; q++) {
    const col = Math.floor((q - 1) / ROWS_PER_COLUMN);
    const row = (q - 1) % ROWS_PER_COLUMN;

    const intensities = OPTION_LABELS.map((_, opt) => {
      const center = getBubbleCenter(corners, col, row, opt, yOffsetMM);
      return sampleMeanIntensity(gray, width, height, center, sampleR);
    });

    const maxI = Math.max(...intensities);
    const minI = Math.min(...intensities);
    totalContrast += maxI - minI;
  }

  return count > 0 ? totalContrast / count : 0;
}

// ════════════════════════════════════════════════════════════════════
// Answer Extraction with Relative Thresholding
// ════════════════════════════════════════════════════════════════════

function extractAnswers(
  gray: Uint8Array,
  width: number,
  height: number,
  corners: MarkerCorners,
  questionCount: number,
  yOffsetMM: number,
  sampleR: number,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
): OMRResult {
  const answers: Record<number, string | null> = {};
  const flaggedQuestions: number[] = [];
  const count = Math.min(questionCount, TOTAL_QUESTIONS);

  for (let q = 1; q <= count; q++) {
    const col = Math.floor((q - 1) / ROWS_PER_COLUMN);
    const row = (q - 1) % ROWS_PER_COLUMN;

    // Sample each bubble's mean intensity (lower = darker = more filled)
    const intensities = OPTION_LABELS.map((_, opt) => {
      const center = getBubbleCenter(corners, col, row, opt, yOffsetMM);
      return sampleMeanIntensity(gray, width, height, center, sampleR);
    });

    // Debug: draw sample circles on the canvas
    OPTION_LABELS.forEach((_, opt) => {
      const center = getBubbleCenter(corners, col, row, opt, yOffsetMM);
      ctx.beginPath();
      ctx.arc(center.x, center.y, sampleR, 0, Math.PI * 2);
      // Green for dark (likely filled), red for light (likely empty)
      const normIntensity = intensities[opt] / 255;
      ctx.strokeStyle = normIntensity < 0.5 ? 'lime' : 'rgba(255,0,0,0.6)';
      ctx.lineWidth = normIntensity < 0.5 ? 2 : 1;
      ctx.stroke();
    });

    // ── Per-row relative thresholding ──
    // Sort to find the lightest bubbles (assumed empty = background reference)
    const sorted = [...intensities].sort((a, b) => b - a); // descending (lightest first)
    // Background = average of the 2 lightest bubbles
    const bgIntensity = (sorted[0] + sorted[1]) / 2;

    // Determine which bubbles are filled
    const filled: { idx: number; intensity: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const drop = bgIntensity - intensities[i];
      // Must exceed both absolute AND relative thresholds
      if (drop > MIN_CONTRAST && drop / Math.max(bgIntensity, 1) > RELATIVE_DROP) {
        filled.push({ idx: i, intensity: intensities[i] });
      }
    }

    if (filled.length === 0) {
      // No bubble clearly filled → unanswered
      answers[q] = null;
    } else if (filled.length === 1) {
      // Exactly one filled → clear answer
      answers[q] = OPTION_LABELS[filled[0].idx];
    } else {
      // Multiple filled → pick the darkest, flag for review
      filled.sort((a, b) => a.intensity - b.intensity);
      answers[q] = OPTION_LABELS[filled[0].idx];
      flaggedQuestions.push(q);
    }
  }

  // Debug: draw marker corners
  const markerPoints = [corners.topLeft, corners.topRight, corners.bottomLeft, corners.bottomRight];
  markerPoints.forEach((p) => {
    ctx.fillStyle = 'blue';
    ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
  });

  // Debug: label Y offset
  ctx.fillStyle = 'yellow';
  ctx.font = '14px monospace';
  ctx.fillText(`Y-offset: ${yOffsetMM}mm | R: ${sampleR}px`, 10, 20);

  // Confidence: ratio of non-flagged answered questions
  const confidence = count > 0 ? (count - flaggedQuestions.length) / count : 0;

  return {
    answers,
    flaggedQuestions,
    confidence,
    debugImageUrl: canvas.toDataURL('image/jpeg', 0.8),
  };
}

// ════════════════════════════════════════════════════════════════════
// Utility: Convert OMR answers to exam system format
// ════════════════════════════════════════════════════════════════════

/**
 * Convert OMR answers (question number -> A/B/C/D) to the exam system format
 * (questionId -> optionId) using the exam's question list.
 */
export function mapOMRAnswersToExam(
  omrAnswers: Record<number, string | null>,
  examQuestions: { id: string; options: { id: string; text: string }[] }[]
): Record<string, string> {
  const result: Record<string, string> = {};
  const optionMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

  examQuestions.forEach((q, idx) => {
    const questionNum = idx + 1;
    const selectedLabel = omrAnswers[questionNum];
    if (selectedLabel && selectedLabel in optionMap) {
      const optionIndex = optionMap[selectedLabel];
      if (optionIndex < q.options.length) {
        result[q.id] = q.options[optionIndex].id;
      }
    }
  });

  return result;
}
