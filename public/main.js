import { updateTrackColor, uploadAudio, updateClipPosition, updateClipRegions, duplicateAudioClipInDatabase, deleteAudioClipFromDb } from './daw.js';

//document.getElementById('addTrackBtn').addEventListener('click', addTrack);
document.getElementById('playBtn').addEventListener('click', playAll);
document.getElementById('stopBtn').addEventListener('click', stopAll);

export const waveSurferInstances = new Map();

let trackCount = 0;
let isDragging = false;
let isResizing = false;
let isResizingLeft = false;
let isPickingColor = false;
let isNamingTrack = false;

function getStandardBarWidth() {
    const standardBpm = 120;
    const beatsPerSecond = standardBpm / 60; // e.g., 2 for 120bpm
    const secondsPerBar = 4 / beatsPerSecond; // e.g., 2 for 120bpm
    return secondsPerBar * 50; // px per second, e.g., 100px for 120bpm
}

function getBeatWidth() {
    const standardBpm = 120;
    const beatsPerSecond = standardBpm / 60; // e.g., 2 for 120bpm
    return 50 / beatsPerSecond; // px per second per beat, e.g., 25px for 120bpm
}

function getHalfBeatWidth() {
    const standardBpm = 120;
    const hbeatsPerSecond = standardBpm / 30; // e.g., 2 for 120bpm
    return 50 / hbeatsPerSecond; // px per second per beat, e.g., 25px for 120bpm
}

export function addTrack(trackData) {
    if (!document.getElementById(`track-${trackData.id}`)) {
        trackCount++;
        const track = document.createElement('div');
        track.className = 'track';
        track.id = `track-${trackData.id}`;
        track.innerHTML = `
        <div class="track-header">
        <span contenteditable="true" spellcheck="false" class="track-name">Track ${trackCount}</span>
            <select class="color-picker">
                <option value="#9400D3" style="background-color: #9400D3;"></option>
                <option value="#FF0000" style="background-color: #FF0000;"></option>
                <option value="#00FF00" style="background-color: #00FF00;"></option>
                <option value="#FFFF00" style="background-color: #FFFF00;"></option>
            </select>
            <input type="file" accept=".mp3, .wav" onchange="loadAudio(this, this.closest('.track'))" hidden>
            <button class="addaudio-button" onclick="this.previousElementSibling.click()">+</button>
        </div>
        <div class="audio-controls">
            <button class="mute-button">Mute</button>
        </div>
        `;

        track.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });

        track.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
        
            const files = e.dataTransfer.files;
            if (files.length) {
                // Pass the files and the track element to the `loadAudioToDb` function
                loadAudioToDb(files, trackData); // `this` refers to the track element
            }
        });
        
        const screenWidth = window.innerWidth;
        track.style.width = (3 * screenWidth) + 'px';

        document.getElementById('tracks').appendChild(track);

        //Color picker logic
        const colorPicker = track.querySelector('.color-picker');
        colorPicker.style.backgroundColor = trackData.color;
        colorPicker.addEventListener('change', function () {
            const color = this.value;
            this.style.backgroundColor = color;
            const trackId = this.closest('.track').id;
        
            // Call the exported function from daw.js
            let newTrackId = trackId.slice(6);
            updateTrackColor(trackData.trackRoomId, newTrackId, color).then(() => {
              // Update successful, now update the local UI if needed
              if (waveSurferInstances[trackId]) {
                waveSurferInstances[trackId].forEach(wavesurfer => {
                    wavesurfer.setProgressColor(color);
                });
            }
            }).catch(error => {
              console.error(`Error updating color in main.js: ${error}`);
            });
        });

        colorPicker.addEventListener('click', function(){
            isPickingColor = !isPickingColor;
        });

        //Mute button logic 
        const muteButton = track.querySelector('.mute-button');
        muteButton.addEventListener('click', function() {
            const trackDiv = this.closest('.track');
            
            if (trackDiv.dataset.muted === "true") {
                trackDiv.dataset.muted = "false";
            } else {
                trackDiv.dataset.muted = "true";
            }
        });

        //track renaming logic
        const trackNameEl = track.querySelector('.track-name');
        trackNameEl.addEventListener('click', function() {
            isNamingTrack = true;
        });
        trackNameEl.addEventListener('focus', function() {
            isNamingTrack = true;
        });
        trackNameEl.addEventListener('blur', function() {
            const newName = this.textContent.trim();
            if (newName === '') {
                // If the user removes all content, reset it to the default track name
                this.textContent = `Track ${trackCount}`;
            }
            isNamingTrack = false;
        });
        trackNameEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent newline
                this.blur(); // Lose focus to trigger the blur event
                isNamingTrack = false;
            }
        });
        
        
        //draw beat indicators
        const barWidth = getStandardBarWidth();
        const beatWidth = getBeatWidth();
        const trackWidth = track.offsetWidth; 
        
        const indicator1 = document.createElement('div');
        indicator1.className = 'beat-indicator';
        indicator1.style.left = 0 + 'px';
        track.appendChild(indicator1);

        for(let x = beatWidth; x < trackWidth; x += beatWidth) {
            const indicator = document.createElement('div');

            // Determine if it's a full bar or a quarter beat
            if (x % barWidth === 0) {
                indicator.className = 'bar-indicator';
            } else {
                indicator.className = 'beat-indicator';
            }

            indicator.style.left = x + 'px';
            track.appendChild(indicator);
        }

        if(trackCount == 1){
            const beatIndicators = track.querySelectorAll('.beat-indicator, .bar-indicator');

            beatIndicators.forEach(marker => {
                console.log("button added!")
                const loopButton = document.createElement('button');
                loopButton.className = 'loop-button';
                loopButton.title = "Toggle loop point";
                
                // Position the loopButton above the beat marker
                loopButton.style.left = marker.style.left;
                loopButton.style.bottom = (marker.offsetHeight + 5) + 'px'; // 5px gap from the marker
                loopButton.style.left = loopButton.style.left - 2;
                
                marker.parentElement.insertBefore(loopButton, marker);
            });
        }
    }
}

