/**
 * Revolve POC — tests axis selection + revolve APIs on live SolidWorks 2023.
 * Run: node temp/revolve-poc.mjs
 */
import { loadWinax } from '../dist/adapters/winax-loader.js';
import { SolidWorksConfig } from '../dist/utils/solidworks-config.js';

const R = 0.025;
const angle = Math.PI * 2;

function log(label, value) {
  console.log(`${label}:`, value);
}

function logErr(label, e) {
  console.log(`${label} ERR:`, String(e).split('\n')[0]);
}

function setupSphereSketch(model) {
  model.ClearSelection2(true);
  model.SketchManager.InsertSketch(true);
  model.SketchManager.CreateCenterLine(0, -R, 0, 0, R, 0);
  model.SketchManager.Create3PointArc(-R, 0, 0, R, 0, 0, 0, 0, 0);
  model.SketchManager.InsertSketch(true);
  const sketchFeat = model.FeatureByPositionReverse(0);
  return sketchFeat;
}

function selectSketch(model, sketchFeat) {
  model.ClearSelection2(true);
  return sketchFeat.Select2(false, 0);
}

async function tryAxisSelection(model, sketchFeat) {
  const results = [];
  const sketchName = sketchFeat.Name;

  // 1) SelectByID2 variants (callout 0 vs undefined)
  const axisNames = [`Line1@${sketchName}`, 'Line1', `Line1@${sketchName}`];
  for (const name of axisNames) {
    for (const callout of [0, undefined]) {
      try {
        selectSketch(model, sketchFeat);
        const ok = model.Extension.SelectByID2(name, 'SKETCHSEGMENT', 0, 0, 0, true, 16, callout, 0);
        results.push({ method: `SelectByID2(${name}, callout=${callout})`, ok });
      } catch (e) {
        results.push({ method: `SelectByID2(${name})`, error: String(e).split('\n')[0] });
      }
    }
  }

  // 2) GetLines2 (VBA macro pattern)
  try {
    selectSketch(model, sketchFeat);
    const sketch = sketchFeat.GetSpecificFeature2();
    const lines = sketch.GetLines2(0);
    const lineCount = lines?.length ?? lines?.Count ?? 0;
    results.push({ method: 'GetLines2 count', count: lineCount, type: typeof lines });
    if (Array.isArray(lines)) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line?.ConstructionGeometry) {
          try {
            const sel = line.Select4(true, undefined);
            results.push({ method: `GetLines2[${i}].Select4`, ok: sel });
          } catch (e) {
            results.push({ method: `GetLines2[${i}].Select4`, error: String(e).split('\n')[0] });
          }
        }
      }
    } else if (lines?.Count) {
      for (let i = 1; i <= lines.Count; i++) {
        const line = lines.Item(i);
        if (line?.ConstructionGeometry) {
          try {
            const sel = line.Select2(true, 16);
            results.push({ method: `GetLines2.Item(${i}).Select2(16)`, ok: sel });
          } catch (e) {
            results.push({ method: `GetLines2.Item(${i}).Select2`, error: String(e).split('\n')[0] });
          }
        }
      }
    }
  } catch (e) {
    results.push({ method: 'GetLines2', error: String(e).split('\n')[0] });
  }

  // 3) GetSketchSegments
  try {
    selectSketch(model, sketchFeat);
    const sketch = sketchFeat.GetSpecificFeature2();
    const segs = sketch.GetSketchSegments();
    const count = segs?.length ?? segs?.Count ?? 0;
    results.push({ method: 'GetSketchSegments count', count });
    if (Array.isArray(segs)) {
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        if (seg?.ConstructionGeometry) {
          try {
            const sel = seg.Select2(true, 16);
            results.push({ method: `segs[${i}].Select2(16)`, ok: sel });
          } catch (e) {
            results.push({ method: `segs[${i}].Select2`, error: String(e).split('\n')[0] });
          }
        }
      }
    } else if (segs?.Count) {
      for (let i = 1; i <= segs.Count; i++) {
        const seg = segs.Item(i);
        if (seg?.ConstructionGeometry) {
          try {
            const sel = seg.Select2(true, 16);
            results.push({ method: `segs.Item(${i}).Select2(16)`, ok: sel });
          } catch (e) {
            results.push({ method: `segs.Item(${i}).Select2`, error: String(e).split('\n')[0] });
          }
        }
      }
    }
  } catch (e) {
    results.push({ method: 'GetSketchSegments', error: String(e).split('\n')[0] });
  }

  return results;
}

