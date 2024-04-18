// Get the modal
var modal = document.getElementById('myModal');

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// Get the OK button that handles the redirect
var okButton = document.getElementById('okButton');

// When the user clicks on <span> (x), close the modal
span.onclick = function() {
  modal.style.display = "none";
}

// When the user clicks on OK, redirect to the rooms page
okButton.onclick = function() {
  modal.style.display = "none";
  window.location.href = 'rooms.html';
}

// When the room is deleted or no longer exists
export function showRoomDeletedPopup() {
  modal.style.display = "block";
}