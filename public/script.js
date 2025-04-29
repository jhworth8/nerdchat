// Helpers
const $   = s => document.querySelector(s);
const $$  = s => document.querySelectorAll(s);
const debounce = (fn, ms = 300) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};
const escapeHtml = str =>
  str.replace(/[&<>"']/g, ch =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[ch]
);

// Firebase init
const firebaseConfig = {
  apiKey: "AIzaSyDZ49oy4UBs0bK_n__oeNEKSC4sPHuif1k",
  authDomain: "nerd-chat-5559a.firebaseapp.com",
  projectId: "nerd-chat-5559a",
  storageBucket: "nerd-chat-5559a.appspot.com",
  messagingSenderId: "745073234777",
  appId: "1:745073234777:web:3e1a387c2281c04ac83248",
  measurementId: "G-MBBLDPBTC5"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.database();

// FirebaseUI
const ui = new firebaseui.auth.AuthUI(auth);
ui.start("#firebaseui-auth-container", {
  signInOptions: [
    firebase.auth.EmailAuthProvider.PROVIDER_ID,
    firebase.auth.GoogleAuthProvider.PROVIDER_ID
  ],
  callbacks: { signInSuccessWithAuthResult: () => false }
});

// Auth state
auth.onAuthStateChanged(u => u ? initApp(u) : showAuth());

function showAuth() {
  $("#firebaseui-auth-container").classList.remove("hidden");
  $("#app-container").classList.add("hidden");
}

let messagesQuery = null;

function initApp(user) {
  $("#firebaseui-auth-container").classList.add("hidden");
  $("#app-container").classList.remove("hidden");
  $("#user-display-name").textContent = user.displayName || user.email;
  $("#user-username").textContent     = "@" + (user.email.split("@")[0]);
  bindUI();
  loadChatList();
}

// Bind all UI events
function bindUI() {
  // Logout & menu
  $("#logout-btn").onclick = () => auth.signOut();
  $("#menu-toggle").onclick = () =>
    $("#chat-list-panel").classList.toggle("hidden");

  // Modals
  $("#new-chat-btn").onclick       = () => openModal("new-chat-modal");
  $("#find-friends-btn").onclick   = () => {
    openModal("find-friends-modal");
    if (!$("#find-friends-list").hasChildNodes()) loadAllUsers();
  };
  $("#close-new-chat").onclick     = () => closeModal("new-chat-modal");
  $("#close-find-friends").onclick = () => closeModal("find-friends-modal");

  // Search inputs
  $("#new-chat-input").oninput = debounce(e =>
    searchUsersByUsername(e.target.value.trim(), "new-chat-results")
  );
  $("#find-friends-input").oninput = debounce(e =>
    filterList(e.target.value.trim().toLowerCase(), "find-friends-list")
  );
  $("#chat-search-input").oninput = debounce(e =>
    filterChats(e.target.value.trim().toLowerCase())
  );

  // Message sending + Enter key + auto-resize
  $("#send-btn").onclick = sendMessage;
  const mi = $("#message-input");
  mi.addEventListener("input", e => {
    $("#send-btn").disabled = !e.target.value.trim();
    autoResize(e.target);
  });
  mi.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// Modals helpers
function openModal(id) {
  const m = $("#" + id);
  m.classList.remove("hidden");
  m.classList.add("flex");
}
function closeModal(id) {
  const m = $("#" + id);
  m.classList.add("hidden");
  m.classList.remove("flex");
}

// Auto-resize textarea
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

// CHAT LIST
let currentChatId = null;
function loadChatList() {
  const uid = auth.currentUser.uid;
  db.ref(`users/${uid}/friends`).on("value", snap => {
    const list = $("#chat-list");
    list.innerHTML = "";
    snap.forEach(fr => {
      const fid    = fr.key;
      const chatId = [uid, fid].sort().join("_");

      // fetch profile + last message
      Promise.all([
        db.ref(`users/${fid}`).once("value"),
        db.ref(`messages/${chatId}`)
          .orderByChild("timestamp")
          .limitToLast(1)
          .once("value")
      ]).then(([uSnap, mSnap]) => {
        const { displayName, username } = uSnap.val() || {};
        const name = escapeHtml(displayName || username || "User");
        let preview = "No messages yet";
        let timeStr = "";
        mSnap.forEach(ms => {
          const { text, timestamp } = ms.val();
          preview = text;
          timeStr = new Date(timestamp).toLocaleTimeString([], {
            hour:   "2-digit",
            minute: "2-digit"
          });
        });

        const item = document.createElement("div");
        item.className =
          "flex justify-between items-center p-2 rounded hover:bg-gray-100 cursor-pointer";
        item.innerHTML = `
          <div class="flex-1 overflow-hidden">
            <div class="font-medium truncate">${name}</div>
            <div class="text-sm text-gray-500 truncate">${escapeHtml(preview)}</div>
          </div>
          <div class="ml-2 text-xs text-gray-400">${timeStr}</div>
          <button data-id="${fid}"
                  class="ml-2 text-red-500 hover:text-red-700">
            <i class="fas fa-trash"></i>
          </button>`;
        item.onclick = () => openChat(fid, name);
        item
          .querySelector("button")
          .addEventListener("click", e => {
            e.stopPropagation();
            removeFriend(fid);
          });
        list.appendChild(item);
      });
    });
  });
}

// CHAT OPEN / HISTORY
function openChat(friendId, friendName) {
  const me = auth.currentUser.uid;
  currentChatId = [me, friendId].sort().join("_");
  $("#chat-header-name").textContent           = friendName;
  $("#messages").innerHTML                     = "";
  $("#message-input-container").classList.remove("hidden");

  // detach old listener
  if (messagesQuery) messagesQuery.off();

  // attach new listener
  messagesQuery = db
    .ref(`messages/${currentChatId}`)
    .orderByChild("timestamp")
    .limitToLast(50);

  messagesQuery.on("child_added", snap =>
    displayMessage(snap.val())
  );
}

// RENDER A SINGLE MESSAGE
function displayMessage({ senderId, text, timestamp }) {
  const mine = senderId === auth.currentUser.uid;
  const w    = document.createElement("div");
  w.className = (mine ? "text-right" : "text-left") + " mb-2";
  const time = new Date(timestamp).toLocaleTimeString([], {
    hour:   "2-digit",
    minute: "2-digit"
  });
  w.innerHTML = `
    <div class="inline-block px-3 py-1 rounded ${
      mine ? "bg-green-200" : "bg-gray-200"
    }">
      ${escapeHtml(text)}
      <div class="text-xs text-gray-500 mt-1">${time}</div>
    </div>`;
  $("#messages").appendChild(w);
  $("#messages").scrollTop = $("#messages").scrollHeight;
}

// SEND MESSAGE
function sendMessage() {
  const txt = $("#message-input").value.trim();
  if (!txt) return;
  db.ref(`messages/${currentChatId}`).push({
    senderId:  auth.currentUser.uid,
    text:      txt,
    timestamp: Date.now()
  });
  $("#message-input").value     = "";
  $("#send-btn").disabled       = true;
  $("#message-input").style.height = "auto";
}

// FRIEND MANAGEMENT
function addFriend(fid, name) {
  const me = auth.currentUser.uid;
  const updates = {
    [`users/${me}/friends/${fid}`]: true,
    [`users/${fid}/friends/${me}`]: true
  };
  db.ref().update(updates).then(() => {
    closeModal("new-chat-modal");
    openChat(fid, name);
  });
}
function removeFriend(fid) {
  const me = auth.currentUser.uid;
  const updates = {
    [`users/${me}/friends/${fid}`]: null,
    [`users/${fid}/friends/${me}`]: null
  };
  db.ref().update(updates);
}

// SEARCH & FILTER
function searchUsersByUsername(query, listId) {
  const list = $("#" + listId);
  list.innerHTML = `<li class="text-gray-500">Searching…</li>`;
  db.ref("users")
    .orderByChild("username")
    .startAt(query)
    .endAt(query + "\uf8ff")
    .limitToFirst(10)
    .once("value")
    .then(snap => renderUserList(snap, listId));
}

function loadAllUsers() {
  const list = $("#find-friends-list");
  list.innerHTML = `<li class="text-gray-500">Loading…</li>`;
  db.ref("users")
    .orderByChild("displayName_lower")
    .limitToFirst(50)
    .once("value")
    .then(snap => renderUserList(snap, "find-friends-list"));
}

function renderUserList(snap, listId) {
  const me   = auth.currentUser.uid;
  const list = $("#" + listId);
  list.innerHTML = "";
  snap.forEach(uSnap => {
    const fid = uSnap.key;
    if (fid === me) return;
    // skip if already friends
    if (
      Array.from($$("#chat-list button[data-id]"))
        .some(b => b.dataset.id === fid)
    ) return;
    const { displayName, username } = uSnap.val() || {};
    const name = escapeHtml(displayName || username || fid);
    const li   = document.createElement("li");
    li.className =
      "flex justify-between items-center p-2 rounded hover:bg-gray-100 cursor-pointer";
    li.innerHTML = `
      <span>${name}</span>
      <button class="text-indigo-600 hover:text-indigo-800">
        <i class="fas fa-plus-circle"></i>
      </button>`;
    li.querySelector("button").onclick = e => {
      e.stopPropagation();
      addFriend(fid, name);
    };
    list.appendChild(li);
  });
}

function filterList(query, listId) {
  $$("#" + listId + " li").forEach(li => {
    li.style.display = li.textContent
      .toLowerCase()
      .includes(query)
      ? ""
      : "none";
  });
}

function filterChats(query) {
  $$("#chat-list > div").forEach(div => {
    div.style.display = div.textContent
      .toLowerCase()
      .includes(query)
      ? ""
      : "none";
  });
}
