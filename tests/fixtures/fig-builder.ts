import { compileSchema, encodeBinarySchema, parseSchema } from 'kiwi-schema';
import { deflateSync, zipSync } from 'fflate';

/** Synthetic native wire fixture; tests the adapter, not Figma acceptance. */
export const figTestSchema = parseSchema(`
enum MessageType { NODE_CHANGES = 0; }
enum NodeType { DOCUMENT=0; CANVAS=1; FRAME=2; ROUNDED_RECTANGLE=3; ELLIPSE=4; TEXT=5; GROUP=6; VECTOR=7; SYMBOL=8; INSTANCE=9; }
struct GUID { uint sessionID; uint localID; }
struct Parent { GUID guid; string position; }
struct Size { float x; float y; }
struct Matrix { float m00; float m01; float m02; float m10; float m11; float m12; }
struct Color { float r; float g; float b; float a; }
message Paint { string type=1; Color color=2; float opacity=3; bool visible=4; }
message Font { string family=1; string style=2; }
message TextData { string characters=1; }
message Node {
 GUID guid=1; NodeType type=2; string name=3; Parent parentIndex=4; Size size=5; Matrix transform=6;
 Paint[] fillPaints=7; Paint[] strokePaints=8; float opacity=9; bool visible=10; bool locked=11;
 float strokeWeight=12; string strokeAlign=13; float cornerRadius=14; TextData textData=15;
 Font fontName=16; float fontSize=17; bool internalOnly=18; bool frameMaskDisabled=19;
}
message Message { MessageType type=1; Node[] nodeChanges=2; byte[] testBlob=3; string label=4; uint64 wide=5; }
`);
export const id = (localID: number) => ({ sessionID: 1, localID });
export const parent = (localID: number, position = '!') => ({ guid: id(localID), position });
export const transform = (x = 0, y = 0, angle = 0) => ({
  m00: Math.cos(angle),
  m01: -Math.sin(angle),
  m02: x,
  m10: Math.sin(angle),
  m11: Math.cos(angle),
  m12: y,
});
export const solid = (r = 1, g = 0, b = 0, a = 1) => ({
  type: 'SOLID',
  color: { r, g, b, a },
  opacity: 1,
  visible: true,
});
export const basicFigNodes = () => [
  { guid: id(0), type: 'DOCUMENT', name: 'Document' },
  { guid: id(1), type: 'CANVAS', name: 'Page one', parentIndex: parent(0) },
  {
    guid: id(2),
    type: 'FRAME',
    name: 'Frame',
    parentIndex: parent(1),
    size: { x: 200, y: 120 },
    transform: transform(100, 50),
    fillPaints: [solid(1, 1, 1)],
  },
  {
    guid: id(3),
    type: 'ROUNDED_RECTANGLE',
    name: 'Card',
    parentIndex: parent(2),
    size: { x: 80, y: 40 },
    transform: transform(10, 20),
    fillPaints: [solid(1, 0, 0, 0.5)],
    cornerRadius: 8,
  },
  {
    guid: id(4),
    type: 'ELLIPSE',
    name: 'Dot',
    parentIndex: parent(2, '"'),
    size: { x: 20, y: 20 },
    transform: transform(120, 20),
    fillPaints: [solid(0, 0, 1)],
  },
  {
    guid: id(5),
    type: 'TEXT',
    name: 'Label',
    parentIndex: parent(2, '#'),
    size: { x: 100, y: 20 },
    transform: transform(10, 80),
    textData: { characters: 'Hello \u4e16\u754c' },
    fontName: { family: 'Inter', style: 'Regular' },
    fontSize: 14,
    fillPaints: [solid(0, 0, 0)],
  },
];
export function nativeStream(
  schemaChunk: Uint8Array,
  messageChunk: Uint8Array,
  version = 106,
): Uint8Array {
  const out = new Uint8Array(20 + schemaChunk.length + messageChunk.length),
    view = new DataView(out.buffer);
  out.set(new TextEncoder().encode('fig-kiwi'));
  view.setUint32(8, version, true);
  view.setUint32(12, schemaChunk.length, true);
  out.set(schemaChunk, 16);
  view.setUint32(16 + schemaChunk.length, messageChunk.length, true);
  out.set(messageChunk, 20 + schemaChunk.length);
  return out;
}
export function makeFig(nodes: unknown[] = basicFigNodes(), zipped = true): Uint8Array {
  const schema = deflateSync(encodeBinarySchema(figTestSchema));
  const message = deflateSync(
    compileSchema(figTestSchema).encodeMessage({ type: 'NODE_CHANGES', nodeChanges: nodes }),
  );
  const data = nativeStream(schema, message);
  return zipped
    ? zipSync({ 'canvas.fig': data, 'meta.json': new TextEncoder().encode('{}') })
    : data;
}
