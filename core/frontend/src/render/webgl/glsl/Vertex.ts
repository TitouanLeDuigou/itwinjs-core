/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import { DrawParams } from "../DrawCommand";
import { UniformHandle } from "../UniformHandle";
import { Matrix4 } from "../Matrix";
import { Pass, TextureUnit } from "../RenderFlags";
import { IsInstanced } from "../TechniqueFlags";
import { VariableType, VertexShaderBuilder } from "../ShaderBuilder";
import { System } from "../System";
import { decode3Float32, decodeUint16, decodeUint24 } from "./Decode";
import { addInstanceOverrides } from "./Instancing";
import { addLookupTable } from "./LookupTable";

const initializeVertLUTCoords = `
  g_vertexLUTIndex = decodeUInt24(qpos);
  g_vertexBaseCoords = compute_vert_coords(g_vertexLUTIndex);
`;

const unquantizePosition = `
vec4 unquantizePosition(vec3 pos, vec3 origin, vec3 scale) { return vec4(origin + scale * pos, 1.0); }
`;

export const unquantizeVertexPosition = `
vec4 unquantizeVertexPosition(vec3 pos, vec3 origin, vec3 scale) { return unquantizePosition(pos, origin, scale); }
`;

// Need to read 2 rgba values to obtain 6 16-bit integers for position
const unquantizeVertexPositionFromLUT = `
vec4 unquantizeVertexPosition(vec3 encodedIndex, vec3 origin, vec3 scale) {
  if (g_usesQuantizedPosition) {
#if 0
    vec4 enc1 = g_vertLutData[0];
    vec4 enc2 = g_vertLutData[1];
    vec3 qpos = vec3(decodeUInt16(enc1.xy), decodeUInt16(enc1.zw), decodeUInt16(enc2.xy));
    return unquantizePosition(qpos, origin, scale);
#else
    vec2 tc = g_vertexBaseCoords;
    vec4 enc1 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
    tc.x += g_vert_stepX;
    vec4 enc2 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
    vec3 qpos = vec3(decodeUInt16(enc1.xy), decodeUInt16(enc1.zw), decodeUInt16(enc2.xy));
    g_vertexData1zw = enc2.zw;
    return unquantizePosition(qpos, origin, scale);
#endif
  }

  vec4 pf[4];
#if 0
  pf[0] = g_vertLutData[0].xwzy; // swap y and w
  pf[1] = g_vertLutData[1].xywz; // swap z and w
  pf[2] = g_vertLutData[2].wyzx; // swap x and w
#else
  vec2 tc = g_vertexBaseCoords;
  pf[0] = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  tc.x += g_vert_stepX;
  pf[1] = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  tc.x += g_vert_stepX;
  pf[2] = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  tc.x += g_vert_stepX;
  pf[3] = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
#endif
  g_featureAndMaterialIndex = vec4(pf[0].w, pf[1].w, pf[2].w, pf[3].w);
  vec4 position;
  position.xyz = decode3Float32(pf);
  position.w = 1.0;
  return position;
}
`;

const computeLineWeight = "\nfloat computeLineWeight() { return g_lineWeight; }\n";
const computeLineCode = "\nfloat computeLineCode() { return g_lineCode; }\n";

/** @internal */
export function addModelViewProjectionMatrix(vert: VertexShaderBuilder): void {
  if (vert.usesInstancedGeometry) {
    addModelViewMatrix(vert);
    addProjectionMatrix(vert);
    vert.addGlobal("g_mvp", VariableType.Mat4);
    vert.addInitializer("g_mvp = u_proj * g_mv;");
  } else {
    vert.addUniform("u_mvp", VariableType.Mat4, (prog) => {
      prog.addGraphicUniform("u_mvp", (uniform, params) => {
        params.target.uniforms.branch.bindModelViewProjectionMatrix(uniform, params.geometry, params.isViewCoords);
      });
    });
  }
}

/** @internal */
export function addProjectionMatrix(vert: VertexShaderBuilder): void {
  vert.addUniform("u_proj", VariableType.Mat4, (prog) => {
    prog.addProgramUniform("u_proj", (uniform, params) => {
      params.bindProjectionMatrix(uniform);
    });
  });
}

const computeInstancedRtcMatrix = `
  g_instancedRtcMatrix = u_instanced_rtc * g_modelMatrixRTC;
`;

/** @internal */
export function addInstancedRtcMatrix(vert: VertexShaderBuilder): void {
  if (!vert.usesInstancedGeometry)
    return;

  assert(undefined !== vert.find("g_modelMatrixRTC")); // set up in VertexShaderBuilder constructor...
  vert.addUniform("u_instanced_rtc", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_instanced_rtc", (uniform, params) => {
      const modelt = params.geometry.asInstanced!.getRtcOnlyTransform();
      uniform.setMatrix4(Matrix4.fromTransform(modelt));
    });
  });

  vert.addGlobal("g_instancedRtcMatrix", VariableType.Mat4);
  vert.addInitializer(computeInstancedRtcMatrix);
}

