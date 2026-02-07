(async function () {
  const statusEl = document.getElementById("status");
  const setupGuide = document.getElementById("setup-guide");
  const chatMessages = document.getElementById("chat-messages");
  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");
  const voiceButton = document.getElementById("voice-button");

  let session = null;
  let isGenerating = false;

  // --- Status helpers ---

  function setStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = "status" + (type ? " " + type : "");
  }

  function showSetupGuide() {
    setupGuide.classList.remove("hidden");
  }

  // --- Message UI helpers ---

  function addMessage(role, text) {
    const msg = document.createElement("div");
    msg.className = "message " + role;

    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = role === "user" ? "あなた" : "Gemini Nano";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = text;

    msg.appendChild(label);
    msg.appendChild(bubble);
    chatMessages.appendChild(msg);
    scrollToBottom();
    return bubble;
  }

  function addTypingIndicator() {
    const msg = document.createElement("div");
    msg.className = "message ai";
    msg.id = "typing-indicator";

    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = "Gemini Nano";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    const dots = document.createElement("div");
    dots.className = "typing-indicator";
    dots.innerHTML = "<span></span><span></span><span></span>";

    bubble.appendChild(dots);
    msg.appendChild(label);
    msg.appendChild(bubble);
    chatMessages.appendChild(msg);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const el = document.getElementById("typing-indicator");
    if (el) el.remove();
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // --- Textarea auto-resize ---

  messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px";
  });

  // --- Send message ---

  async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isGenerating) return;

    isGenerating = true;
    sendButton.disabled = true;
    messageInput.disabled = true;
    voiceButton.disabled = true;

    addMessage("user", text);
    messageInput.value = "";
    messageInput.style.height = "auto";

    addTypingIndicator();

    try {
      const stream = await session.promptStreaming(text);
      removeTypingIndicator();
      const bubble = addMessage("ai", "");
      let fullText = "";

      for await (const chunk of stream) {
        fullText += chunk;
        bubble.textContent = fullText;
        scrollToBottom();
      }
    } catch (err) {
      removeTypingIndicator();
      console.error("Prompt error:", err);

      if (err.name === "NotReadableError" || err.message?.includes("session")) {
        addMessage("error", "セッションエラーが発生しました。ページを再読み込みしてください。");
      } else {
        addMessage("error", "エラー: " + err.message);
      }
    } finally {
      isGenerating = false;
      sendButton.disabled = false;
      messageInput.disabled = false;
      voiceButton.disabled = false;
      messageInput.focus();
    }
  }

  // --- Event listeners ---

  sendButton.addEventListener("click", sendMessage);

  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // --- Voice input ---

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "ja-JP";

    let isListening = false;
    let textBeforeVoice = "";

    voiceButton.addEventListener("click", () => {
      if (isListening) {
        recognition.stop();
      } else {
        textBeforeVoice = messageInput.value;
        recognition.start();
        isListening = true;
        voiceButton.classList.add("listening");
      }
    });

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      messageInput.value = textBeforeVoice + transcript;
      messageInput.dispatchEvent(new Event("input"));
    };

    recognition.onend = () => {
      isListening = false;
      voiceButton.classList.remove("listening");
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      isListening = false;
      voiceButton.classList.remove("listening");
    };
  } else {
    voiceButton.style.display = "none";
  }

  // --- Initialization ---

  async function init() {
    // Check API availability (new global LanguageModel API, with fallback to legacy self.ai.languageModel)
    const api =
      typeof LanguageModel !== "undefined" ? LanguageModel :
      self.ai?.languageModel ? self.ai.languageModel :
      null;

    if (!api) {
      setStatus("API未対応", "error");
      showSetupGuide();
      return;
    }

    setStatus("確認中...", "");

    let availability;
    try {
      availability = await api.availability();
    } catch (err) {
      setStatus("APIエラー", "error");
      showSetupGuide();
      console.error("Availability check failed:", err);
      return;
    }

    if (availability === "unavailable") {
      setStatus("モデル未対応", "error");
      showSetupGuide();
      return;
    }

    if (availability === "downloadable" || availability === "downloading") {
      setStatus("モデルダウンロード中...", "downloading");
    }

    // Create session
    try {
      session = await api.create({
        systemPrompt:
          "あなたは親切なAIアシスタントです。日本語で回答してください。",
        monitor(m) {
          m.addEventListener("downloadprogress", (e) => {
            const pct = Math.round((e.loaded / e.total) * 100);
            setStatus("ダウンロード中 " + pct + "%", "downloading");
          });
        },
      });
    } catch (err) {
      setStatus("セッション作成失敗", "error");
      showSetupGuide();
      console.error("Session creation failed:", err);
      return;
    }

    setStatus("Ready", "ready");
    messageInput.disabled = false;
    sendButton.disabled = false;
    voiceButton.disabled = false;
    messageInput.focus();
  }

  init();
})();
