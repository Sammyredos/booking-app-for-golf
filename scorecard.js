/**
 * SMJ GOLF - Mobile Scorecard & Tournament Round Tracker Engine
 * Inter Tabular Typography | Offline Persistence | Official Golf Scoring
 */

(function () {
  'use strict';

  // --- Default Course Data: SMJ Championship Course ---
  const DEFAULT_COURSE = {
    name: 'SMJ Championship Course',
    tee: 'White',
    totalPar: 72,
    holes: [
      { num: 1, par: 4, yds: 395, si: 7 },
      { num: 2, par: 3, yds: 175, si: 15 },
      { num: 3, par: 5, yds: 520, si: 3 },
      { num: 4, par: 4, yds: 410, si: 1 },
      { num: 5, par: 4, yds: 380, si: 11 },
      { num: 6, par: 3, yds: 190, si: 13 },
      { num: 7, par: 5, yds: 545, si: 5 },
      { num: 8, par: 4, yds: 405, si: 9 },
      { num: 9, par: 4, yds: 415, si: 17 }, // F9 Par 36
      { num: 10, par: 4, yds: 420, si: 8 },
      { num: 11, par: 5, yds: 535, si: 2 },
      { num: 12, par: 3, yds: 165, si: 16 },
      { num: 13, par: 4, yds: 390, si: 12 },
      { num: 14, par: 4, yds: 440, si: 4 },
      { num: 15, par: 5, yds: 550, si: 6 },
      { num: 16, par: 3, yds: 205, si: 14 },
      { num: 17, par: 4, yds: 385, si: 18 },
      { num: 18, par: 4, yds: 430, si: 10 } // B9 Par 36
    ]
  };

  // --- Preloaded History if empty ---
  const INITIAL_HISTORY = [
    {
      id: 'round-101',
      title: 'SMJ Spring Championship - R2',
      type: 'tournament',
      course: 'SMJ Championship Course',
      date: 'Yesterday',
      format: 'Stroke Play',
      score: 71,
      toPar: -1,
      holesCount: 18,
      gir: 72,
      fairways: 78,
      putts: 28,
      birdies: 4,
      pars: 11,
      bogeys: 3,
      holes: DEFAULT_COURSE.holes.map((h, i) => {
        const testScores = [4, 2, 5, 4, 3, 3, 5, 4, 4, 4, 4, 3, 4, 4, 5, 2, 4, 4];
        return { ...h, score: testScores[i], putts: 2, fir: 'center', gir: true };
      })
    },
    {
      id: 'round-102',
      title: 'Mid-Iron & Approach Practice',
      type: 'practice',
      course: 'SMJ Championship Course',
      date: '3 days ago',
      format: 'Training Session',
      score: 37,
      toPar: 1,
      holesCount: 9,
      gir: 66,
      fairways: 71,
      putts: 15,
      birdies: 1,
      pars: 6,
      bogeys: 2,
      holes: DEFAULT_COURSE.holes.slice(0, 9).map((h, i) => {
        const testScores = [4, 3, 5, 5, 4, 3, 4, 4, 5];
        return { ...h, score: testScores[i], putts: 2, fir: 'center', gir: true };
      })
    }
  ];

  // --- App State ---
  let activeRound = null;
  let roundHistory = [];
  let currentActiveHoleIndex = 0; // 0-based index for holes 1-18

  // Signature canvas state
  let isDrawing = false;
  let signatureCanvas = null;
  let signatureCtx = null;

  // --- Initialization ---
  document.addEventListener('DOMContentLoaded', () => {
    loadStoredData();
    initSignatureCanvas();
    bindEvents();
    renderHomePage();
    renderHistoryPage();

    // Check if there is an active round
    if (activeRound) {
      updateActiveRoundUI();
    }
  });

  function loadStoredData() {
    try {
      const savedActive = localStorage.getItem('smj_active_round');
      if (savedActive) {
        activeRound = JSON.parse(savedActive);
      }
      const savedHistory = localStorage.getItem('smj_round_history');
      if (savedHistory) {
        roundHistory = JSON.parse(savedHistory);
      } else {
        roundHistory = INITIAL_HISTORY;
        localStorage.setItem('smj_round_history', JSON.stringify(roundHistory));
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
      roundHistory = INITIAL_HISTORY;
    }
  }

  function saveActiveRound() {
    if (activeRound) {
      localStorage.setItem('smj_active_round', JSON.stringify(activeRound));
      updateActiveRoundUI();
    } else {
      localStorage.removeItem('smj_active_round');
    }
  }

  // --- Navigation & Views ---
  window.switchView = function (viewName) {
    document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.dock-item').forEach(item => item.classList.remove('active'));

    const targetPanel = document.getElementById(`view-${viewName}`);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }

    const dockBtn = document.querySelector(`.dock-item[data-view="${viewName}"]`);
    if (dockBtn) {
      dockBtn.classList.add('active');
    }

    // Contextual updates
    if (viewName === 'home') {
      renderHomePage();
    } else if (viewName === 'scoring') {
      if (!activeRound) {
        window.switchView('setup');
        return;
      }
      renderScoringScreen();
    } else if (viewName === 'scorecard') {
      if (!activeRound) {
        // If no active round, show latest historical round in scorecard
        renderHistoricalScorecard(roundHistory[0]);
      } else {
        renderHorizontalScorecard();
      }
    } else if (viewName === 'history') {
      renderHistoryPage();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Event Bindings ---
  function bindEvents() {
    // Dock Navigation
    document.querySelectorAll('.dock-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        window.switchView(view);
      });
    });

    // Setup Form Toggles: Format
    document.querySelectorAll('[data-setup-format]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-setup-format]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // Setup Form Toggles: Round Number
    document.querySelectorAll('[data-setup-round]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-setup-round]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // Setup Form Toggles: Holes (9 or 18)
    document.querySelectorAll('[data-setup-holes]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-setup-holes]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // Setup Form Toggles: Tee Box
    document.querySelectorAll('[data-setup-tee]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-setup-tee]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // Setup: Start Round Action
    const startRoundBtn = document.getElementById('startRoundBtn');
    if (startRoundBtn) {
      startRoundBtn.addEventListener('click', handleStartNewRound);
    }

    // Scoring: Stepper Minus / Plus
    const scoreMinusBtn = document.getElementById('scoreMinusBtn');
    const scorePlusBtn = document.getElementById('scorePlusBtn');
    if (scoreMinusBtn) {
      scoreMinusBtn.addEventListener('click', () => adjustCurrentScore(-1));
    }
    if (scorePlusBtn) {
      scorePlusBtn.addEventListener('click', () => adjustCurrentScore(1));
    }

    // Scoring: Putts Selectors
    document.querySelectorAll('[data-putt-val]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-putt-val]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const val = parseInt(e.currentTarget.getAttribute('data-putt-val'), 10);
        updateCurrentHoleStat('putts', val);
      });
    });

    // Scoring: Fairway Selectors
    document.querySelectorAll('[data-fir-val]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-fir-val]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const val = e.currentTarget.getAttribute('data-fir-val');
        updateCurrentHoleStat('fir', val);
      });
    });

    // Scoring: GIR Toggle
    const girSwitch = document.getElementById('girToggle');
    if (girSwitch) {
      girSwitch.addEventListener('change', (e) => {
        updateCurrentHoleStat('gir', e.target.checked);
      });
    }

    // Scoring: Penalty Steppers
    const penMinus = document.getElementById('penMinusBtn');
    const penPlus = document.getElementById('penPlusBtn');
    if (penMinus && penPlus) {
      penMinus.addEventListener('click', () => adjustPenalty(-1));
      penPlus.addEventListener('click', () => adjustPenalty(1));
    }

    // Scoring: Next / Prev Hole
    const prevHoleBtn = document.getElementById('prevHoleBtn');
    const nextHoleBtn = document.getElementById('nextHoleBtn');
    if (prevHoleBtn) {
      prevHoleBtn.addEventListener('click', () => navigateHole(-1));
    }
    if (nextHoleBtn) {
      nextHoleBtn.addEventListener('click', () => navigateHole(1));
    }

    // Scorecard Submission
    const submitScorecardBtn = document.getElementById('submitScorecardBtn');
    if (submitScorecardBtn) {
      submitScorecardBtn.addEventListener('click', handleSubmitScorecard);
    }

    // Clear Signature
    const clearSigBtn = document.getElementById('clearSigBtn');
    if (clearSigBtn) {
      clearSigBtn.addEventListener('click', clearSignature);
    }

    // History Filter Tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const filter = e.currentTarget.getAttribute('data-filter');
        renderHistoryList(filter);
      });
    });
  }

  // --- Start New Round Handler ---
  function handleStartNewRound() {
    const activeFormatEl = document.querySelector('[data-setup-format].active');
    const activeRoundEl = document.querySelector('[data-setup-round].active');
    const activeHolesEl = document.querySelector('[data-setup-holes].active');
    const activeTeeEl = document.querySelector('[data-setup-tee].active');
    const markerInput = document.getElementById('attesterInput');

    const format = activeFormatEl ? activeFormatEl.getAttribute('data-setup-format') : 'stroke';
    const roundNumber = activeRoundEl ? activeRoundEl.getAttribute('data-setup-round') : 'R1';
    const holesCount = activeHolesEl ? parseInt(activeHolesEl.getAttribute('data-setup-holes'), 10) : 18;
    const tee = activeTeeEl ? activeTeeEl.getAttribute('data-setup-tee') : 'White';
    const attester = markerInput && markerInput.value.trim() ? markerInput.value.trim() : 'Official Marker';

    const courseData = DEFAULT_COURSE;
    const selectedHoles = courseData.holes.slice(0, holesCount).map(h => ({
      num: h.num,
      par: h.par,
      yds: h.yds,
      si: h.si,
      score: h.par, // Default to Par
      putts: 2,
      fir: h.par === 3 ? 'n/a' : 'center',
      gir: true,
      penalty: 0,
      club: 'Driver',
      completed: false
    }));

    activeRound = {
      id: 'round-' + Date.now(),
      title: 'SMJ Championship - ' + roundNumber,
      type: 'tournament',
      format: format === 'stroke' ? 'Stroke Play' : 'Stableford',
      roundNumber: roundNumber,
      course: courseData.name,
      tee: tee,
      holesCount: holesCount,
      attester: attester,
      startTime: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      holes: selectedHoles,
      signature: null
    };

    currentActiveHoleIndex = 0;
    saveActiveRound();
    window.switchView('scoring');
  }

  // --- Hole Scoring Logic ---
  function renderScoringScreen() {
    if (!activeRound) return;

    const hole = activeRound.holes[currentActiveHoleIndex];
    if (!hole) return;

    // Header Course & Round
    const titleEl = document.getElementById('scoringCourseTitle');
    if (titleEl) {
      titleEl.textContent = `${activeRound.course} • ${activeRound.roundNumber || 'Round'}`;
    }

    // Top Live Score Badge
    updateScoringHeaderScore();

    // Horizontal Hole Carousel
    renderHoleCarousel();

    // Hole Overview Card
    const holeTitle = document.getElementById('holeNumberTitle');
    const holePar = document.getElementById('holeParVal');
    const holeYds = document.getElementById('holeYdsVal');
    const holeSI = document.getElementById('holeSIVal');

    if (holeTitle) holeTitle.textContent = `Hole ${hole.num}`;
    if (holePar) holePar.textContent = `Par ${hole.par}`;
    if (holeYds) holeYds.textContent = `${hole.yds} Yds`;
    if (holeSI) holeSI.textContent = `SI ${hole.si}`;

    // Big Score Stepper
    renderScoreStepperDisplay(hole);

    // Putts Selectors
    document.querySelectorAll('[data-putt-val]').forEach(btn => {
      const pVal = parseInt(btn.getAttribute('data-putt-val'), 10);
      btn.classList.toggle('active', pVal === hole.putts);
    });

    // Fairway Selectors
    const firContainer = document.getElementById('firRow');
    if (hole.par === 3) {
      if (firContainer) firContainer.style.display = 'none';
    } else {
      if (firContainer) firContainer.style.display = 'flex';
      document.querySelectorAll('[data-fir-val]').forEach(btn => {
        const fVal = btn.getAttribute('data-fir-val');
        btn.classList.toggle('active', fVal === hole.fir);
      });
    }

    // GIR Toggle
    const girSwitch = document.getElementById('girToggle');
    if (girSwitch) {
      girSwitch.checked = !!hole.gir;
    }

    // Penalty Display
    const penVal = document.getElementById('penaltyValDisplay');
    if (penVal) {
      penVal.textContent = hole.penalty || 0;
    }

    // Prev / Next button states
    const prevBtn = document.getElementById('prevHoleBtn');
    const nextBtn = document.getElementById('nextHoleBtn');
    if (prevBtn) prevBtn.disabled = currentActiveHoleIndex === 0;
    if (nextBtn) {
      if (currentActiveHoleIndex === activeRound.holes.length - 1) {
        nextBtn.innerHTML = `Scorecard <svg style="width:18px;height:18px" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
      } else {
        nextBtn.innerHTML = `Next Hole <svg style="width:18px;height:18px" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
      }
    }
  }

  function renderHoleCarousel() {
    const container = document.getElementById('holeCarousel');
    if (!container || !activeRound) return;

    container.innerHTML = '';
    activeRound.holes.forEach((h, index) => {
      const item = document.createElement('div');
      item.className = `hole-carousel-item ${index === currentActiveHoleIndex ? 'active' : ''}`;
      
      const diff = h.score - h.par;
      let scoreBadgeText = 'E';
      if (diff > 0) scoreBadgeText = `+${diff}`;
      else if (diff < 0) scoreBadgeText = `${diff}`;

      item.innerHTML = `
        <span class="num">${h.num}</span>
        <span class="score-indicator">${h.completed ? scoreBadgeText : '•'}</span>
      `;

      item.addEventListener('click', () => {
        currentActiveHoleIndex = index;
        renderScoringScreen();
      });

      container.appendChild(item);
    });

    // Auto-scroll active hole into view
    const activeItem = container.children[currentActiveHoleIndex];
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  function renderScoreStepperDisplay(hole) {
    const scoreNum = document.getElementById('stepperScoreDisplay');
    const badgeEl = document.getElementById('stepperBadgeDisplay');
    if (!scoreNum || !badgeEl) return;

    scoreNum.textContent = hole.score;
    const diff = hole.score - hole.par;

    badgeEl.className = 'stepper-score-badge';
    if (diff <= -2) {
      badgeEl.classList.add('badge-eagle');
      badgeEl.textContent = `EAGLE (${diff})`;
    } else if (diff === -1) {
      badgeEl.classList.add('badge-birdie');
      badgeEl.textContent = `BIRDIE (-1)`;
    } else if (diff === 0) {
      badgeEl.classList.add('badge-par');
      badgeEl.textContent = `PAR (E)`;
    } else if (diff === 1) {
      badgeEl.classList.add('badge-bogey');
      badgeEl.textContent = `BOGEY (+1)`;
    } else {
      badgeEl.classList.add('badge-double');
      badgeEl.textContent = `DOUBLE BOGEY+ (+${diff})`;
    }
  }

  function adjustCurrentScore(delta) {
    if (!activeRound) return;
    const hole = activeRound.holes[currentActiveHoleIndex];
    if (!hole) return;

    hole.score = Math.max(1, hole.score + delta);
    hole.completed = true;

    // Auto calculate GIR assumption
    const parMinusTwo = hole.par - 2;
    const shotsToGreen = hole.score - hole.putts;
    hole.gir = shotsToGreen <= parMinusTwo;

    saveActiveRound();
    renderScoreStepperDisplay(hole);
    renderHoleCarousel();
    updateScoringHeaderScore();
  }

  function updateCurrentHoleStat(key, val) {
    if (!activeRound) return;
    const hole = activeRound.holes[currentActiveHoleIndex];
    if (!hole) return;

    hole[key] = val;
    hole.completed = true;
    saveActiveRound();
    updateScoringHeaderScore();
  }

  function adjustPenalty(delta) {
    if (!activeRound) return;
    const hole = activeRound.holes[currentActiveHoleIndex];
    if (!hole) return;

    hole.penalty = Math.max(0, (hole.penalty || 0) + delta);
    saveActiveRound();
    const penVal = document.getElementById('penaltyValDisplay');
    if (penVal) penVal.textContent = hole.penalty;
  }

  function navigateHole(direction) {
    if (!activeRound) return;
    const newIndex = currentActiveHoleIndex + direction;

    if (newIndex >= activeRound.holes.length) {
      // Completed all holes, jump to Full Scorecard
      window.switchView('scorecard');
      return;
    }

    if (newIndex >= 0 && newIndex < activeRound.holes.length) {
      currentActiveHoleIndex = newIndex;
      renderScoringScreen();
    }
  }

  function updateScoringHeaderScore() {
    const badge = document.getElementById('scoringHeaderScoreBadge');
    if (!badge || !activeRound) return;

    let totalScore = 0;
    let totalPar = 0;
    let holesPlayed = 0;

    activeRound.holes.forEach(h => {
      if (h.completed) {
        totalScore += h.score;
        totalPar += h.par;
        holesPlayed++;
      }
    });

    if (holesPlayed === 0) {
      badge.textContent = `E (Thru 0)`;
      return;
    }

    const diff = totalScore - totalPar;
    const diffStr = diff > 0 ? `+${diff}` : (diff < 0 ? `${diff}` : 'E');
    badge.textContent = `${diffStr} (Thru ${holesPlayed})`;
  }

  // --- Horizontal 18-Hole Scorecard Grid Rendering ---
  function renderHorizontalScorecard() {
    if (!activeRound) return;

    // KPI Metrics calculation
    let grossScore = 0;
    let parTotal = 0;
    let totalPutts = 0;
    let girCount = 0;
    let firCount = 0;
    let firEligible = 0;

    activeRound.holes.forEach(h => {
      grossScore += h.score;
      parTotal += h.par;
      totalPutts += (h.putts || 2);
      if (h.gir) girCount++;
      if (h.par > 3) {
        firEligible++;
        if (h.fir === 'center') firCount++;
      }
    });

    const diff = grossScore - parTotal;
    const scoreText = diff > 0 ? `+${diff}` : (diff < 0 ? `${diff}` : 'E');
    const girPct = Math.round((girCount / activeRound.holes.length) * 100);
    const firPct = firEligible > 0 ? Math.round((firCount / firEligible) * 100) : 0;

    // Set KPI cards
    const kpiScore = document.getElementById('cardScoreVal');
    const kpiGir = document.getElementById('cardGirVal');
    const kpiFir = document.getElementById('cardFirVal');
    const kpiPutts = document.getElementById('cardPuttsVal');

    if (kpiScore) kpiScore.innerHTML = `${grossScore} <span class="kpi-sub">(${scoreText})</span>`;
    if (kpiGir) kpiGir.textContent = `${girPct}%`;
    if (kpiFir) kpiFir.textContent = `${firPct}%`;
    if (kpiPutts) kpiPutts.textContent = totalPutts;

    // Course Title
    const title = document.getElementById('scorecardTitle');
    if (title) title.textContent = `${activeRound.course} - Par ${parTotal}`;

    // Attester Label
    const attesterLabel = document.getElementById('attesterDisplayLabel');
    if (attesterLabel) {
      attesterLabel.textContent = `Attester: ${activeRound.attester || 'Official Marker'}`;
    }

    // Build Front 9 Table
    renderTableSegment('f9ScoreTableContainer', activeRound.holes.slice(0, 9), 'OUT');

    // Build Back 9 Table (if 18 holes)
    const b9Container = document.getElementById('b9ScoreTableContainer');
    if (activeRound.holes.length > 9) {
      if (b9Container) {
        b9Container.style.display = 'block';
        renderTableSegment('b9ScoreTableContainer', activeRound.holes.slice(9, 18), 'IN', true, grossScore, diff);
      }
    } else {
      if (b9Container) b9Container.style.display = 'none';
    }
  }

  function renderTableSegment(containerId, holes, subtotalLabel, isBackNine = false, totalGross = 0, totalDiff = 0) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let subPar = 0;
    let subScore = 0;
    holes.forEach(h => {
      subPar += h.par;
      subScore += h.score;
    });

    let thHoles = `<th>Hole</th>`;
    let tdPars = `<td class="row-header">Par</td>`;
    let tdScores = `<td class="row-header">Score</td>`;

    holes.forEach(h => {
      thHoles += `<th>${h.num}</th>`;
      tdPars += `<td>${h.par}</td>`;

      // Official Golf Shape class
      const diff = h.score - h.par;
      let shapeClass = 'par';
      if (diff <= -2) shapeClass = 'eagle';
      else if (diff === -1) shapeClass = 'birdie';
      else if (diff === 1) shapeClass = 'bogey';
      else if (diff >= 2) shapeClass = 'double-bogey';

      tdScores += `
        <td class="score-cell">
          <span class="score-badge-shape ${shapeClass}">${h.score}</span>
        </td>
      `;
    });

    // Append Subtotal Column
    thHoles += `<th class="subtotal-col">${subtotalLabel}</th>`;
    tdPars += `<td class="subtotal-col">${subPar}</td>`;
    tdScores += `<td class="subtotal-col">${subScore}</td>`;

    if (isBackNine) {
      // Append Overall TOTAL Column
      thHoles += `<th class="subtotal-col" style="background:#0f172a">TOT</th>`;
      tdPars += `<td class="subtotal-col" style="font-weight:900">${DEFAULT_COURSE.totalPar}</td>`;
      const diffStr = totalDiff > 0 ? `+${totalDiff}` : (totalDiff < 0 ? `${totalDiff}` : 'E');
      tdScores += `<td class="subtotal-col" style="font-weight:900;color:var(--primary-green)">${totalGross} <span style="font-size:0.65rem">(${diffStr})</span></td>`;
    }

    container.innerHTML = `
      <table class="scorecard-table">
        <thead>
          <tr>${thHoles}</tr>
        </thead>
        <tbody>
          <tr>${tdPars}</tr>
          <tr>${tdScores}</tr>
        </tbody>
      </table>
    `;
  }

  // --- Attester Canvas Signature ---
  function initSignatureCanvas() {
    signatureCanvas = document.getElementById('signatureCanvas');
    if (!signatureCanvas) return;

    signatureCtx = signatureCanvas.getContext('2d');
    
    // Scale for high-DPI displays
    const rect = signatureCanvas.getBoundingClientRect();
    signatureCanvas.width = rect.width * 2;
    signatureCanvas.height = rect.height * 2;
    signatureCtx.scale(2, 2);

    signatureCtx.strokeStyle = '#0f172a';
    signatureCtx.lineWidth = 2.5;
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';

    function getCoords(e) {
      const r = signatureCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - r.left,
        y: clientY - r.top
      };
    }

    function startDraw(e) {
      isDrawing = true;
      const p = getCoords(e);
      signatureCtx.beginPath();
      signatureCtx.moveTo(p.x, p.y);
      const placeholder = document.getElementById('sigPlaceholder');
      if (placeholder) placeholder.style.display = 'none';
      if (e.touches) e.preventDefault();
    }

    function moveDraw(e) {
      if (!isDrawing) return;
      const p = getCoords(e);
      signatureCtx.lineTo(p.x, p.y);
      signatureCtx.stroke();
      if (e.touches) e.preventDefault();
    }

    function stopDraw() {
      if (!isDrawing) return;
      isDrawing = false;
      if (activeRound) {
        activeRound.signature = signatureCanvas.toDataURL();
      }
    }

    signatureCanvas.addEventListener('mousedown', startDraw);
    signatureCanvas.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', stopDraw);

    signatureCanvas.addEventListener('touchstart', startDraw, { passive: false });
    signatureCanvas.addEventListener('touchmove', moveDraw, { passive: false });
    signatureCanvas.addEventListener('touchend', stopDraw);
  }

  function clearSignature() {
    if (!signatureCanvas || !signatureCtx) return;
    signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    const placeholder = document.getElementById('sigPlaceholder');
    if (placeholder) placeholder.style.display = 'block';
    if (activeRound) activeRound.signature = null;
  }

  // --- Scorecard Submission ---
  function handleSubmitScorecard() {
    if (!activeRound) return;

    // Calculate totals
    let gross = 0;
    let par = 0;
    let birdies = 0;
    let pars = 0;
    let bogeys = 0;
    let girCount = 0;
    let firCount = 0;
    let firEligible = 0;
    let putts = 0;

    activeRound.holes.forEach(h => {
      gross += h.score;
      par += h.par;
      putts += (h.putts || 2);
      const diff = h.score - h.par;
      if (diff <= -1) birdies++;
      else if (diff === 0) pars++;
      else bogeys++;

      if (h.gir) girCount++;
      if (h.par > 3) {
        firEligible++;
        if (h.fir === 'center') firCount++;
      }
    });

    const toPar = gross - par;
    const completedRound = {
      id: activeRound.id,
      title: activeRound.title,
      type: activeRound.type,
      course: activeRound.course,
      date: 'Today',
      format: activeRound.format,
      score: gross,
      toPar: toPar,
      holesCount: activeRound.holesCount,
      gir: Math.round((girCount / activeRound.holes.length) * 100),
      fairways: firEligible > 0 ? Math.round((firCount / firEligible) * 100) : 0,
      putts: putts,
      birdies: birdies,
      pars: pars,
      bogeys: bogeys,
      holes: activeRound.holes,
      signature: activeRound.signature
    };

    // Save into history
    roundHistory.unshift(completedRound);
    localStorage.setItem('smj_round_history', JSON.stringify(roundHistory));

    // Clear active round
    activeRound = null;
    localStorage.removeItem('smj_active_round');

    // Show Celebration Modal
    showCompletionModal(completedRound);
  }

  function showCompletionModal(round) {
    const modal = document.getElementById('completionModal');
    const scoreVal = document.getElementById('modalScoreDisplay');
    const toParVal = document.getElementById('modalToParDisplay');
    const statsText = document.getElementById('modalStatsSummary');

    if (modal) {
      if (scoreVal) scoreVal.textContent = round.score;
      if (toParVal) {
        const toParStr = round.toPar > 0 ? `+${round.toPar}` : (round.toPar < 0 ? `${round.toPar}` : 'E');
        toParVal.textContent = toParStr;
      }
      if (statsText) {
        statsText.textContent = `${round.birdies} Birdies • ${round.pars} Pars • ${round.bogeys} Bogeys • ${round.putts} Putts`;
      }
      modal.classList.add('active');

      const closeBtn = document.getElementById('closeModalBtn');
      if (closeBtn) {
        closeBtn.onclick = () => {
          modal.classList.remove('active');
          window.switchView('history');
        };
      }
    }
  }

  // --- Home Page Rendering ---
  function renderHomePage() {
    const resumeBanner = document.getElementById('activeRoundBanner');
    if (resumeBanner) {
      if (activeRound) {
        resumeBanner.style.display = 'flex';
        const bannerCourse = document.getElementById('bannerCourseText');
        const bannerHole = document.getElementById('bannerHoleText');
        if (bannerCourse) bannerCourse.textContent = activeRound.course;
        if (bannerHole) bannerHole.textContent = `Hole ${currentActiveHoleIndex + 1} of ${activeRound.holes.length}`;
        resumeBanner.onclick = () => window.switchView('scoring');
      } else {
        resumeBanner.style.display = 'none';
      }
    }

    // Render Recent Rounds on Home Feed
    const recentFeed = document.getElementById('homeRecentRounds');
    if (recentFeed) {
      recentFeed.innerHTML = '';
      const recent = roundHistory.slice(0, 2);
      recent.forEach(r => {
        const toParStr = r.toPar > 0 ? `+${r.toPar}` : (r.toPar < 0 ? `${r.toPar}` : 'E');
        const card = document.createElement('div');
        card.className = 'round-feed-card';
        card.innerHTML = `
          <div class="round-card-top">
            <div>
              <div class="round-event-title">${r.title}</div>
              <div class="round-event-sub">${r.course} • ${r.holesCount} Holes</div>
            </div>
            <div class="round-score-pill">${r.score} <span style="font-size:0.85rem">(${toParStr})</span></div>
          </div>
          <div class="round-card-meta">
            <span>🟢 ${r.birdies} Birdies • ⬛ ${r.bogeys} Bogeys</span>
            <span style="font-weight:600;color:var(--primary-green)">View Scorecard →</span>
          </div>
        `;
        card.addEventListener('click', () => {
          renderHistoricalScorecard(r);
          window.switchView('scorecard');
        });
        recentFeed.appendChild(card);
      });
    }
  }

  // --- History Page Rendering ---
  function renderHistoryPage() {
    renderHistoryList('all');
  }

  function renderHistoryList(filter) {
    const container = document.getElementById('historyRoundList');
    if (!container) return;

    container.innerHTML = '';
    const filtered = roundHistory.filter(r => {
      if (filter === 'tournament') return r.type === 'tournament';
      if (filter === 'practice') return r.type === 'practice';
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted)">No rounds recorded in this category.</div>`;
      return;
    }

    filtered.forEach(r => {
      const toParStr = r.toPar > 0 ? `+${r.toPar}` : (r.toPar < 0 ? `${r.toPar}` : 'E');
      const card = document.createElement('div');
      card.className = 'round-feed-card';
      card.innerHTML = `
        <div class="round-card-top">
          <div>
            <div class="round-event-title">${r.title}</div>
            <div class="round-event-sub">${r.course} • ${r.holesCount} Holes • ${r.date}</div>
          </div>
          <div class="round-score-pill">${r.score} <span style="font-size:0.85rem">(${toParStr})</span></div>
        </div>
        <div class="round-card-meta">
          <span>GIR: ${r.gir}% • Putts: ${r.putts}</span>
          <span style="font-weight:600;color:var(--primary-green)">Tap to Inspect →</span>
        </div>
      `;
      card.addEventListener('click', () => {
        renderHistoricalScorecard(r);
        window.switchView('scorecard');
      });
      container.appendChild(card);
    });
  }

  function renderHistoricalScorecard(round) {
    if (!round) return;

    const title = document.getElementById('scorecardTitle');
    if (title) title.textContent = `${round.title} - ${round.course}`;

    const kpiScore = document.getElementById('cardScoreVal');
    const kpiGir = document.getElementById('cardGirVal');
    const kpiFir = document.getElementById('cardFirVal');
    const kpiPutts = document.getElementById('cardPuttsVal');

    const toParStr = round.toPar > 0 ? `+${round.toPar}` : (round.toPar < 0 ? `${round.toPar}` : 'E');
    if (kpiScore) kpiScore.innerHTML = `${round.score} <span class="kpi-sub">(${toParStr})</span>`;
    if (kpiGir) kpiGir.textContent = `${round.gir}%`;
    if (kpiFir) kpiFir.textContent = `${round.fairways}%`;
    if (kpiPutts) kpiPutts.textContent = round.putts;

    // Render Front 9
    renderTableSegment('f9ScoreTableContainer', round.holes.slice(0, 9), 'OUT');

    // Render Back 9
    const b9Container = document.getElementById('b9ScoreTableContainer');
    if (round.holes.length > 9) {
      if (b9Container) {
        b9Container.style.display = 'block';
        renderTableSegment('b9ScoreTableContainer', round.holes.slice(9, 18), 'IN', true, round.score, round.toPar);
      }
    } else {
      if (b9Container) b9Container.style.display = 'none';
    }

    // Hide submission button if viewing past round
    const submitBtn = document.getElementById('submitScorecardBtn');
    if (submitBtn) {
      submitBtn.style.display = activeRound ? 'inline-flex' : 'none';
    }
  }

  function updateActiveRoundUI() {
    renderHomePage();
  }

})();
