export type Direction = 'left' | 'center' | 'right';
export type Distance = 'immediate' | 'near' | 'medium' | 'far';
export type AlertLevel = 'clear' | 'caution' | 'critical';
export type VisionMode = 'navigation' | 'reading' | 'full_scene';

export interface HazardItem {
  name: string;
  direction: Direction;
  distance: Distance;
  actionGuidance?: string;
}

export interface VisionAnalysisResult {
  alertLevel: AlertLevel;
  spokenGuidance: string;
  hazards: HazardItem[];
  sceneOverview: string;
  detectedText?: string;
  timestamp: number;
  latencyMs?: number;
}

export interface AnalysisRequestPayload {
  image: string; // Base64 data URL or raw base64 jpeg
  mode?: VisionMode;
  userQuery?: string;
}
