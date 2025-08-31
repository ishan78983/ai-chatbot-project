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
    let chats = {};
    let currentChatId = null;

    // --- INITIALIZATION ---
    loadDarkMode();
    loadChats();
    setupEventListeners();
    
    // Configure marked.js to use highlight.js for code blocks
    marked.setOptions({
        highlight: function(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        breaks: true, // Convert single line breaks to <br>
    });
    
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
        
        userInput.addEventListener('input', () => {
            userInput.style.height = 'auto';
            userInput.style.height = (userInput.scrollHeight) + 'px';
        });

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

    // --- LOCAL STORAGE & HISTORY ---
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
        appendMessage('bot', 'A new conversation has started. How can I assist you today?');
        renderHistoryList();
        saveChats();
    }

    function loadChat(chatId) {
        if (!chats[chatId]) return;
        currentChatId = chatId;
        messageList.innerHTML = '';
        chats[currentChatId].history.forEach(turn => {
            const sender = turn.role === 'user' ? 'user' : 'bot';
            const messageData = turn.parts[0]; // The object containing text, image_base64, etc.

            if (messageData.image_base64) {
                 appendMessage(sender, messageData.text);
                 appendImageMessage(messageData.image_base64);
            } else {
                 appendMessage(sender, messageData.text);
            }
        });
        renderHistoryList();
    }

    // --- CHAT LOGIC ---
    async function handleFormSubmit(e) {
        e.preventDefault();
        const message = userInput.value.trim();
        if (!message) return;

        const userMessageData = { role: 'user', parts: [{ text: message }] };
        appendMessage('user', message);
        chats[currentChatId].history.push(userMessageData);

        if (chats[currentChatId].history.length === 1) {
            chats[currentChatId].title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
            renderHistoryList();
        }
        
        userInput.value = '';
        userInput.style.height = 'auto';
        const typingIndicator = showTypingIndicator();

        try {
            const response = await fetch('http://127.0.0.1:5000/api/generate', { // MAKE SURE THIS IS YOUR BACKEND URL
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: chats[currentChatId].history })
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            
            const data = await response.json();
            typingIndicator.remove();
            
            // This object will store all parts of the model's response
            const modelResponseParts = { text: "" };

            if (data.text_response) {
                appendMessage('bot', data.text_response);
                modelResponseParts.text = data.text_response;
            }
            if (data.image_base64) {
                appendImageMessage(data.image_base64);
                modelResponseParts.image_base64 = data.image_base64;
            }
            
            // Save the complete model response to history
            chats[currentChatId].history.push({ role: 'model', parts: [modelResponseParts] });
            saveChats();

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
        
        // **NEW**: Render text through marked.js
        const renderedText = marked.parse(text);

        const messageElement = document.createElement('div');
        messageElement.className = `message-container ${sender}`;
        messageElement.innerHTML = `<div class="avatar ${avatarBg}">${avatarSVG}</div><div class="chat-bubble">${renderedText}</div>`;
        
        messageList.appendChild(messageElement);
        
        // **NEW**: Add copy buttons to any new code blocks
        addCopyButtons(messageElement);
        
        messageList.scrollTop = messageList.scrollHeight;
    }

    function appendImageMessage(base64Image) {
        const avatarSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5.8 13.3 3.5-3.5a2.1 2.1 0 0 1 3 0l3.5 3.5a2.1 2.1 0 0 1 0 3l-3.5 3.5a2.1 2.1 0 0 1-3 0l-3.5-3.5a2.1 2.1 0 0 1 0-3Z"></path></svg>`;
        // **CHANGED**: Use base64 data URI for the image source
        const messageHTML = `<div class="message-container bot"><div class="avatar bg-indigo-500">${avatarSVG}</div><div class="chat-bubble image-bubble"><img src="data:image/png;base64,${base64Image}" alt="Generated image"></div></div>`;
        messageList.insertAdjacentHTML('beforeend', messageHTML);
        messageList.scrollTop = messageList.scrollHeight;
    }

    // **NEW**: Function to find code blocks and add copy buttons
    function addCopyButtons(element) {
        const codeBlocks = element.querySelectorAll('pre');
        codeBlocks.forEach(block => {
            const btn = document.createElement('button');
            btn.className = 'copy-btn';
            btn.textContent = 'Copy';
            btn.onclick = () => {
                const code = block.querySelector('code').innerText;
                navigator.clipboard.writeText(code).then(() => {
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
                });
            };
            block.appendChild(btn);
        });
    }
    
    function showTypingIndicator() {
        const typingHTML = `<div class="message-container bot typing-indicator"><div class="avatar bg-indigo-500"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5.8 13.3 3.5-3.5a2.1 2.1 0 0 1 3 0l3.5 3.5a2.1 2.1 0 0 1 0 3l-3.5 3.5a2.1 2.1 0 0 1-3 0l-3.5-3.5a2.1 2.1 0 0 1 0-3Z"></path></svg></div><div class="chat-bubble"><div class="flex items-center gap-2"><div class="w-2 h-2 bg-indigo-300 rounded-full animate-pulse [animation-delay:-0.3s]"></div><div class="w-2 h-2 bg-indigo-300 rounded-full animate-pulse [animation-delay:-0.15s]"></div><div class="w-2 h-2 bg-indigo-300 rounded-full animate-pulse"></div></div></div></div>`;
        messageList.insertAdjacentHTML('beforeend', typingHTML);
        const indicator = messageList.querySelector('.typing-indicator');
        messageList.scrollTop = messageList.scrollHeight;
        return indicator;
    }
});