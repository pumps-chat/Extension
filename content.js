(function() {
  const processedTokens = new Set();
  const API_URL = 'https://backend.pumps.chat';
  let ws = null;
  let currentUserAvatar = null;
  let heartbeatInterval = null;
  const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
  const MAX_MESSAGE_LENGTH = 500;
  let activeUsernames = new Set(); // Track active usernames locally

  function playMentionSound() {
    const audio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhEAGbaAIkhMQgBjWAC4hMf4P8MBMBAD/vBPB/4PwQBAEAQDEHQfB8H+sEAQBAEAQDg+D4Pg4CAIAgGIM/B8HwQBAEAQBAEHwfB8HwQBAEAQDEIAgCDgIAgCAYg+D4Pg+D4IAgCAIBiBAEHwfFc+AMQf+D4Pg+CAIAgCAYg+D4Pg+CAIBhGLvKQhCEIQhD//+WQhD/+WQhCEIQhCEIf///lkIQhD//5Z//5ZCEIQhCEP///+UhCEIQh/////y0IQh//LQhCH/8pCEIf/ykIQ/////Lf/ykP//5UIQhCEP/6hCEIQhCthCEIQhCEIQhCEIxf/yEIQhELP/8QQgGIPg+D4PggCAIAgGIPg+DwEAQBAMQf+D4Pg+CAIBgBAEHwfB8HwfBAEAwjECAIOAgCAIBiD4Pg+D4Pg+CAIAgCAYgQBBwEAQBAMQfB8HwfB8EAQBAEAxB8HwfB8EAQDCMQICg4CAIAgGIPg+D4Pg+CAIAgCAIA=');
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Ignore error if browser blocks autoplay
    });
  }

  function generateClientId() {
    const storedId = localStorage.getItem('chatExtensionClientId');
    if (storedId) return storedId;
    const newId = crypto.randomUUID();
    localStorage.setItem('chatExtensionClientId', newId);
    return newId;
  }

  const CLIENT_ID = generateClientId();

  function formatMessageContent(content, activeUsers) {
    return content.replace(/@(\w+)/g, (match, username) => {
      if (activeUsers.has(username)) {
        return `<span class="user-mention">@${username}</span>`;
      }
      return match;
    });
  }

  function createChatPopup() {
    const popupHTML = `
      <div class="chat-popup" id="chatPopup">
        <div class="popup-header">
          <span class="site-url">${window.location.hostname}</span>
          <span class="global-users">
            <span class="online-dot"></span>
            <span>0</span>
          </span>
          <span class="minimize-btn">−</span>
        </div>
        <div class="popup-content">
          <div class="loading-container" id="loadingState">
            <div class="status-text">Select token to begin</div>
            <div class="loading-spinner">
              <div class="spinner-ring"></div>
            </div>
            <div class="pulse-dots">
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </div>
          </div>
          <div class="form-container hidden" id="formState">
            <div class="form-errors"></div>
            <div class="profile-section">
              <div class="profile-upload">
                <label for="profilePic" class="profile-placeholder">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span>Add Photo (PNG/JPG)</span>
                </label>
                <input type="file" id="profilePic" accept="image/png,image/jpeg,image/jpg" class="hidden">
              </div>
              <div class="preview-container hidden">
                <img id="imagePreview" src="" alt="Profile preview">
                <button class="remove-image" id="removeImage">×</button>
              </div>
            </div>
            <div class="input-section">
              <input type="text" id="username" placeholder="Enter your name" maxlength="20">
            </div>
            <button class="start-chat-btn" disabled>
              Start Chatting
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    const popupContainer = document.createElement('div');
    popupContainer.innerHTML = popupHTML;
    document.body.appendChild(popupContainer);
  }

  function setupPopupInteractions() {
    const popup = document.getElementById('chatPopup');
    const header = popup.querySelector('.popup-header');
    const minimizeBtn = popup.querySelector('.minimize-btn');

    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    function dragMouseDown(e) {
      if (e.target !== header) return;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;

      let newTop = popup.offsetTop - pos2;
      let newLeft = popup.offsetLeft - pos1;

      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const popupWidth = popup.offsetWidth;
      const popupHeight = popup.offsetHeight;

      newLeft = Math.min(Math.max(0, newLeft), windowWidth - popupWidth);
      newTop = Math.min(Math.max(0, newTop), windowHeight - popupHeight);

      popup.style.top = newTop + "px";
      popup.style.left = newLeft + "px";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }

    header.onmousedown = dragMouseDown;

    window.addEventListener('resize', () => {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const popupWidth = popup.offsetWidth;
      const popupHeight = popup.offsetHeight;
      
      let currentLeft = parseInt(popup.style.left) || windowWidth - popupWidth - 20;
      let currentTop = parseInt(popup.style.top) || windowHeight - popupHeight - 20;

      if (currentLeft + popupWidth > windowWidth) {
        currentLeft = windowWidth - popupWidth - 20;
      }
      if (currentTop + popupHeight > windowHeight) {
        currentTop = windowHeight - popupHeight - 20;
      }

      popup.style.left = Math.max(0, currentLeft) + "px";
      popup.style.top = Math.max(0, currentTop) + "px";
    });

    if (!popup.style.left && !popup.style.top) {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const popupWidth = popup.offsetWidth;
      const popupHeight = popup.offsetHeight;
      popup.style.left = (windowWidth - popupWidth - 20) + 'px';
      popup.style.top = (windowHeight - popupHeight - 20) + 'px';
    }

    let isMinimized = false;
    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isMinimized = !isMinimized;
      popup.classList.toggle('minimized');
      minimizeBtn.textContent = isMinimized ? '+' : '−';

      if (isMinimized) {
        popup.classList.remove('expanded');
      } else if (document.getElementById('chatMessages')) {
        popup.classList.add('expanded');
      }
    });
  }

  function setupFormHandlers() {
    const fileInput = document.getElementById('profilePic');
    const imagePreview = document.getElementById('imagePreview');
    const previewContainer = document.querySelector('.preview-container');
    const profilePlaceholder = document.querySelector('.profile-placeholder');
    const removeImageBtn = document.getElementById('removeImage');
    const startChatBtn = document.querySelector('.start-chat-btn');
    const usernameInput = document.getElementById('username');

    function updateStartButtonState() {
      const hasUsername = usernameInput.value.trim().length > 0;
      startChatBtn.disabled = !hasUsername;
    }

    usernameInput.addEventListener('input', updateStartButtonState);

    fileInput.addEventListener('change', async function(e) {
      const file = e.target.files[0];
      if (!file) return;

      try {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          throw new Error('Only PNG and JPG images are allowed');
        }

        if (file.size > 3 * 1024 * 1024) {
          throw new Error('Image must be less than 3MB');
        }

        const reader = new FileReader();
        reader.onload = function(e) {
          const img = new Image();
          img.onload = function() {
            if (img.width < 100 || img.height < 100) {
              throw new Error('Image must be at least 100x100 pixels');
            }
            imagePreview.src = e.target.result;
            currentUserAvatar = e.target.result;
            previewContainer.classList.remove('hidden');
            profilePlaceholder.classList.add('hidden');
            updateStartButtonState();
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        clearFormErrors();
      } catch (error) {
        fileInput.value = '';
        showFormError(error.message);
        updateStartButtonState();
      }
    });

    removeImageBtn.addEventListener('click', function() {
      fileInput.value = '';
      imagePreview.src = '';
      currentUserAvatar = null;
      previewContainer.classList.add('hidden');
      profilePlaceholder.classList.remove('hidden');
      clearFormErrors();
      updateStartButtonState();
    });

    startChatBtn.addEventListener('click', async function() {
      const username = usernameInput.value.trim();
      if (!username) {
        showFormError('Please enter your name');
        return;
      }

      try {
        startChatBtn.disabled = true;
        const currentToken = document.querySelector('.site-url').textContent;
        await initializeChat(currentToken, username, currentUserAvatar);
        clearFormErrors();
      } catch (error) {
        showFormError(error.message);
        startChatBtn.disabled = false;
      }
    });
  }

  function showFormError(message) {
    const errorsContainer = document.querySelector('.form-errors');
    errorsContainer.innerHTML = `<div class="error-message">${message}</div>`;
    errorsContainer.style.display = 'block';
  }

  function clearFormErrors() {
    const errorsContainer = document.querySelector('.form-errors');
    errorsContainer.innerHTML = '';
    errorsContainer.style.display = 'none';
  }

  async function initializeChat(token, username, imageData) {
    try {
      const response = await fetch(`${API_URL}/api/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: token,
          username: username,
          image: imageData
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join chat');
      }

      currentUserAvatar = data.avatar;
      showChatInterface();

      if (data.history && data.history.length > 0) {
        const chatMessages = document.getElementById('chatMessages');
        data.history.forEach(message => {
          if (message.sender) {
            activeUsernames.add(message.sender);
          }
          displayMessage(message);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }

      connectWebSocket(data.ws_url);
    } catch (error) {
      console.error('Chat initialization error:', error);
      throw error;
    }
  }

  function connectWebSocket(wsUrl) {
    if (ws) {
      ws.close();
      ws = null;
    }

    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    try {
      const fullUrl = wsUrl.startsWith('wss://') ? wsUrl : `wss://backend.pumps.chat${wsUrl}`;
      
      ws = new WebSocket(fullUrl);

      ws.onopen = () => {
        ws.send(JSON.stringify({ 
          type: 'client_id', 
          clientId: CLIENT_ID 
        }));

        console.log('Connected to chat');
        document.getElementById('chatPopup').classList.add('expanded');

        heartbeatInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: '_ping' }));
          }
        }, 20000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'global_count') {
            const globalUsersElement = document.querySelector('.global-users span:last-child');
            if (globalUsersElement) {
              globalUsersElement.textContent = message.count;
            }
            return;
          }
          
          if (message.type !== '_ping' && message.type !== '_pong') {
            if (message.sender) {
              activeUsernames.add(message.sender);
            }
            displayMessage(message);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      ws.onclose = () => {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        console.log('Disconnected from chat');
        handleConnectionClosed();
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        handleConnectionError();
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      handleConnectionError();
    }
  }

  function handleConnectionClosed() {
    const formState = document.getElementById('formState');
    formState.innerHTML = `
      <div class="error-message">
        Connection lost. Please refresh to reconnect.
        <button onclick="window.location.reload()" class="reconnect-button">
          Refresh
        </button>
      </div>
    `;
    document.getElementById('chatPopup').classList.remove('expanded');
  }

  function handleConnectionError() {
    const formState = document.getElementById('formState');
    formState.innerHTML = `
      <div class="error-message">
        Connection error. Please try again.
        <button onclick="window.location.reload()" class="reconnect-button">
          Retry
        </button>
      </div>
    `;
  }

  function showChatInterface() {
    const formState = document.getElementById('formState');
    formState.innerHTML = `
      <div class="chat-messages" id="chatMessages"></div>
      <div class="chat-input-container">
        <input type="file" id="imageUpload" accept="image/png,image/jpeg,image/jpg" class="hidden">
        <label for="imageUpload" class="image-upload-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="m21 15-5-5L5 21"/>
          </svg>
        </label>
        <input type="text" id="messageInput" placeholder="Type a message..." maxlength="${MAX_MESSAGE_LENGTH}">
        <div class="char-counter">0/${MAX_MESSAGE_LENGTH}</div>
        <button id="sendButton">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    `;

    setupImageUpload();
    setupCharacterCounter();
  }

  function setupCharacterCounter() {
    const messageInput = document.getElementById('messageInput');
    const charCounter = document.querySelector('.char-counter');

    messageInput.addEventListener('input', () => {
      const length = messageInput.value.length;
      charCounter.textContent = `${length}/${MAX_MESSAGE_LENGTH}`;
      
      if (length >= MAX_MESSAGE_LENGTH) {
        charCounter.classList.add('limit-reached');
      } else {
        charCounter.classList.remove('limit-reached');
      }
    });
  }

  function setupImageUpload() {
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const imageUpload = document.getElementById('imageUpload');
    
    const previewContainer = document.createElement('div');
    previewContainer.className = 'image-preview-container hidden';
    messageInput.parentElement.insertBefore(previewContainer, messageInput);

    const dragOverlay = document.createElement('div');
    dragOverlay.className = 'drag-overlay hidden';
    dragOverlay.innerHTML = `
      <div class="drag-overlay-content">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="m21 15-5-5L5 21"/>
        </svg>
        <span>Drop PNG/JPG image to share</span>
      </div>
    `;
    document.getElementById('chatPopup').appendChild(dragOverlay);

    chatMessages.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragOverlay.classList.remove('hidden');
    });

    dragOverlay.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragOverlay.classList.add('hidden');
    });

    dragOverlay.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    dragOverlay.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragOverlay.classList.add('hidden');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
          await handleImageUpload(file);
        } else {
          showFormError('Only PNG and JPG images are allowed');
        }
      }
    });

    imageUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
          await handleImageUpload(file);
        } else {
          showFormError('Only PNG and JPG images are allowed');
          imageUpload.value = '';
        }
      }
    });

    async function handleImageUpload(file) {
      if (file.size > 5 * 1024 * 1024) {
        showFormError('Image must be less than 5MB');
        return;
      }

      sendButton.disabled = true;

      try {
        const reader = new FileReader();
        reader.onload = function(e) {
          previewContainer.innerHTML = `
            <div class="image-preview">
              <img src="${e.target.result}" alt="Upload preview">
              <button class="remove-preview">×</button>
              <div class="start-upload-progress">
                <div class="upload-progress"></div>
              </div>
            </div>
          `;
          previewContainer.classList.remove('hidden');

          const progress = previewContainer.querySelector('.upload-progress');
          let width = 0;
          const interval = setInterval(() => {
            if (width >= 90) clearInterval(interval);
            width = Math.min(90, width + 5);
            progress.style.width = width + '%';
            progress.setAttribute('data-progress', Math.round(width));
          }, 100);

          previewContainer.querySelector('.remove-preview').onclick = () => {
            clearInterval(interval);
            previewContainer.innerHTML = '';
            previewContainer.classList.add('hidden');
            sendButton.disabled = false;
            imageUpload.value = '';
          };

          setTimeout(() => {
            clearInterval(interval);
            progress.style.width = '100%';
            progress.setAttribute('data-progress', '100');
            sendButton.disabled = false;
          }, 2000);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Image preview error:', error);
        showFormError('Failed to load image');
        sendButton.disabled = false;
        imageUpload.value = '';
      }
    }

    async function sendMessage() {
      const message = messageInput.value.trim();
      const imagePreview = previewContainer.querySelector('img');
      
      if ((!message && !imagePreview) || ws?.readyState !== WebSocket.OPEN) return;
      if (message.length > MAX_MESSAGE_LENGTH) return;
      
      try {
        const payload = {
          content: message,
          image: imagePreview ? imagePreview.src : null
        };
        
        ws.send(JSON.stringify(payload));
        messageInput.value = '';
        previewContainer.innerHTML = '';
        previewContainer.classList.add('hidden');
        imageUpload.value = '';
        document.querySelector('.char-counter').textContent = `0/${MAX_MESSAGE_LENGTH}`;
        
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      } catch (error) {
        console.error('Send message error:', error);
      }
    }

    sendButton.onclick = sendMessage;
    messageInput.onkeypress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };
  }

  function displayMessage(message) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${message.type}`;
    
    if (message.type === 'system') {
      messageElement.innerHTML = `
        <div class="system-message">${message.content}</div>
      `;
    } else {
      const avatarSrc = message.avatar ? 
        (message.avatar.startsWith('http') ? message.avatar : `${API_URL}${message.avatar}`) 
        : createDefaultAvatar(message.sender);

      const imageUrl = message.image ? 
        (message.image.startsWith('http') ? message.image : `${API_URL}${message.image}`)
        : null;

      const formattedContent = message.content ? formatMessageContent(message.content, activeUsernames) : '';

      messageElement.innerHTML = `
        <div class="message-avatar">
          <img src="${avatarSrc}" alt="${message.sender}" onerror="this.src='${createDefaultAvatar(message.sender)}'">
        </div>
        <div class="message-content-wrapper">
          <div class="message-header">
            <span class="message-sender">${message.sender}</span>
            <span class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</span>
          </div>
          ${formattedContent ? `<div class="message-text">${formattedContent}</div>` : ''}
          ${imageUrl ? `
            <div class="message-image spoiler">
              <div class="spoiler-overlay">
                <span>Click to reveal image</span>
              </div>
              <img src="${imageUrl}" alt="Shared image" loading="lazy">
            </div>
          ` : ''}
        </div>
      `;

      const currentUsername = document.getElementById('username')?.value;
      if (currentUsername && message.content?.includes(`@${currentUsername}`)) {
        playMentionSound();
      }

      if (imageUrl) {
        const imageContainer = messageElement.querySelector('.message-image');
        imageContainer.addEventListener('click', function() {
          if (this.classList.contains('spoiler')) {
            this.classList.remove('spoiler');
          }
        });
      }
    }

    messagesContainer.appendChild(messageElement);
    
    const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 100;
    const isOwnMessage = message.sender === document.getElementById('username')?.value;
    
    if (isOwnMessage || isAtBottom) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function createDefaultAvatar(username) {
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" fill="#001a11"/>
        <text x="50%" y="50%" font-family="Arial" font-size="16" fill="#00ff9d" text-anchor="middle" dy=".3em">
          ${username.charAt(0).toUpperCase()}
        </text>
      </svg>
    `)}`;
  }

  function findAndProcessToken() {
    const currentUrl = window.location.href;
    let token = null;

    if (currentUrl.includes('photon-sol.tinyastro.io')) {
      const tokenLinks = Array.from(document.querySelectorAll('a')).filter(a => 
        a.textContent.trim() === 'Token' || 
        a.textContent.includes('Token:')
      );

      tokenLinks.forEach(tokenLink => {
        let container = tokenLink.closest('.p-show__bar__link')?.parentElement;
        if (container) {
          const addressElement = container.querySelector('[data-address]');
          if (addressElement) {
            token = addressElement.getAttribute('data-address');
          }
        }
      });
    } else if (currentUrl.includes('bullx.io')) {
      const addressMatch = currentUrl.match(/address=([^&]+)/);
      if (addressMatch) {
        token = addressMatch[1];
      }
    } else if (currentUrl.includes('pump.fun/coin/')) {
      const matches = currentUrl.match(/pump\.fun\/coin\/(.+)/);
      if (matches) {
        token = matches[1];
      }
    }

    if (token && !processedTokens.has(token)) {
      processedTokens.add(token);
      showFormState(token);
    }
  }

  function showFormState(token) {
    const loadingState = document.getElementById('loadingState');
    const formState = document.getElementById('formState');
    const siteUrl = document.querySelector('.site-url');
    
    loadingState.classList.add('hidden');
    
    setTimeout(() => {
      siteUrl.textContent = token;
      formState.classList.remove('hidden');
      requestAnimationFrame(() => {
        formState.classList.add('show');
      });
    }, 300);
  }

  // Initialize
  createChatPopup();
  findAndProcessToken();

  // Monitor URL changes
  let lastUrl = window.location.href;
  setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      findAndProcessToken();
    }
  }, 1000);

  // Monitor DOM changes
  const observer = new MutationObserver(() => {
    findAndProcessToken();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

 // Setup form handlers after DOM is ready
  setTimeout(() => {
    setupPopupInteractions();
    setupFormHandlers();
  }, 0);

  // Cleanup on window close
  window.addEventListener('beforeunload', () => {
    if (ws) {
      ws.close(1000, 'Page closed');
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  });

  // Handle user joins/leaves
  function handleUserJoin(username) {
    activeUsernames.add(username);
  }

  function handleUserLeave(username) {
    activeUsernames.delete(username);
  }
})();