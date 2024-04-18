import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth, signOut as firebaseSignOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { getFirestore, doc, where, getDoc, setDoc, onSnapshot, query, collection, arrayRemove, writeBatch, getDocs, deleteDoc, addDoc, updateDoc} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js';
import {showRoomDeletedPopup} from '/errormodal.js';
import { addTrack, loadAudio, waveSurferInstances } from './main.js';

const firebaseConfig = {
    apiKey: "AIzaSyC8N2DrZddIjadKk6iKJyAYDJfAvaMz8fc",
    authDomain: "together-70afc.firebaseapp.com",
    projectId: "together-70afc",
    storageBucket: "together-70afc.appspot.com",
    messagingSenderId: "903769378174",
    appId: "1:903769378174:web:f693fc7570746954feb72f",
    measurementId: "G-89JEF3BJ8S"
};

const app = initializeApp(firebaseConfig);

// Get the currently signed-in user's auth instance
const auth = getAuth(app);

// Firestore database initialization
const db = getFirestore(app);

//storage init
const storage = getStorage(app);

const queryParams = new URLSearchParams(window.location.search);

const roomId = queryParams.get('roomId');

// Object to store arrays of cursor positions for each user
let cursorTrails = {};

if (roomId) {
  // Code to load the room's data and display it
  document.getElementById('room-id').textContent = 'Room ID: ' + roomId;

  // Add event listener for the Copy Room ID button
  document.getElementById('copyRoomIdButton').addEventListener('click', () => {
      // Copy the room ID to the clipboard
      navigator.clipboard.writeText(roomId)
          .then(() => {
              console.log('Room ID copied to clipboard');
              // You can also show a message to the user indicating that the ID has been copied.
          })
          .catch(err => {
              console.error('Error in copying text: ', err);
          });
  });
} else {
  // Handle the case where no roomId is present in the URL
  console.error('No room ID provided in the URL');
}

function updateParticipantsUI(participantIds) {
  const userProfileContainer = document.getElementById('room-participants');
  userProfileContainer.innerHTML = ''; // Clear the container before adding new profile images

  // Fetch and display each participant's profile image
  participantIds.forEach((participantId) => {
    const userRef = doc(db, "users", participantId);
    getDoc(userRef).then((userDoc) => {
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Create an image element for the user's profile picture
        const img = document.createElement('img');
        img.src = userData.photoURL; // Assume you store the URL of the profile picture in the user document
        img.alt = userData.displayName || 'User profile';
        img.className = 'profile-picture'; // Add a class for styling purposes
        userProfileContainer.appendChild(img); // Append the image to the container
      } else {
        console.error('User document does not exist with id:', participantId);
      }
    }).catch((error) => {
      console.error('Error fetching user data:', error);
    });
  });
}



function loadRoomData(roomId) {
  const roomRef = doc(db, "rooms", roomId);
  // Listen for real-time updates to the room document with onSnapshot
  onSnapshot(roomRef, async (roomDoc) => {
    if (roomDoc.exists()) {
      const roomData = roomDoc.data();
      updateParticipantsUI(roomData.participants); // Update UI for room participants
      //loadRoomTracks(roomId);
    } else {
      console.error('Room does not exist with id:', roomId);
      showRoomDeletedPopup();
    }
  }, (error) => {
    console.error('Error listening to room data:', error);
    window.location.href = 'rooms.html'; // Redirect to the rooms page
  });
}


async function removeUserFromRooms(userId) {
  // Query all rooms the user is a participant in
  const roomsQuery = query(collection(db, "rooms"), where("participants", "array-contains", userId));
  const querySnapshot = await getDocs(roomsQuery);
  // Create a batch to perform all updates together
  const batch = writeBatch(db);

  querySnapshot.forEach((doc) => {
    if (doc.data().creator === userId) {
      // Schedule the room for deletion if the user is the creator
      try {
        deleteAllTracksInRoom(roomId);
        console.log('User tracks removed.');
      } catch (error) {
        console.error('Error removing user track:', error);
      }
      batch.delete(doc.ref);
    }
  });
  // Commit the batch operation
  await batch.commit();
}



