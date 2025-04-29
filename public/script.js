// script.js - NerdChat V2 Revamp

document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Element References --- Updated for V2
    const loadEl = document.getElementById('load');
    const appContainer = document.getElementById('app-container'); // Main app view
    const authContainer = document.getElementById('auth-container'); // Auth screen

    // Auth Screen Elements
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

    // App Container Elements
    const chatListPanel = document.getElementById('chat-list-panel');
    const mainChatArea = document.getElementById('main-chat-area');

    // Chat List Panel Elements
    const userProfileArea = document.getElementById('user-profile-area');
    const userDisplayNameSpan = document.getElementById('user-display-name'); // Span within profile area
    const newChatButton = document.getElementById('new-chat-button');
    const logoutButton = document.getElementById('logout-button');
    const chatListEl = document.getElementById('chat-list'); // Renamed from friendsList

    // Main Chat Area Elements
    const chatHeaderName = document.getElementById('chat-with-name');
    const messagesDiv = document.getElementById('messages');
    const messageInputContainer = document.getElementById('message-input-container');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatPlaceholder = document.getElementById('chat-placeholder');

    // New Chat Modal Elements
    const newChatModal = document.getElementById('new-chat-modal');
    const closeModalButton = document.getElementById('close-modal-button');
    const userSearchInput = document.getElementById('user-search-input'); // Now inside modal
    const searchResultsList = document.getElementById('search-results'); // Now inside modal

    // --- State Variables --- // Renamed some for clarity
    let auth, database;
    let currentUser = null;
    let currentChatFriendId = null;
    let chatListListenerHandle = null; // Renamed from friendsListenerHandle
    let chatListRef = null; // Renamed from friendsRef
    let messageListenerHandle = null;
    let currentMessagesRef = null;
    let searchTimeout; // For debouncing search

    // --- Mobile Menu Toggle --- V2
    const menuToggleButton = document.getElementById('menu-toggle-button');
    const bodyEl = document.body;

    const backButton = document.getElementById('back-button');
    // Remove or comment out backButton listener as it's not used in overlay model
    /*
    if (backButton && bodyEl) {
        backButton.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log("Back button clicked, returning to chat list.");
            bodyEl.classList.remove('chat-view');
        });
    }
    */

    function closePanel() {
        if (chatListPanel && bodyEl) {
            chatListPanel.classList.remove('open');
            bodyEl.classList.remove('panel-open');
            console.log("Panel closed.");
        }
    }

    if (menuToggleButton && chatListPanel && bodyEl) {
        menuToggleButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent click from bubbling to body listener
            console.log("Menu toggle button clicked.");
            chatListPanel.classList.toggle('open');
            bodyEl.classList.toggle('panel-open');
            console.log(`Panel open state: ${chatListPanel.classList.contains('open')}`);
        });

        // Close panel when clicking overlay (add listener to body or overlay element)
        bodyEl.addEventListener('click', (e) => {
            // Check if panel is open, click is outside panel, and not on the toggle button
            if (chatListPanel.classList.contains('open') && !chatListPanel.contains(e.target) && !menuToggleButton.contains(e.target) && e.target !== menuToggleButton) {
                console.log("Overlay clicked, closing panel.");
                closePanel();
            }
        });
    }

    // --- Firebase Initialization --- (Keep as is)
    const firebaseConfig = {
        apiKey: "AIzaSyDZ49oy4UBs0bK_n__oeNEKSC4sPHuif1k", // Replace if needed
        authDomain: "nerd-chat-5559a.firebaseapp.com",
        projectId: "nerd-chat-5559a",
        storageBucket: "nerd-chat-5559a.appspot.com", 
        messagingSenderId: "745073234777",
        appId: "1:745073234777:web:3e1a387c2281c04ac83248",
        measurementId: "G-MBBLDPBTC5"
     };

     try {
        showLoadingMessage("Initializing NerdChat...");
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

         // --- Auth State Change Listener --- (Adjusted UI handling)
         auth.onAuthStateChanged(user => {
             clearAuthMessages();
             if (user) {
                 // User is signed in.
                 if (!currentUser) { // Only run full setup if state actually changed to logged in
                     console.log("User logged in:", user.uid);
                     currentUser = user;
                     authContainer.style.display = 'none';
                     appContainer.style.display = 'flex'; // Show main app
                     hideLoadingMessage();

                     // Fetch user data and then setup UI
                     database.ref('users/' + user.uid).once('value').then(snapshot => {
                         let displayName = user.displayName || user.email; // Fallback display name
                         let username = null;
                         if (snapshot.exists()) {
                             const userData = snapshot.val();
                             displayName = userData.displayName || displayName;
                             username = userData.username;
                             updateUserInfoDisplay(displayName, username);
                         } else {
                             console.warn("User profile not found on login, setting up default.");
                             setupUserProfile(user).then(() => {
                                  updateUserInfoDisplay(displayName, null); // Show without username initially
                             });
                         }
                         loadChatList(user.uid); // Load user's chats/contacts
                         setupNewChatModal(user.uid); // Setup modal listeners
                     }).catch(error => {
                         console.error("Error fetching user profile on login:", error);
                         updateUserInfoDisplay(user.displayName || user.email, null); // Show fallback
                         loadChatList(user.uid); // Still try to load other data
                         setupNewChatModal(user.uid);
                     });

                 } else {
                     // User was already logged in, maybe profile updated?
                     currentUser = user; // Update currentUser just in case
                     console.log("Auth state change detected for already logged-in user.");
                     // Re-fetch profile data
                     database.ref('users/' + user.uid).once('value').then(snapshot => {
                          let displayName = user.displayName || user.email;
                          let username = null;
                         if (snapshot.exists()) {
                             const userData = snapshot.val();
                             displayName = userData.displayName || displayName;
                             username = userData.username;
                         }
                         updateUserInfoDisplay(displayName, username);
                     }).catch(error => {
                         console.error("Error fetching user profile on auth update:", error);
                         updateUserInfoDisplay(user.displayName || user.email, null);
                     });
                 }

             } else {
                 // User is signed out.
                 if (currentUser) { // Only run full cleanup if state actually changed to logged out
                     console.log("User logged out.");
                     currentUser = null;
                     clearChatState(); // Clean up listeners and UI
                     authContainer.style.display = 'flex'; // Show auth screen
                     appContainer.style.display = 'none'; // Hide main app
                     hideLoadingMessage();
                 } else {
                      hideLoadingMessage(); // Ensure loading message is hidden
                 }
             }
         });

     } catch (e) {
         console.error("Firebase initialization error:", e);
         showLoadingMessage('Error loading Firebase. Check console.', true);
     }

    // --- Loading Message --- (Keep as is)
    function showLoadingMessage(message, isError = false) {
        if (!loadEl) return;
        loadEl.textContent = message;
        loadEl.style.color = isError ? 'red' : 'white'; // Adjusted for dark background
        loadEl.style.display = 'block';
    }
    function hideLoadingMessage() {
        if (!loadEl) return;
        loadEl.style.display = 'none';
    }

    // --- Input Auto-Resize --- (Keep as is)
     const autoExpandTextarea = (field) => {
         if (!field) return;
         field.style.height = 'inherit';
         const computed = window.getComputedStyle(field);
         const height = parseInt(computed.getPropertyValue('border-top-width'), 10)
                      + parseInt(computed.getPropertyValue('padding-top'), 10)
                      + field.scrollHeight
                      + parseInt(computed.getPropertyValue('padding-bottom'), 10)
                      + parseInt(computed.getPropertyValue('border-bottom-width'), 10);
         field.style.height = `${Math.min(height, 100)}px`;
         if(sendButton) sendButton.disabled = field.value.trim() === '';
     };
     if (messageInput) messageInput.addEventListener('input', () => autoExpandTextarea(messageInput));


    // --- Auth View Toggle & Messages --- (Keep as is)
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
        if(loginView) loginView.style.display = 'none';
        if(signupView) signupView.style.display = 'block';
        clearAuthMessages();
    });

    if(showLoginLink) showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        if(signupView) signupView.style.display = 'none';
        if(loginView) loginView.style.display = 'block';
         clearAuthMessages();
    });

    // --- Authentication Functions --- (Keep Core Logic, Update UI Feedback)
    function handleAuthError(error, context = "Error") {
        console.error(context + ":", error);
         let message = "An unknown error occurred. Please try again.";
         // --- Keep existing error code mapping --- 
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
                 // V2: Handle username taken during signup
                 case 'permission-denied': 
                     if (context === "Signup Error") message = "Username might be taken or invalid.";
                     else message = "Operation failed: Permission denied.";
                     break;
                 default: message = error.message;
             }
         }
         showAuthError(message);
    }

    // Email/Password Signup (Keep core logic)
    if(signupButton) signupButton.addEventListener('click', () => {
        const name = signupNameInput.value.trim();
        const email = signupEmailInput.value.trim();
        const password = signupPasswordInput.value.trim();
        const username = signupUsernameInput.value.trim().toLowerCase();
        clearAuthMessages();

        // --- Keep existing validations --- 
        if (!name || !email || !password || !username) { showAuthError("Please fill in all fields."); return; }
        if (password.length < 6) { showAuthError("Password should be at least 6 characters."); return; }
        if (username.length < 3) { showAuthError("Username should be at least 3 characters."); return; }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) { showAuthError("Username can only contain letters, numbers, and underscores."); return; }

        showAuthSuccess("Creating account...");

        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const userId = userCredential.user.uid;
                return userCredential.user.updateProfile({ displayName: name })
                    .then(() => {
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
                showAuthSuccess("Account created successfully! Redirecting...");
                // Don't need timeout, onAuthStateChanged handles UI switch
            }).catch(error => {
                 // Updated error check for V2
                 if (error.code === 'auth/email-already-in-use') {
                    showAuthError("This email address is already registered.");
                 } else if (error.message.includes('permission_denied') || error.message.includes('Username is already taken')) {
                     showAuthError("Username is already taken or invalid. Please choose another.");
                 } else {
                     handleAuthError(error, "Signup Error");
                 }
             });
    });

    // Email/Password Login (Keep core logic)
    if(loginButton) loginButton.addEventListener('click', () => {
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value.trim();
        clearAuthMessages();
        if (!email || !password) { showAuthError("Please enter email and password."); return; }
        showAuthSuccess("Logging in...");
        auth.signInWithEmailAndPassword(email, password)
            .catch(err => handleAuthError(err, "Login Error"));
    });

    // Google Sign-in / Sign-up (Keep core logic, ensure username modal works)
     const signInWithGoogle = () => {
         const provider = new firebase.auth.GoogleAuthProvider();
         clearAuthMessages();
         showAuthSuccess("Opening Google Sign-in...");
         auth.signInWithPopup(provider)
            .then((result) => {
                const user = result.user;
                return database.ref('users/' + user.uid).once('value')
                    .then(snapshot => {
                        if (!snapshot.exists() || !snapshot.val().username) { // Also check if username exists
                             showUsernameCreationModal(user); // Show modal if new or no username
                        } else {
                             showAuthSuccess("Google Sign-in successful!");
                             // onAuthStateChanged handles UI update
                        }
                    });
            }).catch(err => handleAuthError(err, "Google Sign-in Error"));
     };
    if(googleSigninButton) googleSigninButton.addEventListener('click', signInWithGoogle);
    if(googleSignupButton) googleSignupButton.addEventListener('click', signInWithGoogle);

    // Username creation modal for Google sign-in (Keep as is, ensure elements exist)
    function showUsernameCreationModal(user) {
        // V2 uses a built-in modal, but logic is same - just show/hide it?
        // Let's keep generating it for now for simplicity
        const modal = document.createElement('div');
        modal.className = 'modal'; // Use the new modal class
        modal.style.display = 'flex'; // Show it
        modal.innerHTML = `
            <div class="modal-content">
                 <header class="modal-header">
                     <h2>Choose a Username</h2>
                     <!-- No close button here - force username selection -->
                 </header>
                 <div class="modal-body">
                     <p>Choose a unique username. This is how others will find you.</p>
                     <input type="text" id="google-username" placeholder="Username (letters, numbers, _)" required>
                     <p id="google-username-error" style="color: var(--error-color); display: none; font-size: 0.85rem; margin-top: -10px; margin-bottom: 10px;"></p>
                     <button id="set-username-button" class="btn-primary">Continue</button>
                 </div>
            </div>
        `;
        document.body.appendChild(modal);

        const usernameInput = document.getElementById('google-username');
        const usernameError = document.getElementById('google-username-error');
        const setUsernameButton = document.getElementById('set-username-button');

        setUsernameButton.addEventListener('click', () => {
            const username = usernameInput.value.trim().toLowerCase();
            usernameError.style.display = 'none';

            // --- Keep existing validations ---
            if (username.length < 3) { /* ... error handling ... */ usernameError.textContent='Min 3 chars'; usernameError.style.display='block'; return; }
            if (!/^[a-zA-Z0-9_]+$/.test(username)) { /* ... error handling ... */ usernameError.textContent='Invalid chars'; usernameError.style.display='block'; return; }

            database.ref('usernames/' + username).once('value')
                .then(snapshot => {
                    if (snapshot.exists()) {
                        throw new Error('Username taken');
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
                    updateUserInfoDisplay(user.displayName, username); // Update main UI
                })
                .catch(error => {
                    if (error.message === 'Username taken') {
                         usernameError.textContent = 'Username is already taken';
                         usernameError.style.display = 'block';
                    } else {
                        console.error("Error creating account via Google Modal:", error);
                        usernameError.textContent = 'Error saving username. Please try again.';
                        usernameError.style.display = 'block';
                    }
                });
        });
    }

    // Update user info display in the sidebar header - V2
    function updateUserInfoDisplay(displayName, username) {
        if (!userDisplayNameSpan) return;
        // Simple display for now
        userDisplayNameSpan.textContent = displayName || 'User';
        // Could add avatar, username display later
         userDisplayNameSpan.title = username ? `@${username}` : 'Username not set';
    }

    // Logout - V2
    if(logoutButton) logoutButton.addEventListener('click', () => {
        console.log("Attempting logout...");
        auth.signOut().catch(error => {
            console.error("Logout Error:", error);
             alert("Error logging out."); // Simple alert for now
        });
    });

     // --- User Profile Setup --- (Keep as is)
     function setupUserProfile(user) {
        if (!user) return Promise.resolve();
        const userRef = database.ref('users/' + user.uid);
        return userRef.once('value').then((snapshot) => {
             const name = user.displayName || user.email.split('@')[0] || 'Anonymous';
             const email = user.email;
             let updates = {};
             if (!snapshot.exists()) {
                 updates = {
                     displayName: name,
                     displayName_lower: name.toLowerCase(),
                     email: email,
                     createdAt: firebase.database.ServerValue.TIMESTAMP
                     // Username is set separately via modal or signup form
                 };
                 return userRef.set(updates);
             } else {
                 const dbData = snapshot.val();
                 if (dbData.displayName !== name) updates.displayName = name;
                 if (dbData.displayName_lower !== name.toLowerCase()) updates.displayName_lower = name.toLowerCase();
                 if (dbData.email !== email) updates.email = email;
                 if (Object.keys(updates).length > 0) {
                     return userRef.update(updates);
                 }
                 return Promise.resolve();
             }
         }).catch(error => console.error("Error setting/updating user profile:", error));
     }

    // Clear application state on logout or error - V2
    function clearChatState() {
         console.log("Clearing chat state...");
         // Clear UI
         if(userDisplayNameSpan) userDisplayNameSpan.textContent = '';
         if(userDisplayNameSpan) userDisplayNameSpan.title = '';
         if(chatListEl) chatListEl.innerHTML = '';
         if(searchResultsList) searchResultsList.innerHTML = ''; // Clear modal search results
         if(messagesDiv) messagesDiv.innerHTML = '';
         if(chatPlaceholder) chatPlaceholder.style.display = 'flex'; // Show placeholder
         if(chatHeaderName) chatHeaderName.textContent = 'Select a chat';
         if(messageInputContainer) messageInputContainer.style.display = 'none';

         closeChat(true); // Detach message listener & reset UI

         // Detach chat list listener
         if (chatListRef && chatListListenerHandle) {
             chatListRef.off('value', chatListListenerHandle);
             console.log("Detached chat list listener");
         }
         chatListRef = null;
         chatListListenerHandle = null;
         currentChatFriendId = null; // Reset current chat
         // currentUser is set to null in the onAuthStateChanged handler
     }

    // --- Chat List (Formerly Friends List) --- V2
    function loadChatList(userId) {
        if (!userId || !chatListEl) return;

        if (chatListRef && chatListListenerHandle) {
            chatListRef.off('value', chatListListenerHandle);
        }

        chatListRef = database.ref('users/' + userId + '/friends'); // Still uses friends data
        chatListEl.innerHTML = '<li class="placeholder-message">Loading chats...</li>';

        chatListListenerHandle = chatListRef.on('value', snapshot => {
            if (!chatListEl) return;
            chatListEl.innerHTML = ''; // Clear current list

            if (!snapshot.exists() || !snapshot.hasChildren()) {
                chatListEl.innerHTML = '<li class="placeholder-message">No chats yet. Start one!</li>';
                checkChatClosure();
                return;
            }

            // Array to hold combined data (friend profile + last message)
            const chatDataPromises = [];

            snapshot.forEach(friendSnapshot => {
                const friendId = friendSnapshot.key;
                const chatId = getChatId(userId, friendId);

                // Promise to get friend profile
                const profilePromise = database.ref('users/' + friendId).once('value');

                // Promise to get the last message
                const lastMessagePromise = database.ref('messages/' + chatId)
                                                .orderByChild('timestamp')
                                                .limitToLast(1)
                                                .once('value');

                chatDataPromises.push(
                    Promise.all([profilePromise, lastMessagePromise])
                           .then(([profileSnap, messageSnap]) => {
                               if (!profileSnap.exists()) return null; // Friend doesn't exist

                               const friendData = profileSnap.val();
                               let lastMessageData = { text: 'No messages yet...', timestamp: null };

                               if (messageSnap.exists()) {
                                   messageSnap.forEach(msg => { // .once() returns snapshot, iterate to get the child
                                       lastMessageData = msg.val();
                                   });
                               }

                               return { // Return combined data
                                   id: friendId,
                                   name: friendData.displayName || friendData.email,
                                   username: friendData.username,
                                   lastMessage: lastMessageData.text,
                                   timestamp: lastMessageData.timestamp
                                   // isUnread: false // Placeholder for now
                               };
                           })
                );
            });

            Promise.all(chatDataPromises)
                .then(results => {
                    if (!chatListEl) return;
                    chatListEl.innerHTML = '';
                    let chatsFound = false;

                    // Filter out null results (where friend profile didn't exist)
                    const validChats = results.filter(r => r !== null);

                    // Optional: Sort chats by last message timestamp (descending)
                    validChats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

                    validChats.forEach(chatInfo => {
                            renderChatItem(
                                chatInfo.id,
                                chatInfo.name,
                                chatInfo.username,
                                chatInfo.lastMessage,
                                chatInfo.timestamp,
                                false // isUnread - Placeholder
                            );
                            chatsFound = true;
                    });

                    if (!chatsFound && chatListEl.innerHTML === '') {
                        chatListEl.innerHTML = '<li class="placeholder-message">No valid contacts found.</li>';
                    }
                    checkChatClosure();
                })
                .catch(error => {
                    console.error("Error fetching chat list data:", error);
                    if(chatListEl) chatListEl.innerHTML = '<li class="placeholder-message" style="color: var(--error-color);">Error loading chats.</li>';
                });
        }, error => {
            console.error("Error loading chat list:", error);
            if(chatListEl) chatListEl.innerHTML = '<li class="placeholder-message" style="color: var(--error-color);">Error loading chats.</li>';
            if (chatListRef && chatListListenerHandle) chatListRef.off('value', chatListListenerHandle);
        });
        console.log("Attached chat list listener for", userId);
    }

    // Helper to check if the open chat needs closing after list update - V2
     function checkChatClosure() {
         if (currentChatFriendId && chatListEl && !chatListEl.querySelector(`li[data-chat-id="${currentChatFriendId}"]`)) {
              console.log("Currently chatting contact is no longer in the list, closing chat.");
              closeChat(true);
          }
     }

     // Render item in the chat list - V2
     function renderChatItem(friendId, friendName, friendUsername, lastMessage = 'No messages yet...', timestamp = null, isUnread = false) {
         if (!chatListEl) return;
         const li = document.createElement('li');
         li.dataset.chatId = friendId; // Use data-chat-id
         if (friendId === currentChatFriendId) li.classList.add('active');

         // V2 Structure: Avatar (placeholder), Content (Name, Last Msg), Timestamp
         // Simple version for now:
         // const avatarPlaceholder = '<div class="chat-item-avatar"></div>'; // Add CSS for this
         const contentDiv = document.createElement('div');
         contentDiv.className = 'chat-item-content';
         const nameDiv = document.createElement('div');
         nameDiv.className = 'chat-item-name';
         nameDiv.textContent = escapeHtml(friendName);
         contentDiv.appendChild(nameDiv);
         // Add last message placeholder later if needed
         // const lastMsgDiv = document.createElement('div');
         // lastMsgDiv.className = 'chat-item-last-message';
         // lastMsgDiv.textContent = '...'; // Placeholder
         // contentDiv.appendChild(lastMsgDiv);

         // li.innerHTML = avatarPlaceholder;
         li.appendChild(contentDiv);

         // Add Timestamp and Unread Indicator (Placeholder Structure)
         const metaDiv = document.createElement('div');
         metaDiv.className = 'chat-item-meta';

         const timeSpan = document.createElement('span');
         timeSpan.className = 'chat-item-time';
         timeSpan.textContent = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }) : ''; // Format time

         const unreadIndicator = document.createElement('span');
         unreadIndicator.className = 'chat-item-unread';
         if (isUnread) {
             unreadIndicator.classList.add('visible');
             // unreadIndicator.textContent = '1'; // Add count later if needed
         }

         metaDiv.appendChild(timeSpan);
         metaDiv.appendChild(unreadIndicator);
         li.appendChild(metaDiv);

         li.addEventListener('click', () => {
              // Remove active class from all items
              document.querySelectorAll('#chat-list li').forEach(item => item.classList.remove('active'));
              // Add active class to the clicked item
              li.classList.add('active');
              // Open the chat
              openChat(friendId, friendName);
              // Close the panel after selecting a chat
              closePanel();
         });

         chatListEl.appendChild(li);
     }

    // Add Friend / Start Chat - V2 (called from search results)
    function addFriendAndOpenChat(userId, friendId, friendName) {
         if (!userId || !friendId) return;
         if (userId === friendId) { /* alert("Cannot add self."); */ return; } // Silently ignore

         console.log(`Attempting to add/confirm friend: ${userId} -> ${friendId}`);
         const updates = {};
         updates[`/users/${userId}/friends/${friendId}`] = true;
         updates[`/users/${friendId}/friends/${userId}`] = true;

         database.ref().update(updates)
             .then(() => {
                 console.log("Friend added/confirmed.");
                 // Close the modal
                 if (newChatModal) newChatModal.style.display = 'none';
                 // Open the chat immediately
                 openChat(friendId, friendName);
                 // Highlight the new chat in the list (will be added by listener)
                 setTimeout(() => { // Delay slightly for list update
                      const newItem = chatListEl.querySelector(`li[data-chat-id="${friendId}"]`);
                      if (newItem) {
                         document.querySelectorAll('#chat-list li').forEach(item => item.classList.remove('active'));
                         newItem.classList.add('active');
                         newItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }
                 }, 300);
             })
             .catch(error => {
                 console.error("Error adding friend:", error);
                 // Show error within the modal?
                 if(searchResultsList) searchResultsList.innerHTML = `<li class="placeholder-message" style="color: var(--error-color);">Failed to add contact.</li>`;
             });
    }

     // Remove Friend (Keep core logic, update UI feedback if needed)
     function removeFriend(userId, friendId) {
        if (!userId || !friendId) return;
         console.log(`Attempting to remove friend: ${userId} -> ${friendId}`);
         // Optional: Add confirmation dialog here
         const updates = {};
         updates[`/users/${userId}/friends/${friendId}`] = null;
         updates[`/users/${friendId}/friends/${userId}`] = null;

         database.ref().update(updates)
             .then(() => {
                 console.log("Friend removed.");
                  if (currentChatFriendId === friendId) {
                      closeChat(true);
                  }
                  // Chat list updates via its listener
             })
             .catch(error => {
                 console.error("Error removing friend:", error);
                 alert("Failed to remove contact.");
             });
     }

    // --- New Chat Modal & User Search --- V2
    function setupNewChatModal(currentUserId) {
        if (!newChatButton || !newChatModal || !closeModalButton || !userSearchInput || !searchResultsList) return;

        newChatButton.addEventListener('click', () => {
            newChatModal.style.display = 'flex';
            userSearchInput.value = ''; // Clear previous search
            searchResultsList.innerHTML = '<li class="placeholder-message">Start typing to find users.</li>';
            userSearchInput.focus();
            // Optional: Trigger empty search immediately?
            // searchUsers('', currentUserId);
        });

        closeModalButton.addEventListener('click', () => {
            newChatModal.style.display = 'none';
        });

        // Close modal if clicking outside the content
        newChatModal.addEventListener('click', (e) => {
            if (e.target === newChatModal) {
                newChatModal.style.display = 'none';
            }
        });

        // Search input listener (debounced)
        userSearchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const query = userSearchInput.value.trim().toLowerCase();

            if (query.length < 1) { // Adjusted minimum length if desired
                searchResultsList.innerHTML = '<li class="placeholder-message">Start typing to find users.</li>';
                // searchUsers('', currentUserId); // Or trigger empty search
                return;
            }

            searchResultsList.innerHTML = '<li class="placeholder-message">Searching...</li>';
            searchTimeout = setTimeout(() => {
                searchUsers(query, currentUserId);
            }, 350);
        });
    }

    // Search Users Function (Adjusted for Modal) - V2
    function searchUsers(query, currentUserId) {
        if (!searchResultsList) return;

        const usersRef = database.ref('users');
        let searchQuery = usersRef.orderByChild('username')
                                   .startAt(query)
                                   .endAt(query + '\uf8ff')
                                   .limitToFirst(10);

        searchQuery.once('value')
            .then(snapshot => {
                if (!searchResultsList) return; // Check element still exists
                searchResultsList.innerHTML = '';

                if (!snapshot.exists()) {
                    searchResultsList.innerHTML = '<li class="placeholder-message">No users found matching that username.</li>';
                    return;
                }

                // Check if already friends (in chat list)
                const chatListItems = chatListEl ? Array.from(chatListEl.querySelectorAll('li[data-chat-id]')).map(li => li.dataset.chatId) : [];
                let found = false;

                snapshot.forEach(userSnap => {
                    const userData = userSnap.val();
                    const userId = userSnap.key;

                    if (userId === currentUserId) return; // Skip self
                    if (chatListItems.includes(userId)) return; // Skip existing contacts

                    renderSearchResultItem(userId, userData.username, userData.displayName || '');
                    found = true;
                });

                if (!found) {
                    searchResultsList.innerHTML = '<li class="placeholder-message">No new users found matching that username.</li>';
                }
            })
            .catch(error => {
                console.error("Error searching users:", error);
                if(searchResultsList) {
                    if (error.code === 'PERMISSION_DENIED') {
                        searchResultsList.innerHTML = '<li class="placeholder-message" style="color: var(--error-color);">Search failed. Check DB Rules/Indexes.</li>';
                    } else {
                        searchResultsList.innerHTML = '<li class="placeholder-message" style="color: var(--error-color);">Error searching users.</li>';
                    }
                }
            });
    }

    // Render Search Result Item (Adjusted for Modal) - V2
    function renderSearchResultItem(userId, username, displayName) {
        if (!searchResultsList) return;
         const li = document.createElement('li');

         const nameSpan = document.createElement('span');
         // Display both username and display name if available
         nameSpan.textContent = displayName ? `${escapeHtml(displayName)} (@${escapeHtml(username)})` : `@${escapeHtml(username)}`;
         li.appendChild(nameSpan);

         const actionsDiv = document.createElement('div');
         actionsDiv.classList.add('search-result-actions');

         const addButton = document.createElement('button');
         addButton.title = 'Start Chat';
         addButton.innerHTML = '<i class="fas fa-plus-circle"></i>'; // Or fa-comment-medical
         addButton.addEventListener('click', (e) => {
             if (currentUser) {
                // Use the display name primarily for the chat header when opening
                addFriendAndOpenChat(currentUser.uid, userId, displayName || username);
             }
         });
         actionsDiv.appendChild(addButton);
         li.appendChild(actionsDiv);

         searchResultsList.appendChild(li);
     }


    // --- Chat Functionality --- (Core logic remains similar)
    // --- Chat ID Generation --- (Keep as is)
    function getChatId(uid1, uid2) {
        return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
    }

    // Open Chat - V2 Adjustments
    function openChat(friendId, friendName) {
        if (currentChatFriendId === friendId || !currentUser) {
            if (currentChatFriendId === friendId) console.log("Chat already open with:", friendId);
            else console.log("Cannot open chat: No current user or same friend ID.")
            return;
        }
        console.log(`Opening chat with: ${friendId} (${friendName})`);

        closeChat(false); // Close previous listener without full UI reset

        currentChatFriendId = friendId;

        // Update UI
        if(chatHeaderName) chatHeaderName.textContent = escapeHtml(friendName);
        if(messageInputContainer) messageInputContainer.style.display = 'flex';
        if(chatPlaceholder) chatPlaceholder.style.display = 'none';
        if(messagesDiv) messagesDiv.innerHTML = ''; // Clear previous messages
        if(messageInput) messageInput.value = '';
        if(sendButton) sendButton.disabled = true;
        if(messageInput) autoExpandTextarea(messageInput); // Reset height

        // Highlight in chat list (ensure renderChatItem adds active class too)
        document.querySelectorAll('#chat-list li').forEach(item => item.classList.remove('active'));
        const activeItem = chatListEl ? chatListEl.querySelector(`li[data-chat-id="${friendId}"]`) : null;
        if (activeItem) activeItem.classList.add('active');

        // Setup Listener
        const chatId = getChatId(currentUser.uid, friendId);
        currentMessagesRef = database.ref(`messages/${chatId}`).orderByChild('timestamp').limitToLast(50); // Keep limit

        messageListenerHandle = currentMessagesRef.on('child_added', snapshot => {
            if (snapshot.exists()) {
                const messageData = snapshot.val();
                // Check if we are *still* viewing the chat this message belongs to
                if (currentChatFriendId === friendId) { 
                    displayMessage(snapshot.key, messageData.senderId, messageData.text, messageData.senderName || null, messageData.timestamp);
                    // If chat is open, ensure it's marked as read
                    updateUnreadIndicator(friendId, false);
                } else {
                     // Message arrived for a different chat - mark it unread
                     console.log(`Unread message received for chat involving: ${friendId}`);
                     updateUnreadIndicator(friendId, true);
                }
            } else {
                 console.log("Received null snapshot for child_added?")
            }
        }, error => {
            console.error("Error loading messages:", error);
            if(messagesDiv && currentChatFriendId === friendId) {
                 messagesDiv.innerHTML = '<p style="color: red; text-align: center; margin-top: 20px;">Error loading messages.</p>';
            }
            if (currentMessagesRef && messageListenerHandle) currentMessagesRef.off('child_added', messageListenerHandle);
        });
        console.log("Attached message listener for chat:", chatId);

        if(messageInput) messageInput.focus();
        // No need to toggle body class anymore for view switching
    }

     // Close Chat - V2 Adjustments
     function closeChat(resetUI = true) {
         // Detach message listener
         if (currentMessagesRef && messageListenerHandle) {
             currentMessagesRef.off('child_added', messageListenerHandle);
             console.log("Detached message listener for chat ID involving:", currentChatFriendId);
         }
         currentChatFriendId = null; // Set ID to null
         messageListenerHandle = null;
         currentMessagesRef = null;

         if (resetUI) {
             console.log("Resetting chat UI.");
             if(chatHeaderName) chatHeaderName.textContent = 'Select a chat';
             if(messagesDiv) messagesDiv.innerHTML = '';
             if(chatPlaceholder) chatPlaceholder.style.display = 'flex';
             if(messageInputContainer) messageInputContainer.style.display = 'none';
             if(messageInput) messageInput.value = '';
             if(sendButton) sendButton.disabled = true;
             // Remove active class from chat list
             if(chatListEl) {
                 document.querySelectorAll('#chat-list li').forEach(item => item.classList.remove('active'));
             }
         }
     }

    // Display Message - V2 Adjustments (mostly styling)
    function displayMessage(messageId, senderId, text, senderName, timestamp) {
         if (!messagesDiv || !currentUser) return;
         if (messagesDiv.querySelector(`[data-message-id="${messageId}"]`)) return; // Prevent duplicates

         const messageContainer = document.createElement('div');
         messageContainer.classList.add('message-container');
         messageContainer.dataset.messageId = messageId;

         const messageBubble = document.createElement('div');
         messageBubble.classList.add('message');

         const isSent = senderId === currentUser.uid;
         messageContainer.classList.add(isSent ? 'sent' : 'received');

         // Sender name (usually not shown in 1-on-1)
         // if (!isSent && senderName) { ... }

         const messageText = document.createElement('div');
         messageText.className = 'message-text'; // Add class for potential styling
         // Basic link detection (same as before)
         const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
         messageText.innerHTML = escapeHtml(text).replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
         messageBubble.appendChild(messageText);

         // Timestamp
         if (timestamp) {
             const time = new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
             const timestampSpan = document.createElement('span');
             timestampSpan.classList.add('timestamp');
             timestampSpan.textContent = time;
             messageBubble.appendChild(timestampSpan);
         }

         messageContainer.appendChild(messageBubble);

         // Scroll handling (same as before)
         const shouldScroll = messagesDiv.scrollHeight - messagesDiv.clientHeight <= messagesDiv.scrollTop + 50;
         messagesDiv.appendChild(messageContainer);
         if (shouldScroll || isSent) {
             messagesDiv.scrollTop = messagesDiv.scrollHeight;
         }
     }

    // Send Message - V2 (No major changes needed)
     const sendMessage = () => {
         if (!messageInput || !currentUser || !currentChatFriendId) return;
         const text = messageInput.value.trim();
         if (text === '') return;

         const chatId = getChatId(currentUser.uid, currentChatFriendId);
         const messagesRef = database.ref(`messages/${chatId}`);
         const newMessageRef = messagesRef.push();

         newMessageRef.set({
             senderId: currentUser.uid,
             // Include senderName even if not always displayed, good for data consistency
             senderName: currentUser.displayName || currentUser.email, 
             text: text,
             timestamp: firebase.database.ServerValue.TIMESTAMP
         })
         .then(() => {
             messageInput.value = '';
             if(sendButton) sendButton.disabled = true;
             autoExpandTextarea(messageInput);
             messageInput.focus();
         })
         .catch(error => {
             console.error("Error sending message:", error);
             alert("Failed to send message."); // Simple feedback
         });
     };

    if(sendButton) sendButton.addEventListener('click', sendMessage);
    if(messageInput) messageInput.addEventListener('keypress', (e) => {
         if (e.key === 'Enter' && !e.shiftKey) {
             e.preventDefault();
             sendMessage();
         }
     });

    // --- Utility --- (Keep as is)
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
             return '';
         }
     }

    // Remove old username change UI function if it exists
    // function setupUsernameChange() { ... } 

    // Function to update the unread status indicator for a chat item
    function updateUnreadIndicator(chatId, isUnread) {
        if (!chatListEl) return;
        const chatItem = chatListEl.querySelector(`li[data-chat-id="${chatId}"]`);
        if (chatItem) {
            const indicator = chatItem.querySelector('.chat-item-unread');
            if (indicator) {
                indicator.classList.toggle('visible', isUnread);
            }
        }
    }

    // --- Find Friends Modal Logic ---
    const findFriendsButton = document.getElementById('find-friends-button');
    const findFriendsModal = document.getElementById('find-friends-modal');
    const closeFindFriendsModal = document.getElementById('close-find-friends-modal');
    const findFriendsSearch = document.getElementById('find-friends-search');
    const findFriendsList = document.getElementById('find-friends-list');
    let allUsersCache = [];
    let findFriendsTimeout;

    if (findFriendsButton && findFriendsModal && closeFindFriendsModal && findFriendsSearch && findFriendsList) {
        findFriendsButton.addEventListener('click', () => {
            findFriendsModal.style.display = 'flex';
            findFriendsSearch.value = '';
            findFriendsList.innerHTML = '<li class="placeholder-message">Loading users...</li>';
            // Load all users (up to 50)
            database.ref('users').orderByChild('username').limitToFirst(50).once('value').then(snapshot => {
                allUsersCache = [];
                if (!snapshot.exists()) {
                    findFriendsList.innerHTML = '<li class="placeholder-message">No users found.</li>';
                    return;
                }
                snapshot.forEach(userSnap => {
                    const userData = userSnap.val();
                    allUsersCache.push({
                        id: userSnap.key,
                        username: userData.username,
                        displayName: userData.displayName || ''
                    });
                });
                renderFindFriendsList(allUsersCache, findFriendsList, currentUser ? currentUser.uid : null);
            });
        });
        closeFindFriendsModal.addEventListener('click', () => {
            findFriendsModal.style.display = 'none';
        });
        findFriendsModal.addEventListener('click', (e) => {
            if (e.target === findFriendsModal) {
                findFriendsModal.style.display = 'none';
            }
        });
        findFriendsSearch.addEventListener('input', () => {
            clearTimeout(findFriendsTimeout);
            const query = findFriendsSearch.value.trim().toLowerCase();
            findFriendsTimeout = setTimeout(() => {
                let filtered = allUsersCache;
                if (query.length > 0) {
                    filtered = allUsersCache.filter(u =>
                        (u.username && u.username.toLowerCase().includes(query)) ||
                        (u.displayName && u.displayName.toLowerCase().includes(query))
                    );
                }
                renderFindFriendsList(filtered, findFriendsList, currentUser ? currentUser.uid : null);
            }, 200);
        });
    }

    function renderFindFriendsList(users, listEl, currentUserId) {
        if (!listEl) return;
        listEl.innerHTML = '';
        // Get current friends to filter out
        let currentFriends = [];
        if (chatListEl) {
            currentFriends = Array.from(chatListEl.querySelectorAll('li[data-chat-id]')).map(li => li.dataset.chatId);
        }
        let found = false;
        users.forEach(user => {
            if (user.id === currentUserId) return; // Skip self
            if (currentFriends.includes(user.id)) return; // Skip existing friends
            const li = document.createElement('li');
            const nameSpan = document.createElement('span');
            nameSpan.textContent = user.displayName ? `${escapeHtml(user.displayName)} (@${escapeHtml(user.username)})` : `@${escapeHtml(user.username)}`;
            li.appendChild(nameSpan);
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('search-result-actions');
            const addButton = document.createElement('button');
            addButton.title = 'Add Friend';
            addButton.innerHTML = '<i class="fas fa-user-plus"></i>';
            addButton.addEventListener('click', (e) => {
                if (currentUser) {
                    addFriendAndOpenChat(currentUser.uid, user.id, user.displayName || user.username);
                    findFriendsModal.style.display = 'none';
                }
            });
            actionsDiv.appendChild(addButton);
            li.appendChild(actionsDiv);
            listEl.appendChild(li);
            found = true;
        });
        if (!found) {
            listEl.innerHTML = '<li class="placeholder-message">No users found.</li>';
        }
    }

}); // End DOMContentLoaded