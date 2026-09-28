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
        const candidate = customId.trim().toUpperCase();
        if (isParticipantIdDuplicate(candidate)) {
          alert(`⚠️ 受試者代號「${candidate}」已經存在於系統紀錄中！\n根據實驗規範，受試者號碼不能重複。請輸入其他未使用的代號。`);
        }
        updateOnboardingParticipantId(candidate);
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
  const btnExportLong = document.getElementById('btn-export-long-csv');
  if (btnExportLong) {
    btnExportLong.addEventListener('click', exportLongCSV);
  }
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

  // URL Hash navigation support (#dashboard, #researcher-dashboard)
  function handleHashNavigation() {
    const hash = window.location.hash;
    if (hash === '#dashboard' || hash === '#researcher-dashboard') {
      setResearcherMode(true);
      showSection('dashboard');
      renderDashboard();
    } else if (hash === '#onboarding' || hash === '#setup') {
      showSection('setup');
    }
  }
  window.addEventListener('hashchange', handleHashNavigation);
  handleHashNavigation();

  // Initialize DB view in Dashboard
  renderDashboard();
});

// Start the Experiment Session
function startExperiment() {
  const pIdInput = document.getElementById('participant-id').value.trim();
  if (!pIdInput) return alert('受試者代號未生成，請重新整理網頁！');
  
  if (isParticipantIdDuplicate(pIdInput)) {
    return alert(`⚠️ 受試者代號「${pIdInput}」已經存在於系統紀錄中！\n根據實驗規範，受試者號碼不能重複。請更換代號後再開始。`);
  }
  
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
  
  // Collect ratings for the 10 questions (Q1 to Q10)
  const q1Val = parseFloat(document.getElementById('q1-slider').value);
  const q2Val = parseInt(document.querySelector('input[name="q2"]:checked').value);
  const q3Val = parseInt(document.querySelector('input[name="q3"]:checked').value);
  const q4Val = parseInt(document.querySelector('input[name="q4"]:checked').value);
  const q5Val = parseInt(document.querySelector('input[name="q5"]:checked').value);
  const q6Val = parseInt(document.querySelector('input[name="q6"]:checked').value);
  const q7Val = parseInt(document.querySelector('input[name="q7"]:checked').value);
  const q8Val = parseInt(document.querySelector('input[name="q8"]:checked').value);
  const q9Val = parseInt(document.querySelector('input[name="q9"]:checked').value);
  const q10Val = parseInt(document.querySelector('input[name="q10"]:checked').value);
  
  // Calculate average QoE Score across the 9 semantic differential items (Q2 to Q10)
  // Note: Q2 (1=Short, 5=Long) is inverted pole for QoE satisfaction ("higher is better"),
  // reverse-code it as (6 - value)
  const q2Positive = 6 - q2Val;
  const qoeScoreList = [q2Positive, q3Val, q4Val, q5Val, q6Val, q7Val, q8Val, q9Val, q10Val];
  const overallQoE = parseFloat((qoeScoreList.reduce((a,b) => a+b, 0) / qoeScoreList.length).toFixed(2));
  
  // Emotional items composite average (Q4 - Q7)
  const emoAvg = parseFloat(((q4Val + q5Val + q6Val + q7Val) / 4).toFixed(2));
  // Utilitarian items composite average (Q8 - Q10)
  const utiAvg = parseFloat(((q8Val + q9Val + q10Val) / 3).toFixed(2));

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
    q2_time_passage: q2Val,
    q3_interest: q3Val,
    q4_happy: q4Val,
    q5_comfortable: q5Val,
    q6_relaxed: q6Val,
    q7_stimulated: q7Val,
    q8_patient: q8Val,
    q9_energetic: q9Val,
    q10_powerful: q10Val,
    emoAvg: emoAvg,
    utiAvg: utiAvg,
    overallQoE: overallQoE
  };
  
  state.trialResults.push(trialResult);
  
  // Proceed to next trial or finish
  state.currentTrialIndex++;
  if (state.currentTrialIndex < state.trialList.length) {
    runTrial();
  } else {
    // Session is complete! Write session results to browser storage
    saveSessionToDatabase();
    
    // Construct consolidated 1-row data (C01 to C09 in order) and sync to Excel (Google Sheets)
    const wideData = buildParticipantWideData(
      state.participantId,
      state.trialResults,
      state.gender,
      state.age,
      state.groupInfo ? state.groupInfo.groupCode : '',
      new Date().toISOString()
    );
    sendParticipantWideRowToGoogleSheets(wideData);

    showThankYouScreen();
  }
}

