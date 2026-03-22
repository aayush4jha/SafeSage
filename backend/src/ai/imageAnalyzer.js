/**
 * NightShield AI - Image Safety Analyzer
 * Uses sharp to decode images and analyze actual pixel data.
 * GATE: Rejects indoor / screenshot / non-outdoor images first.
 */

const sharp = require('sharp');

async function getPixelStats(buffer) {
  // Decode image to raw RGB pixels
  const { data, info } = await sharp(buffer)
    .resize(200, 200, { fit: 'cover' }) // downscale for speed
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const totalPixels = width * height;

  let totalR = 0, totalG = 0, totalB = 0;
  let darkPixels = 0, brightPixels = 0;
  let blueishPixels = 0, greenishPixels = 0, warmPixels = 0;
  let edgeCount = 0;
  let highSaturationPixels = 0;
  let uniformBlocks = 0;
  const brightnessValues = [];

  // Color histogram buckets (simplified)
  const hueBuckets = new Array(12).fill(0); // 30-degree buckets

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
    brightnessValues.push(brightness);
    totalR += r; totalG += g; totalB += b;

    if (brightness < 50) darkPixels++;
    if (brightness > 200) brightPixels++;

    // Color analysis
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (saturation > 0.3) highSaturationPixels++;

    if (b > r * 1.2 && b > g * 1.1) blueishPixels++;
    if (g > r * 1.1 && g > b * 1.1) greenishPixels++;
    if (r > b * 1.3 && r > 100) warmPixels++;

    // Hue bucket
    if (saturation > 0.1) {
      let hue = 0;
      const delta = max - min;
      if (delta > 0) {
        if (max === r) hue = ((g - b) / delta) % 6;
        else if (max === g) hue = (b - r) / delta + 2;
        else hue = (r - g) / delta + 4;
        hue = Math.round(hue * 60);
        if (hue < 0) hue += 360;
        hueBuckets[Math.floor(hue / 30)]++;
      }
    }
  }

  // Edge detection (simple gradient magnitude on brightness)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx = Math.abs(brightnessValues[idx + 1] - brightnessValues[idx - 1]);
      const gy = Math.abs(brightnessValues[idx + width] - brightnessValues[idx - width]);
      if (gx + gy > 40) edgeCount++;
    }
  }

  // Check for uniform blocks (screenshot indicator)
  const blockSize = 10;
  for (let by = 0; by < height - blockSize; by += blockSize) {
    for (let bx = 0; bx < width - blockSize; bx += blockSize) {
      let blockVar = 0;
      const centerBrightness = brightnessValues[by * width + bx];
      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          blockVar += Math.abs(brightnessValues[(by + dy) * width + (bx + dx)] - centerBrightness);
        }
      }
      if (blockVar / (blockSize * blockSize) < 3) uniformBlocks++;
    }
  }

  const avgBrightness = (totalR * 0.299 + totalG * 0.587 + totalB * 0.114) / totalPixels;
  const avgR = totalR / totalPixels;
  const avgG = totalG / totalPixels;
  const avgB = totalB / totalPixels;

  // Brightness standard deviation
  const avgBr = brightnessValues.reduce((s, v) => s + v, 0) / brightnessValues.length;
  const stdDev = Math.sqrt(brightnessValues.reduce((s, v) => s + (v - avgBr) ** 2, 0) / brightnessValues.length);

  const totalBlocks = Math.floor(height / blockSize) * Math.floor(width / blockSize);
  const uniformRatio = uniformBlocks / Math.max(1, totalBlocks);

  // Dominant hue analysis
  const maxHueBucket = Math.max(...hueBuckets);
  const dominantHueIndex = hueBuckets.indexOf(maxHueBucket);
  const hueConcentration = maxHueBucket / totalPixels;

  // Unique colors estimate
  const colorDiversity = hueBuckets.filter(b => b > totalPixels * 0.02).length;

  return {
    avgBrightness, avgR, avgG, avgB, stdDev,
    darkRatio: darkPixels / totalPixels,
    brightRatio: brightPixels / totalPixels,
    blueRatio: blueishPixels / totalPixels,
    greenRatio: greenishPixels / totalPixels,
    warmRatio: warmPixels / totalPixels,
    saturationRatio: highSaturationPixels / totalPixels,
    edgeDensity: edgeCount / totalPixels,
    uniformRatio,
    colorDiversity,
    dominantHueIndex,
    hueConcentration,
    totalPixels,
    width, height
  };
}