function loadAudioToDb(files, trackData) {
    // Assuming `trackElement` contains data attributes with the room ID and track ID
    const roomId = trackData.trackRoomId;
    const trackId = trackData.id; // Make sure these data attributes are set correctly on the track element

    // Handle the first file from the list (assuming single file drop, adjust if multiple files can be dropped)
    const file = files[0];

    if (file && roomId && trackId) {
        // Call uploadAudio with the correct parameters
        uploadAudio(roomId, trackId, file).then(() => {
            console.log('Audio uploaded and document created');
        }).catch((error) => {
            console.error("Error uploading audio:", error);
        });
    }
}


export function loadAudio(input, element, existingPath = null, clipData = null) {
    let file;

    if (clipData) {
        // Directly use the URL from clipData
        return loadAudioInternal(input, null, element, clipData.url, clipData);
    }

    if (existingPath) {
        if (existingPath instanceof Blob || existingPath instanceof File) {
            file = existingPath;
            // Before calling the loadAudioInternal method
            if (element.classList.contains('sequencer')) {
                element.dataset.audioFilePath = URL.createObjectURL(file);
                 // Preload the audio right after setting the filePath
                const preloadedAudio = preloadAudio(element.dataset.audioFilePath);
                // Store the preloadedAudio in the sequencer for later use, this ensures it's cached
                element.audio = preloadedAudio;
            }
            return loadAudioInternal(input, file, element, existingPath, clipData = null);
        } else {
            return fetch(existingPath)
                .then(response => response.blob())
                .then(blob => {
                    // Before calling the loadAudioInternal method
                    if (element.classList.contains('sequencer')) {
                        element.dataset.audioFilePath = URL.createObjectURL(blob);
                        const preloadedAudio = preloadAudio(element.dataset.audioFilePath);
                        element.audio = preloadedAudio;
                    }
                    return loadAudioInternal(input, blob, element, existingPath, clipData = null);
                });
        }
    } else {
        file = input.files[0];
        // Before calling the loadAudioInternal method
        if (element.classList.contains('sequencer')) {
            element.dataset.audioFilePath = URL.createObjectURL(file);
            const preloadedAudio = preloadAudio(element.dataset.audioFilePath);
            element.audio = preloadedAudio;
        }
        return loadAudioInternal(input, file, element, existingPath, clipData = null);
    }    
}


