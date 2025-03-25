/**
 * WebGL shader definitions for CMYK Video Channel Extractor
 * Contains vertex and fragment shaders for RGB to CMYK conversion
 */

// Vertex shader program - passes texture coordinates unchanged
const vertexShaderSource = `
attribute vec4 aVertexPosition;
attribute vec2 aTextureCoord;
varying highp vec2 vTextureCoord;

void main(void) {
  gl_Position = aVertexPosition;
  vTextureCoord = aTextureCoord;
}`;

// Fragment shader program - converts RGB to CMYK and extracts the selected channel
const fragmentShaderSource = `
precision highp float;
varying highp vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform int uChannelSelect; // 0 = Cyan, 1 = Magenta, 2 = Yellow

void main(void) {
  // Sample RGB from the texture
  vec4 color = texture2D(uSampler, vTextureCoord);
  float r = color.r;
  float g = color.g;
  float b = color.b;
  
  // Convert RGB to CMYK
  float k = 1.0 - max(max(r, g), b);
  
  // Calculate CMY components
  // Handle division by zero when K=1 (black)
  float c = k < 1.0 ? (1.0 - r - k) / (1.0 - k) : 0.0;
  float m = k < 1.0 ? (1.0 - g - k) / (1.0 - k) : 0.0;
  float y = k < 1.0 ? (1.0 - b - k) / (1.0 - k) : 0.0;
  
  // Extract the selected channel
  float channelValue = 0.0;
  if (uChannelSelect == 0) {
    channelValue = c; // Cyan
  } else if (uChannelSelect == 1) {
    channelValue = m; // Magenta
  } else if (uChannelSelect == 2) {
    channelValue = y; // Yellow
  }
  
  // Output as grayscale (intensity = channel value)
  gl_FragColor = vec4(channelValue, channelValue, channelValue, 1.0);
}`;

/**
 * Create and compile a shader
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {number} type - The type of shader (VERTEX_SHADER or FRAGMENT_SHADER)
 * @param {string} source - The GLSL source code for the shader
 * @returns {WebGLShader} The compiled shader
 */
function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  
  return shader;
}

/**
 * Create and link a shader program with the given vertex and fragment shaders
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @returns {WebGLProgram} The linked shader program
 */
function createShaderProgram(gl) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  
  if (!vertexShader || !fragmentShader) {
    return null;
  }
  
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error('Shader program linking error:', gl.getProgramInfoLog(shaderProgram));
    return null;
  }
  
  return shaderProgram;
}

/**
 * Initialize WebGL buffer objects for a full-screen quad
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @returns {Object} Buffer objects containing position and texture coordinates
 */
function initBuffers(gl) {
  // Create position buffer (full-screen quad: 2 triangles)
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const positions = [
    -1.0, -1.0,  // bottom left
     1.0, -1.0,  // bottom right
    -1.0,  1.0,  // top left
     1.0,  1.0,  // top right
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  
  // Create texture coordinate buffer
  const textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  const textureCoordinates = [
    0.0, 0.0,  // bottom left
    1.0, 0.0,  // bottom right
    0.0, 1.0,  // top left
    1.0, 1.0,  // top right
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);
  
  return {
    position: positionBuffer,
    textureCoord: textureCoordBuffer,
  };
}
