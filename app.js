// Define the 9 loading video condition combinations (A1-A3 Animation x B1-B3 Duration)
const CONDITIONS = {
  'C01': { conditionCode: 'C01', animCode: 'A1', durCode: 'B1', animation: 'loading', animName: '載入圖示', durationText: '3秒', durationSec: 3, filename: 'loading3秒.mp4' },
  'C02': { conditionCode: 'C02', animCode: 'A1', durCode: 'B2', animation: 'loading', animName: '載入圖示', durationText: '5秒', durationSec: 5, filename: 'loading5秒.mp4' },
  'C03': { conditionCode: 'C03', animCode: 'A1', durCode: 'B3', animation: 'loading', animName: '載入圖示', durationText: '10秒', durationSec: 10, filename: 'loading10秒.mp4' },
  'C04': { conditionCode: 'C04', animCode: 'A2', durCode: 'B1', animation: '咖啡杯', animName: '咖啡杯', durationText: '3秒', durationSec: 3, filename: '咖啡杯3秒.mp4' },
  'C05': { conditionCode: 'C05', animCode: 'A2', durCode: 'B2', animation: '咖啡杯', animName: '咖啡杯', durationText: '5秒', durationSec: 5, filename: '咖啡杯5秒.mp4' },
  'C06': { conditionCode: 'C06', animCode: 'A2', durCode: 'B3', animation: '咖啡杯', animName: '咖啡杯', durationText: '10秒', durationSec: 10, filename: '咖啡杯10秒.mp4' },
  'C07': { conditionCode: 'C07', animCode: 'A3', durCode: 'B1', animation: '百分比', animName: '百分比', durationText: '3秒', durationSec: 3, filename: '百分比3秒.mp4' },
  'C08': { conditionCode: 'C08', animCode: 'A3', durCode: 'B2', animation: '百分比', animName: '百分比', durationText: '5秒', durationSec: 5, filename: '百分比5秒.mp4' },
  'C09': { conditionCode: 'C09', animCode: 'A3', durCode: 'B3', animation: '百分比', animName: '百分比', durationText: '10秒', durationSec: 10, filename: '百分比10秒.mp4' }
};

const TRIALS = Object.values(CONDITIONS);

// Google Sheets Web App Endpoint for automated data collection
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwMcJ8kttJobodGInq4jrTJUivcORMAz2Rw3L_HzjkA73mRLaPqRnLFv7zogGB-FKUM/exec";

// Q1 response midpoint conversion table for scientific calculation (seconds estimation)
const Q1_VALUES = {
  1: { text: "1-2 秒", midpoint: 1.5 },
  2: { text: "3-4 秒", midpoint: 3.5 },
  3: { text: "5-6 秒", midpoint: 5.5 },
  4: { text: "7-8 秒", midpoint: 7.5 },
  5: { text: "9-10 秒", midpoint: 9.5 },
  6: { text: "11-12 秒", midpoint: 11.5 },
  7: { text: "13 秒或以上", midpoint: 14.0 }
};

// Global App State
let state = {
  participantId: '',
  mode: 'full', // 'full' or 'single'
  trialList: [],
  currentTrialIndex: 0,
  trialResults: [], // Results collected in the current session
  viewState: 'setup' // 'setup', 'playing', 'survey', 'thankyou', 'dashboard'
};

// DOM Elements
const sections = {
  setup: document.getElementById('sec-setup'),
  player: document.getElementById('sec-player'),
  questionnaire: document.getElementById('sec-questionnaire'),
  thankyou: document.getElementById('sec-thankyou'),
  dashboard: document.getElementById('sec-dashboard')
};

const navBtns = {
  experiment: document.getElementById('nav-experiment'),
  dashboard: document.getElementById('nav-dashboard')
};

const videoEl = document.getElementById('exp-video');
const videoFallbackContainer = document.getElementById('video-fallback-container');

// Mulberry32 PRNG for reproducible random operations
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shuffles an array (Fisher-Yates) with optional custom RNG
function shuffleArray(arr, rng = Math.random) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Generate a valid 9x9 Randomized Latin Square
function generateRandomizedLatinSquare(seed = null) {
  const rng = seed !== null ? mulberry32(seed) : Math.random;
  const codes = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09'];
  const n = 9;

  // 1. Base cyclic square: base[i][j] = (i + j) % 9
  const base = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      row.push((i + j) % n);
    }
    base.push(row);
  }

  // 2. Randomly permute treatment symbols, rows, and columns
  const symPerm = shuffleArray([...Array(n).keys()], rng);
  const rowPerm = shuffleArray([...Array(n).keys()], rng);
  const colPerm = shuffleArray([...Array(n).keys()], rng);

  // 3. Assemble randomized Latin Square
  const square = [];
  for (let r = 0; r < n; r++) {
    const origRow = rowPerm[r];
    const row = [];
    for (let c = 0; c < n; c++) {
      const origCol = colPerm[c];
      const sym = base[origRow][origCol];
      row.push(codes[symPerm[sym]]);
    }
    square.push(row);
  }

  return square;
}

// Get or initialize persistent 9x9 Latin Square in localStorage
function getOrInitLatinSquare() {
  try {
    const stored = localStorage.getItem('latin_square_9x9');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length === 9 && parsed[0].length === 9) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error reading stored Latin Square:", e);
  }

  const newSquare = generateRandomizedLatinSquare();
  localStorage.setItem('latin_square_9x9', JSON.stringify(newSquare));
  return newSquare;
}

// Force re-randomize Latin Square (researcher action)
function rerandomizeLatinSquare() {
  if (!confirm('確定要重新隨機生成 9×9 拉丁方格嗎？\n生成後，後續受試者的順序分配將採用新的拉丁方格。')) return;
  const newSquare = generateRandomizedLatinSquare();
  localStorage.setItem('latin_square_9x9', JSON.stringify(newSquare));
  renderLatinSquareTable();
  updateOnboardingParticipantId();
  alert('已成功重新生成隨機化 9×9 拉丁方格！');
}