/** @internal */
export function addModelViewMatrix(vert: VertexShaderBuilder): void {
  const bind = (uniform: UniformHandle, params: DrawParams) => {
    params.target.uniforms.branch.bindModelViewMatrix(uniform, params.geometry, params.isViewCoords);
  };

  if (vert.usesInstancedGeometry) {
    vert.addUniform("u_instanced_modelView", VariableType.Mat4, (prog) => {
      prog.addGraphicUniform("u_instanced_modelView", bind);
    });

    vert.addGlobal("g_mv", VariableType.Mat4);
    vert.addInitializer("g_mv = u_instanced_modelView * g_modelMatrixRTC;");
  } else {
    vert.addUniform("u_mv", VariableType.Mat4, (prog) => {
      // ###TODO: We only need 3 rows, not 4...
      prog.addGraphicUniform("u_mv", bind);
    });
  }
}

const computeNormalMatrix = `
  g_nmx = mat3(u_modelViewN);
  g_nmx[0][0] *= u_frustumScale.x;
  g_nmx[1][1] *= u_frustumScale.y;
`;

const computeNormalMatrix2 = `
  g_nmx = transpose(inverse(mat3(MAT_MV)));
  g_nmx[0][0] *= u_frustumScale.x;
  g_nmx[1][1] *= u_frustumScale.y;
`;

const computeNormalMatrix1Inst = `
  g_nmx = mat3(MAT_MV);
  g_nmx[0][0] *= u_frustumScale.x;
  g_nmx[1][1] *= u_frustumScale.y;
`;

/** @internal */
export function addNormalMatrix(vert: VertexShaderBuilder, instanced: IsInstanced) {
  vert.addGlobal("g_nmx", VariableType.Mat3);
  vert.addUniform("u_frustumScale", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_frustumScale", (uniform, params) => {
      const scale = params.target.uniforms.branch.top.frustumScale;
      uniform.setUniform2fv([scale.x, scale.y]);
    });
  });

  if (System.instance.capabilities.isWebGL2) {
    vert.addInitializer(computeNormalMatrix2);
  } else if (IsInstanced.Yes === instanced) {
    vert.addInitializer(computeNormalMatrix1Inst);
  } else {
    vert.addUniform("u_modelViewN", VariableType.Mat3, (prog) => {
      prog.addGraphicUniform("u_modelViewN", (uniform, params) => {
        params.target.uniforms.branch.bindModelViewNTransform(uniform, params.geometry, false);
      });
    });
    vert.addInitializer(computeNormalMatrix);
  }
}

const scratchLutParams = new Float32Array(4);
function addPositionFromLUT(vert: VertexShaderBuilder) {
  vert.addGlobal("g_vertexLUTIndex", VariableType.Float);
  vert.addGlobal("g_vertexBaseCoords", VariableType.Vec2);
  vert.addGlobal("g_vertexData1zw", VariableType.Vec2);
  vert.addGlobal("g_featureAndMaterialIndex", VariableType.Vec4);

  vert.addFunction(decodeUint24);
  vert.addFunction(decodeUint16);
  vert.addFunction(decode3Float32);
  vert.addFunction(unquantizeVertexPositionFromLUT);

  vert.addUniform("u_vertLUT", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_vertLUT", (uniform, params) => {
      (params.geometry.asLUT!).lut.texture.bindSampler(uniform, TextureUnit.VertexLUT);
    });
  });

  vert.addUniform("u_vertParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_vertParams", (uniform, params) => {
      assert(undefined !== params.geometry.asLUT);
      const lut = params.geometry.asLUT.lut;
      const lutParams = scratchLutParams;
      lutParams[0] = lut.texture.width;
      lutParams[1] = lut.texture.height;
      lutParams[2] = lut.numRgbaPerVertex;
      lutParams[3] = lut.numVertices;
      uniform.setUniform4fv(lutParams);
    });
  });

  addLookupTable(vert, "vert", "u_vertParams.z");
  vert.addInitializer(initializeVertLUTCoords);

  assert(undefined !== vert.maxRgbaPerVertex);
  const maxRgbaPerVertex = vert.maxRgbaPerVertex.toString();
  // vert.addGlobal(`g_vertLutData[${maxRgbaPerVertex}]`, VariableType.Vec4);
  vert.addGlobal("g_usesQuantizedPosition", VariableType.Boolean);

  // Read the vertex data from the vertex table up front. If using WebGL 2, only read the number of RGBA values we actually need for this vertex table.
  const loopStart = `for (int i = 0; i < ${System.instance.capabilities.isWebGL2 ? "int(u_vertParams.z)" : maxRgbaPerVertex}; i++)`;
  vert.addInitializer(`
    g_usesQuantizedPosition = u_qScale.x >= 0.0;
#if 0
    vec2 tc = g_vertexBaseCoords;
    ${loopStart} {
      g_vertLutData[i] = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
      tc.x += g_vert_stepX;
    }
#endif
  `);
}

