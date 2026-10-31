import type { NodeFeatures, Workspace } from './features.ts';
export type NodeType = 'frame' | 'rectangle' | 'ellipse' | 'text' | 'group' | 'path';
export type Tool = 'select' | 'hand' | Exclude<NodeType, 'group' | 'path'>;
export interface Point {
  x: number;
  y: number;
}
export interface CornerRadii {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}
export type CornerName = keyof CornerRadii;
export interface Box extends Point {
  width: number;
  height: number;
}
export type ConstraintMode = 'start' | 'end' | 'center' | 'stretch' | 'scale';
export interface NodeOptions {
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  clipContent: boolean;
  constraintX: ConstraintMode;
  constraintY: ConstraintMode;
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  lineHeight: number;
  letterSpacing: number;
  textAlign: 'left' | 'center' | 'right';
  textWrap: 'none' | 'word';
}
export interface DesignNode extends Box, NodeOptions, NodeFeatures {
  id: string;
  parentId: string | null;
  locked: boolean;
  hidden: boolean;
  type: NodeType;
  name: string;
  fill: string;
  opacity: number;
  radius: number;
  cornerRadii?: CornerRadii;
  text: string;
  fontSize: number;
}
export interface DesignDocument {
  format: 'redesign';
  version: 1;
  name: string;
  nodes: DesignNode[];
  workspace?: Workspace;
}
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type Axis = 'x' | 'y';
export type EditableProperty =
  | 'name'
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'radius'
  | 'topLeftRadius'
  | 'topRightRadius'
  | 'bottomRightRadius'
  | 'bottomLeftRadius'
  | 'opacity'
  | 'fill'
  | 'fontSize';
export const clone = <T>(value: T): T => structuredClone(value);