// Extract numeric sequence from Participant ID (e.g. 'P001' -> 1, 'P012' -> 12)
function getParticipantNumber(participantId) {
  if (!participantId) return 1;
  const match = String(participantId).match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

// Calculate Latin Square order group from Participant ID
function getOrderGroupInfo(participantId) {
  const pNum = getParticipantNumber(participantId);
  const rowIndex = ((pNum - 1) % 9 + 9) % 9; // 0 to 8
  const groupNum = rowIndex + 1; // 1 to 9
  const groupCode = `S0${groupNum}`.slice(-3); // S01 - S09
  return {
    rowIndex,
    groupNumber: groupNum,
    groupCode
  };
}

// Generate ordered trial sequence for participant based on their Latin Square row
function getTrialsForParticipant(participantId) {
  const square = getOrInitLatinSquare();
  const groupInfo = getOrderGroupInfo(participantId);
  const conditionCodes = square[groupInfo.rowIndex]; // Array of 9 codes: ['C05', 'C01', ...]

  return conditionCodes.map((cCode, idx) => {
    const cond = CONDITIONS[cCode];
    return {
      ...cond,
      orderGroup: groupInfo.groupCode,
      groupNumber: groupInfo.groupNumber,
      trialOrder: idx + 1 // 1 to 9
    };
  });
}

// Switch between views (Setup, Player, Questionnaire, Thank You, Dashboard)
function showSection(targetSectionId) {
  // Hide all sections
  Object.keys(sections).forEach(key => {
    sections[key].classList.add('hidden');
  });
  
  // Remove fade-in from all, add it to target
  const targetEl = sections[targetSectionId];
  targetEl.classList.remove('hidden');
  targetEl.classList.add('fade-in');
  
  // Keep track of active nav button
  if (targetSectionId === 'dashboard') {
    navBtns.dashboard.classList.add('active');
    navBtns.experiment.classList.remove('active');
  } else {
    navBtns.experiment.classList.add('active');
    navBtns.dashboard.classList.remove('active');
    // Store current state section to return to if researcher switches back
    state.viewState = targetSectionId;
  }
}

// Setup Event Listeners on Load
document.addEventListener('DOMContentLoaded', () => {
  // 1. Navigation Button Toggles
  navBtns.experiment.addEventListener('click', () => {
    showSection(state.viewState);
  });
  
  navBtns.dashboard.addEventListener('click', () => {
    showSection('dashboard');
    renderDashboard();
  });

  // Initialize Auto-generated Participant ID
  updateOnboardingParticipantId();

  // Custom Participant ID change button
  const btnChangeId = document.getElementById('btn-change-id');
  if (btnChangeId) {
    btnChangeId.addEventListener('click', () => {
      const currentId = document.getElementById('participant-id').value;
      const customId = prompt('請輸入指定的受試者代號 (例如 P002, P005)：', currentId);
      if (customId && customId.trim()) {
        updateOnboardingParticipantId(customId.trim());
      }
    });
  }

  // 3. Start Experiment Event
  document.getElementById('form-setup').addEventListener('submit', (e) => {
    e.preventDefault();
    startExperiment();
  });

  // 4. Skip Video Fallback Button
  document.getElementById('btn-skip-video').addEventListener('click', () => {
    stopVideo();
    transitionToSurvey();
  });

  // 5. Questionnaire Submit Event
  document.getElementById('form-questionnaire').addEventListener('submit', (e) => {
    e.preventDefault();
    submitSurvey();
  });

  // Slider change listener
  const q1Slider = document.getElementById('q1-slider');
  const q1ValDisplay = document.getElementById('q1-val-display');
  if (q1Slider && q1ValDisplay) {
    q1Slider.addEventListener('input', (e) => {
      q1ValDisplay.textContent = parseFloat(e.target.value).toFixed(1);
    });
  }

  // 6. Navigation inside Thank you screen
  document.getElementById('btn-restart').addEventListener('click', () => {
    resetExperimentState();
    showSection('setup');
  });

  document.getElementById('btn-view-results').addEventListener('click', () => {
    showSection('dashboard');
    renderDashboard();
  });

  const btnDownloadSession = document.getElementById('btn-download-session');
  if (btnDownloadSession) {
    btnDownloadSession.addEventListener('click', exportSessionCSV);
  }

  // 7. Dashboard actions
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-clear-db').addEventListener('click', clearDatabase);
  document.getElementById('btn-load-samples').addEventListener('click', loadSampleMockData);

  const btnRerandomizeLs = document.getElementById('btn-rerandomize-ls');
  if (btnRerandomizeLs) {
    btnRerandomizeLs.addEventListener('click', rerandomizeLatinSquare);
  }

  // --- Researcher Mode Access Control (Hidden by default, accessible only to researcher) ---
  const urlParams = new URLSearchParams(window.location.search);
  let isResearcherUnlocked = urlParams.has('admin') || urlParams.has('researcher') || sessionStorage.getItem('researcher_unlocked') === 'true';

  function setResearcherMode(active) {
    const navDash = document.getElementById('nav-dashboard');
    const viewResultsBtn = document.getElementById('btn-view-results');
    if (active) {
      sessionStorage.setItem('researcher_unlocked', 'true');
      if (navDash) navDash.classList.remove('hidden');
      if (viewResultsBtn) viewResultsBtn.classList.remove('hidden');
    } else {
      sessionStorage.removeItem('researcher_unlocked');
      if (navDash) navDash.classList.add('hidden');
      if (viewResultsBtn) viewResultsBtn.classList.add('hidden');
      if (state.viewState === 'dashboard') {
        showSection('setup');
      }
    }
  }

  setResearcherMode(isResearcherUnlocked);

  // Lock and hide dashboard button
  const btnLockDash = document.getElementById('btn-lock-dashboard');
  if (btnLockDash) {
    btnLockDash.addEventListener('click', () => {
      setResearcherMode(false);
      showSection('setup');
      alert('已成功鎖定並隱藏研究者後台！');
    });
  }

  // Secret unlock mechanism for researcher:
  // 1. Triple click on logo within 1.5s
  let logoClickCount = 0;
  let logoClickTimer = null;
  const logoEl = document.querySelector('.header-logo');
  if (logoEl) {
    logoEl.style.cursor = 'pointer';
    logoEl.title = '雙擊或三擊可開啟研究者登入';
    logoEl.addEventListener('click', () => {
      logoClickCount++;
      if (logoClickTimer) clearTimeout(logoClickTimer);
      logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 1500);

      if (logoClickCount >= 3) {
        logoClickCount = 0;
        promptResearcherLogin();
      }
    });
  }

  // 2. Keyboard shortcut Ctrl + Shift + R or Ctrl + Alt + A
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.shiftKey && (e.key === 'R' || e.key === 'r')) ||
        (e.ctrlKey && e.altKey && (e.key === 'A' || e.key === 'a'))) {
      e.preventDefault();
      promptResearcherLogin();
    }
  });

  function promptResearcherLogin() {
    const pwd = prompt('🔐 請輸入研究者後台密碼 (預設: admin)：');
    if (pwd === null) return;
    if (pwd.trim() === 'admin' || pwd.trim() === 'qoe2026' || pwd.trim() === '8888') {
      setResearcherMode(true);
      showSection('dashboard');
      renderDashboard();
      alert('已驗證身分，已為您開啟研究者後台！');
    } else {
      alert('密碼錯誤，無法開啟後台。');
    }
  }

  // Initialize DB view in Dashboard
  renderDashboard();
});

