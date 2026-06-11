import { loadWinax } from '../dist/adapters/winax-loader.js';
import { SolidWorksConfig } from '../dist/utils/solidworks-config.js';

const R = 0.025;
const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');
const model = swApp.NewDocument(SolidWorksConfig.getTemplatePath(swApp, 'part'), 0, 0, 0);

// Step 1: thin disk (circle extrude)
model.SketchManager.InsertSketch(true);
model.SketchManager.CreateCircleByRadius(0, 0, 0, R);
model.SketchManager.InsertSketch(true);
model.ClearSelection2(true);
model.FeatureByPositionReverse(0).Select2(false, 0);
const disk = model.FeatureManager.FeatureExtrusion3(
  true, false, false, 0, 0, 0.001, 0,
  false, false, false, false, 0, 0,
  false, false, false, false, true, true, true, 0, 0, false
);
console.log('Disk extrude =>', disk?.Name ?? disk);

// Step 2: find and select top circular face
function trySelectTopFace() {
  const body = model.GetBodies2(0); // solid bodies
  console.log('Bodies', typeof body, body?.length, body?.Count);

  const bodies = body?.length ? body : body?.Count ? Array.from({ length: body.Count }, (_, i) => body.Item(i + 1)) : [];
  for (const b of bodies) {
    const faces = b.GetFaces();
    const faceList = faces?.length ? faces : faces?.Count ? Array.from({ length: faces.Count }, (_, i) => faces.Item(i + 1)) : [];
    console.log('Face count', faceList.length);
    for (const face of faceList) {
      try {
        const surf = face.GetSurface();
        const isPlane = surf?.IsPlane?.() ?? surf?.IsPlane;
        const area = face.GetArea?.() ?? '?';
        console.log('  face plane=', isPlane, 'area=', area);
        if (isPlane) {
          const sel = face.Select2(true, 0);
          console.log('  face.Select2 =>', sel);
          return face;
        }
      } catch (e) {
        console.log('  face ERR', String(e).split('\n')[0]);
      }
    }
  }
  return null;
}

model.ClearSelection2(true);
const face = trySelectTopFace();

// Step 3: InsertDome
try {
  const dome = model.InsertDome(R, 0, false);
  console.log('InsertDome =>', dome?.Name ?? dome);
} catch (e) {
  console.log('InsertDome ERR', String(e).split('\n')[0]);
}

// Step 4: bounding box check
try {
  const mp = model.Extension.CreateMassProperty();
  mp.AddBodies(model.GetBodies2(0));
  console.log('Volume m^3 =>', mp.Volume);
} catch (e) {
  console.log('Mass ERR', String(e).split('\n')[0]);
}

console.log('done');