function tryRevolveCalls(model, label) {
  const fm = model.FeatureManager;
  const tries = [
    ['FeatureRevolve(8)', () => fm.FeatureRevolve(false, false, angle, 0, false, false, false, true)],
    ['FeatureRevolve2(10-vba)', () => fm.FeatureRevolve2(false, false, angle, 0, 0, 0, true, true, 0, 0)],
    ['FeatureRevolve2(12)', () => fm.FeatureRevolve2(true, false, false, false, false, angle, 0, 0, 0, 0, 0, true)],
  ];
  for (const [name, fn] of tries) {
    try {
      const f = fn();
      log(`${label} ${name}`, f?.Name ?? f ?? 'null');
    } catch (e) {
      logErr(`${label} ${name}`, e);
    }
  }
}

function tryCreateDefinition(model, sketchFeat, constants) {
  const fm = model.FeatureManager;
  for (const c of constants) {
    try {
      selectSketch(model, sketchFeat);
      const def = fm.CreateDefinition(c);
      log(`CreateDefinition(${c})`, !!def);
      if (!def) continue;

      // Try setting properties on revolve definition
      const props = ['Angle', 'RevolutionAngle', 'ReverseDirection', 'Type'];
      for (const p of props) {
        try {
          if (p === 'Angle' || p === 'RevolutionAngle') def[p] = angle;
          if (p === 'ReverseDirection') def[p] = false;
          log(`  def.${p} set`, 'ok');
        } catch (_e) {
          // property may not exist
        }
      }

      try {
        def.AccessSelections(model, undefined);
        log(`  AccessSelections(${c})`, 'ok');
      } catch (e) {
        logErr(`  AccessSelections(${c})`, e);
      }

      try {
        const feat = fm.CreateFeature(def);
        log(`  CreateFeature(${c})`, feat?.Name ?? feat ?? 'null');
        if (feat) return feat;
      } catch (e) {
        logErr(`  CreateFeature(${c})`, e);
      }
    } catch (e) {
      logErr(`CreateDefinition(${c})`, e);
    }
  }
  return null;
}

// --- main ---
const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');
swApp.Visible = true;

const template = SolidWorksConfig.getTemplatePath(swApp, 'part');
const model = swApp.NewDocument(template, 0, 0, 0);
log('Part', model.GetTitle());

const sketchFeat = setupSphereSketch(model);
log('Sketch', sketchFeat.Name);

console.log('\n=== Axis selection attempts ===');
const axisResults = tryAxisSelection(model, sketchFeat);
for (const r of axisResults) console.log(JSON.stringify(r));

console.log('\n=== Revolve without explicit axis (sketch only) ===');
selectSketch(model, sketchFeat);
tryRevolveCalls(model, 'no-axis');

console.log('\n=== Revolve after best axis selection (GetLines2 Select2) ===');
selectSketch(model, sketchFeat);
try {
  const sketch = sketchFeat.GetSpecificFeature2();
  const lines = sketch.GetLines2(0);
  if (Array.isArray(lines)) {
    for (const line of lines) {
      if (line?.ConstructionGeometry) line.Select2(true, 16);
    }
  } else if (lines?.Count) {
    for (let i = 1; i <= lines.Count; i++) {
      const line = lines.Item(i);
      if (line?.ConstructionGeometry) line.Select2(true, 16);
    }
  }
} catch (e) {
  logErr('axis Select2', e);
}
tryRevolveCalls(model, 'with-axis');

console.log('\n=== CreateDefinition constants ===');
const SW_FM_CANDIDATES = [2, 33, 72, 73, 84, 85]; // revolve-related guesses
tryCreateDefinition(model, sketchFeat, SW_FM_CANDIDATES);

console.log('\n=== Done ===');