document.getElementById('signOutButton').addEventListener('click', async () => {
  const userId = auth.currentUser.uid;
  try {
    await cleanUpOnSignOut(userId);
    console.log('User cursor removed.');
  } catch (error) {
    console.error('Error removing user cursor:', error);
  }
  // Remove user from any rooms and potentially delete room before signing out
  try {
    await removeUserFromRooms(userId);
    console.log('User removed from all rooms.');
  } catch (error) {
    console.error('Error removing user from rooms:', error);
  }
  // Sign out the user after updating room data
  firebaseSignOut(auth).then(() => {
    console.log('User signed out.');
    window.location.href = 'index.html'; // Redirect to sign-in page
  }).catch((error) => {
    console.error('Sign out error:', error);
  });
});


//cursor handling
function broadcastCursorPosition(x, y) {
  if (auth.currentUser && roomId) { // Make sure roomId is in scope
    const cursorRef = doc(db, "cursors", auth.currentUser.uid);
    setDoc(cursorRef, {
      x,
      y,
      roomId: roomId, // Add roomId to cursor data
      userId: auth.currentUser.uid,
      displayName: auth.currentUser.displayName,
      photoURL: auth.currentUser.photoURL // If you want to show their profile picture with the cursor
    }, { merge: true });
  }
}

let lastTime = 0;
const updateInterval = 50; // Time in milliseconds

document.addEventListener('mousemove', (event) => {
  const currentTime = Date.now();
  if (currentTime - lastTime > updateInterval) {
    broadcastCursorPosition(event.pageX, event.pageY);
    lastTime = currentTime;
  }
});

// Object to store cached user data
const userDataCache = {};

// Function to get user data with caching
async function getUserDataWithCaching(userId) {
  if (!userDataCache[userId]) {
    // User data not in cache, fetch from Firestore
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      userDataCache[userId] = userDoc.data(); // Cache it for future use
    } else {
      console.error('User document does not exist with id:', userId);
      // Handle the user not found error
    }
  }
  return userDataCache[userId]; // Return cached data
}

// Update function with debouncing
let debounceTimer;
function debounceCursorUpdates() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // Update DOM or process cursor positions here after waiting for updates to settle
  }, 50); // Adjust debounce time as needed
}

// Modified startListeningForCursorUpdates function
function startListeningForCursorUpdates(roomId) {
  const cursorsQuery = query(collection(db, "cursors"), where("roomId", "==", roomId));
  onSnapshot(cursorsQuery, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => { // Make sure to handle async correctly
      const cursorData = change.doc.data();
      if (cursorData.userId === auth.currentUser.uid) return; // Skip the current user's cursor
      if (change.type === "added" || change.type === "modified") {
        const userData = await getUserDataWithCaching(cursorData.userId); // Use caching function
        if (userData) {
          moveCursor(cursorData.userId, cursorData.x, cursorData.y, userData.displayName, userData.photoURL);
          updateCursorTrail(cursorData.userId, cursorData.x, cursorData.y);
        }
        debounceCursorUpdates(); // Call debounced updates
      }
      if (change.type === "removed") {
        removeCursor(cursorData.userId);
        delete cursorTrails[cursorData.userId];
      }
    });
  });
}

// Move cursor to new position
function moveCursor(userId, x, y, displayName, photoURL) {
  let cursorImg = document.getElementById('cursor-' + userId);
  if (!cursorImg) {
    cursorImg = document.createElement('img');
    cursorImg.src = '/defaultcursor.png';
    cursorImg.id = 'cursor-' + userId;
    cursorImg.className = 'other-user-cursor';
    document.body.appendChild(cursorImg);
  }
  cursorImg.style.left = x + 'px';
  cursorImg.style.top = y + 'px';
  // Optional: Set the title attribute to the user's display name for a tooltip
  cursorImg.title = displayName;
}


// Call startListeningForCursorUpdates when the user is authenticated and roomId is available
onAuthStateChanged(auth, (user) => {
  if (user && roomId) {
    loadRoomData(roomId);
    startListeningForCursorUpdates(roomId);
    updateRoomTracks(roomId);
  } else {
    // Handle sign out or no room
    cleanUpOnSignOut(user.uid).catch(console.error);
  }
});



// Call this function on sign out to remove the user's cursor
async function cleanUpOnSignOut(userId) {
  // Remove the user's cursor when they sign out
  const cursorRef = doc(db, "cursors", userId);
  await deleteDoc(cursorRef);
  
  // Additional logic for room cleanup if the user is the creator can be handled here
  // ...
}

