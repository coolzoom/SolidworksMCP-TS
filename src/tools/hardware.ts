import { z } from 'zod';
import { ISO4762_SCREWS } from '../standards/iso4762.js';
import type { SolidWorksAPI } from '../solidworks/api.js';

const supportedSizes = Object.keys(ISO4762_SCREWS).join(', ');

export const hardwareTools = [
  {
    name: 'create_hex_socket_screw',
    description:
      'Create a standard ISO 4762 hex socket head cap screw in one step: shank, head, hex pocket, head chamfer, and M×pitch cosmetic thread (helical display).',
    inputSchema: z.object({
      size: z
        .string()
        .default('M3')
        .describe(`Thread size (${supportedSizes})`),
      length: z.number().positive().describe('Shank length under head in mm (e.g. 60)'),
      headChamferMm: z
        .number()
        .positive()
        .optional()
        .describe('Head top edge chamfer in mm (default: ISO nominal)'),
      cosmeticThread: z
        .boolean()
        .default(true)
        .describe('Add cosmetic thread with helical display (Metric Die)'),
      headChamfer: z.boolean().default(true).describe('Add chamfer on head top outer edge'),
      newDocument: z
        .boolean()
        .default(true)
        .describe('Create a new part (true) or build on the active document (false)'),
    }),
    handler: (
      args: {
        size?: string;
        length: number;
        headChamferMm?: number;
        cosmeticThread?: boolean;
        headChamfer?: boolean;
        newDocument?: boolean;
      },
      swApi: SolidWorksAPI,
    ) => {
      try {
        const result = swApi.createHexSocketScrew({
          size: args.size ?? 'M3',
          length: args.length,
          headChamferMm: args.headChamferMm,
          cosmeticThread: args.cosmeticThread,
          headChamfer: args.headChamfer,
          newDocument: args.newDocument,
        });

        if (!result.success) {
          return `Failed to create screw: ${result.error}`;
        }

        const f = result.features ?? {};
        const lines = [
          `Created ${result.spec?.designation}×${args.length} hex socket head cap screw in ${result.partName}`,
          `  Shank: ${f.shank}`,
          `  Head: ${f.head}`,
          `  Hex socket: ${f.hexCut}`,
        ];
        if (f.chamfer) lines.push(`  Head chamfer: ${f.chamfer}`);
        if (f.cosmeticThread) {
          lines.push(`  Cosmetic thread: ${f.cosmeticThread} (${result.spec?.threadSize}, helical display)`);
        }
        return lines.join('\n');
      } catch (error) {
        return `Failed to create hex socket screw: ${error}`;
      }
    },
  },

  {
    name: 'list_standard_screws',
    description: 'List supported ISO 4762 hex socket head cap screw sizes and default dimensions',
    inputSchema: z.object({}),
    handler: () => {
      const rows = Object.values(ISO4762_SCREWS).map(
        (s) =>
          `${s.designation}: pitch ${s.pitch}mm, head Ø${s.headDiameter}×${s.headHeight}mm, hex AF ${s.hexAf}mm depth ${s.hexDepth}mm, thread ${s.threadSize}`,
      );
      return `Supported ISO 4762 sizes:\n${rows.join('\n')}`;
    },
  },
];