function loadAudioInternal(input, file, track, filePath, clipData) {
    return new Promise((resolve, reject) => {
        const audioUrl = file ? URL.createObjectURL(file) : filePath;
        const audioElement = new Audio(audioUrl);

        audioElement.addEventListener('loadedmetadata', async function() {
            const duration = audioElement.duration;

            const audioDiv = document.createElement('div');
            audioDiv.className = 'audio';
            audioDiv.style.width = `${duration * 50}px`;
            
            if (!filePath) { // Only if it's a new load and not a duplicate
                audioDiv.dataset.filePath = URL.createObjectURL(file);
            }
            
            //create wavesurfer object
            if(track.classList.contains('track')){
            const color = track.querySelector('.color-picker').value;
            const wavesurfer = WaveSurfer.create({
                container: document.createElement('div'),
                waveColor: null,
                progressColor: 'purple',
                height: 85,
                pixelRatio: 1,
                plugins: [
                    WaveSurfer.regions.create({
                      disableDragSelection: {
                        slop: 5 // Enables dragging and re-sizing of regions
                      }
                    })
                ]
            });

            if (!waveSurferInstances[track.id]) {
                waveSurferInstances[track.id] = []; // Initialize the array if it doesn't exist
            }
            waveSurferInstances[track.id].push(wavesurfer);
            let regstart;
            let regend;
            waveSurferInstances.set(audioDiv, wavesurfer);
            wavesurfer.on('ready', function() {
                audioDiv.dataset.wavesurferId = wavesurfer.backend.ac.destination.context.id;
                const region = wavesurfer.addRegion({
                    start: clipData.regionstart || 0,
                    end: wavesurfer.getDuration(),
                    drag: false,
                    resize: true,
                    //color: 'rgba(0, 123, 255, 0.1)'
                    color: null,
                });
                //wavesurfer.addRegion(region);
                audioDiv.setAttribute('data-region-id', region.id);
                regstart = region.start;
                regend = region.end;
            });
            
            audioDiv.appendChild(wavesurfer.container);
            if (file) {
                // Only execute this part if 'file' is a Blob or File
                const reader = new FileReader();
                reader.onload = function(e) {
                    wavesurfer.loadBlob(new Blob([new Uint8Array(e.target.result)]));
                };
                reader.readAsArrayBuffer(file);
            } else {
                // If there is no 'file', load the audio from the URL
                wavesurfer.load(audioUrl);
            }
            if (input) {
                input.parentElement.nextElementSibling.appendChild(audioDiv);
            } else {
                // If input is null, append the audioDiv to an appropriate parent element
                const trackForClip = document.getElementById(`track-${clipData.trackId}`);
                trackForClip.prepend(audioDiv);
            }
            // Add file name as label on top
            const audioLabel = document.createElement('div');
            audioLabel.className = 'audio-label';
            let fileName = '';
            if(file){
                fileName = file.name +'';
                audioLabel.innerText = fileName;
            }else{
                fileName = clipData.name +'';
                audioLabel.innerText = fileName;
            }
            //wavesurfer.setWaveColor(null);
            wavesurfer.setProgressColor(clipData.color);
            audioDiv.appendChild(audioLabel);
            audioDiv.dataset.fileName = fileName;
            audioDiv.setAttribute('firebase-id', clipData.id);
            
            let overlay = audioDiv.querySelector('.audio-overlay');
            if (!overlay) {
                // If it doesn't exist yet, create it
                overlay = document.createElement('div');
                overlay.className = 'audio-overlay';
                audioDiv.appendChild(overlay); // Append the overlay to the audioDiv
                overlay.style.position = 'absolute';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.bottom = '0';
                overlay.style.width = '0';
            }
            const pixelDurationRatio = parseFloat(clipData.width) / clipData.duration;
            const startPixels = (clipData.regionstart) * pixelDurationRatio;
            console.log(startPixels);
            overlay.style.width = `${startPixels}px`;
            audioLabel.style.left = overlay.style.width;

            // Draggable function
            let startX = 0;
            let originalX = 0;
            audioDiv.dataset.dbClipData = JSON.stringify(clipData);
            audioLabel.addEventListener('mousedown', (e) => {
                isDragging = true;
                e.preventDefault(); // Prevent the default action
                startX = e.clientX;
                originalX = audioDiv.getBoundingClientRect().left;
                
                // Check if this audio clip is part of a group selection
                let group = [];
                if(audioDiv.classList.contains('selected')) {
                    group = document.querySelectorAll('.audio.selected'); // All selected clips
                } else {
                    group.push(audioDiv); // Only this clip
                }
            
                // For each clip in the group, store its original left position
                group.forEach(clip => {
                    clip.dataset.originalLeftStyle = parseInt(getComputedStyle(clip).left);
                });
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                let lastTime = 0;
                const updateInterval = 50; // Time in milliseconds
                function onMouseMove(e) {
                    if (isDragging && !isResizing) {
                        e.preventDefault(); // Prevent the default action
                        const currentTime = Date.now();
                        let deltaX = e.clientX - startX;
                        const pixelDurationRatio = wavesurfer.drawer.width / wavesurfer.getDuration();
                        group.forEach(clip => {
                            let originalLeftStyle = parseInt(clip.dataset.originalLeftStyle, 10);
                            let newLeft = originalLeftStyle + deltaX;
                            let regionStart = regstart * pixelDurationRatio;
                            if (e.ctrlKey) { // Check if Ctrl key is pressed
                            // Calculate nearest beat-indicator's X position
                            const track = clip.closest('.track'); // Get the closest track ancestor to the clip
                            // Fetch all the beat and bar indicators inside this track
                            const beatIndicators = [...track.querySelectorAll('.beat-indicator, .bar-indicator, .half-beat-indicator')];
                            const distances = beatIndicators.map(indicator => {
                                const indicatorLeft = parseFloat(getComputedStyle(indicator).left);
                                // Calculate distance for snapping based on the region's start within the clip
                                return Math.abs((newLeft + regionStart) - indicatorLeft);
                            });
                            const nearestDistance = Math.min(...distances);
                            const nearestIndicatorIndex = distances.indexOf(nearestDistance);
                            const nearestIndicator = beatIndicators[nearestIndicatorIndex];
                            // Snap audio clip's left position to align with the region start to the beat-indicator's X position
                            newLeft = parseFloat(getComputedStyle(nearestIndicator).left) - regionStart;
                            }
                            const clipId = clipData.id;
                            const trackId = clipData.trackId;
                            if (currentTime - lastTime > updateInterval) {
                                if (clipId) {
                                    updateClipPosition(trackId, clipId, newLeft); // Define this function in daw.js
                                }
                                lastTime = currentTime;
                            }
                            clip.style.left = newLeft + "px";
                            updateZIndexesForTrack(); // Replace with your actual function to update Z-Indexes for a track
                        });
                    }
                }
            
                function onMouseUp() {
                    isDragging = false;
                
                    // Iterate over each selected clip and update its position in the database
                    const selectedClips = document.querySelectorAll('.audio.selected');
                    selectedClips.forEach(clip => {
                        const newLeft = parseInt(clip.style.left);
                        const storedClipDataString = clip.dataset.dbClipData;
                        const storedClipData = JSON.parse(storedClipDataString);
                        const clipId = storedClipData.id;
                        const trackId = storedClipData.trackId;
                        // Update the clip's position in the database
                        if (clipId) {
                            updateClipPosition(trackId, clipId, newLeft); // Ensure this function is correctly defined in daw.js
                        }
                    });
                
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                }
            });

            //check for duplication
            audioLabel.addEventListener('click', async function(e) {
                if (e.shiftKey) {
                    // Check if this audio clip is part of a group selection
                    const group = audioDiv.classList.contains('selected') ? document.querySelectorAll('.audio.selected') : [audioDiv];
                    for (const clip of group) {
                        const originalClipData = {
                          // Extract necessary data from the original clip
                          url: clipData.url,
                          leftPosition: parseInt(clip.style.left, 10),
                          fileName: clipData.name + '(d)',
                          volume: clip.dataset.volume || 1,
                          trackId: clipData.trackId,
                          color: clipData.color,
                          width: clipData.width,
                          regionstart: clipData.regionstart,
                          regionend: clipData.duration,
                          duration: clipData.duration,
                          // Add other properties as needed
                        };
                        // Duplicate the clip in the database
                        try {
                          const newClipId = await duplicateAudioClipInDatabase(originalClipData);
                          console.log(`Duplicated clip with new ID: ${newClipId}`);
                        } catch (error) {
                          console.error(`Error duplicating clip: ${error}`);
                        }
                    }
                    // Store duplicated clips for future selection
                    const duplicatedClips = [];
                    // group.forEach(clip => {
                    //     const filePath = clip.dataset.filePath;
                    //     // Duplicate the clip
                    //     const trackElement = document.getElementById(`track-${clipData.trackId}`);
                    //     loadAudio(null, trackElement, null, clipData).then(duplicatedAudio => {
                    //         setTimeout(() => {
                    //             if (duplicatedAudio && clip.dataset.originalLeftStyle) {
                    //                 // Position the duplicate
                    //                 let originalLeftStyle = parseInt(clip.dataset.originalLeftStyle);
                    //                 duplicatedAudio.style.left = originalLeftStyle + "px"; //match dup clip position
                    //                 let originalWidth = parseFloat(clip.dataset.originalWidth);
                    //                 duplicatedAudio.style.width = originalWidth + "px"; //match dup clip width
                    //                 duplicatedAudio.dataset.originalWidth = duplicatedAudio.style.width;
                    //                 const wavesurfer = waveSurferInstances.get(duplicatedAudio);
                    //                 if (clip.dataset.volume) { //match dup clip volume
                    //                     wavesurfer.setVolume(clip.dataset.volume);
                    //                     duplicatedAudio.dataset.volume = clip.dataset.volume;
                    //                 }else{
                    //                     wavesurfer.setVolume(1);
                    //                 }
                    //                 // Access the audioLabel inside duplicatedAudio and change its innerText to match name
                    //                 const duplicatedAudioLabel = duplicatedAudio.querySelector('.audio-label');
                    //                 const originalAudioLabel = clip.querySelector('.audio-label');
                    //                 if (originalAudioLabel) {
                    //                     duplicatedAudioLabel.innerText = originalAudioLabel.innerText;
                    //                     duplicatedAudio.dataset.fileName = clip.dataset.fileName;
                    //                 }
                                    
                                
                    //                 // Add to the list of duplicated clips
                    //                 duplicatedClips.push(duplicatedAudio);
                    //             }
                    //             // Once all clips are duplicated and processed, update selection
                    //             if (duplicatedClips.length == group.length) {
                    //                 // Deselect the original clips
                    //                 group.forEach(originalClip => {
                    //                     originalClip.classList.remove('selected');
                    //                     originalClip.style.zIndex = 0;
                    //                 });
            
                    //                 // Select the duplicated clips and set their z-index
                    //                 duplicatedClips.forEach(dupClip => {
                    //                     dupClip.classList.add('selected');
                    //                     dupClip.style.zIndex = 1;
                    //                 });
                    //             }
                    //         }, 0);
                    //     });
                    // });
                }
            });
            
            //Modify your audioDiv creation to include a resize handle
            // Assuming you have access to the region element or can retrieve it
            // You might need to adjust this code to fit how you can access the handles or regions

            function updateZIndexesForTrack() {
                // Get the track element by the selector, if it's class based use '.track' or adjust accordingly.
                const track = document.querySelector('.track');
                if (!track) return; // If no track is found, do nothing.
              
                // Get all audio clips within the track
                let audioClips = Array.from(track.querySelectorAll('.audio'));
              
                // Sort the clips based on their offsetLeft property
                audioClips.sort((a, b) => a.offsetLeft - b.offsetLeft);
              
                // Assign z-index in descending order, starting with the length of the clips array
                // and decrementing down for each subsequent clip.
                audioClips.forEach((clip, index) => {
                  // You may choose a starting z-index value that suits your need, e.g., 1000
                  // Subtract the index to ensure it decreases with each clip from left to right
                  const zIndex = 1000 - index; 
                  clip.style.zIndex = zIndex;
                });
              }
              
            wavesurfer.on('region-updated', (region) =>{
                updateZIndexesForTrack(); // Replace with your actual track ID or class
                if(region.start !== regstart){
                    let lr = true;
                    onRegionResizeMove(region, lr);
                }else if (region.end !== regend){
                    let lr = false;
                    onRegionResizeMove(region, lr);
                }
                let trackId = clipData.trackId;
                let clipId = clipData.id;
                //updateClipRegions(trackId, clipId, region.start, region.end, audioDiv.style.width);
                return;
            });

            wavesurfer.on('region-update-end', (region) => {
                // This event should be fired once the resize ends
                console.log("region update end");
                regstart = region.start;
                regend = region.end;
                const audioDiv = document.querySelector(`.audio[data-region-id="${region.id}"]`);
                audioDiv.dataset.originalWidth = audioDiv.style.width;
                //onRegionResizeMove(region); //update
                let trackId = clipData.trackId;
                let clipId = clipData.id;
                updateClipRegions(trackId, clipId, regstart, regend, audioDiv.dataset.originalWidth);
                return;
            });

            function onRegionResizeMove(region, lr) {
                const audioDiv = document.querySelector(`.audio[data-region-id="${region.id}"]`);
                if (!audioDiv) {
                    console.error(`No audioDiv found for region with id: ${region.id}`);
                    return;
                }
                
                const wavesurfer = waveSurferInstances.get(audioDiv);
                
                const pixelDurationRatio = wavesurfer.drawer.width / wavesurfer.getDuration();
                if (lr == false){
                    const endPositionPixels = region.end * pixelDurationRatio; // Convert region end position to pixels
                    audioDiv.style.width = `${endPositionPixels}px`;
                }

                if (lr == true){
                    // If we're moving the left handle, adjust the overlay
                    let overlay = audioDiv.querySelector('.audio-overlay'); // Find the overlay div inside the audioDiv
                    // Update the overlay width based on the new start position
                    const startPixels = region.start * pixelDurationRatio;
                    overlay.style.width = `${startPixels}px`;
                    audioLabel.style.left = overlay.style.width;
                }
            }
            
            }
            audioDiv.style.left = (-0.5 + 'px');
            resolve(audioDiv);  // return the audioDiv when it's ready
            //const wavesurfer = waveSurferInstances.get(audioDiv);
            //const pixelDurationRatio = wavesurfer.drawer.width / clipData.duration;
            //const endPixels = (clipData.regionend) * pixelDurationRatio;
            //audioDiv.style.width = `${endPixels}px`;
        });

        audioElement.onerror = function() {
            reject(new Error('Error loading the audio file.'));
        };
    });
}
//add first track
//addTrack();