function removeCursor(userId) {
  const cursorImg = document.getElementById('cursor-' + userId);
  if (cursorImg) {
    cursorImg.parentNode.removeChild(cursorImg);
  }
}

// Additional canvas setup and cursor tracking code

const trailCanvas = document.getElementById('trailCanvas');
const trailCtx = trailCanvas.getContext('2d');

// Set canvas size to window's size
trailCanvas.width = window.innerWidth;
trailCanvas.height = window.innerHeight;



function drawCursorTrails() {
  trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height); // Clear the canvas for redrawing

  Object.keys(cursorTrails).forEach(userId => {
    const trails = cursorTrails[userId] || [];
    for (let i = trails.length - 1; i > 0; i--) {
      // Draw from trails[i] to trails[i - 1]
      const opacity = 1 - (trails.length - i) / trails.length; // Newer points are more opaque
      trailCtx.beginPath();
      trailCtx.moveTo(trails[i].x, trails[i].y);
      trailCtx.lineTo(trails[i - 1].x, trails[i - 1].y);
      trailCtx.strokeStyle = `rgba(235,125,70, ${opacity})`; // Replace with user's color
      trailCtx.lineWidth = 2; // Adjust line width if necessary
      trailCtx.stroke();
    }

    // Remove points that are too old
    const now = Date.now();
    cursorTrails[userId] = trails.filter(point => now - point.time < 1000); // Adjust time as needed
  });

  requestAnimationFrame(drawCursorTrails); // Request next frame for animation
}

// Start the drawing loop
requestAnimationFrame(drawCursorTrails);

// When receiving a cursor position update
function updateCursorTrail(userId, x, y) {
  // Add the new position with a timestamp
  if (!cursorTrails[userId]) cursorTrails[userId] = [];
  cursorTrails[userId].push({ x, y, time: Date.now() });
}

//tracks logic

document.getElementById('addTrackBtn').addEventListener('click', (event) => {
  const newTrackData = {
    name: "Track 1",
    muted: false,
    effects: [],
    color: "#9400d3",
    createdAt: new Date(),
    creator: auth.currentUser.uid,
    trackRoomId: roomId
  };
  addNewTrack(roomId, newTrackData);
});


function updateRoomTracks(roomId) {
  const tracksRef = collection(db, `rooms/${roomId}/tracks`);

  // Listen for real-time updates to the tracks within this room
  onSnapshot(tracksRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const newTrackData = { id: change.doc.id, ...change.doc.data() };
        addTrack(newTrackData); // Call addTrack with the new data
        updateAudioClipsForTrack(roomId, newTrackData.id);
      } else if (change.type === "modified") {
        // A track was modified
        const modifiedTrackData = { id: change.doc.id, ...change.doc.data() };
        // Call a function to update this track in the UI
        //updateTrack(modifiedTrackData); // Implement this function based on your application logic
      } else if (change.type === "removed") {
        // A track was removed
        const removedTrackId = change.doc.id;
        // Call a function to remove this track from the UI
        //removeTrack(removedTrackId); // Implement this function based on your application logic
      }
    });
  });
}

function loadRoomTracks(roomId) {
  return new Promise((resolve, reject) => {
    const tracksRef = collection(db, `rooms/${roomId}/tracks`);

    getDocs(tracksRef).then((querySnapshot) => {
      if (querySnapshot) {
        querySnapshot.forEach((doc) => {
          const trackData = { id: doc.id, ...doc.data() };
          addTrack(trackData); // Now addTrack will check for duplicates before adding
        });
        resolve(); // Resolve the promise after all tracks are processed
      } else {
        reject("No tracks found"); // Reject the promise if no data is returned
      }
    }).catch((error) => {
      console.error("Error loading tracks:", error);
      reject(error); // Reject the promise if there's an error
    });
  });
}

// Function to add a new track to Firestore
function addNewTrack(roomId, trackData) {
  const tracksRef = collection(db, `rooms/${roomId}/tracks`);
  addDoc(tracksRef, trackData)
    .then((docRef) => {
      console.log(`Track added with ID: ${docRef.id}`);
    })
    .catch((error) => {
      console.error(`Error adding track: ${error}`);
    });
}