// Start the Experiment Session
function startExperiment() {
  const pIdInput = document.getElementById('participant-id').value.trim();
  if (!pIdInput) return alert('受試者代號未生成，請重新整理網頁！');
  
  state.participantId = pIdInput;
  state.gender = document.querySelector('input[name="demographic-gender"]:checked').value;
  state.age = document.querySelector('input[name="demographic-age"]:checked').value;
  state.trialResults = [];
  
  // Full 9-trial within-subject Latin Square experiment
  state.mode = 'full';
  state.groupInfo = getOrderGroupInfo(state.participantId);
  state.trialList = getTrialsForParticipant(state.participantId);
  state.currentTrialIndex = 0;
  
  // Launch the first trial
  runTrial();
}

// Run a Specific Trial (play video)
function runTrial() {
  const trial = state.trialList[state.currentTrialIndex];
  state.currentTrial = trial;
  
  // Update UI badge (blind: only display group and progress)
  const badgeEl = document.getElementById('trial-progress-badge');
  if (state.mode === 'full') {
    badgeEl.textContent = `測試進度: ${state.currentTrialIndex + 1} / 9 (組別: ${trial.orderGroup})`;
  } else {
    badgeEl.textContent = `單一測試模式`;
  }
  
  showSection('player');
  videoFallbackContainer.classList.add('hidden');
  
  // Set up HTML5 video elements
  videoEl.muted = true;
  videoEl.volume = 0;
  videoEl.src = encodeURIComponent(trial.filename);
  videoEl.load();
  
  // Handle autoplay constraints
  let playPromise = videoEl.play();
  
  if (playPromise !== undefined) {
    playPromise.catch(error => {
      console.warn("Autoplay was prevented, showing click warning or skip backup button.", error);
      // Show skip button in case the video cannot start
      videoFallbackContainer.classList.remove('hidden');
    });
  }
  
  // Detect video finish
  videoEl.onended = () => {
    transitionToSurvey();
  };
  
  // Safety timeout: if video fails to report end, show manual skip
  const safetyTimeoutMs = (trial.durationSec + 5) * 1000;
  window.videoSafetyTimer = setTimeout(() => {
    if (state.viewState === 'playing') {
      videoFallbackContainer.classList.remove('hidden');
    }
  }, safetyTimeoutMs);
}

// Cleanup and Stop Video
function stopVideo() {
  if (window.videoSafetyTimer) clearTimeout(window.videoSafetyTimer);
  videoEl.pause();
  videoEl.src = "";
}