function addAudio(btn) {
    const audioDiv = document.createElement('div');
    audioDiv.className = 'audio';
    audioDiv.innerHTML = `Audio ${btn.parentElement.parentElement.getElementsByClassName('audio').length + 1}`;
    btn.parentElement.nextElementSibling.appendChild(audioDiv);
}

let isPlaying = false;
let playbackInterval = null;
let isLooping = false;

document.addEventListener('keydown', function(e) {
    if (e.code === 'Space') { // Check if the pressed key is spacebar
        if(isNamingTrack != true){
            e.preventDefault(); // Prevent the default action (page scrolling in some browsers)
            if (isPlaying) {
                stopAll();
                isPlaying = false;
            } else {
                playAll();
                isPlaying = true;
            }
        }
    }
});

// Keydown event for delete key
document.addEventListener('keydown', async function(e) {
    if (e.code === 'Delete') {
        e.preventDefault(); // Prevent the default action

        let group = document.querySelectorAll('.audio.selected'); // All selected clips
        for (let clip of group) {
            const clipId = clip.getAttribute('firebase-id');
            const storedClipDataString = clip.dataset.dbClipData;
            const storedClipData = JSON.parse(storedClipDataString);
            const trackId = storedClipData.trackId;

            if (clipId) {
                await deleteAudioClipFromDb(clipId, trackId); // Define this function in daw.js
            }
            //removeAudioClip(clip);
        }
    }
});


