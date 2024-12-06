// auth.js

// Use window.auth and window.db defined in firebaseConfig.js
const auth = window.auth;
const db = window.db;

// Register User
window.registerUser = async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    displayErrorMessageAuth("Please enter both email and password.");
    return;
  }

  try {
    await auth.createUserWithEmailAndPassword(email, password);
    alert("User registered successfully!");
  } catch (error) {
    console.error("Registration Error:", error);
    displayErrorMessageAuth("Registration failed: " + error.message);
  }
};

// Login User
window.loginUser = async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    displayErrorMessageAuth("Please enter both email and password.");
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
    alert("Logged in successfully!");
  } catch (error) {
    console.error("Login Error:", error);
    displayErrorMessageAuth("Login failed: " + error.message);
  }
};

// Logout User
window.logoutUser = async () => {
  try {
    await auth.signOut();
    alert("You have been logged out.");
  } catch (error) {
    console.error("Logout Error:", error);
    displayErrorMessageAuth("Logout failed: " + error.message);
  }
};

// Monitor Authentication State
auth.onAuthStateChanged((user) => {
  window.currentUser = user; 
  if (user) {
    loadUserApartments(user.uid);
  } else {
    clearRatingsTable();
  }
});

// Load User Apartments
window.loadUserApartments = async (uid) => {
  const ratingsTableBody = document.querySelector('#ratingsTable tbody');
  if (!ratingsTableBody) return;

  ratingsTableBody.innerHTML = '';
  showLoadingSpinner();

  try {
    const userApartmentsRef = db.collection('users').doc(uid).collection('apartments');
    const querySnapshot = await userApartmentsRef.get();

    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const tr = document.createElement('tr');
      tr.setAttribute('data-place-id', docSnap.id);

      // Apartment Name
      const nameTd = document.createElement('td');
      nameTd.textContent = data.name;
      tr.appendChild(nameTd);

      // Luxury
      tr.appendChild(createEditableTd(docSnap.id, 'luxury', data.luxury));

      // Amenities
      tr.appendChild(createEditableTd(docSnap.id, 'amenities', data.amenities));

      // Distance Miles
      tr.appendChild(createEditableTd(docSnap.id, 'distanceMiles', data.distanceMiles));

      // Price
      tr.appendChild(createEditableTd(docSnap.id, 'price', data.price));

      // Sq Ft
      tr.appendChild(createEditableTd(docSnap.id, 'sq_ft', data.sq_ft));

      // Price per Sq Ft (Computed)
      const pricePerSqFtTd = document.createElement('td');
      pricePerSqFtTd.textContent = data.price_per_sq_ft > 0 ? data.price_per_sq_ft.toFixed(2) : 'N/A';
      pricePerSqFtTd.setAttribute('data-field', 'price_per_sq_ft');
      tr.appendChild(pricePerSqFtTd);

      // Final Rating (Computed)
      const finalRatingTd = document.createElement('td');
      finalRatingTd.textContent = data.finalRating > 0 ? data.finalRating.toFixed(2) : 'N/A';
      finalRatingTd.setAttribute('data-field', 'finalRating');
      tr.appendChild(finalRatingTd);

      ratingsTableBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error loading apartments:", error);
    displayErrorMessage("Failed to load apartments.");
  } finally {
    hideLoadingSpinner();
  }
};

// Create Editable Table Cell
function createEditableTd(placeId, fieldName, value) {
  const td = document.createElement('td');
  const input = document.createElement('input');
  input.type = 'number';
  input.value = value ?? 0;
  input.min = 0; 
  input.step = 'any'; 
  input.addEventListener('input', debounce(() => {
    const newValue = parseFloat(input.value);
    if (isNaN(newValue) || newValue < 0) {
      alert("Please enter a valid non-negative number.");
      input.value = value ?? 0;
      return;
    }
    updateApartmentField(placeId, fieldName, newValue);
  }, 500));
  td.appendChild(input);
  return td;
}

// Update Apartment Field
window.updateApartmentField = async (placeId, field, value) => {
  if (!window.currentUser) return;

  showLoadingSpinner();

  try {
    const aptRef = db.collection('users').doc(window.currentUser.uid).collection('apartments').doc(placeId);
    const aptSnap = await aptRef.get();
    if (!aptSnap.exists) {
      console.error("Apartment does not exist:", placeId);
      displayErrorMessage("Apartment does not exist.");
      return;
    }

    const aptData = aptSnap.data();
    aptData[field] = parseFloat(value) || 0;

    // Recalculate Final Rating and Price per Sq Ft
    const luxury = parseFloat(aptData.luxury) || 0;
    const amenities = parseFloat(aptData.amenities) || 0;
    const price = parseFloat(aptData.price) || 0;
    const sq_ft = parseFloat(aptData.sq_ft) || 0;

    aptData.finalRating = (luxury + amenities) / 2;
    aptData.price_per_sq_ft = (sq_ft > 0) ? (price / sq_ft) : 0;

    await aptRef.set(aptData, { merge: true });

    updateApartmentRow(placeId, aptData);
  } catch (error) {
    console.error("Error updating apartment field:", error);
    displayErrorMessage("Failed to update field.");
  } finally {
    hideLoadingSpinner();
  }
};

// Update Table Row with New Data
function updateApartmentRow(placeId, aptData) {
  const row = document.querySelector(`tr[data-place-id="${placeId}"]`);
  if (!row) return;

  const finalRatingTd = row.querySelector('[data-field="finalRating"]');
  if (finalRatingTd) {
    finalRatingTd.textContent = aptData.finalRating > 0 ? aptData.finalRating.toFixed(2) : 'N/A';
  }

  const pricePerSqFtTd = row.querySelector('[data-field="price_per_sq_ft"]');
  if (pricePerSqFtTd) {
    pricePerSqFtTd.textContent = aptData.price_per_sq_ft > 0 ? aptData.price_per_sq_ft.toFixed(2) : 'N/A';
  }
}

// Clear Ratings Table
function clearRatingsTable() {
  const ratingsTableBody = document.querySelector('#ratingsTable tbody');
  if (ratingsTableBody) {
    ratingsTableBody.innerHTML = '';
  }
}

// Display Error Message in Authentication Page
function displayErrorMessageAuth(message) {
  let errorDiv = document.getElementById('error-message-auth');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'error-message-auth';
    errorDiv.className = 'error-message';
    document.querySelector('.section-container').prepend(errorDiv);
  }
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
}

// Display Error Message in Ratings Page
function displayErrorMessage(message) {
  let errorDiv = document.getElementById('error-message');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'error-message';
    errorDiv.className = 'error-message';
    document.querySelector('.section-container').prepend(errorDiv);
  }
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
}

// Debounce Function
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// Loading Spinner Controls
function showLoadingSpinner() {
  const spinner = document.getElementById('loadingSpinnerGlobal');
  if (spinner) {
    spinner.style.display = 'block';
  }
}

function hideLoadingSpinner() {
  const spinner = document.getElementById('loadingSpinnerGlobal');
  if (spinner) {
    spinner.style.display = 'none';
  }
}

window.displayErrorMessage = displayErrorMessage;
window.displayErrorMessageAuth = displayErrorMessageAuth;
window.showLoadingSpinner = showLoadingSpinner;
window.hideLoadingSpinner = hideLoadingSpinner;
