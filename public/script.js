// script.js

document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Element References ---
    const loadEl = document.getElementById('load');
    const authContainer = document.getElementById('auth-container');
    const chatContainer = document.getElementById('chat-container');
    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');

    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const loginButton = document.getElementById('login-button');
    const googleSigninButton = document.getElementById('google-signin-button');

    const signupNameInput = document.getElementById('signup-name');
    const signupEmailInput = document.getElementById('signup-email');
    const signupPasswordInput = document.getElementById('signup-password');
    const signupUsernameInput = document.getElementById('signup-username');
    const signupButton = document.getElementById('signup-button');
    const googleSignupButton = document.getElementById('google-signup-button');

    const authError = document.getElementById('auth-error');
    const authSuccess = document.getElementById('auth-success');

    const userDisplayName = document.getElementById('user-display-name');
    const logoutButton = document.getElementById('logout-button');

    const userSearchInput = document.getElementById('user-search-input');
    const searchResultsList = document.getElementById('search-results');
    const friendsList = document.getElementById('friends-list');

    const chatHeaderName = document.getElementById('chat-with-name');
    const messagesDiv = document.getElementById('messages');
    const messageInputContainer = document.getElementById('message-input-container');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatPlaceholder = document.getElementById('chat-placeholder');

    // --- State Variables ---
    let auth, database;
    let currentUser = null;
    let currentChatFriendId = null;
    let friendsListenerHandle = null;
    let friendsRef = null;
    let messageListenerHandle = null;
    let currentMessagesRef = null;
    let searchTimeout; // For debouncing search

    // --- Firebase Initialization ---
    const firebaseConfig = {
        apiKey: "AIzaSyDZ49oy4UBs0bK_n__oeNEKSC4sPHuif1k", // Replace with your actual API key if needed
        authDomain: "nerd-chat-5559a.firebaseapp.com",
        projectId: "nerd-chat-5559a",
        storageBucket: "nerd-chat-5559a.appspot.com", // Ensure this is correct
        messagingSenderId: "745073234777",
        appId: "1:745073234777:web:3e1a387c2281c04ac83248",
        measurementId: "G-MBBLDPBTC5", // Optional
         // databaseURL: "https://nerd-chat-5559a-default-rtdb.firebaseio.com" // Specify if needed
     };

     try {
        showLoadingMessage("Initializing NerdChat...");
         // Initialize Firebase
         if (!firebase.apps.length) {
             firebase.initializeApp(firebaseConfig);
             console.log("Firebase Initialized.");
         } else {
             firebase.app();
             console.log("Firebase App already exists.");
         }

         auth = firebase.auth();
         database = firebase.database();
         showLoadingMessage("Checking auth status...");

         // --- Auth State Change Listener ---
         auth.onAuthStateChanged(user => {
             clearAuthMessages();
             if (user) {
                 // User is signed in.
                 if (!currentUser) { // Only run full setup if state actually changed to logged in
                     console.log("User logged in:", user.uid);
                     currentUser = user;
                     authContainer.style.display = 'none';
                     chatContainer.style.display = 'flex';
                     hideLoadingMessage();

                     // Fetch user data (including username) and then setup UI
                     database.ref('users/' + user.uid).once('value').then(snapshot => {
                         if (snapshot.exists()) {
                             const userData = snapshot.val();
                             updateUserInfoDisplay(userData.displayName || user.email, userData.username, user.email);
                         } else {
                             // Fallback if profile doesn't exist yet (should be rare)
                             console.warn("User profile not found on login, setting up default.");
                             setupUserProfile(user).then(() => {
                                 updateUserInfoDisplay(user.displayName || user.email, null, user.email); // Show without username initially
                             });
                         }
                         loadUserData(user.uid); // Load friends/search after getting profile
                     }).catch(error => {
                         console.error("Error fetching user profile on login:", error);
                         updateUserInfoDisplay(user.displayName || user.email, null, user.email); // Show fallback
                         loadUserData(user.uid); // Still try to load other data
                     });
                 } else {
                     // User was already logged in, maybe profile updated?
                     currentUser = user; // Update currentUser just in case
                     // Re-fetch profile data in case display name or username changed
                     database.ref('users/' + user.uid).once('value').then(snapshot => {
                         if (snapshot.exists()) {
                             const userData = snapshot.val();
                             updateUserInfoDisplay(userData.displayName || user.email, userData.username, user.email);
                         } else {
                              updateUserInfoDisplay(user.displayName || user.email, null, user.email);
                         }
                     }).catch(error => {
                         console.error("Error fetching user profile on auth update:", error);
                         updateUserInfoDisplay(user.displayName || user.email, null, user.email);
                     });
                     console.log("Auth state change detected for already logged-in user.");
                 }

             } else {
                 // User is signed out.
                 if (currentUser) { // Only run full cleanup if state actually changed to logged out
                     console.log("User logged out.");
                     currentUser = null; // Set currentUser to null *before* clearing state
                     clearChatState(); // Clean up listeners and UI *first*
                     authContainer.style.display = 'flex';
                     chatContainer.style.display = 'none';
                     hideLoadingMessage();
                 } else {
                      // Already logged out, do nothing extra
                      hideLoadingMessage(); // Ensure loading message is hidden
                 }
             }
         });


     } catch (e) {
         console.error("Firebase initialization error:", e);
         showLoadingMessage('Error loading Firebase. Check console.', true); // Show persistent error
     }

    // --- Loading Message ---
    function showLoadingMessage(message, isError = false) {
        loadEl.textContent = message;
        loadEl.style.color = isError ? 'red' : 'rgba(0,0,0,0.4)';
        loadEl.style.display = 'block';
    }
    function hideLoadingMessage() {
        loadEl.style.display = 'none';
    }

    // --- Input Auto-Resize ---
     const autoExpandTextarea = (field) => {
         field.style.height = 'inherit'; // Reset height
         const computed = window.getComputedStyle(field);
         const height = parseInt(computed.getPropertyValue('border-top-width'), 10)
                      + parseInt(computed.getPropertyValue('padding-top'), 10)
                      + field.scrollHeight
                      + parseInt(computed.getPropertyValue('padding-bottom'), 10)
                      + parseInt(computed.getPropertyValue('border-bottom-width'), 10);
         field.style.height = `${Math.min(height, 100)}px`; // Apply height, capped at max-height

         sendButton.disabled = field.value.trim() === '';
     };
     if (messageInput) messageInput.addEventListener('input', () => autoExpandTextarea(messageInput));


    // --- Auth View Toggle & Messages ---
    function clearAuthMessages() {
        if(authError) authError.textContent = '';
        if(authSuccess) authSuccess.textContent = '';
    }
     function showAuthError(message) {
         clearAuthMessages();
         if(authError) authError.textContent = message;
     }
     function showAuthSuccess(message) {
         clearAuthMessages();
         if(authSuccess) authSuccess.textContent = message;
     }

    if(showSignupLink) showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginView.style.display = 'none';
        signupView.style.display = 'block';
        clearAuthMessages();
    });

    if(showLoginLink) showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        signupView.style.display = 'none';
        loginView.style.display = 'block';
         clearAuthMessages();
    });


    // --- Authentication Functions ---
    function handleAuthError(error, context = "Error") {
        console.error(context + ":", error);
         let message = "An unknown error occurred. Please try again.";
         if (error.code) {
             switch (error.code) {
                 case 'auth/invalid-email': message = "Please enter a valid email address."; break;
                 case 'auth/user-disabled': message = "This user account has been disabled."; break;
                 case 'auth/user-not-found':
                 case 'auth/wrong-password': message = "Invalid email or password."; break;
                 case 'auth/email-already-in-use': message = "This email address is already registered."; break;
                 case 'auth/weak-password': message = "Password is too weak. Please use at least 6 characters."; break;
                 case 'auth/operation-not-allowed': message = "Authentication method not enabled in Firebase."; break;
                 case 'auth/popup-closed-by-user': message = "Sign-in window closed before completion."; break;
                 case 'auth/cancelled-popup-request': message = "Multiple sign-in windows open. Please close others."; break;
                 default: message = error.message;
             }
         }
         showAuthError(message);
    }

    // Email/Password Signup
    if(signupButton) signupButton.addEventListener('click', () => {
        const name = signupNameInput.value.trim();
        const email = signupEmailInput.value.trim();
        const password = signupPasswordInput.value.trim();
        const username = signupUsernameInput.value.trim().toLowerCase();
        clearAuthMessages();

        if (!name || !email || !password || !username) { 
            showAuthError("Please fill in all fields."); 
            return; 
        }
        if (password.length < 6) { 
            showAuthError("Password should be at least 6 characters."); 
            return; 
        }
        if (username.length < 3) {
            showAuthError("Username should be at least 3 characters.");
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            showAuthError("Username can only contain letters, numbers, and underscores.");
            return;
        }

        showAuthSuccess("Creating account...");

        // Attempt to create user directly. DB rules will handle username conflicts.
        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const userId = userCredential.user.uid;
                
                // Update Auth profile with display name
                return userCredential.user.updateProfile({ displayName: name })
                    .then(() => {
                        // Create DB profile and reserve username
                        const updates = {};
                        updates[`users/${userId}`] = {
                            displayName: name,
                            displayName_lower: name.toLowerCase(),
                            username: username,
                            email: email,
                            createdAt: firebase.database.ServerValue.TIMESTAMP
                        };
                        updates[`usernames/${username}`] = userId;
                        
                        return database.ref().update(updates);
                    });
            })
            .then(() => {
                showAuthSuccess("Account created successfully!");
                setTimeout(clearAuthMessages, 2000);
            })
            .catch(error => {
                // Check if the error is due to the username being taken (permission denied on write)
                if (error.code === 'permission-denied' || error.message.includes('permission_denied') || error.message.includes('Username is already taken')) {
                     showAuthError("Username is already taken. Please choose another one.");
                } else {
                     handleAuthError(error, "Signup Error");
                }
            });
    });

    // Email/Password Login
    if(loginButton) loginButton.addEventListener('click', () => {
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value.trim();
        clearAuthMessages();

         if (!email || !password) { showAuthError("Please enter email and password."); return; }

        showAuthSuccess("Logging in..."); // Provide feedback

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                console.log("Login successful");
                // onAuthStateChanged handles the UI switch
            })
            .catch(err => handleAuthError(err, "Login Error"));
    });

    // Google Sign-in / Sign-up
     const signInWithGoogle = () => {
         const provider = new firebase.auth.GoogleAuthProvider();
         clearAuthMessages();
         showAuthSuccess("Opening Google Sign-in...");
         auth.signInWithPopup(provider)
            .then((result) => {
                console.log("Google Sign-in successful");
                const user = result.user;
                
                // Check if this is a new user
                return database.ref('users/' + user.uid).once('value')
                    .then(snapshot => {
                        if (!snapshot.exists()) {
                            // New user - show username creation modal
                            showUsernameCreationModal(user);
                        } else {
                            showAuthSuccess("Google Sign-in successful!");
                        }
                    });
            }).catch(err => handleAuthError(err, "Google Sign-in Error"));
     };
    if(googleSigninButton) googleSigninButton.addEventListener('click', signInWithGoogle);
    if(googleSignupButton) googleSignupButton.addEventListener('click', signInWithGoogle);

    // Username creation modal for Google sign-in
    function showUsernameCreationModal(user) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Choose a Username</h2>
                <p>Your username will be how other users find you in the directory.</p>
                <input type="text" id="google-username" placeholder="Username (letters, numbers, _)" required>
                <p id="google-username-error" style="color: var(--error-color); display: none;"></p>
                <button id="set-username-button" class="btn-primary">Continue</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const usernameInput = document.getElementById('google-username');
        const usernameError = document.getElementById('google-username-error');
        const setUsernameButton = document.getElementById('set-username-button');
        
        setUsernameButton.addEventListener('click', () => {
            const username = usernameInput.value.trim().toLowerCase();
            usernameError.style.display = 'none';
            
            if (username.length < 3) {
                usernameError.textContent = 'Username should be at least 3 characters';
                usernameError.style.display = 'block';
                return;
            }
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                usernameError.textContent = 'Username can only contain letters, numbers, and underscores';
                usernameError.style.display = 'block';
                return;
            }
            
            // Check if username is taken
            database.ref('usernames/' + username).once('value')
                .then(snapshot => {
                    if (snapshot.exists()) {
                        usernameError.textContent = 'Username is already taken';
                        usernameError.style.display = 'block';
                        return Promise.reject(new Error('Username taken'));
                    }
                    
                    const updates = {};
                    updates[`users/${user.uid}`] = {
                        displayName: user.displayName,
                        displayName_lower: user.displayName.toLowerCase(),
                        username: username,
                        email: user.email,
                        createdAt: firebase.database.ServerValue.TIMESTAMP
                    };
                    updates[`usernames/${username}`] = user.uid;
                    
                    return database.ref().update(updates);
                })
                .then(() => {
                    modal.remove();
                    showAuthSuccess("Account created successfully!");
                    // Explicitly update the UI after username is set
                    updateUserInfoDisplay(user.displayName, username, user.email);
                })
                .catch(error => {
                    if (error.message !== 'Username taken') {
                        console.error("Error creating account:", error);
                        usernameError.textContent = 'Error creating account. Please try again.';
                        usernameError.style.display = 'block';
                    }
                });
        });
    }

    // Update user info display in the sidebar
    function updateUserInfoDisplay(displayName, username, email) {
        if (!userDisplayName) return;

        const nameHtml = `Hey, ${escapeHtml(displayName)}`;
        const usernameHtml = username ? `<div class="user-username">@${escapeHtml(username)}</div>` : '';

        userDisplayName.innerHTML = `
            <div class="user-display-name">${nameHtml}</div>
            ${usernameHtml}
        `;
        userDisplayName.title = escapeHtml(email); // Set tooltip to email
    }

    // Logout
    if(logoutButton) logoutButton.addEventListener('click', () => {
        console.log("Attempting logout...");
        auth.signOut().catch(error => {
            console.error("Logout Error:", error);
             alert("Error logging out. Please try again.");
        });
    });


     // --- User Profile and Data Loading ---

     function setupUserProfile(user) {
        if (!user) return Promise.resolve();

        const userRef = database.ref('users/' + user.uid);
        return userRef.once('value').then((snapshot) => {
             const name = user.displayName || user.email.split('@')[0] || 'Anonymous';
             const email = user.email;
             const nameLower = name.toLowerCase();
             let updates = {};

             if (!snapshot.exists()) {
                 // Create profile
                 console.log("Creating user profile in DB for:", user.uid);
                 updates = {
                     displayName: name,
                     displayName_lower: nameLower,
                     email: email,
                     createdAt: firebase.database.ServerValue.TIMESTAMP
                 };
                 return userRef.set(updates);
             } else {
                 // Check for updates needed
                 const dbData = snapshot.val();
                 if (dbData.displayName !== name || dbData.displayName_lower !== nameLower) {
                     updates.displayName = name;
                     updates.displayName_lower = nameLower;
                 }
                  if (dbData.email !== email) {
                      updates.email = email;
                  }
                 if (Object.keys(updates).length > 0) {
                     console.log("Updating user profile in DB for:", user.uid, updates);
                     return userRef.update(updates);
                 }
                 return Promise.resolve(); // No update needed
             }
         }).catch(error => console.error("Error setting/updating user profile:", error));
     }


    function loadUserData(userId) {
         console.log("Loading user data for:", userId);
         loadFriends(userId);
         setupUserSearch(userId);
     }

    function clearChatState() {
         console.log("Clearing chat state...");
         // Clear UI
         if(userDisplayName) userDisplayName.textContent = 'Not logged in';
         if(userDisplayName) userDisplayName.title = '';
         if(friendsList) friendsList.innerHTML = '';
         if(searchResultsList) searchResultsList.innerHTML = '';
         if(messagesDiv) messagesDiv.innerHTML = '';
         if(chatPlaceholder) chatPlaceholder.style.display = 'flex';

         // Detach message listener first
         closeChat(true); // This handles message listener detachment & UI reset

         // Detach friends listener
         if (friendsRef && friendsListenerHandle) {
             friendsRef.off('value', friendsListenerHandle);
             console.log("Detached friends listener");
         }
         friendsRef = null;
         friendsListenerHandle = null;
         // currentUser is set to null in the onAuthStateChanged handler
     }


    // --- Friends List ---
    function loadFriends(userId) {
        if (!userId) return;
        
        // Detach previous listener first
        if (friendsRef && friendsListenerHandle) {
            friendsRef.off('value', friendsListenerHandle);
            console.log("Detached previous friends listener.");
        }

        friendsRef = database.ref('users/' + userId + '/friends');
        if(friendsList) {
            friendsList.innerHTML = '<li class="placeholder-message">Loading friends...</li>';
        }

        friendsListenerHandle = friendsRef.on('value', snapshot => {
            if (!friendsList) return; // Exit if element doesn't exist
            friendsList.innerHTML = ''; // Clear current list

            if (!snapshot.exists() || !snapshot.hasChildren()) {
                friendsList.innerHTML = '<li class="placeholder-message">Your friends list is empty.</li>';
                checkChatClosure(); // Check if current chat friend was removed
                return;
            }

            const friendPromises = [];
            snapshot.forEach(friendSnapshot => {
                const friendId = friendSnapshot.key;
                const promise = database.ref('users/' + friendId).once('value');
                friendPromises.push({id: friendId, promise: promise});
            });

            Promise.all(friendPromises.map(p => p.promise))
                .then(userSnaps => {
                    if (!friendsList) return; // Check again in case user logged out during async fetch
                    friendsList.innerHTML = ''; // Clear loading/previous render

                    let friendsFound = false;
                    userSnaps.forEach((userSnap, index) => {
                        const friendId = friendPromises[index].id;
                        if (userSnap.exists()) {
                            const friendData = userSnap.val();
                            renderFriendItem(friendId, friendData.displayName || friendData.email);
                            friendsFound = true;
                        } else {
                            console.warn("Friend data not found for ID:", friendId);
                            // Remove stale friend entry
                            removeFriend(userId, friendId);
                        }
                    });

                    if (!friendsFound && friendsList.innerHTML === '') {
                        friendsList.innerHTML = '<li class="placeholder-message">No valid friend profiles found.</li>';
                    }

                    checkChatClosure(); // Check if current chat friend was removed
                })
                .catch(error => {
                    console.error("Error fetching friend details:", error);
                    if(friendsList) {
                        friendsList.innerHTML = '<li class="placeholder-message" style="color: var(--error-color);">Error loading friends. Please try refreshing.</li>';
                    }
                });
        }, error => {
            console.error("Error loading friends list:", error);
            if(friendsList) {
                friendsList.innerHTML = '<li class="placeholder-message" style="color: var(--error-color);">Error loading friends. Please try refreshing.</li>';
            }
            if (friendsRef && friendsListenerHandle) {
                friendsRef.off('value', friendsListenerHandle); // Detach on error
            }
        });

        console.log("Attached friends listener for", userId);
    }
     // Helper to check if the open chat needs closing after friends list update
     function checkChatClosure() {
         if (currentChatFriendId && friendsList && !friendsList.querySelector(`li[data-friend-uid="${currentChatFriendId}"]`)) {
              console.log("Currently chatting friend is no longer in the list, closing chat.");
              closeChat(true); // Close fully and reset UI
          }
     }

     function renderFriendItem(friendId, friendName) {
         const li = document.createElement('li');
         li.dataset.friendUid = friendId;
         if (friendId === currentChatFriendId) li.classList.add('active');

         const nameSpan = document.createElement('span');
         nameSpan.textContent = escapeHtml(friendName);
         li.appendChild(nameSpan);

         const actionsDiv = document.createElement('div');
         actionsDiv.classList.add('friend-actions');

         const removeButton = document.createElement('button');
         removeButton.classList.add('remove-friend');
         removeButton.title = 'Remove Friend';
         removeButton.innerHTML = '<i class="fas fa-user-minus"></i>';
         removeButton.addEventListener('click', (e) => {
              e.stopPropagation();
              if (confirm(`Are you sure you want to remove ${friendName} as a friend?`)) {
                  if(currentUser) removeFriend(currentUser.uid, friendId);
              }
         });
         actionsDiv.appendChild(removeButton);
         li.appendChild(actionsDiv);

         li.addEventListener('click', () => {
              document.querySelectorAll('#friends-list li').forEach(item => item.classList.remove('active'));
              li.classList.add('active');
              openChat(friendId, friendName);
         });

         if(friendsList) friendsList.appendChild(li);
     }

    function addFriend(userId, friendId, friendName) {
         if (!userId || !friendId) return;
         if (userId === friendId) { alert("You cannot add yourself as a friend."); return; }

         console.log(`Attempting to add friend: ${userId} -> ${friendId}`);
         const updates = {};
         updates[`/users/${userId}/friends/${friendId}`] = true;
         updates[`/users/${friendId}/friends/${userId}`] = true;

         database.ref().update(updates)
             .then(() => {
                 console.log("Friend added successfully.");
                 if(searchResultsList) {
                    searchResultsList.innerHTML = `<li class="placeholder-message" style="color: var(--success-color);">Added ${escapeHtml(friendName)}!</li>`;
                     // Optionally clear input: userSearchInput.value = '';
                    setTimeout(() => { if(searchResultsList) searchResultsList.innerHTML = ''; }, 2500);
                 }
             })
             .catch(error => {
                 console.error("Error adding friend:", error);
                 if(searchResultsList) searchResultsList.innerHTML = `<li class="placeholder-message" style="color: var(--error-color);">Failed to add friend.</li>`;
             });
    }

     function removeFriend(userId, friendId) {
        if (!userId || !friendId) return;
         console.log(`Attempting to remove friend: ${userId} -> ${friendId}`);
         const updates = {};
         updates[`/users/${userId}/friends/${friendId}`] = null;
         updates[`/users/${friendId}/friends/${userId}`] = null;

         database.ref().update(updates)
             .then(() => {
                 console.log("Friend removed successfully.");
                  if (currentChatFriendId === friendId) {
                      closeChat(true); // Fully close chat if it was with the removed friend
                  }
                  // Friends list updates via its listener
             })
             .catch(error => {
                 console.error("Error removing friend:", error);
                 alert("Failed to remove friend. Please try again.");
             });
     }

    // --- User Search ---
     function setupUserSearch(currentUserId) {
        if (!userSearchInput) return;

        // Show initial results when search box is focused
        userSearchInput.addEventListener('focus', () => {
            if (userSearchInput.value.trim() === '') {
                searchUsers('', currentUserId);
            }
        });

        // Handle input changes with debouncing
        userSearchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const query = userSearchInput.value.trim().toLowerCase();

            if (query.length < 1) {
                searchUsers('', currentUserId);
                return;
            }

            if(searchResultsList) searchResultsList.innerHTML = '<li class="placeholder-message">Searching...</li>';

            searchTimeout = setTimeout(() => {
                searchUsers(query, currentUserId);
            }, 350);
        });
    }

    function searchUsers(query, currentUserId) {
        if (!searchResultsList) return;
        
        const usersRef = database.ref('users');
        let searchQuery = usersRef.orderByChild('username');

        if (query) {
            searchQuery = searchQuery.startAt(query).endAt(query + '\uf8ff');
        }

        searchQuery.limitToFirst(10).once('value')
            .then(snapshot => {
                if (!searchResultsList) return;
                searchResultsList.innerHTML = ''; // Clear previous results
                
                if (!snapshot.exists()) {
                    searchResultsList.innerHTML = '<li class="placeholder-message">No users found.</li>';
                    return;
                }

                const promises = [];
                let found = false;

                snapshot.forEach(userSnap => {
                    const userData = userSnap.val();
                    const userId = userSnap.key;

                    // Skip current user
                    if (userId === currentUserId) return;

                    const friendCheckPromise = database.ref(`users/${currentUserId}/friends/${userId}`).once('value')
                        .then(friendSnap => {
                            if (!friendSnap.exists()) {
                                renderSearchResultItem(userId, userData.username || userData.displayName || userData.email);
                                found = true;
                            }
                        });
                    promises.push(friendCheckPromise);
                });

                return Promise.all(promises).then(() => {
                    if (!found && searchResultsList.innerHTML === '') {
                        searchResultsList.innerHTML = query 
                            ? `<li class="placeholder-message">No new users found matching "${escapeHtml(query)}".</li>`
                            : '<li class="placeholder-message">Type to search for users.</li>';
                    } else if (!found && !query) {
                        searchResultsList.innerHTML = '<li class="placeholder-message">Type to search for users.</li>';
                    }
                });
            })
            .catch(error => {
                console.error("Error searching users:", error);
                if(searchResultsList) {
                    // Display error based on the actual error code if possible
                    if (error.code === 'PERMISSION_DENIED') {
                        searchResultsList.innerHTML = '<li class="placeholder-message" style="color: var(--error-color);">Search failed: Check database rules/indexes.</li>';
                    } else {
                        searchResultsList.innerHTML = '<li class="placeholder-message" style="color: var(--error-color);">Error searching users. Please try again.</li>';
                    }
                }
            });
    }

    function renderSearchResultItem(userId, userName) {
        if (!searchResultsList) return;
         const li = document.createElement('li');

         const nameSpan = document.createElement('span');
         nameSpan.textContent = escapeHtml(userName);
         li.appendChild(nameSpan);

         const actionsDiv = document.createElement('div');
         actionsDiv.classList.add('search-result-actions');

         const addButton = document.createElement('button');
         addButton.classList.add('add-friend');
         addButton.dataset.uid = userId;
         addButton.dataset.name = userName;
         addButton.title = 'Add Friend';
         addButton.innerHTML = '<i class="fas fa-user-plus"></i>';
         addButton.addEventListener('click', (e) => {
             if (currentUser) {
                const friendId = e.currentTarget.dataset.uid;
                const friendName = e.currentTarget.dataset.name;
                addFriend(currentUser.uid, friendId, friendName);
             }
         });
         actionsDiv.appendChild(addButton);
         li.appendChild(actionsDiv);

         searchResultsList.appendChild(li);
     }


    // --- Chat ID Generation ---
    function getChatId(uid1, uid2) {
        // Sort UIDs alphabetically to ensure consistency
        return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
    }

    // --- Chat Functionality ---
    function openChat(friendId, friendName) {
        if (currentChatFriendId === friendId || !currentUser) {
            console.log("Chat open condition not met:", currentChatFriendId, friendId, currentUser);
            return;
        }
        console.log(`Opening chat with: ${friendId} (${friendName})`);

        closeChat(false); // Close previous chat listeners without full UI reset

        currentChatFriendId = friendId;

        if(chatHeaderName) chatHeaderName.textContent = escapeHtml(friendName);
        if(messageInputContainer) messageInputContainer.style.display = 'flex';
        if(chatPlaceholder) chatPlaceholder.style.display = 'none';
        if(messagesDiv) messagesDiv.innerHTML = ''; // Clear messages
        if(messageInput) messageInput.value = '';
        if(sendButton) sendButton.disabled = true;
        if(messageInput) autoExpandTextarea(messageInput);

        // Use combined chat ID
        const chatId = getChatId(currentUser.uid, friendId);
        console.log(`Calculated Chat ID: ${chatId}`);
        currentMessagesRef = database.ref(`messages/${chatId}`).orderByChild('timestamp').limitToLast(50);

        messageListenerHandle = currentMessagesRef.on('child_added', snapshot => {
            if (snapshot.exists()) {
                const messageData = snapshot.val();
                if (currentChatFriendId === friendId) {
                    displayMessage(snapshot.key, messageData.senderId, messageData.text, messageData.senderName || null, messageData.timestamp);
                }
            }
        }, error => {
            console.error("Error loading messages:", error);
            if(messagesDiv) messagesDiv.innerHTML = '<p style="color: red; text-align: center;">Error loading messages.</p>';
            if (currentMessagesRef && messageListenerHandle) currentMessagesRef.off('child_added', messageListenerHandle);
        });
        console.log("Attached message listener for chat:", chatId);

        if(messageInput) messageInput.focus();
    }

     function closeChat(resetUI = true) {
         // Detach message listener
         if (currentMessagesRef && messageListenerHandle) {
             currentMessagesRef.off('child_added', messageListenerHandle);
             console.log("Detached message listener for", currentChatFriendId);
         }
         currentChatFriendId = null; // Crucial: set ID to null *before* potentially resetting UI
         messageListenerHandle = null;
         currentMessagesRef = null;

         if (resetUI) {
             if(chatHeaderName) chatHeaderName.textContent = 'Select a friend to chat';
             if(messagesDiv) messagesDiv.innerHTML = '';
             if(chatPlaceholder) chatPlaceholder.style.display = 'flex';
             if(messageInputContainer) messageInputContainer.style.display = 'none';
             if(messageInput) messageInput.value = '';
             if(sendButton) sendButton.disabled = true;

             document.querySelectorAll('#friends-list li').forEach(item => item.classList.remove('active'));
         }
     }


    function displayMessage(messageId, senderId, text, senderName, timestamp) {
         if (!messagesDiv || !currentUser) return; // Ensure elements & user exist

         // Prevent duplicates
         if (messagesDiv.querySelector(`[data-message-id="${messageId}"]`)) {
             console.log("Duplicate message render attempt blocked:", messageId);
             return;
         }

         const messageContainer = document.createElement('div');
         messageContainer.classList.add('message-container');
         messageContainer.dataset.messageId = messageId;

         const messageBubble = document.createElement('div');
         messageBubble.classList.add('message');

         const isSent = senderId === currentUser.uid;
         messageContainer.classList.add(isSent ? 'sent' : 'received');

         if (!isSent) {
             const nameDiv = document.createElement('div');
             nameDiv.classList.add('sender-name');
             nameDiv.textContent = escapeHtml(senderName || '...');
             messageBubble.appendChild(nameDiv);
         }

         const messageText = document.createElement('div');
         const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
         messageText.innerHTML = escapeHtml(text).replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
         messageBubble.appendChild(messageText);

         if (timestamp) {
             const time = new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
             const timestampDiv = document.createElement('span');
             timestampDiv.classList.add('timestamp');
             timestampDiv.textContent = time;
             messageBubble.appendChild(timestampDiv);
         }

         messageContainer.appendChild(messageBubble);

         const shouldScroll = messagesDiv.scrollHeight - messagesDiv.clientHeight <= messagesDiv.scrollTop + 50; // Check if near bottom (within 50px)

         messagesDiv.appendChild(messageContainer); // Append new message

         if (shouldScroll || isSent) { // Scroll if user was near bottom or sent the message
             messagesDiv.scrollTop = messagesDiv.scrollHeight;
         }
     }


    // Send Message
     const sendMessage = () => {
         if (!messageInput || !currentUser || !currentChatFriendId) return;
         const text = messageInput.value.trim();
         if (text === '') return;

         const chatId = getChatId(currentUser.uid, currentChatFriendId);
         const messagesRef = database.ref(`messages/${chatId}`);
         const newMessageRef = messagesRef.push();

         newMessageRef.set({
             senderId: currentUser.uid,
             senderName: currentUser.displayName || currentUser.email,
             text: text,
             timestamp: firebase.database.ServerValue.TIMESTAMP
         })
         .then(() => {
             console.log("Message sent.");
             messageInput.value = '';
             sendButton.disabled = true;
             autoExpandTextarea(messageInput);
             messageInput.focus();
         })
         .catch(error => {
             console.error("Error sending message:", error);
             alert("Failed to send message.");
         });
     };

    if(sendButton) sendButton.addEventListener('click', sendMessage);
    if(messageInput) messageInput.addEventListener('keypress', (e) => {
         if (e.key === 'Enter' && !e.shiftKey) {
             e.preventDefault();
             sendMessage();
         }
     });


    // --- Utility ---
     function escapeHtml(unsafe) {
         if (typeof unsafe !== 'string') return '';
         try {
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
         } catch (e) {
             console.error("Error escaping HTML:", e, unsafe);
             return ''; // Return empty string on error
         }
     }

    // Add username change functionality
    function changeUsername(newUsername) {
        if (!currentUser) return Promise.reject(new Error('Not logged in'));
        
        newUsername = newUsername.trim().toLowerCase();
        if (newUsername.length < 3) {
            return Promise.reject(new Error('Username should be at least 3 characters'));
        }
        if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
            return Promise.reject(new Error('Username can only contain letters, numbers, and underscores'));
        }

        const userId = currentUser.uid;
        const currentUsername = currentUser.username;

        // Check if new username is available
        return database.ref('usernames/' + newUsername).once('value')
            .then(snapshot => {
                if (snapshot.exists() && snapshot.val() !== userId) {
                    throw new Error('Username is already taken');
                }

                const updates = {};
                // Update username reference
                updates[`usernames/${newUsername}`] = userId;
                if (currentUsername) {
                    updates[`usernames/${currentUsername}`] = null; // Remove old username reference
                }
                // Update user profile
                updates[`users/${userId}/username`] = newUsername;
                
                return database.ref().update(updates);
            })
            .then(() => {
                console.log("Username updated successfully");
                return true;
            });
    }

    // Add username change UI
    function setupUsernameChange() {
        const usernameChangeContainer = document.createElement('div');
        usernameChangeContainer.className = 'username-change-container';
        usernameChangeContainer.innerHTML = `
            <input type="text" id="new-username" placeholder="New username">
            <button id="change-username-button">Change Username</button>
            <p id="username-change-message"></p>
        `;
        
        document.querySelector('.user-info').appendChild(usernameChangeContainer);
        
        const newUsernameInput = document.getElementById('new-username');
        const changeUsernameButton = document.getElementById('change-username-button');
        const usernameChangeMessage = document.getElementById('username-change-message');
        
        changeUsernameButton.addEventListener('click', () => {
            const newUsername = newUsernameInput.value.trim();
            usernameChangeMessage.textContent = '';
            
            changeUsername(newUsername)
                .then(() => {
                    usernameChangeMessage.textContent = 'Username changed successfully!';
                    usernameChangeMessage.style.color = 'var(--success-color)';
                    newUsernameInput.value = '';
                })
                .catch(error => {
                    usernameChangeMessage.textContent = error.message;
                    usernameChangeMessage.style.color = 'var(--error-color)';
                });
        });
    }
}); // End DOMContentLoaded