function resetPlayedFlags() {
    // Iterate through all audio div elements
    document.querySelectorAll('.audio').forEach(audioDiv => {
      // Retrieve the corresponding Wavesurfer instance
      const wavesurfer = waveSurferInstances.get(audioDiv);
  
      if (wavesurfer) {
        // Stop playback
        wavesurfer.stop();
  
        // Reset playhead to the start
        wavesurfer.seekTo(0);
  
        // Iterate through each region in the current Wavesurfer instance
        Object.keys(wavesurfer.regions.list).forEach((id) => {
          const region = wavesurfer.regions.list[id];
  
          // Reset custom properties or flags you have set on the regions
          region.isPlaying = false;
        });
  
        // Reset the data-played attribute for the audio div
        audioDiv.removeAttribute('data-played');
      }
    });
  }
  


let startTime = null;
let playbackTime = 0;
let activeIntervals = []; // Store all active sequencer intervals



function playAll() {
    const bar = document.getElementById('globalPlaybackBar');

    if (!isPlaying) {
        isPlaying = true;
        // Display the global playback bar
        bar.style.display = 'block';
        let lastTimestamp = null;
        let startTime = null;
        let playbackTime = 0;

        function playbackAnimation(timestamp) {
            if (!lastTimestamp) lastTimestamp = timestamp;
            const deltaTime = timestamp - lastTimestamp; // Time since the last frame
            lastTimestamp = timestamp;

            const bpm = document.getElementById('bpm').value;
            // Assume this is our basis for 120 BPM
            const basePixelsPerMinute = 25 * bpm; 
            const pixelsPerMinute = (bpm / bpm) * basePixelsPerMinute;
            const pixelsPerSecond = pixelsPerMinute / 60;

            const moveDistance = (pixelsPerSecond * deltaTime) / 1000; // Convert ms to seconds
            const newLeft = parseFloat(getComputedStyle(bar).left) + moveDistance;
            bar.style.left = `${newLeft}px`;

            // Update timer
            if (!startTime) startTime = timestamp;
            playbackTime += deltaTime;

            // Convert the playback time to minutes, seconds, and milliseconds
            const minutes = Math.floor(playbackTime / 60000);
            const seconds = Math.floor((playbackTime % 60000) / 1000);
            const milliseconds = playbackTime % 1000;

            // Format and display the time
            const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(3, '0').substring(0,2)}`; // Taking only first 2 digits of milliseconds
            document.getElementById('playbackTimer').textContent = formattedTime;
            
            // Iterate through all regions of all WaveSurfer instances
            waveSurferInstances.forEach((wavesurfer, audioDiv) => {
                const duration = wavesurfer.getDuration(); // Total duration of the waveform
                const containerWidth = wavesurfer.drawer.wrapper.scrollWidth; // Width of the waveform container
                const pixelsPerSecond = containerWidth / duration; // Calculate pixels per second

                Object.values(wavesurfer.regions.list).forEach((region) => {
                    // Now calculate the pixel position of the region start and end
                    const regionStartPixel = (region.start * pixelsPerSecond) + 28 + parseFloat(audioDiv.style.left);
                    const regionEndPixel = (region.end * pixelsPerSecond) + 28 + parseFloat(audioDiv.style.left);
            
                    if (newLeft >= regionStartPixel && newLeft <= regionEndPixel) {
                        if (!region.isPlaying && !audioDiv.dataset.played) {
                            if (audioDiv.closest('.track').dataset.muted !== "true") {
                                wavesurfer.play(region.start);
                                region.isPlaying = true;
                            }
                            audioDiv.dataset.played = "true"; // Mark the region as played
                        }
                    } else {
                        if (region.isPlaying) {
                            wavesurfer.stop();
                            region.isPlaying = false;
                        }
                    }
                });
            });
  
            //check for looping
            const loopingButtons = document.querySelectorAll('.loop-button[data-looping="true"]');
            loopingButtons.forEach(btn => {
                const btnPosition = parseFloat(btn.style.left);
                if (Math.abs((newLeft-30) - btnPosition) < 3) { // 1 as a threshold
                    // Add this line to set a global looping flag:
                    document.body.dataset.looping = "true";
                    //activateSeqs();
                    bar.style.left = '28px'; // Reset the bar's position
                    resetPlayedFlags(); // Reset the played flags for all audio clips
                    playbackTime = 0;
                    startTime = null;
                    document.getElementById('playbackTimer').textContent = '00:00:00';
                }
            });

            if (isPlaying) {
                requestAnimationFrame(playbackAnimation);
            }
        }
        //activateSeqs();
        requestAnimationFrame(playbackAnimation);
    }
}


function stopAll() {
    isPlaying = false;
    clearInterval(playbackInterval);
    document.getElementById('globalPlaybackBar').style.display = 'none';
    document.getElementById('globalPlaybackBar').style.left = '28px'; // Reset playback bar position
    // Similarly, reset timer and WaveSurfer instances here
    setTimeout(() => {
        document.querySelectorAll('.audio').forEach(audioDiv => {
            const wavesurfer = waveSurferInstances.get(audioDiv);
            wavesurfer.stop(); // Stop any playback
            wavesurfer.seekTo(0); // Set position to start of waveform
            audioDiv.removeAttribute('data-played'); // Reset the played state for the clip
            Object.keys(wavesurfer.regions.list).forEach((id) => {
                const region = wavesurfer.regions.list[id];
                wavesurfer.stop();
                region.isPlaying = false;
                wavesurfer.seekTo(0);
            });
        });
        playbackTime = 0;
        startTime = null;
        document.getElementById('playbackTimer').textContent = '00:00:00';
        activeIntervals.forEach(interval => clearInterval(interval));
        activeIntervals = []; // Reset the list of active intervals
    }, 25);
}

function preloadAudio(filePath) {
    const audio = new Audio(filePath);
    audio.preload = 'auto'; // Hint to browser that audio should be preloaded
    audio.load(); // Explicitly load the audio
    return audio;
}

function activateSeqs(){
    //play sequencers
    const allSequencers = document.querySelectorAll('.sequencer');
    allSequencers.forEach(sequencer => {
        if (sequencer.dataset.muted !== "true"){
            const interval = playSequencer(sequencer); // Modify the playSequencer to return interval
            if(interval) { // Check if an interval was returned (e.g., sequencer had audio loaded)
                activeIntervals.push(interval); 
            }
        }
    });
}

let sequencerCount = 0;
let isChangingSeqVol = false;

function addSequencer() {
    const sequencer = document.createElement('div');
    sequencer.className = 'sequencer';

    sequencerCount++;

    sequencer.innerHTML = `
    <div class="track-header">
    <span contenteditable="true" spellcheck="false" class="track-name">Seq ${sequencerCount}</span>
        <input type="file" accept=".mp3, .wav" onchange="loadAudio(this, this.closest('.sequencer'))" hidden>
        <button class="addSeqAudio-button" onclick="this.previousElementSibling.click()">+</button>
    </div>
    <div class="audio-controls">
        <button class="seqMute-button">Mute</button>
    </div>
    `;

    sequencer.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });

    sequencer.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const wavesurfer = waveSurferInstances.get(sequencer);
        if (wavesurfer) {
            wavesurfer.destroy();
            waveSurferInstances.delete(sequencer);
        }
        const files = e.dataTransfer.files;
        if (files.length) {
            const fileInput = sequencer.querySelector('input[type="file"]');
            fileInput.files = files;  // Assign the dragged files to the input element
            loadAudio(fileInput, sequencer);  // Call the loadAudio function using the file input
        }
    });

    //Mute button logic 
    const muteButton = sequencer.querySelector('.seqMute-button');
    muteButton.addEventListener('click', function() {
        const seqDiv = this.closest('.sequencer');
        
        if (seqDiv.dataset.muted === "true") {
            seqDiv.dataset.muted = "false";
        } else {
            seqDiv.dataset.muted = "true";
        }
    });

    //track renaming logic
    const trackNameEl = sequencer.querySelector('.track-name');
    trackNameEl.addEventListener('click', function() {
        isNamingTrack = true;
    });
    trackNameEl.addEventListener('focus', function() {
        isNamingTrack = true;
    });
    trackNameEl.addEventListener('blur', function() {
        const newName = this.textContent.trim();
        if (newName === '') {
            // If the user removes all content, reset it to the default track name
            this.textContent = `Track ${trackCount}`;
        }
        isNamingTrack = false;
    });

    trackNameEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent newline
            this.blur(); // Lose focus to trigger the blur event
            isNamingTrack = false;
        }
    });


    
    const beats = 320;  // Assuming you have a method to calculate number of beats based on BPM and duration.
    let width = 0;
    for(let i = 0; i < beats; i++) {
        const beatButton = document.createElement('button');
        beatButton.className = 'beat-button';
        sequencer.appendChild(beatButton);
        beatButton.style.left = width + 'px';
        width += 6.25;
        beatButton.addEventListener('click', function() {
            beatButton.classList.toggle('active'); // Toggle active state for playback
        });
    }

    // Append the sequencer to your container (or wherever you're storing tracks)
    document.getElementById('tracks').appendChild(sequencer);
}

function playSequencer(sequencer) {
    const allBeatButtons = Array.from(sequencer.querySelectorAll('.beat-button')); // All beat buttons
    const activeBeats = Array.from(sequencer.querySelectorAll('.beat-button.active'));  // Active beat buttons
    const preloadedAudio = sequencer.audio;
    if (!preloadedAudio) return;
    
    let beatCounter = 0;

    // Calculate the interval for a quarter beat
    const bpm = document.getElementById('bpm').value;
    const bpmInterval = (60000 / bpm) / 4; // Convert BPM to ms per quarter beat.

    let startTime;
    let nextBeatTime;

    function animate(timestamp) {
        if (!startTime) {
            startTime = timestamp;

            // Immediately check and play the first beat
            if (activeBeats.includes(allBeatButtons[beatCounter])) {
                preloadedAudio.currentTime = 0; // Reset audio to the start
                preloadedAudio.play();
            }

            beatCounter++;
            nextBeatTime = startTime + bpmInterval; // Set the time for the next beat
        }

        if (timestamp >= nextBeatTime) {
            // Check if the current beat button is active
            if (activeBeats.includes(allBeatButtons[beatCounter])) {
                preloadedAudio.currentTime = 0; // Reset audio to the start
                preloadedAudio.play();
            }
            

            beatCounter++;

            if (beatCounter >= allBeatButtons.length || document.body.dataset.looping === "true") {
                // We've reached the end or a loop has been triggered.
                // So, we shouldn't request another animation frame.
                document.body.dataset.looping = "false";
                beatCounter = 0;
                startTime = 0;
                nextBeatTime = 0;
                return;
            }

            nextBeatTime += bpmInterval; // Update the time for the next beat
        }
        if(isPlaying == true){
            requestAnimationFrame(animate);
        }else{
            preloadedAudio.pause();
            beatCounter = 0;
            startTime = 0;
            nextBeatTime = 0;
        }
    }

    // Kick off our animation loop.
    requestAnimationFrame(animate);
}



let selectedAudioClip; // Variable to hold the current selected audio clip

document.addEventListener('contextmenu', function(e) {
    e.preventDefault(); // Prevent the default right-click menu

    // Check if the right-clicked element is an audio clip or its child elements
    let target = e.target;
    while (target && !target.classList.contains('audio')) {
        target = target.parentElement;
    }

    if (target) {
        // Show the context menu
        const contextMenu = document.getElementById('contextMenu');
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`; 
        contextMenu.style.display = 'block';

        selectedAudioClip = target; // Update the selected clip

        // Set the volume slider value based on the clip's volume or set to default (1) if not set
        const volumeSlider = document.getElementById('volumeSlider');
        const currentVolume = selectedAudioClip.dataset.volume || 1;
        volumeSlider.value = currentVolume;

        // Attach an input event to the volume slider to adjust the clip's volume
        volumeSlider.oninput = function() {
            const wavesurfer = waveSurferInstances.get(selectedAudioClip);
            if (wavesurfer) {
                wavesurfer.setVolume(volumeSlider.value);
                selectedAudioClip.dataset.volume = volumeSlider.value; // Store the volume in the dataset for duplicated clips to access later
            }
        };

        // Attach a click event to the delete option in the context menu
        document.getElementById('deleteClip').onclick = async function() {
            const clipId = selectedAudioClip.getAttribute('firebase-id');
            const storedClipDataString = selectedAudioClip.dataset.dbClipData;
            const storedClipData = JSON.parse(storedClipDataString);
            const trackId = storedClipData.trackId;
            if (clipId) {
                await deleteAudioClipFromDb(clipId, trackId); // Define this function in daw.js
            }
            //removeAudioClip(selectedAudioClip);
            contextMenu.style.display = 'none'; // Hide the context menu
        };
    }
});

