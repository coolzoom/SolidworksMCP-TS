/**
 * SolidWorks Configuration Utilities
 * Provides version detection and path resolution for SolidWorks installations
 */

import { existsSync } from 'node:fs';
export interface SolidWorksVersion {
  year: string;
  majorVersion: number;
  revisionNumber: string;
}

export interface SolidWorksTemplates {
  part: string;
  assembly: string;
  drawing: string;
}

export class SolidWorksConfig {
  /**
   * Extract SolidWorks version information from the application
   */
  static getVersion(swApp: any): SolidWorksVersion | null {
    try {
      const revisionNumber = swApp.RevisionNumber();
      if (!revisionNumber) return null;

      // Revision number format: "YYYY SP X.Y" or "XX.Y.Z.ZZZZ"
      // Modern format: "2024 SP5.0" or older format: "27.5.0.0084" (SW 2019)
      const yearMatch = revisionNumber.match(/^(\d{4})/);
      if (yearMatch) {
        return {
          year: yearMatch[1],
          majorVersion: parseInt(yearMatch[1], 10),
          revisionNumber,
        };
      }

      // Fallback for older version number format (27.x = SW2019, 28.x = SW2020, etc.)
      const oldFormatMatch = revisionNumber.match(/^(\d+)\./);
      if (oldFormatMatch) {
        const majorVer = parseInt(oldFormatMatch[1], 10);
        const year = (1992 + majorVer).toString();
        return {
          year,
          majorVersion: parseInt(year, 10),
          revisionNumber,
        };
      }

      return null;
    } catch (_error) {
      // Errors are expected when SolidWorks is not available or mock throws
      return null;
    }
  }

  /**
   * Get default template paths for SolidWorks
   * Attempts multiple strategies to find the correct template location
   */
  static getDefaultTemplates(swApp: any): SolidWorksTemplates | null {
    try {
      // Strategy 1: User preference templates (SW 2019+ uses 8/9/10; older uses 0/1/8)
      for (const [partId, asmId, drwId] of [
        [8, 9, 10],
        [0, 1, 8],
      ] as const) {
        try {
          const partTemplate = swApp.GetUserPreferenceStringValue(partId);
          const assemblyTemplate = swApp.GetUserPreferenceStringValue(asmId);
          const drawingTemplate = swApp.GetUserPreferenceStringValue(drwId);
          if (partTemplate && SolidWorksConfig.validateTemplatePath(partTemplate)) {
            return {
              part: partTemplate,
              assembly:
                assemblyTemplate && SolidWorksConfig.validateTemplatePath(assemblyTemplate)
                  ? assemblyTemplate
                  : partTemplate.replace(/Part/i, 'Assembly'),
              drawing:
                drawingTemplate && SolidWorksConfig.validateTemplatePath(drawingTemplate)
                  ? drawingTemplate
                  : partTemplate.replace(/Part/i, 'Drawing'),
            };
          }
        } catch (_e) {
          // try next constant set
        }
      }

      // Strategy 2: Build paths based on SolidWorks version
      const version = SolidWorksConfig.getVersion(swApp);
      if (version?.year) {
        const basePath = `C:\\ProgramData\\SolidWorks\\SOLIDWORKS ${version.year}\\templates`;
        return {
          part: `${basePath}\\Part.prtdot`,
          assembly: `${basePath}\\Assembly.asmdot`,
          drawing: `${basePath}\\Drawing.drwdot`,
        };
      }

      // Strategy 3: Try version-independent paths
      const genericBasePath = 'C:\\ProgramData\\SolidWorks\\templates';
      return {
        part: `${genericBasePath}\\Part.prtdot`,
        assembly: `${genericBasePath}\\Assembly.asmdot`,
        drawing: `${genericBasePath}\\Drawing.drwdot`,
      };
    } catch (_error) {
      return null;
    }
  }

  /**
   * Get a specific template path with fallback logic
   */
  static getTemplatePath(swApp: any, templateType: 'part' | 'assembly' | 'drawing', customPath?: string): string {
    // If custom path provided, use it
    if (customPath && customPath !== '') {
      return customPath;
    }

    // Try to get from default templates
    const templates = SolidWorksConfig.getDefaultTemplates(swApp);
    if (templates) {
      return templates[templateType];
    }

    // Final fallback - throw error with helpful message
    throw new Error(
      `Cannot determine SolidWorks ${templateType} template path. ` +
        `Please specify the template path explicitly in your request, or ensure ` +
        `SolidWorks default templates are configured in Tools > Options > File Locations > Document Templates.`
    );
  }

  /**
   * Validate that a template file exists (if possible)
   * Note: This is a best-effort check and may not work in all environments
   */
  static validateTemplatePath(templatePath: string): boolean {
    if (!templatePath) return false;
    try {
      return existsSync(templatePath);
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get SolidWorks installation information for debugging
   */
  static getInstallInfo(swApp: any): Record<string, any> {
    const info: Record<string, any> = {};

    try {
      const version = SolidWorksConfig.getVersion(swApp);
      if (version) {
        info.version = version;
      }
    } catch (e) {
      info.versionError = String(e);
    }

    try {
      const templates = SolidWorksConfig.getDefaultTemplates(swApp);
      if (templates) {
        info.templates = templates;
      }
    } catch (e) {
      info.templatesError = String(e);
    }

    try {
      // Try to get installation path
      info.visible = swApp.Visible;
    } catch (_e) {
      // Ignore
    }

    return info;
  }
}
