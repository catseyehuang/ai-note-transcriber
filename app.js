// --- App Initialization & State Management ---
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();
  
  // Set Marked options for line breaks
  if (typeof marked !== 'undefined') {
    if (typeof marked.setOptions === 'function') {
      marked.setOptions({ breaks: true, gfm: true });
    } else if (typeof marked.use === 'function') {
      marked.use({ breaks: true, gfm: true });
    }
  }
  
  // App State
  const state = {
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    recordingInterval: null,
    mediaRecorder: null,
    audioChunks: [],
    audioContext: null,
    analyser: null,
    dataArray: null,
    bufferLength: 0,
    audioBlob: null,
    audioUrl: null,
    activeTab: 'preview', // 'preview' | 'editor'
    apiKey: localStorage.getItem('notes_assistant_api_key') || '',
    
    // Sessions list
    sessions: JSON.parse(localStorage.getItem('notes_assistant_sessions')) || [],
    currentSessionId: localStorage.getItem('notes_assistant_current_session_id') || '',
    
    // Active session being renamed
    sessionToRename: null
  };

  // --- DOM Elements ---
  const DOM = {
    // Header
    btnToggleConfig: document.getElementById('btn-toggle-config'),
    btnToggleHelp: document.getElementById('btn-toggle-help'),
    apiConfigPanel: document.getElementById('api-config-panel'),
    helpModal: document.getElementById('help-modal'),
    btnCloseHelp: document.getElementById('btn-close-help'),
    
    // API Config Drawer
    geminiApiKeyInput: document.getElementById('gemini-api-key'),
    btnToggleKeyVisibility: document.getElementById('btn-toggle-key-visibility'),
    eyeIcon: document.getElementById('eye-icon'),
    btnSaveApiKey: document.getElementById('btn-save-api-key'),
    apiStatusText: document.getElementById('api-status-text'),
    
    // Audio Recorder
    recorderStatus: document.getElementById('recorder-status'),
    recorderStatusText: document.getElementById('recorder-status-text'),
    waveformCanvas: document.getElementById('waveform-canvas'),
    recordingTimer: document.getElementById('recording-timer'),
    btnStartRecord: document.getElementById('btn-start-record'),
    btnPauseRecord: document.getElementById('btn-pause-record'),
    btnStopRecord: document.getElementById('btn-stop-record'),
    
    // Playback Box
    audioPlaybackContainer: document.getElementById('audio-playback-container'),
    audioFileSize: document.getElementById('audio-file-size'),
    audioPlayer: document.getElementById('audio-player'),
    btnDownloadAudio: document.getElementById('btn-download-audio'),
    
    // Transcript Area
    saveStatusText: document.getElementById('save-status-text'),
    dictationNoticeBanner: document.getElementById('dictation-notice-banner'),
    transcriptTextarea: document.getElementById('transcript-textarea'),
    metricChars: document.getElementById('metric-chars'),
    metricReadTime: document.getElementById('metric-read-time'),
    btnClearTranscript: document.getElementById('btn-clear-transcript'),
    btnDownloadTranscript: document.getElementById('btn-download-transcript'),
    btnCopyTranscript: document.getElementById('btn-copy-transcript'),
    
    // AI Settings
    selectNoteStyle: document.getElementById('select-note-style'),
    customInstruction: document.getElementById('custom-instruction'),
    btnCopyPrompt: document.getElementById('btn-copy-prompt'),
    btnGenerateNotes: document.getElementById('btn-generate-notes'),
    
    // Preview / Editor
    tabPreview: document.getElementById('tab-preview'),
    tabEditor: document.getElementById('tab-editor'),
    btnCopyNotes: document.getElementById('btn-copy-notes'),
    btnDownloadNotes: document.getElementById('btn-download-notes'),
    aiLoadingOverlay: document.getElementById('ai-loading-overlay'),
    loadingStatusText: document.getElementById('loading-status-text'),
    notesPreviewArea: document.getElementById('notes-preview-area'),
    notesEditorArea: document.getElementById('notes-editor-area'),
    toastContainer: document.getElementById('toast-container'),
    
    // Sidebar Session controls
    btnNewSession: document.getElementById('btn-new-session'),
    sessionList: document.getElementById('session-list'),
    
    // Rename Modal controls
    renameModal: document.getElementById('rename-modal'),
    renameInput: document.getElementById('rename-input'),
    btnCloseRename: document.getElementById('btn-close-rename'),
    btnCancelRename: document.getElementById('btn-cancel-rename'),
    btnConfirmRename: document.getElementById('btn-confirm-rename')
  };

  // Canvas context
  const canvasCtx = DOM.waveformCanvas.getContext('2d');
  
  // --- Initialize Session list ---
  if (state.sessions.length === 0) {
    const defaultSession = {
      id: 'session_' + Date.now(),
      title: '新會話',
      transcript: '',
      aiNotes: '',
      style: 'structured',
      customInstruction: '',
      created: Date.now()
    };
    state.sessions.push(defaultSession);
    state.currentSessionId = defaultSession.id;
    saveSessions();
  } else if (!state.sessions.some(s => s.id === state.currentSessionId)) {
    state.currentSessionId = state.sessions[0].id;
  }

  // --- Initialize App UI from Saved State ---
  if (state.apiKey) {
    DOM.geminiApiKeyInput.value = state.apiKey;
    updateApiStatusUI(true);
  } else {
    updateApiStatusUI(false);
  }

  // Load active session data
  loadSessionToUI(getCurrentSession());

  // Render sidebar
  updateSidebarUI();

  // Set initial canvas size
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Start Idle Animation
  let idleAnimationId;
  let wavePhase = 0;
  function animateIdleWave() {
    if (!state.isRecording) {
      drawIdleWave();
      idleAnimationId = requestAnimationFrame(animateIdleWave);
    }
  }
  animateIdleWave();

  // --- Toast Notification System ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle-2';
    if (type === 'warning') iconName = 'alert-triangle';
    if (type === 'error') iconName = 'alert-circle';
    
    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <span>${message}</span>
    `;
    
    DOM.toastContainer.appendChild(toast);
    lucide.createIcons({ attrs: { class: 'toast-icon' } });
    
    // Fade out and remove
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(1rem)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => {
        toast.remove();
      }, 250);
    }, 3500);
  }

  // --- Canvas Waveform Rendering Helpers ---
  function resizeCanvas() {
    const rect = DOM.waveformCanvas.parentElement.getBoundingClientRect();
    DOM.waveformCanvas.width = rect.width;
    DOM.waveformCanvas.height = rect.height || 120;
  }

  function drawIdleWave() {
    const width = DOM.waveformCanvas.width;
    const height = DOM.waveformCanvas.height;
    const midY = height / 2;
    
    canvasCtx.clearRect(0, 0, width, height);
    
    wavePhase += 0.04;
    for (let w = 0; w < 3; w++) {
      canvasCtx.beginPath();
      canvasCtx.lineWidth = w === 0 ? 2 : 1;
      canvasCtx.strokeStyle = w === 0 
        ? 'rgba(6, 182, 212, 0.45)' 
        : (w === 1 ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)');
      
      const amplitude = 10 - w * 3;
      const frequency = 0.015 + w * 0.005;
      
      for (let x = 0; x < width; x++) {
        const y = midY + Math.sin(x * frequency + wavePhase + (w * Math.PI / 3)) * amplitude;
        if (x === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
      }
      canvasCtx.stroke();
    }
  }

  function drawRecordingWave() {
    if (!state.isRecording) return;
    
    requestAnimationFrame(drawRecordingWave);
    
    const width = DOM.waveformCanvas.width;
    const height = DOM.waveformCanvas.height;
    const midY = height / 2;
    
    if (state.isPaused) {
      // If paused, just draw a flat line or standard subtle wave
      canvasCtx.clearRect(0, 0, width, height);
      canvasCtx.beginPath();
      canvasCtx.moveTo(0, midY);
      canvasCtx.lineTo(width, midY);
      canvasCtx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
      canvasCtx.lineWidth = 2;
      canvasCtx.stroke();
      return;
    }

    state.analyser.getByteFrequencyData(state.dataArray);
    
    canvasCtx.fillStyle = 'rgba(11, 13, 19, 0.4)';
    canvasCtx.fillRect(0, 0, width, height);
    
    // Draw mirrored visualizer frequency bars
    const barCount = 48;
    const barWidth = (width / barCount) * 0.75;
    const spacing = (width / barCount) * 0.25;
    
    for (let i = 0; i < barCount; i++) {
      // Map frequency array indexes
      const dataIndex = Math.floor((i / barCount) * state.bufferLength * 0.6);
      const value = state.dataArray[dataIndex] || 0;
      
      // Calculate normalized height (max 80% of canvas)
      const barHeight = (value / 255) * height * 0.75;
      const x = i * (barWidth + spacing) + spacing / 2;
      
      // Dynamic colors (gradient transitions from left to right)
      const ratio = i / barCount;
      const r = Math.floor(139 - ratio * 100);
      const g = Math.floor(92 + ratio * 100);
      const b = 246;
      
      canvasCtx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
      
      // Draw centered bar
      canvasCtx.fillRect(x, midY - barHeight / 2, barWidth, barHeight);
    }
  }

  // --- API Configuration Drawer Toggle & Storage ---
  DOM.btnToggleConfig.addEventListener('click', () => {
    DOM.apiConfigPanel.classList.toggle('collapsed');
  });

  DOM.btnToggleHelp.addEventListener('click', () => {
    DOM.helpModal.classList.add('active');
  });

  DOM.btnCloseHelp.addEventListener('click', () => {
    DOM.helpModal.classList.remove('active');
  });

  // Close help modal on clicking overlay
  DOM.helpModal.addEventListener('click', (e) => {
    if (e.target === DOM.helpModal) {
      DOM.helpModal.classList.remove('active');
    }
  });

  // --- Rename Modal Actions ---
  const closeRenameModal = () => {
    DOM.renameModal.classList.remove('active');
    state.sessionToRename = null;
  };

  DOM.btnCloseRename.addEventListener('click', closeRenameModal);
  DOM.btnCancelRename.addEventListener('click', closeRenameModal);
  
  DOM.renameModal.addEventListener('click', (e) => {
    if (e.target === DOM.renameModal) {
      closeRenameModal();
    }
  });

  const handleConfirmRename = () => {
    const newTitle = DOM.renameInput.value.trim();
    if (!newTitle) {
      showToast('會話名稱不能為空！', 'warning');
      return;
    }
    
    if (state.sessionToRename) {
      state.sessionToRename.title = newTitle;
      saveSessions();
      updateSidebarUI();
      showToast('會話名稱已成功修改！', 'success');
      closeRenameModal();
    }
  };

  DOM.btnConfirmRename.addEventListener('click', handleConfirmRename);

  DOM.renameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmRename();
    } else if (e.key === 'Escape') {
      closeRenameModal();
    }
  });

  DOM.btnToggleKeyVisibility.addEventListener('click', () => {
    if (DOM.geminiApiKeyInput.type === 'password') {
      DOM.geminiApiKeyInput.type = 'text';
      DOM.eyeIcon.setAttribute('data-lucide', 'eye-off');
    } else {
      DOM.geminiApiKeyInput.type = 'password';
      DOM.eyeIcon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
  });

  DOM.btnSaveApiKey.addEventListener('click', () => {
    const key = DOM.geminiApiKeyInput.value.trim();
    state.apiKey = key;
    localStorage.setItem('notes_assistant_api_key', key);
    
    if (key) {
      updateApiStatusUI(true);
      showToast('Gemini API Key 已儲存成功！', 'success');
      DOM.apiConfigPanel.classList.add('collapsed');
    } else {
      updateApiStatusUI(false);
      showToast('已清除 API Key。工具將降級為手動複製提示詞模式。', 'warning');
    }
  });

  function updateApiStatusUI(configured) {
    if (configured) {
      DOM.apiStatusText.className = 'api-status status-configured';
      DOM.apiStatusText.innerHTML = '<span class="status-dot"></span> API Key 已成功設定';
      DOM.btnToggleConfig.classList.add('btn-secondary');
      DOM.btnToggleConfig.classList.remove('btn-danger');
    } else {
      DOM.apiStatusText.className = 'api-status status-unconfigured';
      DOM.apiStatusText.innerHTML = '<span class="status-dot"></span> 未設定金鑰（僅可使用複製提示詞模式）';
    }
  }

  // --- Audio Recording Logic ---
  DOM.btnStartRecord.addEventListener('click', async () => {
    if (state.isRecording) return;
    
    try {
      // Request mic permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialize audio analyzer
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const sourceNode = state.audioContext.createMediaStreamSource(stream);
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 256;
      
      state.bufferLength = state.analyser.frequencyBinCount;
      state.dataArray = new Uint8Array(state.bufferLength);
      sourceNode.connect(state.analyser);
      
      // Select supported codec
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};
      
      state.mediaRecorder = new MediaRecorder(stream, options);
      state.audioChunks = [];
      
      state.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          state.audioChunks.push(event.data);
        }
      };
      
      state.mediaRecorder.onstop = () => {
        // Stop all audio tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        if (state.audioContext) {
          state.audioContext.close();
        }
        
        state.audioBlob = new Blob(state.audioChunks, { type: mimeType || 'audio/webm' });
        state.audioUrl = URL.createObjectURL(state.audioBlob);
        
        // Populate Playback details
        DOM.audioPlayer.src = state.audioUrl;
        DOM.audioPlayer.load();
        
        const sizeMB = (state.audioBlob.size / (1024 * 1024)).toFixed(1);
        DOM.audioFileSize.textContent = `${sizeMB} MB`;
        DOM.btnDownloadAudio.href = state.audioUrl;
        DOM.btnDownloadAudio.download = `課堂錄音_${getFormattedDate()}.webm`;
        
        DOM.audioPlaybackContainer.classList.remove('hidden');
        showToast('錄音完成！您可於播放器預覽或點擊下載存檔。', 'success');
      };
      
      // Set Recording State
      state.isRecording = true;
      state.isPaused = false;
      state.recordingTime = 0;
      state.audioChunks = [];
      
      // Update UI
      DOM.recorderStatus.className = 'rec-status-badge status-recording';
      DOM.recorderStatusText.textContent = '錄音中';
      DOM.recordingTimer.textContent = '00:00:00';
      
      DOM.btnStartRecord.disabled = true;
      DOM.btnPauseRecord.disabled = false;
      DOM.btnStopRecord.disabled = false;
      
      // Start Recording
      state.mediaRecorder.start(1000); // chunk every 1 sec
      
      // Start visualizer and timer
      cancelAnimationFrame(idleAnimationId);
      drawRecordingWave();
      
      state.recordingInterval = setInterval(() => {
        if (!state.isPaused) {
          state.recordingTime++;
          DOM.recordingTimer.textContent = formatTime(state.recordingTime);
        }
      }, 1000);
      
      showToast('開始錄音，已啟用麥克風捕捉。', 'info');
      
    } catch (err) {
      console.error('Microphone access failed:', err);
      showToast('無法取得麥克風權限或啟動錄音！請檢查瀏覽器設定。', 'error');
    }
  });

  DOM.btnPauseRecord.addEventListener('click', () => {
    if (!state.isRecording || !state.mediaRecorder) return;
    
    if (!state.isPaused) {
      // Pause
      state.mediaRecorder.pause();
      state.isPaused = true;
      DOM.recorderStatus.className = 'rec-status-badge status-paused';
      DOM.recorderStatusText.textContent = '已暫停';
      DOM.btnPauseRecord.innerHTML = '<i data-lucide="play"></i> 繼續';
      showToast('錄音已暫停。', 'warning');
    } else {
      // Resume
      state.mediaRecorder.resume();
      state.isPaused = false;
      DOM.recorderStatus.className = 'rec-status-badge status-recording';
      DOM.recorderStatusText.textContent = '錄音中';
      DOM.btnPauseRecord.innerHTML = '<i data-lucide="pause"></i> 暫停';
      showToast('繼續錄音中。', 'info');
    }
    lucide.createIcons();
  });

  DOM.btnStopRecord.addEventListener('click', () => {
    if (!state.isRecording || !state.mediaRecorder) return;
    
    // Stop recording
    state.mediaRecorder.stop();
    clearInterval(state.recordingInterval);
    
    state.isRecording = false;
    state.isPaused = false;
    
    // Reset UI buttons
    DOM.recorderStatus.className = 'rec-status-badge status-idle';
    DOM.recorderStatusText.textContent = '未開始';
    DOM.btnStartRecord.disabled = false;
    DOM.btnPauseRecord.disabled = true;
    DOM.btnStopRecord.disabled = true;
    DOM.btnPauseRecord.innerHTML = '<i data-lucide="pause"></i> 暫停';
    lucide.createIcons();
    
    // Restart idle wave
    animateIdleWave();
  });

  function getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/wav',
      'audio/mp4'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }

  function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }

  function getFormattedDate() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  }

  // --- Real-time Transcription & Stats ---
  DOM.transcriptTextarea.addEventListener('input', () => {
    const text = DOM.transcriptTextarea.value;
    const session = getCurrentSession();
    session.transcript = text;
    
    // Auto rename title if it was default "新會話"
    if (session.title === '新會話' && text.trim().length > 0) {
      session.title = text.trim().substring(0, 15) + (text.trim().length > 15 ? '...' : '');
    }
    
    saveSessions();
    updateSidebarUI();
    updateTextMetrics();
    triggerAutoSaveIndicator();
  });

  function updateTextMetrics() {
    const text = DOM.transcriptTextarea.value;
    const charCount = text.length;
    DOM.metricChars.textContent = charCount;
    
    // Estimation: 400 characters per minute reading speed
    const estTime = Math.ceil(charCount / 400);
    DOM.metricReadTime.textContent = charCount > 0 ? estTime : 0;
    
    // Hide notice banner once user typed or recorded something
    if (charCount > 0) {
      DOM.dictationNoticeBanner.style.opacity = '0.3';
    } else {
      DOM.dictationNoticeBanner.style.opacity = '1';
    }
  }

  let saveIndicatorTimeout;
  function triggerAutoSaveIndicator() {
    DOM.saveStatusText.classList.remove('hidden');
    DOM.saveStatusText.style.opacity = '1';
    
    clearTimeout(saveIndicatorTimeout);
    saveIndicatorTimeout = setTimeout(() => {
      DOM.saveStatusText.style.opacity = '0';
      setTimeout(() => {
        DOM.saveStatusText.classList.add('hidden');
      }, 300);
    }, 1500);
  }

  DOM.btnClearTranscript.addEventListener('click', () => {
    if (!DOM.transcriptTextarea.value.trim()) return;
    
    if (confirm('確定要清空目前的逐字稿嗎？本動作無法復原。')) {
      DOM.transcriptTextarea.value = '';
      const session = getCurrentSession();
      session.transcript = '';
      saveSessions();
      updateSidebarUI();
      updateTextMetrics();
      showToast('已清空逐字稿。', 'warning');
    }
  });

  DOM.btnCopyTranscript.addEventListener('click', () => {
    const text = DOM.transcriptTextarea.value.trim();
    if (!text) {
      showToast('無逐字稿內容可複製！', 'warning');
      return;
    }
    
    navigator.clipboard.writeText(text)
      .then(() => showToast('原始逐字稿已複製到剪貼簿！', 'success'))
      .catch(() => showToast('複製失敗，請手動複製。', 'error'));
  });

  // Download raw transcript
  DOM.btnDownloadTranscript.addEventListener('click', () => {
    const text = DOM.transcriptTextarea.value.trim();
    if (!text) {
      showToast('無逐字稿內容可下載！', 'warning');
      return;
    }
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getCurrentSession().title}_逐字稿_${getFormattedDate()}.txt`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    showToast('已下載逐字稿檔案 (.txt)。', 'success');
  });

  // Track style selector changes
  DOM.selectNoteStyle.addEventListener('change', () => {
    const session = getCurrentSession();
    session.style = DOM.selectNoteStyle.value;
    saveSessions();
  });

  // Track custom instructions input
  DOM.customInstruction.addEventListener('input', () => {
    const session = getCurrentSession();
    session.customInstruction = DOM.customInstruction.value;
    saveSessions();
  });

  // --- Session Management Functions ---
  function getCurrentSession() {
    return state.sessions.find(s => s.id === state.currentSessionId) || state.sessions[0];
  }

  function saveSessions() {
    localStorage.setItem('notes_assistant_sessions', JSON.stringify(state.sessions));
    localStorage.setItem('notes_assistant_current_session_id', state.currentSessionId);
  }

  function loadSessionToUI(session) {
    DOM.transcriptTextarea.value = session.transcript;
    DOM.notesEditorArea.value = session.aiNotes;
    DOM.selectNoteStyle.value = session.style || 'structured';
    DOM.customInstruction.value = session.customInstruction || '';
    
    // Reset local audio playback state
    DOM.audioPlaybackContainer.classList.add('hidden');
    DOM.audioPlayer.src = '';
    
    updateTextMetrics();
    renderMarkdownNotes(session.aiNotes);
    updateSidebarUI();
  }

  function updateSidebarUI() {
    if (!DOM.sessionList) return;
    DOM.sessionList.innerHTML = '';
    
    state.sessions.forEach(session => {
      const item = document.createElement('div');
      item.className = `session-item ${session.id === state.currentSessionId ? 'active' : ''}`;
      item.setAttribute('data-id', session.id);
      item.setAttribute('title', '點擊切換，連按兩下可重命名此會話');
      
      const dateStr = new Date(session.created).toLocaleString('zh-TW', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      item.innerHTML = `
        <div class="session-info">
          <span class="session-title" title="${escapeHTML(session.title)}">${escapeHTML(session.title)}</span>
          <span class="session-date">${dateStr}</span>
        </div>
        <button class="btn-delete-session" title="刪除會話">
          <i data-lucide="trash-2"></i>
        </button>
      `;
      
      // Click session to load
      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-session')) return;
        state.currentSessionId = session.id;
        saveSessions();
        loadSessionToUI(session);
      });

      // Double click to rename session (custom modal)
      const sessionInfo = item.querySelector('.session-info');
      sessionInfo.addEventListener('dblclick', () => {
        state.sessionToRename = session;
        DOM.renameInput.value = session.title;
        DOM.renameModal.classList.add('active');
        setTimeout(() => {
          DOM.renameInput.focus();
          DOM.renameInput.select();
        }, 100);
      });
      
      // Delete session action
      const btnDelete = item.querySelector('.btn-delete-session');
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.sessions.length <= 1) {
          showToast('必須保留至少一個會話！', 'warning');
          return;
        }
        
        if (confirm(`確定要刪除「${session.title}」這個會話紀錄嗎？`)) {
          state.sessions = state.sessions.filter(s => s.id !== session.id);
          if (state.currentSessionId === session.id) {
            state.currentSessionId = state.sessions[0].id;
          }
          saveSessions();
          loadSessionToUI(getCurrentSession());
        }
      });
      
      DOM.sessionList.appendChild(item);
    });
    
    lucide.createIcons();
  }

  // Create new session
  DOM.btnNewSession.addEventListener('click', () => {
    const newSession = {
      id: 'session_' + Date.now(),
      title: '新會話',
      transcript: '',
      aiNotes: '',
      style: 'structured',
      customInstruction: '',
      created: Date.now()
    };
    
    state.sessions.unshift(newSession);
    state.currentSessionId = newSession.id;
    saveSessions();
    loadSessionToUI(newSession);
    showToast('已建立新會話！請開始錄音或聽寫。', 'success');
  });

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // --- AI Note Generation & Direct API Hook ---
  
  // Styling Prompts
  const prompts = {
    structured: '系統化整理筆記。包含：前言/背景、核心概念拆解說明（多用條列與加粗重點）、細節整理與結構、結論與大意、以及後續的實踐或思考行動計畫。',
    meeting: '專業會議記錄。請整理成包含以下項目的標準會議紀要：\n1. 會議基本資訊 (時間、主題，若逐字稿未提及請留空)\n2. 會議摘要：用簡短的段落說明會議主要目的與討論範疇\n3. 決議事項：條列說明會議中達成的共識、定案內容與決議方案\n4. 待辦與追蹤事項：列出後續行動清單，並用任務清單格式（- [ ]）呈現執行項目與指派對象(若有)。',
    summary: '精簡摘要。包含：一句話概括主要重點、核心重點精華整理（控制在 3-5 大重點）、重點補充、關鍵問題解答。',
    mindmap: '心智圖大綱格式。請利用 Markdown 的標題階層（#, ##, ###）與無序清單（-，搭配適當的兩格空白縮排）展現邏輯知識樹，從粗到細描述概念，不要有大段冗長文字。',
    qa: '重點 Q&A 與概念複習。請將內容轉換為問答卡片格式，包含：常見重點問答 (Q&A，至少 5 個)、核心名詞與定義解釋閃卡、自我評量練習題 (包含簡答提示)。'
  };

  // Generate prompt text helper
  function buildSystemPrompt() {
    const styleKey = DOM.selectNoteStyle.value;
    const styleDescription = prompts[styleKey] || prompts.structured;
    const customInstr = DOM.customInstruction.value.trim();
    const transcriptText = DOM.transcriptTextarea.value.trim();
    
    return `你是一個專業的智慧學習與工作筆記管理助手。請將以下語音轉文字的逐字稿整理成結構化、美觀易讀的智慧筆記。
請遵循以下黃金指南：
1. 請使用【繁體中文】回答。
2. 筆記必須採用標準的 Markdown 語法，排版需優雅乾淨，適合直接複製並貼入 Notion 筆記。
3. 修正逐字稿中因為語音辨識出錯而產生的錯別字、贅字或不通順的口語（例如把口頭禪修飾掉，校正專業術語拼寫），在維持發言者原意下提升文字可讀性。
4. 使用清晰的標題階層（## 代表大主題，### 代表子主題，避免過度使用 # 單一井號）。
5. 善用粗體、斜體、條列清單、任務清單（- [ ]）、區塊引言（>）以及 Markdown 表格來呈現資訊，使版面豐富有層次。
6. 對於逐字稿中提到的重要觀念或專有名詞，請為其加上簡短的解釋（可以使用 > 區塊引言或粗體標記）。
7. 請依據以下指定的【筆記風格】進行產出：
   📌 筆記風格需求：${styleDescription}

${customInstr ? `8. 使用者附加特別指示：${customInstr}\n` : ''}
【逐字稿開始】
${transcriptText}
【逐字稿結束】

整理後的 Markdown 智慧筆記：`;
  }

  // Copy AI Prompt Mode (For manual use)
  DOM.btnCopyPrompt.addEventListener('click', () => {
    const transcriptText = DOM.transcriptTextarea.value.trim();
    if (!transcriptText) {
      showToast('請先在左側輸入或語音錄製一些課堂逐字稿！', 'warning');
      return;
    }
    
    const fullPrompt = buildSystemPrompt();
    
    navigator.clipboard.writeText(fullPrompt)
      .then(() => {
        showToast('AI 整理提示詞已複製！請至 ChatGPT 或 Claude 貼上。', 'success');
        // Flash visual alert on right preview container to direct user where to paste
        DOM.tabEditor.click();
        DOM.notesEditorArea.focus();
        showToast('完成手動對話後，可將產生的 Markdown 筆記貼在右側編輯區。', 'info');
      })
      .catch((err) => {
        console.error('Clipboard copy failed:', err);
        showToast('複製失敗，請手動選擇複製。', 'error');
      });
  });

  // Call Gemini API Direct Mode
  DOM.btnGenerateNotes.addEventListener('click', async () => {
    const transcriptText = DOM.transcriptTextarea.value.trim();
    if (!transcriptText) {
      showToast('請先輸入或語音錄製逐字稿！', 'warning');
      return;
    }
    
    if (!state.apiKey) {
      showToast('尚未設定 Gemini API Key！請點擊右上角設定以進行自動整理。', 'warning');
      DOM.apiConfigPanel.classList.remove('collapsed');
      DOM.geminiApiKeyInput.focus();
      return;
    }
    
    // Display loading
    DOM.aiLoadingOverlay.classList.remove('hidden');
    DOM.btnGenerateNotes.disabled = true;
    
    const statusSteps = [
      '正在建立連線至 Gemini...',
      '正在載入您的課堂逐字稿...',
      'AI 正在仔細分析與修復語音辨識錯字...',
      '整理成結構化的 Notion 筆記格式...',
      '正在渲染 Markdown 頁面...'
    ];
    
    let stepIndex = 0;
    DOM.loadingStatusText.textContent = statusSteps[0];
    const statusInterval = setInterval(() => {
      if (stepIndex < statusSteps.length - 1) {
        stepIndex++;
        DOM.loadingStatusText.textContent = statusSteps[stepIndex];
      }
    }, 3000);
    
    try {
      const fullPrompt = buildSystemPrompt();
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.apiKey}`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: fullPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.25,
            topP: 0.95
          }
        })
      });
      
      clearInterval(statusInterval);
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP 錯誤碼: ${response.status}`);
      }
      
      const data = await response.json();
      const aiNotesResult = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!aiNotesResult) {
        throw new Error('Gemini API 未返回有效的內容。請確認您的 API 金鑰是否有餘額或受限。');
      }
      
      // Save results
      const session = getCurrentSession();
      session.aiNotes = aiNotesResult;
      saveSessions();
      
      DOM.notesEditorArea.value = aiNotesResult;
      
      // Render
      renderMarkdownNotes(aiNotesResult);
      
      // Switch back to Preview Tab
      switchTab('preview');
      showToast('筆記整理成功！已自動排版並套用 Notion 格式。', 'success');
      
    } catch (err) {
      console.error('API Call Failed:', err);
      showToast(`整理失敗：${err.message}`, 'error');
    } finally {
      clearInterval(statusInterval);
      DOM.aiLoadingOverlay.classList.add('hidden');
      DOM.btnGenerateNotes.disabled = false;
    }
  });

  // --- Tab Control & Render Functions ---
  DOM.tabPreview.addEventListener('click', () => {
    switchTab('preview');
  });

  DOM.tabEditor.addEventListener('click', () => {
    switchTab('editor');
  });

  function switchTab(tab) {
    if (tab === 'preview') {
      state.activeTab = 'preview';
      DOM.tabPreview.classList.add('active');
      DOM.tabEditor.classList.remove('active');
      
      // Compile raw editor content back to preview just in case it was updated
      const rawText = DOM.notesEditorArea.value;
      const session = getCurrentSession();
      session.aiNotes = rawText;
      saveSessions();
      renderMarkdownNotes(rawText);
      
      DOM.notesPreviewArea.classList.remove('hidden');
      DOM.notesEditorArea.classList.add('hidden');
    } else {
      state.activeTab = 'editor';
      DOM.tabPreview.classList.remove('active');
      DOM.tabEditor.classList.add('active');
      
      DOM.notesPreviewArea.classList.add('hidden');
      DOM.notesEditorArea.classList.remove('hidden');
    }
  }

  function renderMarkdownNotes(markdownText) {
    if (!markdownText || !markdownText.trim()) {
      DOM.notesPreviewArea.innerHTML = `
        <div class="empty-preview">
          <i data-lucide="file-edit"></i>
          <h3>尚未生成筆記</h3>
          <p>在左側輸入或錄製逐字稿，然後點選上面的「透過 AI 整理筆記」按鈕，精美的 Markdown 學習筆記將會在此呈現。</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }
    
    try {
      if (typeof marked !== 'undefined') {
        DOM.notesPreviewArea.innerHTML = marked.parse(markdownText);
      } else {
        // Fallback if marked library is somehow missing
        DOM.notesPreviewArea.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHTML(markdownText)}</pre>`;
      }
    } catch (err) {
      console.error('Markdown compile error:', err);
      DOM.notesPreviewArea.innerHTML = `<div class="toast-error">Markdown 渲染出錯。</div>`;
    }
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // Monitor edits in Editor area to auto-save
  DOM.notesEditorArea.addEventListener('input', () => {
    const session = getCurrentSession();
    session.aiNotes = DOM.notesEditorArea.value;
    saveSessions();
  });

  // --- Clipboard Copy & File Download Actions ---
  DOM.btnCopyNotes.addEventListener('click', () => {
    const text = DOM.notesEditorArea.value.trim();
    if (!text) {
      showToast('無筆記內容可複製！', 'warning');
      return;
    }
    
    navigator.clipboard.writeText(text)
      .then(() => {
        showToast('Markdown 筆記已複製！請至 Notion 頁面直接貼上 (Ctrl+V)。', 'success');
      })
      .catch((err) => {
        console.error('Copy notes failed:', err);
        showToast('複製失敗，請手動選取編輯區複製。', 'error');
      });
  });

  DOM.btnDownloadNotes.addEventListener('click', () => {
    const text = DOM.notesEditorArea.value.trim();
    if (!text) {
      showToast('無筆記內容可下載！', 'warning');
      return;
    }
    
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `課堂學習筆記_${getFormattedDate()}.md`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    showToast('已下載 Markdown 筆記檔案。', 'success');
  });
});
