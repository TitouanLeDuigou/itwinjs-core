/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert, Id64 } from "@itwin/core-bentley";
import { PackedFeatureTable } from "@itwin/core-common";
import { VertexTableWithIndices } from "./VertexTable";
import { PointStringParams } from "./PointStringParams";

export type ComputeNodeId = (elementId: Id64.Uint32Pair) => number;

class IndexBuffer {
  private _data: Uint8Array;
  private _numIndices = 0;
  private readonly _index32 = new Uint32Array(1);
  private readonly _index8 = new Uint8Array(this._index32, 0, 3);

  public constructor() {
    this._data = new Uint8Array(9);
  }

  public get numIndices(): number {
    return this._numIndices;
  }

  public push(index: number): void {
    this.reserve(this.numIndices + 1);
    this._index32[0] = index;
    this._data.set(this._index8, this.numIndices * 3);
    this._numIndices++;
  }

  private reserve(numTotalIndices: number): void {
    const numTotalBytes = numTotalIndices * 3;
    if (this._data.length >= numTotalBytes)
      return;

    const numBytes = Math.floor(numTotalBytes * 1.5);
    const prevData = this._data;
    this._data = new Uint8Array(numBytes);
    this._data.set(prevData, 0);
  }

  public toUint8Array(): Uint8Array {
    return this._data.subarray(0, this.numIndices * 3);
  }
}

class VertexBuffer {
  private _data: Uint32Array;
  private _length: number;
  private readonly _numRgbaPerVertex;

  public constructor(numRgbaPerVertex: number) {
    this._data = new Uint32Array(3 * numRgbaPerVertex);
    this._length = 0;
    this._numRgbaPerVertex = numRgbaPerVertex;
  }

  public get length(): number {
    return this._length;
  }

  public push(vertex: Uint32Array): void {
    assert(vertex.length === this._numRgbaPerVertex);
    this.reserve(this._length + 1);
    this._data.set(vertex, this.length);
    this._length++;
  }

  private reserve(newSize: number): void {
    newSize *= this._numRgbaPerVertex;
    if (this._data.length >= newSize)
      return;

    newSize = Math.floor(newSize * 1.5);
    const prevData = this._data;
    this._data = new Uint32Array(newSize);
    this._data.set(prevData, 0);
  }

  public toUint8Array(): Uint8Array {
    return new Uint8Array(this._data.buffer, 0, this._length * 4 * this._numRgbaPerVertex);
  }
}

class ColorTableRemapper {
  private readonly _remappedIndices = new Map<number, number>();
  private readonly _colorTable: Uint32Array;
  public readonly colors: number[] = [];

  public constructor(colorTable: Uint32Array) {
    this._colorTable = colorTable;
  }

  public remap(vertex: Uint32Array): void {
    const word = vertex[1];
    const oldIndex = (word & 0xffff0000) >>> 16;
    let newIndex = this._remappedIndices.get(oldIndex);
    if (undefined === newIndex) {
      newIndex = this.colors.length;
      this._remappedIndices.set(oldIndex, newIndex);
      const color = this._colorTable[oldIndex];
      this.colors.push(color);
    }

    vertex[1] = (word & (newIndex << 16)) >>> 0;
  }
}

class Node {
  public readonly id: number;
  public readonly vertices: VertexBuffer;
  private readonly _remappedIndices = new Map<number, number>();
  public readonly indices = new IndexBuffer();
  public readonly colors?: ColorTableRemapper;
  // ###TODO remap material indices.

  public constructor(id: number, numRgbaPerVertex: number, colorTable?: Uint32Array) {
    this.id = id;
    this.vertices = new VertexBuffer(numRgbaPerVertex);
    if (colorTable)
      this.colors = new ColorTableRemapper(colorTable);
  }

  public addVertex(originalIndex: number, vertex: Uint32Array): void {
    let newIndex = this._remappedIndices.get(originalIndex);
    if (undefined === newIndex) {
      newIndex = this.vertices.length;
      this._remappedIndices.set(originalIndex, newIndex);

      this.colors?.remap(vertex);
      this.vertices.push(vertex);
    }

    this.indices.push(newIndex);
  }
}

interface VertexTableSplitArgs extends VertexTableWithIndices {
  featureTable: PackedFeatureTable;
  colorTable?: Uint32Array;
}

class VertexTableSplitter {
  private readonly _input: VertexTableSplitArgs;
  private readonly _computeNodeId: ComputeNodeId;
  private readonly _nodes = new Map<number, Node>();

  private constructor(input: VertexTableSplitArgs, computeNodeId: ComputeNodeId) {
    this._input = input;
    this._computeNodeId = computeNodeId;
  }

  public static split(source: VertexTableSplitArgs, computeNodeId: ComputeNodeId): Map<number, Node> {
    const splitter = new VertexTableSplitter(source, computeNodeId);
    splitter.split();
    return splitter._nodes;
  }

  // ###TODO: Produce new color tables and material atlases, remapping indices.
  private split(): void {
    // Track the most recent feature and corresponding node to avoid repeated lookups - vertices for
    // individual features are largely contiguous.
    let curState = {
      featureIndex: -1,
      node: undefined as unknown as Node,
    };

    const vertSize = this._input.vertices.numRgbaPerVertex;
    const vertex = new Uint32Array(vertSize);
    const vertexTable = new Uint32Array(this._input.vertices.data.buffer, this._input.vertices.data.byteOffset, this._input.vertices.data.byteLength / 4);

    for (const index of this._input.indices) {
      // Extract the data for this vertex without allocating new typed arrays.
      const vertexOffset = index * vertSize;
      for (let i = 0; i < vertex.length; i++)
        vertex[i] = vertexTable[vertexOffset + i];

      // Determine to which element the vertex belongs and find the corresponding Node.
      const featureIndex = vertex[2] & 0x00ffffff;
      if (curState.featureIndex !== featureIndex) {
        curState.featureIndex = featureIndex;
        const elemId = this._input.featureTable.getElementIdPair(featureIndex);
        const nodeId = this._computeNodeId(elemId);
        let node = this._nodes.get(nodeId);
        if (undefined === node)
          this._nodes.set(nodeId, node = new Node(nodeId, vertSize));

        curState.node = node;
      }

      // Add the vertex to the appropriate node.
      curState.node.addVertex(index, vertex);
    }
  }
}

/** Given a PointStringParams and a function that can associate a node Id with an element Id, produce a mapping of nodes to PointStringParams, splitting up
 * the input params as needed.
 * @internal
 */
export function splitPointStringParams(params: PointStringParams, featureTable: PackedFeatureTable, computeNodeId: ComputeNodeId): Map<number, PointStringParams> {
  const result = new Map<number, PointStringParams>();

  const { indices, vertices } = params;
  const colorTable = undefined === vertices.uniformColor ? new Uint32Array(vertices.data.buffer, vertices.numVertices * vertices.numRgbaPerVertex * 4) : undefined;
  const nodes = VertexTableSplitter.split({ indices, vertices, featureTable, colorTable }, computeNodeId);

  return result;
}
