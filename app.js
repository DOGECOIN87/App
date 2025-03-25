/**
 * CMYK Video Channel Extractor
 * Main application logic for video processing using WebGL
 */

// Application state variables
let videoInput = null;
let channelSelect = null;
let processBtn = null;
let enableBtn = null;
let originalVideo = null;
let processedCanvas = null;
let statusElement = null;
let isProcessing = false;
let gl = null;
let shaderProgram = null;
let programInfo = null;
let buffers = null;
let texture = null;
let selectedChannel = 0; // 0: Cyan, 1: Magenta, 2: Yellow
let videoWidth = 0;
let videoHeight = 0;

console.log('CMYK Video Channel Extractor script loaded');

// Check browser compatibility
function checkCompatibility() {
  const hasWebGL = !!document.createElement('canvas').getContext('webgl');
  
  if (!hasWebGL) {
    updateStatus('Error: This browser does not support WebGL.', true);
    return false;
  }
  
  // Check video format support
  const videoEl = document.createElement('video');
  const webmSupport = videoEl.canPlayType('video/webm; codecs="vp8, vorbis"');
  const mp4Support = videoEl.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
  
  console.log(`Browser video format support - WebM: ${webmSupport}, MP4: ${mp4Support}`);
  
  // Show format recommendation if available
  const warningBox = document.querySelector('.warning-box');
  if (warningBox) {
    if (webmSupport === 'probably' || webmSupport === 'maybe') {
      if (mp4Support === 'probably' || mp4Support === 'maybe') {
        warningBox.style.display = 'none'; // Hide warning if both formats are supported
      } else {
        warningBox.innerHTML = `
          <p><strong>Browser Compatibility Note:</strong> Your browser appears to better support WebM format videos rather than MP4. For best results, please use WebM format videos.</p>
          <p><strong>Convert videos to WebM:</strong> You can use tools like <a href="https://cloudconvert.com/mp4-to-webm" target="_blank">CloudConvert</a> or <a href="https://ffmpeg.org/" target="_blank">FFmpeg</a> to convert videos to WebM format.</p>
        `;
      }
    } else if (mp4Support === 'probably' || mp4Support === 'maybe') {
      warningBox.innerHTML = `
        <p><strong>Browser Compatibility Note:</strong> Your browser appears to better support MP4 format videos rather than WebM. For best results, please use MP4 format videos.</p>
      `;
    } else {
      warningBox.innerHTML = `
        <p><strong>Browser Compatibility Warning:</strong> Your browser has limited support for video formats. You may encounter playback issues.</p>
        <p>Try using a different browser such as Chrome, Firefox, or Edge for better compatibility.</p>
      `;
    }
  }
  
  return true;
}

// Initialize the application
function init() {
  console.log('App initialization started');
  
  // Important: Get DOM elements after document is loaded
  videoInput = document.getElementById('videoInput');
  channelSelect = document.getElementById('channelSelect');
  processBtn = document.getElementById('processBtn');
  enableBtn = document.getElementById('enableBtn');
  originalVideo = document.getElementById('originalVideo');
  processedCanvas = document.getElementById('processedCanvas');
  statusElement = document.getElementById('status');
  
  // Check if all critical DOM elements are found
  const criticalElements = {
    videoInput: !!videoInput, 
    channelSelect: !!channelSelect, 
    processBtn: !!processBtn, 
    originalVideo: !!originalVideo, 
    processedCanvas: !!processedCanvas, 
    statusElement: !!statusElement
  };
  
  const missingElements = Object.entries(criticalElements)
    .filter(([key, exists]) => !exists)
    .map(([key]) => key);
  
  if (missingElements.length > 0) {
    console.error('Critical DOM elements not found:', missingElements);
    alert('Error: App could not initialize - missing DOM elements. Check console for details.');
    return;
  }
  
  console.log('All critical DOM elements found');
  
  if (!checkCompatibility()) {
    console.error('WebGL compatibility check failed');
    return;
  }
  
  // Set up event listeners
  videoInput.addEventListener('change', handleVideoUpload);
  channelSelect.addEventListener('change', handleChannelSelect);
  processBtn.addEventListener('click', startProcessing);
  originalVideo.addEventListener('play', syncProcessedVideo);
  originalVideo.addEventListener('pause', () => isProcessing = false);
  originalVideo.addEventListener('seeked', handleVideoSeek);
  
  // Set up enable button if it exists
  if (enableBtn) {
    console.log('Enable button found, setting up event listener');
    enableBtn.addEventListener('click', manuallyEnableProcessing);
  }
  
  console.log('Event listeners configured');
  
  // Initialize WebGL
  initWebGL();
  
  updateStatus('Ready. Please upload a video file.');
  console.log('App successfully initialized');
}

