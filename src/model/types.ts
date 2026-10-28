export type NodeType = 'frame' | 'rectangle' | 'ellipse' | 'text' | 'group';
export type Tool = 'select' | 'hand' | Exclude<NodeType, 'group'>;
export interface Point {
  x: number;
  y: number;
}
export interface Box extends Point {
  width: number;
  height: number;
}
export type ConstraintMode = 'start' | 'end' | 'center' | 'stretch' | 'scale';
export interface NodeOptions {
  rotation: number;
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
export interface DesignNode extends Box, NodeOptions {
  id: string;
  parentId: string | null;
  locked: boolean;
  hidden: boolean;
  type: NodeType;
  name: string;
  fill: string;
  opacity: number;
  radius: number;
  text: string;
  fontSize: number;
}
export interface DesignDocument {
  format: 'redesign';
  version: 1;
  name: string;
  nodes: DesignNode[];
}
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type Axis = 'x' | 'y';
export type EditableProperty =
  'name' | 'x' | 'y' | 'width' | 'height' | 'radius' | 'opacity' | 'fill' | 'fontSize';
export const clone = <T>(value: T): T => structuredClone(value);