async function deleteAllTracksInRoom(roomId) {
  // Reference to the collection of tracks in the room
  const tracksQuery = query(collection(db, "rooms", roomId, "tracks"));

  // Get all track documents in the room
  const querySnapshot = await getDocs(tracksQuery);

  // Create a batch to perform all deletions together
  const batch = writeBatch(db);
  
  // Add each track document to the batch for deletion
  querySnapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });

  // Commit the batch operation to delete all tracks
  try {
    await batch.commit();
    console.log('All tracks in room deleted successfully.');
  } catch (error) {
    console.error('Error deleting tracks in room:', error);
  }
}

export async function updateTrackColor(roomId, trackId, color) {
  // Reference to the track document
  const trackRef = doc(db, "rooms", roomId, "tracks", trackId);

  // Begin a batch write operation
  const batch = writeBatch(db);

  try {
    // Update the track's color
    batch.update(trackRef, { color: color });

    // Reference to the audio clips within the track
    const audioClipsRef = collection(trackRef, "audioClips");
    const querySnapshot = await getDocs(audioClipsRef);

    // Update each audio clip document with the new color
    querySnapshot.forEach((docSnapshot) => {
      batch.update(docSnapshot.ref, { color: color });
    });

    // Commit the batch operation
    await batch.commit();

    console.log(`Track color updated to ${color} for track ID ${trackId} in room ${roomId}`);
  } catch (error) {
    console.error(`Error updating track color and associated audio clips: ${error}`);
    throw error; // Re-throw the error for further handling
  }
}



//audio clips logic
function updateAudioClipsForTrack(roomId, trackId) {
  const audioClipsRef = collection(db, `rooms/${roomId}/tracks/${trackId}/audioClips`);
  let lastTime = 0;
  const updateInterval = 50; // Time in milliseconds
  onSnapshot(audioClipsRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
          const clipData = { id: change.doc.id, ...change.doc.data() };
          if (change.type === "added") {
                addAudioClipToUI(clipData, trackId);
              } else if (change.type === "modified") {
                
                const currentTime = Date.now();
                if (currentTime - lastTime > updateInterval) {
                  updateAudioClipInUI(clipData);
                  lastTime = currentTime;
                }
              } else if (change.type === "removed") {
                  removeAudioClipFromUI(clipData.id);
              }
          });
      }, (error) => {
          console.error(`Error listening to audio clip updates: ${error}`);
      });
}

// Function to remove an audio clip from the UI
function removeAudioClipFromUI(clipId) {
  const audioClipElement = document.querySelector(`[firebase-id="${clipId}"]`);
  if (audioClipElement) {
      removeAudioClip(audioClipElement);
  }
}

// Function to remove audio clip from UI and WaveSurfer
function removeAudioClip(clip) {
  const wavesurfer = waveSurferInstances.get(clip);
  if (wavesurfer) {
      wavesurfer.destroy();
      waveSurferInstances.delete(clip);
  }
  clip.remove();
}

// Function to delete an audio clip from Firestore
export async function deleteAudioClipFromDb(clipId, trackId) {
  try {
      // Assuming clipId is structured as 'roomId-trackId-clipId'
      //const [roomId, trackId, actualClipId] = clipId.split('-');
      const clipRef = doc(db, `rooms/${roomId}/tracks/${trackId}/audioClips`, clipId);
      await deleteDoc(clipRef);
      console.log(`Deleted clip with ID: ${clipId}`);
  } catch (error) {
      console.error(`Error deleting audio clip: ${error}`);
  }
}

async function addAudioClipToUI(clipData) {
  // Find the track element in the DOM using clipData.trackId and the 'id' attribute
  const trackElement = document.getElementById(`track-${clipData.trackId}`);
  if (!trackElement) {
      console.error(`Track not found for trackId: ${clipData.trackId}`);
      return;
  }
  if(!document.querySelector(`[firebase-id="${clipData.id}"]`)){
    // Call loadAudio with clipData
    await loadAudio(null, trackElement, null, clipData);
    console.log("Added audio clip with name " + clipData.name + " to DOM");
  }
  updateAudioClipInUI(clipData);
  
}

