
export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface WallData {
  id: string;
  imageSrc: string;
  // The 4 corners defining the flat surface on the wall image (TL, TR, BR, BL)
  corners: [Point, Point, Point, Point];
  // The real-world width of the defined surface in centimeters
  realWidthCm: number;
  // The real-world height of the defined surface in centimeters
  realHeightCm: number;
  // Calculated aspect ratio of the real wall surface (width / height)
  aspectRatio: number; 
}

export interface FrameConfig {
  matColor: string;
  matWidthCm: number;
  frameColor: string;
  frameWidthCm: number;
}

export interface ArtObject {
  id: string;
  name: string;
  imageSrc: string; // The corrected, cropped image
  realWidthCm: number;
  realHeightCm: number;
  frame: FrameConfig;
}

export interface PlacedArt {
  id: string; // unique instance id
  artId: string; // reference to ArtObject
  // Position of center relative to the wall's logical coordinate system (0..1)
  x: number; 
  y: number;
  rotation: number; // Reserved for future use
}

export interface SavedLayout {
  name: string;
  items: PlacedArt[];
}

export interface ProjectState {
  wall: WallData | null;
  inventory: ArtObject[];
  layout: PlacedArt[];
  savedLayouts: SavedLayout[];
  palette: string[]; // Saved colors
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  WALL_SETUP = 'WALL_SETUP',
  ART_STUDIO = 'ART_STUDIO',
  GALLERY = 'GALLERY',
}
