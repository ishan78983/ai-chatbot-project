document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENT SELECTORS ---
    const darkModeToggle = document.getElementById('darkModeToggle');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const messageList = document.getElementById('message-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const historyList = document.getElementById('history-list');
    const clearAllBtn = document.getElementById('clear-all-btn');
    
    // --- STATE MANAGEMENT ---
    let chats = {}; // Object to hold all chat histories, e.g., { "chat_123": { title: "...", history: [] } }
    let currentChatId = null;

    // --- INITIALIZATION ---
    loadDarkMode();
    loadChats();
    setupEventListeners();
    
    // Check if any chats exist. If not, start a new one. Otherwise, load the most recent.
    if (Object.keys(chats).length === 0) {
        startNewChat();
    } else {
        const latestChatId = Object.keys(chats).sort().pop();
        loadChat(latestChatId);
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        darkModeToggle.addEventListener('change', toggleDarkMode);
        chatForm.addEventListener('submit', handleFormSubmit);
        newChatBtn.addEventListener('click', startNewChat);
        clearAllBtn.addEventListener('click', () => {
             if (confirm("Are you sure you want to delete ALL chat history? This cannot be undone.")) {
                localStorage.removeItem('aiChats');
                chats = {};
                startNewChat();
             }
        });
        
        // Auto-resize textarea
        userInput.addEventListener('input', () => {
            userInput.style.height = 'auto';
            userInput.style.height = (userInput.scrollHeight) + 'px';
        });

        // Submit on Enter key, but allow new line with Shift+Enter
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                chatForm.dispatchEvent(new Event('submit'));
            }
        });
    }

    // --- THEME ---
    function loadDarkMode() {
        if (localStorage.getItem('darkMode') === 'enabled') {
            document.documentElement.classList.add('dark');
            darkModeToggle.checked = true;
        }
    }
    function toggleDarkMode() {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('darkMode', document.documentElement.classList.contains('dark') ? 'enabled' : 'disabled');
    }

    // --- LOCAL STORAGE & HISTORY MANAGEMENT ---
    function saveChats() {
        localStorage.setItem('aiChats', JSON.stringify(chats));
    }

    function loadChats() {
        const savedChats = localStorage.getItem('aiChats');
        chats = savedChats ? JSON.parse(savedChats) : {};
        renderHistoryList();
    }
    
    function renderHistoryList() {
        historyList.innerHTML = '';
        Object.keys(chats).sort().reverse().forEach(chatId => {
            const historyItem = document.createElement('button');
            historyItem.className = `history-item ${chatId === currentChatId ? 'active' : ''}`;
            historyItem.textContent = chats[chatId].title;
            historyItem.dataset.chatId = chatId;
            historyItem.onclick = () => loadChat(chatId);
            historyList.appendChild(historyItem);
        });
    }

    function startNewChat() {
        currentChatId = `chat_${Date.now()}`;
        chats[currentChatId] = {
            title: "New Conversation",
            history: []
        };
        messageList.innerHTML = '';
        appendMessage('bot', 'A new conversation has started. How can I help?');
        renderHistoryList();
        saveChats();
    }

    function loadChat(chatId) {
        if (!chats[chatId]) return;
        currentChatId = chatId;
        messageList.innerHTML = '';
        chats[currentChatId].history.forEach(turn => {
            const sender = turn.role === 'user' ? 'user' : 'bot';
            // Simple check to see if the content is an image URL to render it correctly on load
            if (turn.parts[0].text.startsWith('!image')) {
                 const imageUrl = turn.parts[0].text.replace('!image', '');
                 appendImageMessage(imageUrl);
            } else {
                 appendMessage(sender, turn.parts[0].text);
            }
        });
        renderHistoryList();
    }

    // --- CHAT LOGIC ---
    async function handleFormSubmit(e) {
        e.preventDefault();
        const message = userInput.value.trim();
        if (!message) return;

        // Add user message to UI and current chat history
        appendMessage('user', message);
        chats[currentChatId].history.push({ role: 'user', parts: [{ text: message }] });

        // Update title of chat if it's the first user message
        if (chats[currentChatId].history.length === 1) {
            chats[currentChatId].title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
            renderHistoryList();
        }
        
        userInput.value = '';
        userInput.style.height = 'auto';
        const typingIndicator = showTypingIndicator();

        try {
            const response = await fetch('http://localhost:5000/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: chats[currentChatId].history })
            });
            if (!response.ok) throw new Error('Server responded with an error.');
            
            const data = await response.json();
            typingIndicator.remove();

            if (data.text_response) {
                appendMessage('bot', data.text_response);
                chats[currentChatId].history.push({ role: 'model', parts: [{ text: data.text_response }] });
            }
            if (data.image_url) {
                appendImageMessage(data.image_url);
                // Save a placeholder in history to know it was an image
                chats[currentChatId].history.push({ role: 'model', parts: [{ text: `!image${data.image_url}` }] });
            }
            saveChats(); // Save after each successful interaction

        } catch (error) {
            typingIndicator.remove();
            appendMessage('bot', `Sorry, I ran into a problem: ${error.message}`);
        }
    }
    
    function appendMessage(sender, text) {
        const avatarSVG = sender === 'bot' ? 
            `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5.8 13.3 3.5-3.5a2.1 2.1 0 0 1 3 0l3.5 3.5a2.1 2.1 0 0 1 0 3l-3.5 3.5a2.1 2.1 0 0 1-3 0l-3.5-3.5a2.1 2.1 0 0 1 0-3Z"></path></svg>` : 
            `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        const avatarBg = sender === 'bot' ? 'bg-indigo-500' : 'bg-pink-500';
        const messageHTML = `<div class="message-container ${sender}"><div class="avatar ${avatarBg}">${avatarSVG}</div><div class="chat-bubble">${text}</div></div>`;
        messageList.insertAdjacentHTML('beforeend', messageHTML);
        messageList.scrollTop = messageList.scrollHeight;
    }

    function appendImageMessage(imageUrl) {
        const avatarSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5.8 13.3 3.5-3.5a2.1 2.1 0 0 1 3 0l3.5 3.5a2.1 2.1 0 0 1 0 3l-3.5 3.5a2.1 2.1 0 0 1-3 0l-3.5-3.5a2.1 2.1 0 0 1 0-3Z"></path></svg>`;
        const messageHTML = `<div class="message-container bot"><div class="avatar bg-indigo-500">${avatarSVG}</div><div class="chat-bubble image-bubble"><img src="${imageUrl}" alt="Generated image"></div></div>`;
        messageList.insertAdjacentHTML('beforeend', messageHTML);
        messageList.scrollTop = messageList.scrollHeight;
    }
    
    function showTypingIndicator() {
        const typingHTML = `<div class="message-container bot typing-indicator"><div class="avatar bg-indigo-500"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5.8 13.3 3.5-3.5a2.1 2.1 0 0 1 3 0l3.5 3.5a2.1 2.1 0 0 1 0 3l-3.5 3.5a2.1 2.1 0 0 1-3 0l-3.5-3.5a2.1 2.1 0 0 1 0-3Z"></path></svg></div><div class="chat-bubble"><div class="flex items-center gap-2"><div class="w-2 h-2 bg-indigo-300 rounded-full animate-pulse [animation-delay:-0.3s]"></div><div class="w-2 h-2 bg-indigo-300 rounded-full animate-pulse [animation-delay:-0.15s]"></div><div class="w-2 h-2 bg-indigo-300 rounded-full animate-pulse"></div></div></div></div>`;
        messageList.insertAdjacentHTML('beforeend', typingHTML);
        const indicator = messageList.querySelector('.typing-indicator');
        messageList.scrollTop = messageList.scrollHeight;
        return indicator;
    }
});