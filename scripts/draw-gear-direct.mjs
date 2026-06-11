#!/usr/bin/env node
/**
 * Draw spur gear directly via winax (single SolidWorks session).
 */

import { loadWinax } from '../dist/adapters/winax-loader.js';

const BORE_DIAMETER = 8;
const DISC_DIAMETER = 20;
const CIRCULAR_PITCH = 5;
const EXTRUDE_DEPTH = 8;

const boreRadius = BORE_DIAMETER / 2;
const outerRadius = DISC_DIAMETER / 2;
const rootRadius = outerRadius - 2.5;
const numTeeth = Math.max(6, Math.round((Math.PI * DISC_DIAMETER) / CIRCULAR_PITCH));

function buildGearProfilePoints() {
  const pitchAngle = (2 * Math.PI) / numTeeth;
  const toothFraction = 0.48;
  const points = [];

  for (let i = 0; i < numTeeth; i++) {
    const base = i * pitchAngle;
    const halfTooth = (pitchAngle * toothFraction) / 2;
    const angles = [
      base + halfTooth,
      base + halfTooth * 0.75,
      base + pitchAngle - halfTooth * 0.75,
      base + pitchAngle - halfTooth,
    ];
    const radii = [rootRadius, outerRadius, outerRadius, rootRadius];
    for (let j = 0; j < angles.length; j++) {
      points.push({
        x: (radii[j] * Math.cos(angles[j])) / 1000,
        y: (radii[j] * Math.sin(angles[j])) / 1000,
      });
    }
  }
  return points;
}

function selectPlane(model, name) {
  model.ClearSelection2(true);
  const ok = model.Extension.SelectByID2(name, 'PLANE', 0, 0, 0, false, 0, undefined, 0);
  if (!ok) throw new Error(`Could not select plane ${name}`);
}

function selectLatestSketch(model) {
  model.ClearSelection2(true);
  const count = model.GetFeatureCount();
  for (let i = 0; i < count; i++) {
    const feat = model.FeatureByPositionReverse(i);
    if (!feat) continue;
    const typeName = feat.GetTypeName2();
    if (typeName === 'ProfileFeature') {
      feat.Select2(false, 0);
      return feat.Name;
    }
  }
  throw new Error('No sketch found for extrusion');
}

async function main() {
  console.log('\n=== Draw Gear (direct winax) ===');
  console.log(`bore=${BORE_DIAMETER}mm, OD=${DISC_DIAMETER}mm, pitch=${CIRCULAR_PITCH}mm, teeth=${numTeeth}\n`);

  const winax = loadWinax();
  const swApp = new winax.Object('SldWorks.Application');
  swApp.Visible = true;

  const template =
    process.env.SOLIDWORKS_PART_TEMPLATE ||
    'C:\\ProgramData\\SolidWorks\\SOLIDWORKS 2023\\templates\\Part.PRTDOT';

  const model = swApp.NewDocument(template, 0, 0, 0);
  if (!model) throw new Error('Failed to create new part');

  selectPlane(model, 'Front Plane');
  model.SketchManager.InsertSketch(true);

  const points = buildGearProfilePoints();
  for (let i = 0; i < points.length; i++) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    const line = model.SketchManager.CreateLine(start.x, start.y, 0, end.x, end.y, 0);
    if (!line) throw new Error(`Failed to create line segment ${i + 1}`);
  }

  const circle = model.SketchManager.CreateCircle(0, 0, 0, boreRadius / 1000, 0, 0);
  if (!circle) throw new Error('Failed to create bore circle');

  model.SketchManager.InsertSketch(true);
  const sketchName = selectLatestSketch(model);
  console.log(`Sketch ready: ${sketchName}`);

  const depthM = EXTRUDE_DEPTH / 1000;
  const feature = model.FeatureManager.FeatureExtrusion3(
    true,
    false,
    false,
    0,
    0,
    depthM,
    0,
    false,
    false,
    false,
    false,
    0,
    0,
    false,
    false,
    false,
    false,
    true,
    true,
    true,
    0,
    0,
    false
  );

  if (!feature) throw new Error('FeatureExtrusion3 returned null');

  model.EditRebuild3();
  model.ViewZoomtofit2();

  console.log('\n=== Gear created successfully ===');
  console.log(`  Part: ${model.GetTitle}`);
  console.log(`  Center bore: Ø${BORE_DIAMETER} mm`);
  console.log(`  Outer diameter: Ø${DISC_DIAMETER} mm`);
  console.log(`  Circular pitch: ${CIRCULAR_PITCH} mm (${numTeeth} teeth)`);
  console.log(`  Thickness: ${EXTRUDE_DEPTH} mm\n`);
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