function updateAudioClipInUI(clipData) {
  // Find the audio clip element in the DOM
  const audioClipElement = document.querySelector(`[firebase-id="${clipData.id}"]`);
  const audioLabel = audioClipElement.querySelector('.audio-label');
  if (!audioClipElement) {
    console.error(`Audio clip not found in UI for id: ${clipData.id}`);
    return;
  }

  // Skip updating the region if the current user is the one who last modified the clip
  if (clipData.lastModifiedBy === auth.currentUser.uid) {
    return;
  }
  
  // Get the WaveSurfer instance and the correct region
  const wavesurfer = waveSurferInstances.get(audioClipElement);
  let region;
  Object.keys(wavesurfer.regions.list).forEach((id) => {
    region = wavesurfer.regions.list[id]; // Assuming you have regionId in clipData
  });
  if (region) {
    // Update region start position
    region.update({ start: clipData.regionstart });

    // Update overlay width if necessary
    const pixelDurationRatio = parseFloat(clipData.width) / clipData.duration;
    const startPixels = clipData.regionstart * pixelDurationRatio;
    let overlay = audioClipElement.querySelector('.audio-overlay');
    if (overlay) {
      overlay.style.width = `${startPixels}px`;
      audioLabel.style.left = overlay.style.width;

    }
  } else {
    console.error(`Region not found for audio clip id: ${clipData.id}`);
  }

  // Update audio clip position
  if (clipData.leftPosition !== undefined) {
    audioClipElement.style.left = `${clipData.leftPosition}px`;
  }
}


export async function uploadAudio(roomId, trackId, file) {
  try {
    const uniqueFileName = `${Date.now()}-${file.name}`;
    const fileRef = ref(storage, `audio/${roomId}/${trackId}/${uniqueFileName}`);
    const audioUrl = URL.createObjectURL(file);
    const audioElement = new Audio(audioUrl);

    // Function to resolve with the audio duration
    const getAudioDuration = () => new Promise((resolve, reject) => {
      audioElement.addEventListener('loadedmetadata', () => {
        resolve(audioElement.duration);
      });
      audioElement.addEventListener('error', () => {
        reject('Error loading audio file.');
      });
    });

    // Get the duration of the audio file
    const duration = await getAudioDuration();

    // Proceed with file upload
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    // Fetch the track document to get the color
    const trackRef = doc(db, `rooms/${roomId}/tracks/${trackId}`);
    const trackSnapshot = await getDoc(trackRef);
    let trackColor = trackSnapshot.data().color;

    // Add the audio clip data with duration
    await addDoc(collection(db, `rooms/${roomId}/tracks/${trackId}/audioClips`), {
      url: url,
      name: file.name,
      trackId: trackId,
      color: trackColor,
      regionstart: 0,
      regionend: duration,
      duration: duration,
      leftPosition: 0,
      width: null,
      // Other metadata
    });

    console.log(`Uploaded file and created document for ${uniqueFileName}`);
  } catch (error) {
    console.error(`Error uploading audio: ${error}`);
    throw error;
  }
}

export async function updateClipPosition(trackId, clipId, newPosition) {
  const clipRef = doc(db, `rooms/${roomId}/tracks/${trackId}/audioClips/${clipId}`);
  try {
    await updateDoc(clipRef, { leftPosition: newPosition });
    console.log(`Updated position for clip: ${clipId}`);
  } catch (error) {
    console.error(`Error updating clip position: ${error}`);
  }
}

export async function updateClipRegions(trackId, clipId, regstart, regend, width) {
  const currentUserId = auth.currentUser.uid; // Get the current user's ID
  const clipRef = doc(db, `rooms/${roomId}/tracks/${trackId}/audioClips/${clipId}`);

  try {
    await updateDoc(clipRef, { regionstart: regstart, regionend: regend, width: width});
    if (clipRef.lastmod !== currentUserId) {
      await updateDoc(clipRef, {lastmod: currentUserId});
      return;
    }
    console.log(`Updated regions for clip: ${clipId}`);
  } catch (error) {
    console.error(`Error updating clip regions: ${error}`);
  }
}

export async function duplicateAudioClipInDatabase(ogclipData) {
  const trackRef = doc(db, `rooms/${roomId}/tracks/${ogclipData.trackId}`);
  const newClipData = {
    url: ogclipData.url,
    leftPosition: ogclipData.leftPosition,
    name: ogclipData.fileName,
    volume: ogclipData.volume,
    trackId: ogclipData.trackId,
    color: ogclipData.color,
    width: ogclipData.width,
    regionstart: ogclipData.regionstart,
    regionend: ogclipData.regionend,
    duration: ogclipData.duration,
    // Add other metadata as necessary
  };

  const newClipDocRef = await addDoc(collection(trackRef, 'audioClips'), newClipData);
  return newClipDocRef.id;
}