// Hide context menu if clicked elsewhere
document.addEventListener('click', function(e) {
    document.getElementById('contextMenu').style.display = 'none';
});

let isSelecting = false;
let startPoint = { x: 0, y: 0 };
const selectionRectangle = document.getElementById('selectionRectangle');

// Function to get the current scroll position
function getScrollPosition() {
    return {
        scrollLeft: window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft,
        scrollTop: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop
    };
}

// Listen for mousedown on the track for lasso
document.getElementById('tracks').addEventListener('mousedown', (e) => {
    if (isDragging == false && isResizing == false && isChangingSeqVol == false) {
        isSelecting = true;
        if (isPickingColor != true && isNamingTrack != true && isChangingSeqVol != true) {
            e.preventDefault(); // Prevent the default action
        }

        const scroll = getScrollPosition();
        startPoint.x = e.clientX + scroll.scrollLeft;
        startPoint.y = e.clientY + scroll.scrollTop;

        selectionRectangle.style.left = startPoint.x + 'px';
        selectionRectangle.style.top = startPoint.y + 'px';
        selectionRectangle.style.display = 'block';
    }
});

// Listen for mousemove on the track for lasso
document.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;
    e.preventDefault(); // Prevent the default action

    const scroll = getScrollPosition();
    const width = e.clientX + scroll.scrollLeft - startPoint.x;
    const height = e.clientY + scroll.scrollTop - startPoint.y;

    selectionRectangle.style.width = Math.abs(width) + 'px';
    selectionRectangle.style.height = Math.abs(height) + 'px';
    selectionRectangle.style.left = (width > 0 ? startPoint.x : e.clientX + scroll.scrollLeft) + 'px';
    selectionRectangle.style.top = (height > 0 ? startPoint.y : e.clientY + scroll.scrollTop) + 'px';
    const selectionRectBounds = selectionRectangle.getBoundingClientRect();
    const audioClips = document.querySelectorAll('.audio');

    audioClips.forEach(clip => {
        const clipBounds = clip.getBoundingClientRect();
        if (clipBounds.right > selectionRectBounds.left && 
            clipBounds.left < selectionRectBounds.right &&
            clipBounds.bottom > selectionRectBounds.top && 
            clipBounds.top < selectionRectBounds.bottom) {
            // This clip is within the selection rectangle.
            clip.classList.add('selected');
        } else {
            clip.classList.remove('selected');
        }
    });
});

