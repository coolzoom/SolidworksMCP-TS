import { z } from 'zod';
import type { SolidWorksAPI } from '../solidworks/api.js';

export const modelingTools = [
  {
    name: 'open_model',
    description: 'Open a SolidWorks part, assembly, or drawing file',
    inputSchema: z.object({
      path: z.string().describe('Full path to the SolidWorks file'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.openModel(args.path);
        return `Opened ${model.type}: ${model.name}`;
      } catch (error) {
        return `Failed to open model: ${error}`;
      }
    },
  },

  {
    name: 'create_part',
    description: 'Create a new SolidWorks part document',
    inputSchema: z.object({}),
    handler: (_args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.createPart();
        return `Created new part: ${model.name}`;
      } catch (error) {
        return `Failed to create part: ${error}`;
      }
    },
  },

  {
    name: 'close_model',
    description: 'Close the current model with option to save',
    inputSchema: z.object({
      save: z.boolean().default(false).describe('Save before closing'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        // FIX: Safely handle model closing
        const currentModel = swApi.getCurrentModel();
        if (!currentModel) {
          return 'No active model to close';
        }

        // Get title safely before closing
        let modelTitle = 'Unknown';
        try {
          if (currentModel.GetTitle) {
            modelTitle = currentModel.GetTitle();
          } else if (currentModel.GetPathName) {
            const path = currentModel.GetPathName();
            modelTitle = path ? path.split('\\').pop() || 'Unknown' : 'Unknown';
          }
        } catch (_e) {
          // Title might not be available
        }

        swApi.closeModel(args.save);
        return `Model "${modelTitle}" closed successfully`;
      } catch (error) {
        return `Failed to close model: ${error}`;
      }
    },
  },

  {
    name: 'create_extrusion',
    description: 'Create an extrusion feature',
    inputSchema: z.object({
      depth: z.number().describe('Extrusion depth in mm'),
      draft: z.number().default(0).describe('Draft angle in degrees'),
      reverse: z.boolean().default(false).describe('Reverse direction'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const feature = swApi.createExtrude(args.depth, args.draft, args.reverse);
        return `Created extrusion: ${feature.name}`;
      } catch (error) {
        return `Failed to create extrusion: ${error}`;
      }
    },
  },

  {
    name: 'create_revolve',
    description: 'Create a revolve feature from the active sketch profile',
    inputSchema: z.object({
      angle: z.number().default(360).describe('Revolve angle in degrees'),
      reverse: z.boolean().default(false).describe('Reverse direction'),
      axisPickY: z
        .number()
        .optional()
        .describe('Y coordinate in mm for axis pick on centerline (default 1mm)'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const axisPickYMeters = (args.axisPickY ?? 1) / 1000;
        const feature = swApi.createRevolve(args.angle, args.reverse, axisPickYMeters);
        return `Created revolve: ${feature.name}`;
      } catch (error) {
        return `Failed to create revolve: ${error}`;
      }
    },
  },

  {
    name: 'set_part_color',
    description: 'Set display color (RGB) on all faces of the active part solid body',
    inputSchema: z.object({
      r: z.number().min(0).max(255).default(0),
      g: z.number().min(0).max(255).default(0),
      b: z.number().min(0).max(255).default(0),
    }),
    handler: (args: { r?: number; g?: number; b?: number }, swApi: SolidWorksAPI) => {
      try {
        swApi.setPartColor(args.r ?? 0, args.g ?? 0, args.b ?? 0);
        return `Set part color to RGB(${args.r ?? 0}, ${args.g ?? 0}, ${args.b ?? 0})`;
      } catch (error) {
        return `Failed to set part color: ${error}`;
      }
    },
  },

  {
    name: 'get_dimension',
    description: 'Get the value of a dimension',
    inputSchema: z.object({
      name: z.string().describe('Dimension name (e.g., "D1@Sketch1")'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const value = swApi.getDimension(args.name);
        return `Dimension ${args.name} = ${value} mm`;
      } catch (error) {
        return `Failed to get dimension: ${error}`;
      }
    },
  },

  {
    name: 'set_dimension',
    description: 'Set the value of a dimension',
    inputSchema: z.object({
      name: z.string().describe('Dimension name (e.g., "D1@Sketch1")'),
      value: z.number().describe('New value in mm'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        swApi.setDimension(args.name, args.value);
        return `Set dimension ${args.name} = ${args.value} mm`;
      } catch (error) {
        return `Failed to set dimension: ${error}`;
      }
    },
  },

  {
    name: 'rebuild_model',
    description: 'Rebuild the current model',
    inputSchema: z.object({
      force: z.boolean().default(false).describe('Force rebuild even if not needed'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No model open');

        // FIX: Use correct SolidWorks API methods
        let success = false;

        if (args.force) {
          // Use ForceRebuild3 for forced rebuild
          try {
            success = model.ForceRebuild3(false); // false = top level only
          } catch (_e) {
            // If ForceRebuild3 doesn't exist, try ForceRebuild
            try {
              model.ForceRebuild();
              success = true;
            } catch (_e2) {
              // Fall back to EditRebuild
              success = model.EditRebuild();
            }
          }
        } else {
          // Use EditRebuild for normal rebuild
          try {
            success = model.EditRebuild();
          } catch (_e) {
            // Try alternative methods
            try {
              model.Rebuild(1); // 1 = swRebuildAll
              success = true;
            } catch (_e2) {
              throw new Error('Rebuild method not available');
            }
          }
        }

        if (!success && success !== undefined) {
          throw new Error('Rebuild failed');
        }

        return 'Model rebuilt successfully';
      } catch (error) {
        return `Failed to rebuild model: ${error}`;
      }
    },
  },
];
