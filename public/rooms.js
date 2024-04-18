// rooms.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth, signOut as firebaseSignOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDoc, updateDoc, arrayUnion, query, where, onSnapshot, doc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';



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
// Call subscribeToRooms when the user is authenticated
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in, update greeting and subscribe to rooms
        document.getElementById('user-greeting').textContent = `Hello, ${user.displayName || user.email}!`;
        updateRoomList();
    } else {
        // User is signed out, redirect to sign-in page
        window.location.href = 'index.html';
    }
});


document.getElementById('signOutButton').addEventListener('click', () => {
    // Sign out the user
    firebaseSignOut(auth).then(() => {
        // Sign-out successful.
        window.location.href = 'index.html'; // Redirect to the sign-in page
    }).catch((error) => {
        // An error happened during sign out.
        console.error('Sign out error:', error);
    });
});



// Function to create a new room
async function createRoom(roomName) {
    try {
      const roomRef = await addDoc(collection(db, "rooms"), {
        name: roomName,
        creator: auth.currentUser.uid,
        createdAt: new Date(),
        participants: [auth.currentUser.uid], // Start with the creator as the first participant
      });
  
      console.log("Room created with ID: ", roomRef.id);
      // Redirecting to the daw.html with the room ID as a query parameter
      window.location.href = `daw.html?roomId=${roomRef.id}`;
    } catch (e) {
      console.error("Error creating room: ", e);
    }
}



// Add event listener for room creation button click
// Assuming you have a button with id 'createRoomButton' and an input with id 'roomNameInput'
document.getElementById('createRoomButton').addEventListener('click', () => {
    const roomName = document.getElementById('roomNameInput').value;
    if (roomName) {
        createRoom(roomName).then(() => {
            console.log('Room "' + roomName + '" successfully created');
        }).catch((error) => {
            console.error('Error creating room:', error);
        });
    } else {
        console.error('Room name is empty');
    }
});

// Function to join an existing room
async function joinRoom(roomId) {
  // Query for the room with the given ID
  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);

  if (roomSnap.exists()) {
      // Check if user is already a participant
      const roomData = roomSnap.data();
      if (!roomData.participants.includes(auth.currentUser.uid)) {
          // Add the user as a participant
          await updateDoc(roomRef, {
              participants: arrayUnion(auth.currentUser.uid)
          });
          console.log(`Joined room with ID: ${roomId}`);
          // Redirecting to the daw.html with the room ID as a query parameter
          window.location.href = `daw.html?roomId=${roomId}`;
      } else {
          console.log('Already a participant in the room.');
          window.location.href = `daw.html?roomId=${roomId}`;
      }
  } else {
      // Handle the case where the room doesn't exist
      console.error('No room found with the provided ID.');
  }
}

// Event listener for join room button click
// Assuming you have a button with id 'joinRoomButton' and an input with id 'roomIdInput'
document.getElementById('joinRoomButton').addEventListener('click', () => {
  const roomIdToJoin = document.getElementById('roomIdInput').value;
  if (roomIdToJoin) {
      joinRoom(roomIdToJoin).then(() => {
          console.log('Attempted to join room');
      }).catch((error) => {
          console.error('Error joining room:', error);
      });
  } else {
      console.error('Room ID is empty');
  }
});

function updateRoomList() {
    const roomsTableBody = document.getElementById('roomsTable').getElementsByTagName('tbody')[0];
    roomsTableBody.innerHTML = ''; // Clear existing rows

    const roomsQuery = query(collection(db, "rooms"), where("participants", "array-contains", auth.currentUser.uid));
    onSnapshot(roomsQuery, (querySnapshot) => {
        querySnapshot.forEach((doc) => {
            const roomData = doc.data();
            const row = roomsTableBody.insertRow();
            const nameCell = row.insertCell(0);
            const actionCell = row.insertCell(1);

            nameCell.textContent = roomData.name;

            const joinButton = document.createElement('button');
            joinButton.textContent = 'Join';
            joinButton.onclick = () => window.location.href = `daw.html?roomId=${doc.id}`;
            actionCell.appendChild(joinButton);
        });
    }, (error) => {
        console.error(`Error fetching rooms: ${error}`);
    });
}