// Shader tests u_qScale.x < 0 to determine that positions are not quantized.
const unquantizedScale = new Float32Array([-1, -1, -1]);

/** @internal */
export function addPosition(vert: VertexShaderBuilder, fromLUT: boolean) {
  vert.addFunction(unquantizePosition);

  vert.addUniform("u_qScale", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_qScale", (uniform, params) => {
      uniform.setUniform3fv(params.geometry.usesQuantizedPositions ? params.geometry.qScale : unquantizedScale);
    });
  });
  vert.addUniform("u_qOrigin", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_qOrigin", (uniform, params) => {
      // If positions aren't quantized, the shader doesn't use the origin - don't bother updating it.
      if (params.geometry.usesQuantizedPositions)
        uniform.setUniform3fv(params.geometry.qOrigin);
    });
  });

  if (!fromLUT) {
    vert.addFunction(unquantizeVertexPosition);
  } else {
    addPositionFromLUT(vert);
  }
}

/** @internal */
export function addAlpha(vert: VertexShaderBuilder): void {
  vert.addUniform("u_hasAlpha", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_hasAlpha", (uniform, params) => {
      uniform.setUniform1f(Pass.rendersTranslucent(params.geometry.getPass(params.target)) ? 1 : 0);
    });
  });
}

/** @internal */
export function addLineWeight(vert: VertexShaderBuilder): void {
  vert.addUniform("u_lineWeight", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_lineWeight", (attr, params) => {
      attr.setUniform1f(params.geometry.getLineWeight(params.programParams));
    });
  });

  vert.addGlobal("g_lineWeight", VariableType.Float);
  if (vert.usesInstancedGeometry) {
    addInstanceOverrides(vert);
    vert.addInitializer("g_lineWeight = mix(u_lineWeight, a_instanceOverrides.g, extractInstanceBit(kOvrBit_Weight));");
  } else {
    vert.addInitializer("g_lineWeight = u_lineWeight;");
  }

  vert.addFunction(computeLineWeight);
}

/** @internal */
export function replaceLineWeight(vert: VertexShaderBuilder, func: string): void {
  vert.replaceFunction(computeLineWeight, func);
}

/** @internal */
export function addLineCode(vert: VertexShaderBuilder): void {
  vert.addUniform("u_lineCode", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_lineCode", (attr, params) => {
      attr.setUniform1f(params.geometry.getLineCode(params.programParams));
    });
  });

  vert.addGlobal("g_lineCode", VariableType.Float);
  if (vert.usesInstancedGeometry) {
    addInstanceOverrides(vert);
    vert.addInitializer("g_lineCode = mix(u_lineCode, a_instanceOverrides.b, extractInstanceBit(kOvrBit_LineCode));");
  } else {
    vert.addInitializer("g_lineCode = u_lineCode;");
  }

  vert.addFunction(computeLineCode);
}

/** @internal */
export function replaceLineCode(vert: VertexShaderBuilder, func: string): void {
  vert.replaceFunction(computeLineCode, func);
}

/** @internal */
export function addFeatureAndMaterialLookup(vert: VertexShaderBuilder): void {
  if (undefined !== vert.find("g_featureAndMaterialIndex"))
    return;

  const computeFeatureAndMaterialIndex = `
#if 0
    g_featureAndMaterialIndex = g_usesQuantizedPosition ? g_vertLutData[2] : g_vertLutData[3];
#else
    if (g_usesQuantizedPosition) {
      vec2 tc = g_vertexBaseCoords;
      tc.x += g_vert_stepX * 2.0;
      g_featureAndMaterialIndex = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
    }
#endif
  `;

  vert.addGlobal("g_featureAndMaterialIndex", VariableType.Vec4);
  if (!vert.usesInstancedGeometry) {
    // Only needed for material atlas, and instanced geometry never uses material atlas.
    vert.addInitializer(computeFeatureAndMaterialIndex);
  }
}

// This vertex belongs to a triangle which should not be rendered. Produce a degenerate triangle.
// Also place it outside NDC range (for GL_POINTS)
const discardVertex = ` {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
`;

/** @internal */
export const earlyVertexDiscard = `  if (checkForEarlyDiscard(rawPosition))${discardVertex}`;
/** @internal */
export const vertexDiscard = `  if (checkForDiscard())${discardVertex}`;
/** @internal */
export const lateVertexDiscard = `  if (checkForLateDiscard())${discardVertex}`;
