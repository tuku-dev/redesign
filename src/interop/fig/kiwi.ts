import type { Schema, Definition, Field } from 'kiwi-schema';
import { FIG_LIMITS, figError } from './limits.ts';

const PRIMITIVES = ['bool', 'byte', 'int', 'uint', 'float', 'string', 'int64', 'uint64'];
const unsafe = (name: string) => !name || ['__proto__', 'prototype', 'constructor'].includes(name);

/** Bounded Kiwi wire reader. No generated code, eval or Function from file-supplied schemas. */
class Reader {
  offset = 0;
  private view: DataView;
  private floatView = new DataView(new ArrayBuffer(4));
  readonly data: Uint8Array;
  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }
  byte(): number {
    if (this.offset >= this.data.length) figError('truncated Kiwi data.');
    return this.data[this.offset++];
  }
  uint(): number {
    let value = 0;
    for (let shift = 0; shift <= 28; shift += 7) {
      const b = this.byte();
      if (shift === 28 && b > 15) figError('invalid Kiwi integer.');
      value += (b & 127) * 2 ** shift;
      if (!(b & 128)) return value;
    }
    return figError('invalid Kiwi integer.');
  }
  int(): number {
    const v = this.uint();
    return v & 1 ? -(v + 1) / 2 : v / 2;
  }
  uint64(): bigint {
    let value = 0n;
    // Kiwi uses eight 7-bit groups followed by one full byte (not protobuf's 10 bytes).
    for (let shift = 0; shift <= 56; shift += 7) {
      const b = this.byte();
      value |= BigInt(shift === 56 ? b : b & 127) << BigInt(shift);
      if (shift === 56 || !(b & 128)) return value;
    }
    return value;
  }
  float(): number {
    const first = this.byte();
    if (!first) return 0;
    const bits = first | (this.byte() << 8) | (this.byte() << 16) | (this.byte() << 24);
    const temp = this.floatView;
    temp.setUint32(0, ((bits << 23) | (bits >>> 9)) >>> 0, true);
    const value = temp.getFloat32(0, true);
    if (!Number.isFinite(value)) figError('non-finite Kiwi float.');
    return value;
  }
  string(): string {
    const start = this.offset;
    while (this.byte())
      if (this.offset - start > FIG_LIMITS.string)
        figError('Kiwi string exceeds the import limit.');
    return new TextDecoder('utf-8', { fatal: true }).decode(
      this.data.subarray(start, this.offset - 1),
    );
  }
  bytes(length: number): Uint8Array {
    if (length > this.data.length - this.offset) figError('truncated Kiwi byte array.');
    const result = this.data.subarray(this.offset, this.offset + length);
    this.offset += length;
    return result;
  }
  done(): void {
    if (this.offset !== this.view.byteLength) figError('trailing Kiwi data.');
  }
}

export function readFigSchema(data: Uint8Array): Schema {
  const r = new Reader(data),
    count = r.uint();
  if (!count || count > 4096) figError('Kiwi schema definition limit exceeded.');
  const definitions: Definition[] = [],
    names = new Set<string>();
  const typeRefs = new Map<Field, number>();
  let total = 0;
  for (let i = 0; i < count; i++) {
    const name = r.string(),
      kind = ['ENUM', 'STRUCT', 'MESSAGE'][r.byte()] as Definition['kind'] | undefined,
      fields: Field[] = [];
    if (unsafe(name) || names.has(name) || !kind) figError('invalid Kiwi schema definition.');
    names.add(name);
    const fieldCount = r.uint(),
      fieldNames = new Set<string>(),
      tags = new Set<number>();
    total += fieldCount;
    if (total > 100000) figError('Kiwi schema field limit exceeded.');
    for (let j = 0; j < fieldCount; j++) {
      const fieldName = r.string(),
        type = r.int(),
        array = r.byte(),
        value = r.uint();
      if (
        unsafe(fieldName) ||
        fieldNames.has(fieldName) ||
        tags.has(value) ||
        array > 1 ||
        (kind === 'MESSAGE' && !value)
      )
        figError('invalid Kiwi schema field.');
      fieldNames.add(fieldName);
      tags.add(value);
      const field: Field = {
        name: fieldName,
        type: null,
        isArray: !!array,
        value,
        isDeprecated: false,
        line: 0,
        column: 0,
      };
      if (kind !== 'ENUM') typeRefs.set(field, type);
      fields.push(field);
    }
    definitions.push({ name, kind, fields, line: 0, column: 0 });
  }
  r.done();
  for (const [field, index] of typeRefs) {
    field.type = index < 0 ? PRIMITIVES[~index] : definitions[index]?.name;
    if (!field.type) figError('unknown Kiwi schema type.');
  }
  return { package: null, definitions };
}

export function readFigMessage(data: Uint8Array, schema: Schema): Record<string, unknown> {
  const r = new Reader(data),
    definitions = new Map(schema.definitions.map((d) => [d.name, d]));
  const tags = new Map(
    schema.definitions.map((d) => [d.name, new Map(d.fields.map((f) => [f.value, f]))]),
  );
  let values = 0;
  function read(type: string, depth: number): unknown {
    if (++values > FIG_LIMITS.values || depth > FIG_LIMITS.depth)
      figError('Kiwi complexity/nesting limit exceeded.');
    switch (type) {
      case 'bool':
        return !!r.byte();
      case 'byte':
        return r.byte();
      case 'uint':
        return r.uint();
      case 'int':
        return r.int();
      case 'float':
        return r.float();
      case 'string':
        return r.string();
      case 'uint64':
        return r.uint64();
      case 'int64': {
        const v = r.uint64();
        return v & 1n ? ~(v >> 1n) : v >> 1n;
      }
    }
    const def = definitions.get(type);
    if (!def) return figError('unknown Kiwi message type.');
    const fields = tags.get(type)!;
    if (def.kind === 'ENUM') {
      const tag = r.uint();
      return fields.get(tag)?.name ?? tag;
    }
    const result: Record<string, unknown> = Object.create(null);
    const field = (f: Field) => {
      if (!f.type) figError('invalid Kiwi field type.');
      if (!f.isArray) return read(f.type, depth + 1);
      const length = r.uint();
      if (f.type === 'byte') return r.bytes(length);
      if (length > FIG_LIMITS.array || length + values > FIG_LIMITS.values)
        figError('Kiwi array limit exceeded.');
      return Array.from({ length }, () => read(f.type!, depth + 1));
    };
    if (def.kind === 'STRUCT') for (const f of def.fields) result[f.name] = field(f);
    else {
      let tag: number;
      while ((tag = r.uint()) !== 0) {
        const f = fields.get(tag);
        if (!f) figError('message field is absent from the embedded Kiwi schema.');
        if (Object.hasOwn(result, f.name)) figError('duplicate Kiwi message field.');
        result[f.name] = field(f);
      }
    }
    return result;
  }
  const root = definitions.get('Message');
  if (root?.kind !== 'MESSAGE') figError('embedded schema has no Message root.');
  const message = read('Message', 0) as Record<string, unknown>;
  r.done();
  return message;
}