// Transition from Player to Questionnaire Form
function transitionToSurvey() {
  stopVideo();
  
  // Update Survey Header labels (blind testing: only display group and trial index)
  const infoBanner = document.getElementById('survey-current-info');
  infoBanner.textContent = `順序組別: ${state.currentTrial.orderGroup} | 評估進度: 第 ${state.currentTrialIndex + 1} / ${state.trialList.length} 題`;
  
  // Reset form values
  document.getElementById('form-questionnaire').reset();
  
  // Reset Q1 slider to 5.0
  const q1Slider = document.getElementById('q1-slider');
  const q1ValDisplay = document.getElementById('q1-val-display');
  if (q1Slider && q1ValDisplay) {
    q1Slider.value = "5.0";
    q1ValDisplay.textContent = "5.0";
  }
  
  showSection('questionnaire');
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Gather and Submit Survey Answers
function submitSurvey() {
  const form = document.getElementById('form-questionnaire');
  
  // Collect all ratings
  const q1Val = parseFloat(document.getElementById('q1-slider').value);
  const q2Val = parseInt(document.querySelector('input[name="q2"]:checked').value);
  const q3Val = parseInt(document.querySelector('input[name="q3"]:checked').value);
  const q4Val = parseInt(document.querySelector('input[name="q4"]:checked').value);
  const q5Val = parseInt(document.querySelector('input[name="q5"]:checked').value);
  
  const e1Val = parseInt(document.querySelector('input[name="e1"]:checked').value);
  const e2Val = parseInt(document.querySelector('input[name="e2"]:checked').value);
  const e3Val = parseInt(document.querySelector('input[name="e3"]:checked').value);
  const e4Val = parseInt(document.querySelector('input[name="e4"]:checked').value);
  const e5Val = parseInt(document.querySelector('input[name="e5"]:checked').value);
  
  const u1Val = parseInt(document.querySelector('input[name="u1"]:checked').value);
  const u2Val = parseInt(document.querySelector('input[name="u2"]:checked').value);
  const u3Val = parseInt(document.querySelector('input[name="u3"]:checked').value);
  const u4Val = parseInt(document.querySelector('input[name="u4"]:checked').value);
  const u5Val = parseInt(document.querySelector('input[name="u5"]:checked').value);
  
  // Calculate average QoE Score across the 14 semantic differential items (Q2 to Q15)
  // Note: Q2 (1=Fast, 5=Slow) and Q3 (1=Short, 5=Long) are inverted poles,
  // so for composite overall QoE ("higher is better"), reverse-code them as (6 - value)
  const q2Positive = 6 - q2Val;
  const q3Positive = 6 - q3Val;
  const qoeScoreList = [q2Positive, q3Positive, q4Val, q5Val, e1Val, e2Val, e3Val, e4Val, e5Val, u1Val, u2Val, u3Val, u4Val, u5Val];
  const overallQoE = parseFloat((qoeScoreList.reduce((a,b) => a+b, 0) / qoeScoreList.length).toFixed(2));
  
  // Slider has direct estimated seconds
  const q1Text = q1Val.toFixed(1) + " 秒";
  
  // Prepare Result Object
  const trialResult = {
    participantId: state.participantId,
    orderGroup: state.currentTrial.orderGroup,
    groupNumber: state.currentTrial.groupNumber,
    trialOrder: state.currentTrial.trialOrder,
    conditionCode: state.currentTrial.conditionCode,
    animCode: state.currentTrial.animCode,
    durCode: state.currentTrial.durCode,
    gender: state.gender,
    age: state.age,
    timestamp: new Date().toISOString(),
    animation: state.currentTrial.animation,
    animName: state.currentTrial.animName,
    durationText: state.currentTrial.durationText,
    durationSec: state.currentTrial.durationSec,
    q1_estimateRaw: q1Val,
    q1_estimateText: q1Text,
    q1_estimateMidpoint: q1Val,
    q2_speed: q2Val,
    q3_time_passage: q3Val,
    q4_interest: q4Val,
    q5_aesthetics: q5Val,
    e1: e1Val,
    e2: e2Val,
    e3: e3Val,
    e4: e4Val,
    e5: e5Val,
    u1: u1Val,
    u2: u2Val,
    u3: u3Val,
    u4: u4Val,
    u5: u5Val,
    overallQoE: overallQoE
  };
  
  state.trialResults.push(trialResult);
  
  // Send data to Google Sheets automatically in the background
  sendDataToGoogleSheets(trialResult);
  
  // Proceed to next trial or finish
  state.currentTrialIndex++;
  if (state.currentTrialIndex < state.trialList.length) {
    runTrial();
  } else {
    // Session is complete! Write session results to browser storage
    saveSessionToDatabase();
    showThankYouScreen();
  }
}

// Show final completed screen
function showThankYouScreen() {
  document.getElementById('summary-p-id').textContent = state.participantId;
  const groupText = state.groupInfo ? ` (順序組別: ${state.groupInfo.groupCode})` : '';
  document.getElementById('summary-trial-count').textContent = `${state.trialResults.length} / ${state.trialList.length}${groupText}`;
  showSection('thankyou');
}

// Save trialResults to permanent LocalStorage
function saveSessionToDatabase() {
  const currentDb = JSON.parse(localStorage.getItem('qoe_study_data') || '[]');
  const updatedDb = [...currentDb, ...state.trialResults];
  localStorage.setItem('qoe_study_data', JSON.stringify(updatedDb));
}

// Reset state values for a fresh run
function resetExperimentState() {
  state.participantId = '';
  state.gender = '';
  state.age = '';
  state.trialList = [];
  state.currentTrialIndex = 0;
  state.trialResults = [];
  state.viewState = 'setup';

  // Clear onboarding form inputs
  const genderChecked = document.querySelector('input[name="demographic-gender"]:checked');
  if (genderChecked) genderChecked.checked = false;
  const ageChecked = document.querySelector('input[name="demographic-age"]:checked');
  if (ageChecked) ageChecked.checked = false;

  // Auto-generate Participant ID for next session
  updateOnboardingParticipantId();
}

// --- DATABASE & ANALYTICS LAYER ---

// Load data and rebuild dashboard statistics
function renderDashboard() {
  const data = JSON.parse(localStorage.getItem('qoe_study_data') || '[]');
  
  // 1. Render Latin Square Counterbalancing Table
  renderLatinSquareTable();
  
  // 2. Update Core Stats
  const subjects = new Set(data.map(item => item.participantId));
  document.getElementById('stat-total-subjects').textContent = subjects.size;
  document.getElementById('stat-total-trials').textContent = data.length;
  
  if (data.length > 0) {
    const avgAesthetics = (data.reduce((sum, item) => sum + item.q5_aesthetics, 0) / data.length).toFixed(2);
    // Utilitarian score is average of U1-U5
    const sumUtilitarian = data.reduce((sum, item) => sum + (item.u1 + item.u2 + item.u3 + item.u4 + item.u5) / 5, 0);
    const avgUtilitarian = (sumUtilitarian / data.length).toFixed(2);
    
    document.getElementById('stat-avg-aesthetics').textContent = avgAesthetics;
    document.getElementById('stat-avg-utilitarian').textContent = avgUtilitarian;
  } else {
    document.getElementById('stat-avg-aesthetics').textContent = '-';
    document.getElementById('stat-avg-utilitarian').textContent = '-';
  }
  
  // 2. Render Charts
  renderAestheticsQoEChart(data);
  renderTimeBiasChart(data);
  
  // 3. Render Data Table
  renderRawDataTable(data);
}

// Render Bar Chart: QoE rating by animation type
function renderAestheticsQoEChart(data) {
  const container = document.getElementById('chart-animation-qoe');
  if (data.length === 0) {
    container.innerHTML = '<div class="chart-placeholder">暫無數據，請先進行實驗</div>';
    return;
  }
  
  // Group ratings by animation type
  const anims = ['loading', '咖啡杯', '百分比'];
  const results = {};
  anims.forEach(a => results[a] = { sum: 0, count: 0 });
  
  data.forEach(item => {
    if (results[item.animation]) {
      results[item.animation].sum += item.overallQoE;
      results[item.animation].count++;
    }
  });
  
  let html = '';
  anims.forEach(anim => {
    const group = results[anim];
    const avg = group.count > 0 ? (group.sum / group.count).toFixed(2) : 0;
    // Map avg (1-5) to width percentage (0-100%)
    // formula: (avg - 1) / 4 * 100
    const percent = avg > 0 ? ((avg - 1) / 4 * 100).toFixed(0) : 0;
    
    const labelText = anim === 'loading' ? '載入圖示' : anim;
    
    html += `
      <div class="chart-row">
        <div class="chart-label" title="${labelText}">${labelText}</div>
        <div class="chart-bar-outer">
          <div class="chart-bar-inner" style="width: ${percent}%;"></div>
        </div>
        <div class="chart-val">${avg} 分</div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Render Bar Chart: Time Estimation Bias by actual duration
function renderTimeBiasChart(data) {
  const container = document.getElementById('chart-time-bias');
  if (data.length === 0) {
    container.innerHTML = '<div class="chart-placeholder">暫無數據，請先進行實驗</div>';
    return;
  }
  
  // Estimate bias = (estimateTime - actualTime) / actualTime * 100
  const durations = [3, 5, 10];
  const results = {};
  durations.forEach(d => results[d] = { sumBias: 0, count: 0 });
  
  data.forEach(item => {
    const act = item.durationSec;
    const est = item.q1_estimateMidpoint;
    if (results[act]) {
      const bias = ((est - act) / act) * 100;
      results[act].sumBias += bias;
      results[act].count++;
    }
  });
  
  let html = '';
  durations.forEach(d => {
    const group = results[d];
    const avgBias = group.count > 0 ? (group.sumBias / group.count).toFixed(1) : 0;
    
    // Normalize percentage for displaying on bar
    // Let's assume a range of -50% to +50% is standard.
    // For visualization, we center the bar or show absolute deviation from accuracy.
    // Let's show perceived time ratio: Perceived Time / Actual Time. Perfect is 100%.
    // perceivedRatio = est / act. 
    const sumEst = data.filter(item => item.durationSec === d).reduce((s, item) => s + item.q1_estimateMidpoint, 0);
    const avgEst = group.count > 0 ? (sumEst / group.count).toFixed(1) : 0;
    
    // Width represents ratio up to 150%
    const ratioPercent = Math.min((avgEst / d) * 100, 100);
    
    // Sign text for bias
    const biasSign = avgBias > 0 ? `+${avgBias}%` : `${avgBias}%`;
    const labelDesc = avgBias > 0 ? '時間高估' : avgBias < 0 ? '時間低估' : '估值精準';
    
    html += `
      <div class="chart-row">
        <div class="chart-label">${d}秒 影片組</div>
        <div class="chart-bar-outer">
          <div class="chart-bar-inner" style="width: ${ratioPercent}%; background: linear-gradient(90deg, #10b981 0%, #6366f1 100%);"></div>
        </div>
        <div class="chart-val" style="width: 100px; font-size: 0.75rem;" title="主觀估算: ${avgEst}秒 (偏差 ${biasSign})">
          ${avgEst}s (${biasSign})
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Render data entries table
function renderRawDataTable(data) {
  const tbody = document.querySelector('#db-raw-table tbody');
  
  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="15" class="text-center text-muted">目前尚無實驗紀錄。請前往「進行實驗」填寫問卷，或點擊「載入範例模擬數據」。</td>
      </tr>
    `;
    return;
  }
  
  // Sort by newest timestamp
  const sortedData = [...data].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  let html = '';
  sortedData.forEach(item => {
    const date = new Date(item.timestamp);
    const dateStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
    
    // Emotional items composite average
    const emoAvg = ((item.e1 + item.e2 + item.e3 + item.e4 + item.e5) / 5).toFixed(1);
    // Utilitarian items composite average
    const utiAvg = ((item.u1 + item.u2 + item.u3 + item.u4 + item.u5) / 5).toFixed(1);

    const animBadgeClass = item.animCode === 'A1' ? 'badge-anim-a1' :
                           item.animCode === 'A2' ? 'badge-anim-a2' : 'badge-anim-a3';
    
    html += `
      <tr>
        <td><strong>${escapeHtml(item.participantId)}</strong></td>
        <td><span class="badge-cond" style="background: rgba(99,102,241,0.15); color: #c7d2fe;">${escapeHtml(item.orderGroup || '-')}</span></td>
        <td>${item.trialOrder ? '#' + item.trialOrder : '-'}</td>
        <td><span class="badge-cond ${animBadgeClass}"><strong>${escapeHtml(item.conditionCode || '-')}</strong></span></td>
        <td><small class="text-muted">${escapeHtml((item.animCode || '') + (item.durCode || ''))}</small></td>
        <td>${escapeHtml(item.animName || (item.animation === 'loading' ? '載入圖示' : item.animation))}</td>
        <td><span class="badge-e" style="background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.2); color:#818cf8;">${item.durationText}</span></td>
        <td title="原始選值: ${item.q1_estimateRaw}">${item.q1_estimateText}</td>
        <td title="1(快)～5(慢)">${item.q2_speed}</td>
        <td title="1(短)～5(長)">${item.q3_time_passage}</td>
        <td>${item.q4_interest}</td>
        <td>${item.q5_aesthetics}</td>
        <td title="E1:${item.e1} E2:${item.e2} E3:${item.e3} E4:${item.e4} E5:${item.e5}">${emoAvg} <span class="text-muted">(Avg)</span></td>
        <td title="U1:${item.u1} U2:${item.u2} U3:${item.u3} U4:${item.u4} U5:${item.u5}">${utiAvg} <span class="text-muted">(Avg)</span></td>
        <td><span class="text-muted">${dateStr}</span></td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
}

// Render the 9x9 Latin Square Matrix in Dashboard
function renderLatinSquareTable() {
  const tbody = document.getElementById('tbody-latin-square');
  if (!tbody) return;

  const square = getOrInitLatinSquare();
  let html = '';

  square.forEach((row, rowIndex) => {
    const groupNum = rowIndex + 1;
    const groupCode = `S0${groupNum}`.slice(-3);
    
    // Calculate sample participant IDs that fall into this row (e.g. S01 -> P001, P010, P019...)
    const p1 = 'P' + String(groupNum).padStart(3, '0');
    const p2 = 'P' + String(groupNum + 9).padStart(3, '0');

    html += `
      <tr>
        <td class="ls-group-col">
          <strong>第 ${groupNum} 組 (${groupCode})</strong>
          <br><small class="text-muted">${p1}, ${p2}...</small>
        </td>
    `;

    row.forEach((condCode, colIndex) => {
      const cond = CONDITIONS[condCode];
      const animBadgeClass = cond.animCode === 'A1' ? 'badge-anim-a1' :
                             cond.animCode === 'A2' ? 'badge-anim-a2' : 'badge-anim-a3';
      const tooltip = `序號 ${colIndex + 1}: ${cond.conditionCode} = ${cond.animName} ${cond.durationText} (${cond.animCode}${cond.durCode})`;
      
      html += `
        <td>
          <span class="ls-cell-badge ${animBadgeClass}" title="${tooltip}">
            ${condCode}
          </span>
        </td>
      `;
    });

    html += `</tr>`;
  });

  tbody.innerHTML = html;
}

// Helper to escape HTML characters
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// Clear browser DB
function clearDatabase() {
  if (!confirm('🚨 確定要清空所有實驗數據嗎？\n此動作無法還原，請確認是否已備份 CSV！')) return;
  
  localStorage.removeItem('qoe_study_data');
  renderDashboard();
  alert('數據庫已清空！');
}

// Load Scientific Realistic Mock Data for Demonstration
function loadSampleMockData() {
  const mockData = [];
  const subjects = ['P001', 'P002', 'P003', 'P004', 'P005'];
  
  // Seed database
  subjects.forEach(subjectId => {
    // Constant demographics for each mock subject
    const gender = Math.random() > 0.5 ? '生理男性' : '生理女性';
    const ageOptions = ['18-24歲', '25-34歲', '35-44歲', '45歲以上'];
    const age = ageOptions[Math.floor(Math.random() * ageOptions.length)];

    // Generate all 9 trials according to Latin Square order for this participant
    const participantTrials = getTrialsForParticipant(subjectId);
    
    participantTrials.forEach(trial => {
      let q1Raw, q2, q3, q4, q5;
      let e1, e2, e3, e4, e5;
      let u1, u2, u3, u4, u5;
      
      const isPercent = trial.animation === '百分比';
      const isCoffee = trial.animation === '咖啡杯';
      const isLoading = trial.animation === 'loading';
      
      const dur = trial.durationSec;
      
      // 1. Time Judgment Q1 and Passage of Time Q3 (Psychological Modeling)
      // Note: Q2 is 1=Fast, 5=Slow; Q3 is 1=Short, 5=Long!
      if (isCoffee) {
        // Coffee Cup: engaging, aesthetic. Time flies!
        // Underestimates time
        if (dur === 3) q1Raw = parseFloat((Math.random() * 0.8 + 1.2).toFixed(1)); // 1.2 - 2.0s
        else if (dur === 5) q1Raw = parseFloat((Math.random() * 1.2 + 3.0).toFixed(1)); // 3.0 - 4.2s
        else q1Raw = parseFloat((Math.random() * 2.0 + 6.5).toFixed(1)); // 6.5 - 8.5s
        
        q2 = Math.floor(Math.random() * 2) + 1; // 1-2 (Feels Fast!)
        q3 = Math.floor(Math.random() * 2) + 1; // 1-2 (Feels Short!)
        q4 = Math.floor(Math.random() * 2) + 4; // 4-5 (Interesting)
        q5 = Math.floor(Math.random() * 2) + 4; // 4-5 (High Aesthetics)
      } 
      else if (isPercent) {
        // Percentage: high information feedback, highly accurate.
        if (dur === 3) q1Raw = parseFloat((Math.random() * 0.6 + 2.7).toFixed(1)); // 2.7 - 3.3s
        else if (dur === 5) q1Raw = parseFloat((Math.random() * 0.8 + 4.6).toFixed(1)); // 4.6 - 5.4s
        else q1Raw = parseFloat((Math.random() * 1.5 + 9.2).toFixed(1)); // 9.2 - 10.7s
        
        q2 = Math.floor(Math.random() * 2) + 1; // 1-2 (Active ticking feels fast!)
        q3 = Math.floor(Math.random() * 2) + 2; // 2-3 (Moderate passage)
        q4 = Math.floor(Math.random() * 2) + 2; // 2-3 (Plain)
        q5 = Math.floor(Math.random() * 2) + 2; // 2-3 (Plain)
      } 
      else {
        // Loading: boring spinner. 度日如年!
        // Overestimates time
        if (dur === 3) q1Raw = parseFloat((Math.random() * 1.5 + 3.8).toFixed(1)); // 3.8 - 5.3s
        else if (dur === 5) q1Raw = parseFloat((Math.random() * 2.5 + 6.2).toFixed(1)); // 6.2 - 8.7s
        else q1Raw = parseFloat((Math.random() * 4.0 + 11.2).toFixed(1)); // 11.2 - 15.0s
        
        q2 = Math.floor(Math.random() * 2) + 4; // 4-5 (Slow! Endless spinner)
        q3 = Math.floor(Math.random() * 2) + 4; // 4-5 (Feels Long!)
        q4 = Math.floor(Math.random() * 2) + 1; // 1-2 (Boring)
        q5 = Math.floor(Math.random() * 2) + 1; // 1-2 (Low aesthetics)
      }
      
      // 2. Emotional SD (E1-E5)
      if (isCoffee) {
        // Feels cozy and relaxed
        e1 = Math.floor(Math.random() * 2) + 4; // Happy
        e2 = Math.floor(Math.random() * 2) + 4; // Comfortable
        e3 = Math.floor(Math.random() * 2) + 4; // At ease
        e4 = Math.floor(Math.random() * 2) + 4; // Relaxed
        e5 = Math.floor(Math.random() * 2) + 4; // Stimulated/Surprised
      } else if (isPercent) {
        // Neutral/Comfortable
        e1 = Math.floor(Math.random() * 2) + 3;
        e2 = Math.floor(Math.random() * 2) + 3;
        e3 = Math.floor(Math.random() * 2) + 3;
        e4 = Math.floor(Math.random() * 2) + 3;
        e5 = Math.floor(Math.random() * 2) + 2; // Low stimulation
      } else {
        // Boring spinner causes anxiety and tension, especially at 10s
        const anxietyFactor = dur === 10 ? 1 : 2;
        e1 = Math.floor(Math.random() * 2) + 2;
        e2 = Math.floor(Math.random() * 2) + 2;
        e3 = Math.floor(Math.random() * 2) + anxietyFactor; 
        e4 = Math.floor(Math.random() * 2) + anxietyFactor;
        e5 = Math.floor(Math.random() * 2) + 1;
      }
      
      // 3. Functional SD (U1-U5)
      if (isPercent) {
        // Extremely high control confidence
        u1 = Math.floor(Math.random() * 2) + 4; // Patient (knows when it will end)
        u2 = Math.floor(Math.random() * 2) + 3;
        u3 = Math.floor(Math.random() * 2) + 4; // Powerful (has information)
        u4 = Math.floor(Math.random() * 2) + 3;
        u5 = Math.floor(Math.random() * 2) + 4; // Confident
      } else if (isCoffee) {
        u1 = Math.floor(Math.random() * 2) + 4; // Patient (distracted by design)
        u2 = Math.floor(Math.random() * 2) + 4;
        u3 = Math.floor(Math.random() * 2) + 3; // Low status feedback
        u4 = Math.floor(Math.random() * 2) + 3; 
        u5 = Math.floor(Math.random() * 2) + 3;
      } else {
        // Spinner is annoying and helpless
        const annoyanceFactor = dur === 10 ? 1 : 2;
        u1 = Math.floor(Math.random() * 2) + annoyanceFactor; // Impatient
        u2 = Math.floor(Math.random() * 2) + 2;
        u3 = Math.floor(Math.random() * 2) + 1; // Helpless (no clue when it stops)
        u4 = Math.floor(Math.random() * 2) + annoyanceFactor; // Annoyed
        u5 = Math.floor(Math.random() * 2) + 2; // Confused
      }
      
      // Compute overall score with reversed Q2 & Q3
      const list = [6 - q2, 6 - q3, q4, q5, e1, e2, e3, e4, e5, u1, u2, u3, u4, u5];
      const overall = parseFloat((list.reduce((a,b)=>a+b, 0)/list.length).toFixed(2));
      
      // Timestamp distributed over the last hour
      const timeOffset = Math.floor(Math.random() * 3600) * 1000;
      const ts = new Date(Date.now() - timeOffset).toISOString();
      
      mockData.push({
        participantId: subjectId,
        orderGroup: trial.orderGroup,
        groupNumber: trial.groupNumber,
        trialOrder: trial.trialOrder,
        conditionCode: trial.conditionCode,
        animCode: trial.animCode,
        durCode: trial.durCode,
        gender: gender,
        age: age,
        timestamp: ts,
        animation: trial.animation,
        animName: trial.animName,
        durationText: trial.durationText,
        durationSec: trial.durationSec,
        q1_estimateRaw: q1Raw,
        q1_estimateText: q1Raw.toFixed(1) + " 秒",
        q1_estimateMidpoint: q1Raw,
        q2_speed: q2,
        q3_time_passage: q3,
        q4_interest: q4,
        q5_aesthetics: q5,
        e1, e2, e3, e4, e5,
        u1, u2, u3, u4, u5,
        overallQoE: overall
      });
    });
  });
  
  // Write to localStorage
  localStorage.setItem('qoe_study_data', JSON.stringify(mockData));
  renderDashboard();
  alert('成功模擬載入 5 位受試者共 45 筆符合 9×9 拉丁方格之完整實驗數據！\n您可以立即在下方查看視覺化圖表、拉丁方格與數據表格。');
}

// Generate CSV string and trigger download in browser
function exportCSV() {
  const data = JSON.parse(localStorage.getItem('qoe_study_data') || '[]');
  if (data.length === 0) {
    alert('無可用數據進行匯出，請先填寫問卷！');
    return;
  }
  
  // Define CSV Header
  const headers = [
    'ParticipantID', 'OrderGroup', 'TrialOrder', 'ConditionCode', 'AnimCode', 'DurCode',
    'Gender', 'AgeGroup', 'Timestamp', 'Animation', 'ActualDurationText', 'ActualDurationSec',
    'Q1_EstimateRaw', 'Q1_EstimateText', 'Q1_EstimateMidpointSec',
    'Q2_Speed', 'Q3_TimePassage', 'Q4_Interest', 'Q5_Aesthetics',
    'E1_Happy', 'E2_Comfortable', 'E3_AtEase', 'E4_Relaxed', 'E5_Stimulated',
    'U1_Patient', 'U2_Energetic', 'U3_Powerful', 'U4_Excited', 'U5_Confident',
    'OverallQoE'
  ];
  
  let csvContent = headers.join(',') + '\r\n';
  
  data.forEach(item => {
    const row = [
      escapeCsvCell(item.participantId),
      escapeCsvCell(item.orderGroup || '-'),
      item.trialOrder || '-',
      escapeCsvCell(item.conditionCode || '-'),
      escapeCsvCell(item.animCode || '-'),
      escapeCsvCell(item.durCode || '-'),
      escapeCsvCell(item.gender || '-'),
      escapeCsvCell(item.age || '-'),
      item.timestamp,
      escapeCsvCell(item.animation),
      escapeCsvCell(item.durationText),
      item.durationSec,
      item.q1_estimateRaw,
      escapeCsvCell(item.q1_estimateText),
      item.q1_estimateMidpoint,
      item.q2_speed,
      item.q3_time_passage,
      item.q4_interest,
      item.q5_aesthetics,
      item.e1,
      item.e2,
      item.e3,
      item.e4,
      item.e5,
      item.u1,
      item.u2,
      item.u3,
      item.u4,
      item.u5,
      item.overallQoE
    ];
    csvContent += row.join(',') + '\r\n';
  });
  
  // Add Unicode BOM (\ufeff) to force Excel to read UTF-8 correctly
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  // File naming convention: QoE_Study_Data_YYYYMMDD_HHMM.csv
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, '');
  
  link.setAttribute('href', url);
  link.setAttribute('download', `QoE_Study_Data_${dateStr}_${timeStr}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Helper to escape cells containing commas or double quotes
function escapeCsvCell(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Export current session data as CSV for participants to email
function exportSessionCSV() {
  const data = state.trialResults;
  if (data.length === 0) {
    alert('無可用數據進行匯出！');
    return;
  }
  
  // Define CSV Header
  const headers = [
    'ParticipantID', 'OrderGroup', 'TrialOrder', 'ConditionCode', 'AnimCode', 'DurCode',
    'Gender', 'AgeGroup', 'Timestamp', 'Animation', 'ActualDurationText', 'ActualDurationSec',
    'Q1_EstimateRaw', 'Q1_EstimateText', 'Q1_EstimateMidpointSec',
    'Q2_Speed', 'Q3_TimePassage', 'Q4_Interest', 'Q5_Aesthetics',
    'E1_Happy', 'E2_Comfortable', 'E3_AtEase', 'E4_Relaxed', 'E5_Stimulated',
    'U1_Patient', 'U2_Energetic', 'U3_Powerful', 'U4_Excited', 'U5_Confident',
    'OverallQoE'
  ];
  
  let csvContent = headers.join(',') + '\r\n';
  
  data.forEach(item => {
    const row = [
      escapeCsvCell(item.participantId),
      escapeCsvCell(item.orderGroup || '-'),
      item.trialOrder || '-',
      escapeCsvCell(item.conditionCode || '-'),
      escapeCsvCell(item.animCode || '-'),
      escapeCsvCell(item.durCode || '-'),
      escapeCsvCell(item.gender || '-'),
      escapeCsvCell(item.age || '-'),
      item.timestamp,
      escapeCsvCell(item.animation),
      escapeCsvCell(item.durationText),
      item.durationSec,
      item.q1_estimateRaw,
      escapeCsvCell(item.q1_estimateText),
      item.q1_estimateMidpoint,
      item.q2_speed,
      item.q3_time_passage,
      item.q4_interest,
      item.q5_aesthetics,
      item.e1,
      item.e2,
      item.e3,
      item.e4,
      item.e5,
      item.u1,
      item.u2,
      item.u3,
      item.u4,
      item.u5,
      item.overallQoE
    ];
    csvContent += row.join(',') + '\r\n';
  });
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, '');
  
  const safePId = escapeCsvCell(state.participantId).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${safePId}_QoE_Data_${dateStr}_${timeStr}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  alert('您的答題紀錄已匯出成功！\n請將下載的 CSV 檔案傳送給研究者以完成實驗。謝謝您的參與！');
}

// Automatically send individual trial data to Google Sheets script
function sendDataToGoogleSheets(result) {
  if (!GOOGLE_SCRIPT_URL) return;
  
  // Flattening or mapping key-values for easier sheet consumption
  const postData = {
    "ParticipantID": result.participantId,
    "OrderGroup": result.orderGroup || '-',
    "TrialOrder": result.trialOrder || '-',
    "ConditionCode": result.conditionCode || '-',
    "AnimCode": result.animCode || '-',
    "DurCode": result.durCode || '-',
    "Gender": result.gender || '-',
    "AgeGroup": result.age || '-',
    "Timestamp": result.timestamp,
    "Animation": result.animation,
    "ActualDurationText": result.durationText,
    "ActualDurationSec": result.durationSec,
    "Q1_EstimateRaw": result.q1_estimateRaw,
    "Q1_EstimateText": result.q1_estimateText,
    "Q1_EstimateMidpoint": result.q1_estimateMidpoint,
    "Q2_Speed": result.q2_speed,
    "Q3_TimePassage": result.q3_time_passage,
    "Q4_Interest": result.q4_interest,
    "Q5_Aesthetics": result.q5_aesthetics,
    "E1_Sad_Happy": result.e1,
    "E2_Uncomfortable_Comfortable": result.e2,
    "E3_Tense_AtEase": result.e3,
    "E4_Anxious_Relaxed": result.e4,
    "E5_Unimpressed_Stimulated": result.e5,
    "U1_Impatient_Patient": result.u1,
    "U2_Tired_Energetic": result.u2,
    "U3_Helpless_Powerful": result.u3,
    "U4_Annoyed_Excited": result.u4,
    "U5_Confused_Confident": result.u5,
    "OverallQoE": result.overallQoE
  };

  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors', // Avoids CORS preflight failures on Web App redirect
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(postData)
  })
  .then(() => {
    console.log("Response recorded to Google Sheets successfully.");
  })
  .catch(err => {
    console.error("Error sending response to Google Sheets:", err);
  });
}

// Automatically generate the next Participant ID based on local storage data
function getNextParticipantId() {
  try {
    const data = JSON.parse(localStorage.getItem('qoe_study_data') || '[]');
    const existingIds = new Set(data.map(item => item.participantId));
    
    let maxNum = 0;
    existingIds.forEach(id => {
      if (typeof id === 'string') {
        const match = id.match(/^P(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });
    
    const nextNum = maxNum + 1;
    return 'P' + String(nextNum).padStart(3, '0');
  } catch (e) {
    console.error("Error generating next participant ID:", e);
    return 'P001';
  }
}

// Update the Participant ID UI, order group, and hidden input value
function updateOnboardingParticipantId(overrideId = null) {
  // Check URL param if no override provided
  let targetId = overrideId;
  if (!targetId) {
    const urlParams = new URLSearchParams(window.location.search);
    const paramId = urlParams.get('pid') || urlParams.get('p') || urlParams.get('id');
    if (paramId) {
      if (!paramId.startsWith('P')) {
        const num = parseInt(paramId, 10);
        targetId = !isNaN(num) ? 'P' + String(num).padStart(3, '0') : paramId;
      } else {
        targetId = paramId;
      }
    }
  }

  const nextId = targetId || getNextParticipantId();
  const displayEl = document.getElementById('display-participant-id');
  const displayGroupEl = document.getElementById('display-order-group');
  const inputEl = document.getElementById('participant-id');
  
  if (displayEl && inputEl) {
    displayEl.textContent = nextId;
    inputEl.value = nextId;
  }

  if (displayGroupEl) {
    const groupInfo = getOrderGroupInfo(nextId);
    displayGroupEl.textContent = `🎲 分配順序組別：第 ${groupInfo.groupNumber} 組 (${groupInfo.groupCode})`;
  }
}