function classifyEnvironment(stats) {
  // SCREENSHOT / WEBPAGE detection:
  // Screenshots have very high uniform block ratios, sharp edges, high saturation text
  const isLikelyScreenshot =
    stats.uniformRatio > 0.45 ||
    (stats.brightRatio > 0.6 && stats.uniformRatio > 0.3) ||
    (stats.saturationRatio > 0.5 && stats.uniformRatio > 0.25);

  // INDOOR detection:
  // Indoor photos: warm tones (artificial light), even brightness, low edge density in backgrounds
  // High brightness uniformity, warm color cast, limited sky-blue
  const isLikelyIndoor =
    (stats.warmRatio > 0.25 && stats.blueRatio < 0.05 && stats.greenRatio < 0.08) ||
    (stats.avgBrightness > 140 && stats.stdDev < 35 && stats.blueRatio < 0.03) ||
    (stats.uniformRatio > 0.35 && stats.warmRatio > 0.15);

  // OUTDOOR detection:
  // Outdoor photos: sky (blue), vegetation (green), more brightness variance, more edges
  // Night outdoor: very dark, some bright spots (lights), high stdDev
  const hasSkyCues = stats.blueRatio > 0.08 || (stats.avgB > stats.avgR * 1.1 && stats.avgB > 100);
  const hasVegetation = stats.greenRatio > 0.1;
  const hasNightCharacteristics = stats.darkRatio > 0.5 && stats.brightRatio < 0.15 && stats.stdDev > 30;
  const hasHighVariance = stats.stdDev > 45;

  const isLikelyOutdoor =
    hasNightCharacteristics ||
    (hasSkyCues && !isLikelyScreenshot) ||
    (hasVegetation && stats.edgeDensity > 0.15) ||
    (hasHighVariance && stats.colorDiversity >= 5 && !isLikelyScreenshot && !isLikelyIndoor);

  let environment = 'unknown';
  let confidence = 0.3;
  let rejectionReason = null;

  if (isLikelyScreenshot) {
    environment = 'screenshot';
    confidence = 0.85;
    rejectionReason = 'This appears to be a screenshot or digital image, not a real photo of the location.';
  } else if (isLikelyIndoor) {
    environment = 'indoor';
    confidence = 0.7;
    rejectionReason = 'This appears to be an indoor photo. Please upload an outdoor photo of the actual location.';
  } else if (isLikelyOutdoor) {
    environment = 'outdoor';
    confidence = 0.75;
  } else {
    environment = 'uncertain';
    confidence = 0.4;
  }

  const isNight = stats.avgBrightness < 80 && stats.darkRatio > 0.45;
  const isDusk = stats.avgBrightness >= 80 && stats.avgBrightness < 130 && stats.warmRatio > 0.15;
  const timeOfDay = isNight ? 'night' : isDusk ? 'dusk' : 'day';

  return { environment, timeOfDay, confidence, rejectionReason, isLikelyScreenshot, isLikelyIndoor, isLikelyOutdoor };
}

async function analyzeImage(imageBuffer) {
  const stats = await getPixelStats(imageBuffer);
  const envResult = classifyEnvironment(stats);

  // GATE: If not outdoor, reject with reason
  if (envResult.environment !== 'outdoor') {
    return {
      accepted: false,
      rejected: true,
      environment: envResult,
      reason: envResult.rejectionReason || 'Please upload an outdoor photo of the location you are reporting.',
      darkness: null,
      crowdPresence: null,
      visibility: null,
      credibilityModifier: 0,
      overallRiskFromImage: 0,
      verified: false,
      analysisTimestamp: new Date()
    };
  }

  // Passed gate — analyze safety properties
  const darknessScore = Math.max(0, Math.min(100, Math.round(100 - (stats.avgBrightness / 255) * 100)));
  let darknessLevel = 'well_lit';
  if (darknessScore > 70) darknessLevel = 'very_dark';
  else if (darknessScore > 50) darknessLevel = 'dark';
  else if (darknessScore > 35) darknessLevel = 'dim';

  // Crowd: more edges + color diversity = more people/activity
  const crowdScore = Math.min(100, Math.round(
    stats.edgeDensity * 200 +
    stats.colorDiversity * 8 +
    (1 - stats.uniformRatio) * 30
  ));
  let crowdLevel = 'likely_empty';
  if (crowdScore > 60) crowdLevel = 'likely_populated';
  else if (crowdScore > 35) crowdLevel = 'moderate';

  // Visibility
  const visibilityScore = Math.min(100, Math.round(
    (stats.avgBrightness / 255) * 50 +
    stats.stdDev * 0.5 +
    (1 - stats.darkRatio) * 25
  ));
  let visibilityLevel = 'good';
  if (visibilityScore < 25) visibilityLevel = 'very_poor';
  else if (visibilityScore < 45) visibilityLevel = 'poor';
  else if (visibilityScore < 65) visibilityLevel = 'moderate';

  // Credibility: how much this image supports a safety concern
  let credibilityModifier = 0;
  if (darknessScore > 50) credibilityModifier += 15;
  if (crowdScore < 35) credibilityModifier += 10;
  if (visibilityScore < 45) credibilityModifier += 10;
  if (envResult.timeOfDay === 'night') credibilityModifier += 15;
  if (envResult.timeOfDay === 'dusk') credibilityModifier += 5;
  credibilityModifier = Math.max(-20, Math.min(50, credibilityModifier));

  const overallRiskFromImage = Math.min(100, Math.round(
    darknessScore * 0.35 +
    (100 - crowdScore) * 0.25 +
    (100 - visibilityScore) * 0.25 +
    (envResult.timeOfDay === 'night' ? 15 : envResult.timeOfDay === 'dusk' ? 5 : 0)
  ));

  return {
    accepted: true,
    rejected: false,
    environment: envResult,
    darkness: { score: darknessScore, level: darknessLevel },
    crowdPresence: { level: crowdLevel, score: crowdScore },
    visibility: { score: visibilityScore, level: visibilityLevel },
    credibilityModifier,
    overallRiskFromImage,
    verified: true,
    analysisTimestamp: new Date()
  };
}

module.exports = { analyzeImage };