// Show final completed screen
function showThankYouScreen() {
  document.getElementById('summary-p-id').textContent = state.participantId;
  const groupText = state.groupInfo ? ` (順序組別: ${state.groupInfo.groupCode})` : '';
  document.getElementById('summary-trial-count').textContent = `${state.trialResults.length} / ${state.trialList.length}${groupText} (C01–C09 全數完成)`;
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
    const sumEmotional = data.reduce((sum, item) => {
      const e = item.emoAvg !== undefined ? item.emoAvg : (item.q4_happy + item.q5_comfortable + item.q6_relaxed + item.q7_stimulated) / 4;
      return sum + (isNaN(e) ? 0 : e);
    }, 0);
    const avgEmotional = (sumEmotional / data.length).toFixed(2);

    const sumUtilitarian = data.reduce((sum, item) => {
      const u = item.utiAvg !== undefined ? item.utiAvg : (item.q8_patient + item.q9_energetic + item.q10_powerful) / 3;
      return sum + (isNaN(u) ? 0 : u);
    }, 0);
    const avgUtilitarian = (sumUtilitarian / data.length).toFixed(2);
    
    const statEmo = document.getElementById('stat-avg-emotional');
    if (statEmo) statEmo.textContent = avgEmotional;
    const statUti = document.getElementById('stat-avg-utilitarian');
    if (statUti) statUti.textContent = avgUtilitarian;
  } else {
    const statEmo = document.getElementById('stat-avg-emotional');
    if (statEmo) statEmo.textContent = '-';
    const statUti = document.getElementById('stat-avg-utilitarian');
    if (statUti) statUti.textContent = '-';
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
        <td colspan="14" class="text-center text-muted">目前尚無實驗紀錄。請前往「進行實驗」填寫問卷，或點擊「載入範例模擬數據」。</td>
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
    
    // Emotional items composite average (Q4 - Q7)
    const emoAvg = item.emoAvg !== undefined ? item.emoAvg : (((item.q4_happy || 0) + (item.q5_comfortable || 0) + (item.q6_relaxed || 0) + (item.q7_stimulated || 0)) / 4).toFixed(1);
    // Utilitarian items composite average (Q8 - Q10)
    const utiAvg = item.utiAvg !== undefined ? item.utiAvg : (((item.q8_patient || 0) + (item.q9_energetic || 0) + (item.q10_powerful || 0)) / 3).toFixed(1);

    const animBadgeClass = item.animCode === 'A1' ? 'badge-anim-a1' :
                           item.animCode === 'A2' ? 'badge-anim-a2' : 'badge-anim-a3';
    
    html += `
      <tr>
        <td><strong>${escapeHtml(item.participantId)}</strong></td>
        <td><span class="badge-cond" style="background: rgba(99,102,241,0.15); color: #4338ca;">${escapeHtml(item.orderGroup || '-')}</span></td>
        <td>${item.trialOrder ? '#' + item.trialOrder : '-'}</td>
        <td><span class="badge-cond ${animBadgeClass}"><strong>${escapeHtml(item.conditionCode || '-')}</strong></span></td>
        <td><small class="text-muted">${escapeHtml((item.animCode || '') + (item.durCode || ''))}</small></td>
        <td>${escapeHtml(item.animName || (item.animation === 'loading' ? '載入圖示' : item.animation))}</td>
        <td><span class="badge-e">${item.durationText}</span></td>
        <td title="原始估算: ${item.q1_estimateRaw}">${item.q1_estimateText}</td>
        <td title="1(短)～5(長)">${item.q2_time_passage}</td>
        <td title="1(無趣)～5(有趣)">${item.q3_interest}</td>
        <td title="Q4:${item.q4_happy} Q5:${item.q5_comfortable} Q6:${item.q6_relaxed} Q7:${item.q7_stimulated}">${emoAvg} <span class="text-muted">(Avg)</span></td>
        <td title="Q8:${item.q8_patient} Q9:${item.q9_energetic} Q10:${item.q10_powerful}">${utiAvg} <span class="text-muted">(Avg)</span></td>
        <td><strong>${item.overallQoE}</strong></td>
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
  updateOnboardingParticipantId();
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
      let q1Raw, q2, q3; // Q1 estimate, Q2 passage of time, Q3 interest
      let q4, q5, q6, q7; // Q4 happy, Q5 comfortable, Q6 relaxed, Q7 stimulated (Affective)
      let q8, q9, q10; // Q8 patient, Q9 energetic, Q10 powerful (Utilitarian)
      
      const isPercent = trial.animation === '百分比';
      const isCoffee = trial.animation === '咖啡杯';
      const isLoading = trial.animation === 'loading';
      
      const dur = trial.durationSec;
      
      // 1. Time Judgment Q1, Passage of Time Q2, Interest Q3
      if (isCoffee) {
        // Coffee Cup: engaging, aesthetic. Time flies! Underestimates time
        if (dur === 3) q1Raw = parseFloat((Math.random() * 0.8 + 1.2).toFixed(1)); // 1.2 - 2.0s
        else if (dur === 5) q1Raw = parseFloat((Math.random() * 1.2 + 3.0).toFixed(1)); // 3.0 - 4.2s
        else q1Raw = parseFloat((Math.random() * 2.0 + 6.5).toFixed(1)); // 6.5 - 8.5s
        
        q2 = Math.floor(Math.random() * 2) + 1; // 1-2 (Feels Short!)
        q3 = Math.floor(Math.random() * 2) + 4; // 4-5 (Interesting)
      } 
      else if (isPercent) {
        // Percentage: high information feedback, highly accurate.
        if (dur === 3) q1Raw = parseFloat((Math.random() * 0.6 + 2.7).toFixed(1)); // 2.7 - 3.3s
        else if (dur === 5) q1Raw = parseFloat((Math.random() * 0.8 + 4.6).toFixed(1)); // 4.6 - 5.4s
        else q1Raw = parseFloat((Math.random() * 1.5 + 9.2).toFixed(1)); // 9.2 - 10.7s
        
        q2 = Math.floor(Math.random() * 2) + 2; // 2-3 (Moderate passage)
        q3 = Math.floor(Math.random() * 2) + 2; // 2-3 (Plain)
      } 
      else {
        // Loading: boring spinner. 度日如年! Overestimates time
        if (dur === 3) q1Raw = parseFloat((Math.random() * 1.5 + 3.8).toFixed(1)); // 3.8 - 5.3s
        else if (dur === 5) q1Raw = parseFloat((Math.random() * 2.5 + 6.2).toFixed(1)); // 6.2 - 8.7s
        else q1Raw = parseFloat((Math.random() * 4.0 + 11.2).toFixed(1)); // 11.2 - 15.0s
        
        q2 = Math.floor(Math.random() * 2) + 4; // 4-5 (Feels Long!)
        q3 = Math.floor(Math.random() * 2) + 1; // 1-2 (Boring)
      }
      
      // 2. Emotional SD (Q4 Happy, Q5 Comfortable, Q6 Relaxed, Q7 Stimulated)
      if (isCoffee) {
        q4 = Math.floor(Math.random() * 2) + 4; // Happy
        q5 = Math.floor(Math.random() * 2) + 4; // Comfortable
        q6 = Math.floor(Math.random() * 2) + 4; // Relaxed
        q7 = Math.floor(Math.random() * 2) + 4; // Stimulated/Surprised
      } else if (isPercent) {
        q4 = Math.floor(Math.random() * 2) + 3;
        q5 = Math.floor(Math.random() * 2) + 3;
        q6 = Math.floor(Math.random() * 2) + 3;
        q7 = Math.floor(Math.random() * 2) + 2;
      } else {
        const anxietyFactor = dur === 10 ? 1 : 2;
        q4 = Math.floor(Math.random() * 2) + 2;
        q5 = Math.floor(Math.random() * 2) + 2;
        q6 = Math.floor(Math.random() * 2) + anxietyFactor;
        q7 = Math.floor(Math.random() * 2) + 1;
      }
      
      // 3. Functional SD (Q8 Patient, Q9 Energetic, Q10 Powerful)
      if (isPercent) {
        q8 = Math.floor(Math.random() * 2) + 4; // Patient
        q9 = Math.floor(Math.random() * 2) + 3; // Energetic
        q10 = Math.floor(Math.random() * 2) + 4; // Powerful
      } else if (isCoffee) {
        q8 = Math.floor(Math.random() * 2) + 4;
        q9 = Math.floor(Math.random() * 2) + 4;
        q10 = Math.floor(Math.random() * 2) + 3;
      } else {
        const annoyanceFactor = dur === 10 ? 1 : 2;
        q8 = Math.floor(Math.random() * 2) + annoyanceFactor;
        q9 = Math.floor(Math.random() * 2) + 2;
        q10 = Math.floor(Math.random() * 2) + 1;
      }
      
      // Compute overall score with reversed Q2 (Short=5, Long=1)
      const list = [6 - q2, q3, q4, q5, q6, q7, q8, q9, q10];
      const overall = parseFloat((list.reduce((a,b)=>a+b, 0)/list.length).toFixed(2));
      const emoAvg = parseFloat(((q4 + q5 + q6 + q7) / 4).toFixed(2));
      const utiAvg = parseFloat(((q8 + q9 + q10) / 3).toFixed(2));
      
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
        q2_time_passage: q2,
        q3_interest: q3,
        q4_happy: q4,
        q5_comfortable: q5,
        q6_relaxed: q6,
        q7_stimulated: q7,
        q8_patient: q8,
        q9_energetic: q9,
        q10_powerful: q10,
        emoAvg: emoAvg,
        utiAvg: utiAvg,
        overallQoE: overall
      });
    });
  });
  
  // Write to localStorage
  localStorage.setItem('qoe_study_data', JSON.stringify(mockData));
  renderDashboard();
  updateOnboardingParticipantId();
  alert('成功模擬載入 5 位受試者共 45 筆符合 9×9 拉丁方格之完整實驗數據！\n您可以立即在下方查看視覺化圖表、拉丁方格與數據表格。');
}

// Build Wide-format Data Object (1 row per participant, ordered C01 to C09)
function buildParticipantWideData(participantId, trialResults, gender = null, age = null, orderGroup = null, timestamp = null) {
  const codes = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09'];
  const baseResult = (trialResults && trialResults.length > 0) ? trialResults[0] : {};
  
  const row = {
    ParticipantID: participantId,
    OrderGroup: orderGroup || baseResult.orderGroup || '-',
    Gender: gender || baseResult.gender || '-',
    AgeGroup: age || baseResult.age || '-',
    Timestamp: timestamp || (trialResults && trialResults[trialResults.length - 1] ? trialResults[trialResults.length - 1].timestamp : new Date().toISOString())
  };

  codes.forEach(code => {
    const t = trialResults ? trialResults.find(item => item.conditionCode === code) : null;
    if (t) {
      const eAvg = t.emoAvg !== undefined ? t.emoAvg : parseFloat(((t.q4_happy + t.q5_comfortable + t.q6_relaxed + t.q7_stimulated) / 4).toFixed(2));
      const uAvg = t.utiAvg !== undefined ? t.utiAvg : parseFloat(((t.q8_patient + t.q9_energetic + t.q10_powerful) / 3).toFixed(2));
      row[`${code}_Order`] = t.trialOrder;
      row[`${code}_Q1_Sec`] = t.q1_estimateRaw;
      row[`${code}_Q2_TimePassage`] = t.q2_time_passage;
      row[`${code}_Q3_Interest`] = t.q3_interest;
      row[`${code}_Q4_Happy`] = t.q4_happy;
      row[`${code}_Q5_Comfortable`] = t.q5_comfortable;
      row[`${code}_Q6_Relaxed`] = t.q6_relaxed;
      row[`${code}_Q7_Stimulated`] = t.q7_stimulated;
      row[`${code}_E_Avg`] = eAvg;
      row[`${code}_Q8_Patient`] = t.q8_patient;
      row[`${code}_Q9_Energetic`] = t.q9_energetic;
      row[`${code}_Q10_Powerful`] = t.q10_powerful;
      row[`${code}_U_Avg`] = uAvg;
      row[`${code}_OverallQoE`] = t.overallQoE;
    } else {
      row[`${code}_Order`] = '-';
      row[`${code}_Q1_Sec`] = '-';
      row[`${code}_Q2_TimePassage`] = '-';
      row[`${code}_Q3_Interest`] = '-';
      row[`${code}_Q4_Happy`] = '-';
      row[`${code}_Q5_Comfortable`] = '-';
      row[`${code}_Q6_Relaxed`] = '-';
      row[`${code}_Q7_Stimulated`] = '-';
      row[`${code}_E_Avg`] = '-';
      row[`${code}_Q8_Patient`] = '-';
      row[`${code}_Q9_Energetic`] = '-';
      row[`${code}_Q10_Powerful`] = '-';
      row[`${code}_U_Avg`] = '-';
      row[`${code}_OverallQoE`] = '-';
    }
  });

  return row;
}

// Generate CSV string and trigger download in browser (Wide Format: 1 row per participant, C01 to C09)
function exportCSV() {
  const data = JSON.parse(localStorage.getItem('qoe_study_data') || '[]');
  if (data.length === 0) {
    alert('無可用數據進行匯出，請先填寫問卷！');
    return;
  }

  // Group trials by participantId preserving insertion order
  const participantsMap = new Map();
  data.forEach(item => {
    if (!participantsMap.has(item.participantId)) {
      participantsMap.set(item.participantId, []);
    }
    participantsMap.get(item.participantId).push(item);
  });

  const wideRows = [];
  participantsMap.forEach((trials, pId) => {
    wideRows.push(buildParticipantWideData(pId, trials));
  });

  if (wideRows.length === 0) {
    alert('無可用數據進行匯出！');
    return;
  }

  const headers = Object.keys(wideRows[0]);
  let csvContent = headers.join(',') + '\r\n';

  wideRows.forEach(row => {
    const values = headers.map(h => escapeCsvCell(row[h]));
    csvContent += values.join(',') + '\r\n';
  });

  // Add Unicode BOM (\ufeff) to force Excel to read UTF-8 correctly
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, '');

  link.setAttribute('href', url);
  link.setAttribute('download', `QoE_Study_Wide_C01_C09_${dateStr}_${timeStr}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Export detailed trials as CSV (Long format: 1 row per trial)
function exportLongCSV() {
  const data = JSON.parse(localStorage.getItem('qoe_study_data') || '[]');
  if (data.length === 0) {
    alert('無可用數據進行匯出，請先填寫問卷！');
    return;
  }

  const headers = [
    'ParticipantID', 'OrderGroup', 'TrialOrder', 'ConditionCode', 'AnimCode', 'DurCode',
    'Gender', 'AgeGroup', 'Timestamp', 'Animation', 'ActualDurationText', 'ActualDurationSec',
    'Q1_EstimateRaw', 'Q1_EstimateText', 'Q1_EstimateMidpointSec',
    'Q2_TimePassage', 'Q3_Interest',
    'Q4_Happy', 'Q5_Comfortable', 'Q6_Relaxed', 'Q7_Stimulated', 'Emotional_Avg',
    'Q8_Patient', 'Q9_Energetic', 'Q10_Powerful', 'Utilitarian_Avg',
    'OverallQoE'
  ];

  let csvContent = headers.join(',') + '\r\n';

  data.forEach(item => {
    const eAvg = item.emoAvg !== undefined ? item.emoAvg : (((item.q4_happy || 0) + (item.q5_comfortable || 0) + (item.q6_relaxed || 0) + (item.q7_stimulated || 0)) / 4).toFixed(2);
    const uAvg = item.utiAvg !== undefined ? item.utiAvg : (((item.q8_patient || 0) + (item.q9_energetic || 0) + (item.q10_powerful || 0)) / 3).toFixed(2);
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
      item.q2_time_passage,
      item.q3_interest,
      item.q4_happy,
      item.q5_comfortable,
      item.q6_relaxed,
      item.q7_stimulated,
      eAvg,
      item.q8_patient,
      item.q9_energetic,
      item.q10_powerful,
      uAvg,
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

  link.setAttribute('href', url);
  link.setAttribute('download', `QoE_Study_Trials_Detail_${dateStr}_${timeStr}.csv`);
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

// Export current session data as CSV for participant (1 row per participant, ordered C01 to C09)
function exportSessionCSV() {
  const data = state.trialResults;
  if (!data || data.length === 0) {
    alert('無可用數據進行匯出！');
    return;
  }

  const wideData = buildParticipantWideData(
    state.participantId,
    data,
    state.gender,
    state.age,
    state.groupInfo ? state.groupInfo.groupCode : '',
    new Date().toISOString()
  );

  const headers = Object.keys(wideData);
  const rowValues = headers.map(key => escapeCsvCell(wideData[key]));

  let csvContent = headers.join(',') + '\r\n' + rowValues.join(',') + '\r\n';

  // Add Unicode BOM (\ufeff) to force Excel to read UTF-8 correctly
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, '');
  const safePId = escapeCsvCell(state.participantId).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');

  link.setAttribute('href', url);
  link.setAttribute('download', `${safePId}_QoE_Results_C01_C09_${dateStr}_${timeStr}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  alert('已成功下載您的實驗結果 (Excel / CSV)！\n數據結果已自動上傳完成，感謝您填寫實驗問卷。');
}

// Automatically send consolidated wide-format participant data (1 row per participant, C01 to C09) to Google Sheets
function sendParticipantWideRowToGoogleSheets(wideData) {
  if (!GOOGLE_SCRIPT_URL) return;

  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors', // Avoids CORS preflight failures on Web App redirect
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(wideData)
  })
  .then(() => {
    console.log("Consolidated participant data (1 row, C01-C09) synced to Google Sheets successfully.");
  })
  .catch(err => {
    console.error("Error syncing consolidated response to Google Sheets:", err);
  });
}

// Check if a Participant ID already exists in stored data
function isParticipantIdDuplicate(participantId) {
  if (!participantId) return false;
  try {
    const data = JSON.parse(localStorage.getItem('qoe_study_data') || '[]');
    const target = String(participantId).trim().toUpperCase();
    return data.some(item => String(item.participantId).trim().toUpperCase() === target);
  } catch (e) {
    console.error("Error checking duplicate participant ID:", e);
    return false;
  }
}

// Automatically generate the next unique Participant ID that does not exist in local storage data
function getNextParticipantId() {
  try {
    const data = JSON.parse(localStorage.getItem('qoe_study_data') || '[]');
    const existingIds = new Set(data.map(item => String(item.participantId).trim().toUpperCase()));

    let maxNum = 0;
    existingIds.forEach(id => {
      const match = id.match(/^P(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    let nextNum = maxNum + 1;
    let candidate = 'P' + String(nextNum).padStart(3, '0');
    while (existingIds.has(candidate)) {
      nextNum++;
      candidate = 'P' + String(nextNum).padStart(3, '0');
    }
    return candidate;
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
      if (!paramId.toUpperCase().startsWith('P')) {
        const num = parseInt(paramId, 10);
        targetId = !isNaN(num) ? 'P' + String(num).padStart(3, '0') : paramId;
      } else {
        targetId = paramId.toUpperCase();
      }
    }
  }

  const nextId = (targetId ? targetId.trim().toUpperCase() : null) || getNextParticipantId();
  const displayEl = document.getElementById('display-participant-id');
  const displayGroupEl = document.getElementById('display-order-group');
  const inputEl = document.getElementById('participant-id');
  const statusEl = document.getElementById('id-status-msg');
  const submitBtn = document.querySelector('#form-setup button[type="submit"]');

  const isDuplicate = isParticipantIdDuplicate(nextId);

  if (displayEl && inputEl) {
    displayEl.textContent = nextId;
    inputEl.value = nextId;
    displayEl.style.color = isDuplicate ? '#dc2626' : '#047857';
  }

  if (statusEl) {
    if (isDuplicate) {
      statusEl.textContent = '⚠️ 此受試者號碼已存在，不可重複！請點擊下方按鈕更換。';
      statusEl.style.color = '#dc2626';
    } else {
      statusEl.textContent = '✅ 受試者代號可用（未重複）';
      statusEl.style.color = '#059669';
    }
  }

  if (submitBtn) {
    submitBtn.disabled = isDuplicate;
    submitBtn.style.opacity = isDuplicate ? '0.5' : '1';
    submitBtn.style.cursor = isDuplicate ? 'not-allowed' : 'pointer';
  }

  if (displayGroupEl) {
    const groupInfo = getOrderGroupInfo(nextId);
    displayGroupEl.textContent = `🎲 分配順序組別：第 ${groupInfo.groupNumber} 組 (${groupInfo.groupCode})`;
  }
}