// Update status message
function updateStatus(message, isError = false) {
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.style.color = isError ? 'red' : '#2c3e50';
  }
  console.log(isError ? `ERROR: ${message}` : message);
}

// Handle video file upload
function handleVideoUpload(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  
  // Reset state
  resetProcessing();
  
  // Get file extension
  const fileExtension = file.name.split('.').pop().toLowerCase();
  
  // Set MIME type based on file extension
  let mimeType;
  switch (fileExtension) {
    case 'mp4':
      mimeType = 'video/mp4';
      break;
    case 'webm':
      mimeType = 'video/webm';
      break;
    case 'ogg':
      mimeType = 'video/ogg';
      break;
    case 'mov':
      mimeType = 'video/quicktime';
      break;
    default:
      mimeType = file.type || 'video/mp4'; // Default to mp4 if unknown
  }
  
  // Log for debugging
  console.log(`File: ${file.name}, Detected MIME: ${mimeType}`);
  
  // Use the file directly with its detected MIME type instead of creating a new Blob
  // This is more reliable as it preserves the original file data
  const videoURL = URL.createObjectURL(file);
  
  // Add more debugging information
  console.log(`Original file type: ${file.type}`);
  console.log(`File size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
  
  // Clear any previous errors
  updateStatus(`Loading video, please wait...`);
  
  // Clear any previous event listeners to avoid duplicates
  originalVideo.removeEventListener('error', videoErrorHandler);
  originalVideo.removeEventListener('loadedmetadata', videoMetadataHandler);
  originalVideo.removeEventListener('loadeddata', videoDataHandler);
  originalVideo.removeEventListener('canplay', videoCanPlayHandler);
  
  // Set up more comprehensive error and event handlers
  originalVideo.addEventListener('error', videoErrorHandler, { once: true });
  originalVideo.addEventListener('loadedmetadata', videoMetadataHandler, { once: true });
  originalVideo.addEventListener('loadeddata', videoDataHandler, { once: true });
  originalVideo.addEventListener('canplay', videoCanPlayHandler, { once: true });
  
  // Progress feedback for better user experience
  originalVideo.addEventListener('loadstart', () => {
    updateStatus(`Starting to load video...`);
  }, { once: true });
  
  originalVideo.addEventListener('waiting', () => {
    updateStatus(`Waiting for video data...`);
  });
  
  // Set the video source after setting up the event handlers
  originalVideo.src = videoURL;
  originalVideo.load(); // Force reload
}

// Video error handler
function videoErrorHandler(e) {
  console.error('Video error:', e);
  let errorMessage = `Error: Failed to load video file.`;
  
  // Provide specific error information based on error code if available
  if (originalVideo.error) {
    switch (originalVideo.error.code) {
      case 1:
        errorMessage = `Error: The video loading was aborted.`;
        break;
      case 2:
        errorMessage = `Error: Network error occurred while loading the video.`;
        break;
      case 3:
        errorMessage = `Error: Video decoding failed. The format may be unsupported.`;
        break;
      case 4:
        errorMessage = `Error: Video format not supported by this browser.`;
        break;
    }
    console.error('Error details:', originalVideo.error);
  }
  
  updateStatus(errorMessage, true);
  processBtn.disabled = true;
}

// Video metadata loaded handler
function videoMetadataHandler() {
  videoWidth = originalVideo.videoWidth;
  videoHeight = originalVideo.videoHeight;
  
  console.log(`Video metadata loaded - dimensions: ${videoWidth}x${videoHeight}`);
  
  if (videoWidth === 0 || videoHeight === 0) {
    updateStatus(`Error: Could not detect video dimensions. The format may be unsupported.`, true);
    processBtn.disabled = true;
    return;
  }
  
  // Set canvas size to match video
  processedCanvas.width = videoWidth;
  processedCanvas.height = videoHeight;
  
  // Enable the process button
  processBtn.disabled = false;
  updateStatus(`Video dimensions detected: ${videoWidth}x${videoHeight}`);
}

// Video data loaded handler
function videoDataHandler() {
  console.log('Video data loaded');
  // Double-check dimensions in case they weren't available in metadata
  if (videoWidth === 0 || videoHeight === 0) {
    videoWidth = originalVideo.videoWidth;
    videoHeight = originalVideo.videoHeight;
    
    if (videoWidth > 0 && videoHeight > 0) {
      processedCanvas.width = videoWidth;
      processedCanvas.height = videoHeight;
      processBtn.disabled = false;
      updateStatus(`Video loaded: ${videoWidth}x${videoHeight}`);
    }
  }
}

// Video can play handler
function videoCanPlayHandler() {
  updateStatus(`Video ready to play`);
  // Final check to enable button if not already enabled
  if (processBtn.disabled && originalVideo.videoWidth > 0) {
    processBtn.disabled = false;
  }
}

// Handle channel selection change
function handleChannelSelect() {
  switch (channelSelect.value) {
    case 'C':
      selectedChannel = 0;
      break;
    case 'M':
      selectedChannel = 1;
      break;
    case 'Y':
      selectedChannel = 2;
      break;
    default:
      selectedChannel = 0;
  }
  
  if (isProcessing) {
    // If already processing, update the shader uniform
    gl.uniform1i(programInfo.uniformLocations.channelSelect, selectedChannel);
  }
}

// Reset processing state
function resetProcessing() {
  isProcessing = false;
  processBtn.disabled = true;
}

// Initialize WebGL for rendering
function initWebGL() {
  gl = processedCanvas.getContext('webgl');
  
  if (!gl) {
    updateStatus('Error: Unable to initialize WebGL. Your browser may not support it.', true);
    return;
  }
  
  // Create shader program
  shaderProgram = createShaderProgram(gl);
  
  if (!shaderProgram) {
    updateStatus('Error: Failed to initialize WebGL shaders.', true);
    return;
  }
  
  // Set up program info with attribute and uniform locations
  programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
      textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
    },
    uniformLocations: {
      sampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
      channelSelect: gl.getUniformLocation(shaderProgram, 'uChannelSelect'),
    },
  };
  
  // Initialize buffers for rendering a full-screen quad
  buffers = initBuffers(gl);
  
  // Create and set up the texture
  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  
  // Fill the texture with a single pixel until we load the video frame
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 255])
  );
  
  // Set texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

// Manually enable processing button (fallback for when automatic detection fails)
function manuallyEnableProcessing() {
  if (!originalVideo.src) {
    updateStatus('Please upload a video first.', true);
    return;
  }
  
  // Force enable the process button
  processBtn.disabled = false;
  
  // Set default dimensions if not already detected
  if (videoWidth === 0 || videoHeight === 0) {
    // Try to get dimensions one more time
    videoWidth = originalVideo.videoWidth || 640;
    videoHeight = originalVideo.videoHeight || 360;
    
    // Set canvas size
    processedCanvas.width = videoWidth;
    processedCanvas.height = videoHeight;
    
    console.log(`Manual dimensions set: ${videoWidth}x${videoHeight}`);
  }
  
  updateStatus(`Processing enabled manually. Click Process Video to start.`);
}

// Start video processing
async function startProcessing() {
  if (!originalVideo.src || isProcessing) {
    return;
  }
  
  updateStatus('Initializing video processing...');
  
  try {
    // Start playback of original video if not already playing
    if (originalVideo.paused) {
      try {
        await originalVideo.play();
      } catch (error) {
        updateStatus('Error: Playback could not start. User interaction may be required.', true);
        console.error('Play error:', error);
        return;
      }
    }
    
    isProcessing = true;
    
    // Start the render loop
    requestAnimationFrame(processCurrentVideoFrame);
    
    updateStatus(`Processing video: ${channelSelect.options[channelSelect.selectedIndex].text}`);
  } catch (error) {
    updateStatus(`Error: ${error.message}`, true);
    console.error('Processing error:', error);
    resetProcessing();
  }
}

// Process the current video frame
function processCurrentVideoFrame() {
  if (!isProcessing || originalVideo.paused || originalVideo.ended) {
    return;
  }
  
  try {
    // Update canvas dimensions if needed
    if (processedCanvas.width !== videoWidth || processedCanvas.height !== videoHeight) {
      processedCanvas.width = videoWidth;
      processedCanvas.height = videoHeight;
    }
    
    // Set up WebGL for rendering
    gl.viewport(0, 0, processedCanvas.width, processedCanvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Use our shader program
    gl.useProgram(programInfo.program);
    
    // Set up vertex attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexPosition,
      2, gl.FLOAT, false, 0, 0
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
    gl.vertexAttribPointer(
      programInfo.attribLocations.textureCoord,
      2, gl.FLOAT, false, 0, 0
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);
    
    // Update the texture with the current video frame
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, originalVideo);
    
    // Set shader uniforms
    gl.uniform1i(programInfo.uniformLocations.sampler, 0);
    gl.uniform1i(programInfo.uniformLocations.channelSelect, selectedChannel);
    
    // Draw the full-screen quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } catch (error) {
    console.error('Error rendering frame:', error);
    updateStatus('Error processing video frame: ' + error.message, true);
    isProcessing = false;
    return;
  }
  
  // Continue the render loop
  requestAnimationFrame(processCurrentVideoFrame);
}

// Sync processed video with original video playback
function syncProcessedVideo() {
  if (!isProcessing) {
    isProcessing = true;
    requestAnimationFrame(processCurrentVideoFrame);
  }
}

// Handle video seeking
function handleVideoSeek() {
  if (isProcessing) {
    // Force a re-rendering with current frame after seeking
    requestAnimationFrame(processCurrentVideoFrame);
  }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