// Listen for mouseup on the track for lasso
document.getElementById('tracks').addEventListener('mouseup', () => {
    if (!isSelecting) return;

    isSelecting = false;

    const selectionRectBounds = selectionRectangle.getBoundingClientRect();
    const audioClips = document.querySelectorAll('.audio');

    audioClips.forEach(clip => {
        const clipBounds = clip.getBoundingClientRect();
        if (clipBounds.right > selectionRectBounds.left && 
            clipBounds.left < selectionRectBounds.right &&
            clipBounds.bottom > selectionRectBounds.top && 
            clipBounds.top < selectionRectBounds.bottom) {
            // This clip is within the selection rectangle.
            clip.classList.add('selected');
        } else {
            clip.classList.remove('selected');
        }
    });

    selectionRectangle.style.display = 'none';
    // Reset the rectangle dimensions
    selectionRectangle.style.width = '0';
    selectionRectangle.style.height = '0';
});

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('loop-button')) {
        // Toggle loop state
        if (e.target.dataset.looping === "true") {
            e.target.dataset.looping = "false";
            e.target.classList.remove('looping');
        } else {
            document.querySelectorAll('.loop-button[data-looping="true"]').forEach(btn => {
                btn.setAttribute('data-looping', 'false');
                btn.classList.remove('looping');
            });
            e.target.dataset.looping = "true";
            e.target.classList.add('looping');
            
        }
    }
});

document.querySelector('#half-beat-toggle').addEventListener('click', function() {
    const allTracks = document.querySelectorAll('.track');
    const halfBeatsExist = document.querySelector('.half-beat-indicator'); // Check if half-beats already exist globally

    allTracks.forEach(track => {
        const beatIndicators = track.querySelectorAll('.beat-indicator'); // Assuming beat-indicators have class "beat-indicator"

        if (halfBeatsExist) {
            // If half-beats exist, remove them
            track.querySelectorAll('.half-beat-indicator').forEach(halfBeat => halfBeat.remove());
        } else {
            // Otherwise, create and insert half-beat indicators for each track
            beatIndicators.forEach(beat => {
                const position = parseFloat(getComputedStyle(beat).left);
                const halfBeat = document.createElement('div');
                halfBeat.className = 'half-beat-indicator';
                halfBeat.style.left = (position - (position / 2)) + "px"; // Place it halfway between current beat and previous beat
                track.insertBefore(halfBeat, beat);
            });
        }
    });
});

