/* ==========================================================================
   CONFIG & GAME SETTINGS (РЕДАКТИРУЕМЫЕ НАСТРОЙКИ КВЕСТА)
   ========================================================================== */

const CONFIG = {
    sisterName: "Аделина",         // Имя сестры
    level2Code: "6857",          // Код 1 (из комнаты 1 - Зал / Зеркало)
    level3Code: "7393",          // Код 2 (из комнаты 2 - Кухня / Предмет)
    level4Code: "5518",          // Резервный код
    finalCode: "5518"                    // Финальный код капсулы
};

// Google Sheets tracking via the user's published Apps Script Web App.
const TRACKING = {
    endpoint: 'https://script.google.com/macros/s/AKfycby4sNWquOTHPrklGA0Hgs0hpnXwNkgnWeqZEVWgobEath5GglWBmkUlx8CwxSlPHwCv/exec',
    token: 'adeline-quest-2026'
};

function sendTrackingEvent(event, payload = {}) {
    if (!TRACKING.endpoint || typeof fetch !== 'function') return;
    try {
        fetch(TRACKING.endpoint, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ token: TRACKING.token, event, payload, at: new Date().toISOString() })
        }).catch(() => {});
    } catch (e) {}
}

const GAME_SETTINGS = {
    startingLives: 3,
    startingScore: 0,
    starGameDuration: 15,
    starsRequired: 300
};

// Редактируемые подсказки для комнат квартиры
const CLUES = {
    mirror: "«Там, где ты чаще всего видишь человека, которого знаешь лучше всех.»",
    item: "«Он каждый день рядом, но обычно ты не обращаешь на него внимания.» (Найди спрятанный предмет)",
    audioFallback: "«Подсказка аудио: ищи там, где рождаются самые сладкие сны.»"
};

// Массив наград для магазина
const REWARDS = [
    { id: 1, name: "🍫 СЛАДОСТЬ", cost: 300, desc: "Получить вкусный десерт когда приеду!", purchaseMessage: "Ну все, с меня вкусняшка, как приеду куплю:3" },
    { id: 2, name: "💰 КУПОН (??? ₸)", cost: 1000, desc: "Купон на карманные расходы.", purchaseMessage: "Купон на твои личные траты, отправь мне его и я обналичу его.( ╹▽╹ )" },
    { id: 4, name: "💎 СЕКРЕТНЫЙ МИНИ-ПОДАРОК", cost: 500, desc: "Мой мини гифт.", purchaseMessage: "Оо, ты его купила, ждите 2 октября и я отдам его✧◝(⁰▿⁰)◜✧" },
    { id: 5, name: "📝 ЛЮБОЕ ЖЕЛАНИЕ", cost: 1500, desc: "С меня - любое твоё желание!", purchaseMessage: "С меня любое желание, если это не что-то невозможное(つ≧▽≦)つ" }
];

/* ==========================================================================
   ИНИЦИАЛИЗАЦИЯ И ИГРОВОЕ СОСТОЯНИЕ
   ========================================================================== */

let gameState = {
    score: GAME_SETTINGS.startingScore,
    lives: GAME_SETTINGS.startingLives,
    unlockedLocations: ['zal', 'gifts', 'wish', 'achievements'],
    completedMinigames: [],
    purchasedRewards: [],
    foundSecrets: [],
    currentLocation: null,
    currentScreen: 'screen-start',
    wishText: '',
    eventLog: [],
    achievements: [],
    bonusCompleted: false
};

let soundEnabled = true;
let gameSettings = {
    musicVolume: 0.18,
    sfxVolume: 0.52,
    vibration: true,
    reducedMotion: false,
    musicTrack: 'Ba1.mp'
};
function loadGameSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('bq_settings') || '{}');
        gameSettings = Object.assign(gameSettings, saved);
    } catch (e) {}
    document.body.classList.toggle('reduced-motion', Boolean(gameSettings.reducedMotion));
}
function saveGameSettings() {
    localStorage.setItem('bq_settings', JSON.stringify(gameSettings));
    document.body.classList.toggle('reduced-motion', Boolean(gameSettings.reducedMotion));
}
function updateSettingsUI() {
    const music = document.getElementById('music-volume');
    const musicTrack = document.getElementById('music-track');
    const sfx = document.getElementById('sfx-volume');
    const vibration = document.getElementById('vibration-toggle');
    const reducedMotion = document.getElementById('reduced-motion-toggle');
    if (music) music.value = String(Math.round(gameSettings.musicVolume * 100));
    if (musicTrack) musicTrack.value = gameSettings.musicTrack;
    if (sfx) sfx.value = String(Math.round(gameSettings.sfxVolume * 100));
    if (vibration) vibration.checked = Boolean(gameSettings.vibration);
    if (reducedMotion) reducedMotion.checked = Boolean(gameSettings.reducedMotion);
    const musicValue = document.getElementById('music-volume-value');
    const sfxValue = document.getElementById('sfx-volume-value');
    if (musicValue) musicValue.textContent = `${Math.round(gameSettings.musicVolume * 100)}%`;
    if (sfxValue) sfxValue.textContent = `${Math.round(gameSettings.sfxVolume * 100)}%`;
}
const SOUND_FILES = {
    click: 'assets/sounds/Click.mp3',
    star: 'assets/sounds/soft-star.wav',
    success: 'assets/sounds/soft-success.wav',
    error: 'assets/sounds/soft-error.wav',
    hit: 'assets/sounds/soft-hit.wav',
    tap: 'assets/sounds/soft-click.wav',
    combo: 'assets/sounds/soft-star.wav',
    match: 'assets/sounds/soft-success.wav',
    achievement: 'assets/sounds/Ach.mp3',
    rhythmClick: 'assets/sounds/Rhytm_Click.mp3',
    terminalInput: 'assets/sounds/Vvod.mp3',
    terminalConfirm: 'assets/sounds/Prinat.mp3',
    purchase: 'assets/sounds/Pay.mp3',
    death: 'assets/sounds/Death.mp3'
};
const MUSIC_FILES = {
    background: 'assets/sounds/Ba.mp3',
    rhythm: 'assets/sounds/Rhytm.mp3',
    final: 'assets/sounds/Final.mp3'
};
// Вставь сюда ссылку YouTube, когда видео будет загружено.
const YOUTUBE_VIDEO_URL = 'https://youtu.be/RAp-wUechaE?si=E3GTDiBo-N1-9ANU';
const soundCache = {};
let audioContext = null;
let backgroundMusic = null;
let videoSecretActive = false;

let rhythmLoop = null;
let rhythmNotes = [];
let rhythmScore = 0;
let rhythmCombo = 0;
let notesSpawned = 0;
const TOTAL_NOTES = 20; // Всего нот за уровень

/* ==========================================================================
   WEB AUDIO API - ГЕНЕРАЦИЯ ЗВУКОВ
   ========================================================================== */

function initAudio() {
    if (!audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) audioContext = new AudioCtx();
    }
}

function startBackgroundMusic(track = MUSIC_FILES.background, volume = gameSettings.musicVolume) {
    if (!backgroundMusic || !soundEnabled) return;
    const source = track.includes('/') ? track : `assets/sounds/${track}`;
    if (!backgroundMusic.src.endsWith(track)) backgroundMusic.src = source;
    backgroundMusic.loop = true;
    backgroundMusic.volume = Math.max(0, Math.min(1, volume));
    backgroundMusic.play().catch(() => {});
}

function updateBackgroundMusic() {
    if (!backgroundMusic) return;
    if (soundEnabled) startBackgroundMusic(gameSettings.musicTrack, gameSettings.musicVolume);
    else backgroundMusic.pause();
}
let rhythmActive = false;
let rhythmFrameId = null;
let rhythmLastTime = 0;
let rhythmChart = [];
let rhythmChartIndex = 0;
let rhythmClockStart = 0;
let rhythmFinished = false;
const RHYTHM_BPM = 128;
const RHYTHM_BEAT_MS = 60000 / RHYTHM_BPM;

function startRhythmGame() {
    showScreen('screen-rhythm');
    startBackgroundMusic(MUSIC_FILES.rhythm, Math.min(gameSettings.musicVolume, 0.14));
    rhythmActive = true;
    rhythmFinished = false;
    rhythmLastTime = performance.now();
    if (rhythmFrameId) cancelAnimationFrame(rhythmFrameId);
    rhythmScore = 0; rhythmCombo = 0; rhythmChartIndex = 0; rhythmNotes = [];
    const pattern = [0,1,2,3, 0,2,1,3, 3,2,1,0, 0,3,1,2,
                     0,1,3,2, 1,0,2,3, 3,1,0,2, 2,3,0,1];
    rhythmChart = pattern.map((lane, index) => ({ lane, beat: index * 0.5 }));
    rhythmClockStart = performance.now();
    document.getElementById('rhythm-score').textContent = rhythmScore;
    document.getElementById('rhythm-combo').textContent = rhythmCombo;
    const judgement = document.getElementById('rhythm-judgement');
    if (judgement) judgement.textContent = 'GET READY';
    document.querySelectorAll('.rhythm-note').forEach(n => n.remove());
    if (rhythmLoop) { clearInterval(rhythmLoop); rhythmLoop = null; }
    rhythmFrameId = requestAnimationFrame(updateRhythmNotes);
}

function scheduleRhythmNotes(now) {
    if (!rhythmActive || rhythmFinished) return;
    const elapsed = now - rhythmClockStart;
    const leadInMs = 1800;
    const travelMs = 1600;
    while (rhythmChartIndex < rhythmChart.length && elapsed >= leadInMs + rhythmChart[rhythmChartIndex].beat * RHYTHM_BEAT_MS - travelMs) {
        spawnRhythmNote(rhythmChart[rhythmChartIndex].lane);
        rhythmChartIndex++;
    }
    const lastBeat = rhythmChart[rhythmChart.length - 1]?.beat || 0;
    if (rhythmChartIndex >= rhythmChart.length && rhythmNotes.length === 0 && elapsed > (leadInMs + lastBeat * RHYTHM_BEAT_MS + travelMs + 250)) {
        rhythmFinished = true;
        clearInterval(rhythmLoop); rhythmLoop = null;
        finishRhythmGame();
    }
}

function spawnRhythmNote(laneIndex = Math.floor(Math.random() * 4)) {
    const lane = document.querySelectorAll('.rhythm-lane')[laneIndex];
    if (!lane) return;
    const note = document.createElement('div');
    note.className = 'rhythm-note';
    note.dataset.top = 0;
    note.dataset.lane = laneIndex;
    lane.appendChild(note);
    rhythmNotes.push(note);
}

function updateRhythmNotes(timestamp = performance.now()) {
    if (!rhythmActive) return;
    scheduleRhythmNotes(timestamp);
    const field = document.getElementById('rhythm-field');
    const targetY = Math.max(100, (field?.clientHeight || 390) - 47);
    const delta = Math.min(34, Math.max(0, timestamp - rhythmLastTime));
    rhythmLastTime = timestamp;
    const speed = 0.22 * delta;
    for (let i = rhythmNotes.length - 1; i >= 0; i--) {
        const note = rhythmNotes[i];
        const currentTop = parseFloat(note.dataset.top) + speed;
        note.dataset.top = currentTop;
        note.style.top = currentTop + 'px';
        if (currentTop > targetY + 30) {
            note.remove(); rhythmNotes.splice(i, 1);
            rhythmCombo = 0;
            document.getElementById('rhythm-combo').textContent = rhythmCombo;
            playSound('error');
            flashScreen('rgba(255,91,120,.18)');
        }
    }
    if (rhythmActive && document.getElementById('screen-rhythm').classList.contains('active')) {
        rhythmFrameId = requestAnimationFrame(updateRhythmNotes);
    }
}

function showRhythmJudgement(label, tone = '') {
    const node = document.getElementById('rhythm-judgement');
    if (!node) return;
    node.textContent = label;
    node.className = `rhythm-judgement ${tone}`;
    clearTimeout(showRhythmJudgement.timer);
    showRhythmJudgement.timer = setTimeout(() => { node.textContent = 'KEEP THE BEAT'; node.className = 'rhythm-judgement'; }, 420);
}

function handleRhythmTap(laneIndex) {
    triggerVibrate(20);
    const field = document.getElementById('rhythm-field');
    const targetY = Math.max(100, (field?.clientHeight || 390) - 47);
    const candidates = rhythmNotes.map((note, index) => ({ note, index }))
        .filter(({ note }) => parseInt(note.dataset.lane) === laneIndex)
        .sort((a,b) => Math.abs(parseFloat(a.note.dataset.top)-targetY) - Math.abs(parseFloat(b.note.dataset.top)-targetY));
    const candidate = candidates[0];
    const distance = candidate ? Math.abs(parseFloat(candidate.note.dataset.top) - targetY) : Infinity;
    if (!candidate || distance >= 52) {
        rhythmCombo = 0;
        document.getElementById('rhythm-combo').textContent = rhythmCombo;
        playSound('error'); showRhythmJudgement('MISS', 'miss');
        flashScreen('rgba(255,91,120,.12)');
        return;
    }
    const { note, index } = candidate;
    burstFromElement(note, distance <= 18 ? '✦' : '•');
    const grade = distance <= 18 ? 'PERFECT' : distance <= 35 ? 'GREAT' : 'GOOD';
    rhythmCombo++;
    const base = grade === 'PERFECT' ? 35 : grade === 'GREAT' ? 25 : 15;
    const points = base + rhythmCombo * 2;
    rhythmScore += points;
    floatingText(`+${points}`, note, rhythmCombo > 2 ? 'combo-pop' : '');
    note.remove(); rhythmNotes.splice(index, 1);
    document.getElementById('rhythm-score').textContent = rhythmScore;
    document.getElementById('rhythm-combo').textContent = rhythmCombo;
    playSound('rhythmClick');
    showRhythmJudgement(grade, grade.toLowerCase());
    flashScreen(grade === 'PERFECT' ? 'rgba(255,209,102,.18)' : 'rgba(82,246,220,.12)');
}

function finishRhythmGame() {
    rhythmActive = false;
    if (rhythmFrameId) cancelAnimationFrame(rhythmFrameId);
    rhythmLoop = null;
    rhythmNotes.forEach(note => note.remove()); rhythmNotes = [];
    rhythmFinished = true;
    if (rhythmScore >= GAME_SETTINGS.starsRequired) {
        playSound('success');
        const firstCompletion = !gameState.completedMinigames.includes('stars');
        if (firstCompletion) {
            gameState.score += 350;
            gameState.completedMinigames.push('stars');
            sendTrackingEvent('mini_game_completed', { game: 'rhythm', score: rhythmScore });
        }
        if (!gameState.unlockedLocations.includes('zal')) gameState.unlockedLocations.push('zal');
        saveProgress(); updateMapUI();
        showModal(firstCompletion ? 'ПОБЕДА!' : 'РИТМ ПРОЙДЕН', firstCompletion ? 'Я и не сомневался что пройдешь:D +350 ⭐' : 'Награда за этот уровень уже получена.', () => openTerminal(CLUES.mirror, CONFIG.level2Code, 'kitchen', '🧠 MEMORY ОТКРЫТ!'));
    } else {
        playSound('error');
        showModal('ПОПРОБУЙ ЕЩЁ РАЗ!', `Нужно набрать минимум ${GAME_SETTINGS.starsRequired} очков, чтобы пройти уровень.`, () => showScreen('screen-map'));
    }
}

function flashScreen(color = 'rgba(82,246,220,.14)') {
    const root = document.getElementById('app');
    if (!root) return;
    root.style.setProperty('--flash-color', color);
    root.classList.remove('screen-flash'); void root.offsetWidth; root.classList.add('screen-flash');
}
function burstFromElement(element, symbol = '✦') {
    const root = document.getElementById('app'); if (!root || !element) return;
    const rr = root.getBoundingClientRect(), rect = element.getBoundingClientRect();
    for (let i = 0; i < 7; i++) {
        const particle = document.createElement('span'); particle.className = 'fx-particle'; particle.textContent = symbol;
        particle.style.left = `${rect.left - rr.left + rect.width/2}px`; particle.style.top = `${rect.top - rr.top + rect.height/2}px`;
        particle.style.setProperty('--dx', `${(Math.random()-.5)*90}px`); particle.style.setProperty('--dy', `${-25-Math.random()*75}px`);
        root.appendChild(particle); particle.addEventListener('animationend', () => particle.remove(), {once:true});
    }
}
function floatingText(text, element, className = '') {
    const root = document.getElementById('app'); if (!root || !element) return;
    const rr = root.getBoundingClientRect(), rect = element.getBoundingClientRect();
    const label = document.createElement('span'); label.className = `floating-text ${className}`; label.textContent = text;
    label.style.left = `${rect.left - rr.left + rect.width/2}px`; label.style.top = `${rect.top - rr.top}px`;
    root.appendChild(label); label.addEventListener('animationend', () => label.remove(), {once:true});
}

function playSound(type) {
    if (videoSecretActive || !soundEnabled || !SOUND_FILES[type]) return;
    try {
        if (!soundCache[type]) soundCache[type] = new Audio(SOUND_FILES[type]);
        const audio = soundCache[type].cloneNode();
        const baseVolume = type === 'rhythmClick' ? 0.20 : type === 'error' ? 0.35 : 0.52;
        audio.volume = Math.max(0, Math.min(1, baseVolume * (gameSettings.sfxVolume / 0.52)));
        audio.play().catch(() => {});
    } catch (e) {}
}
function triggerVibrate(ms = 50) {
    if (!gameSettings.vibration) return;
    if ("vibrate" in navigator) {
        try { navigator.vibrate(ms); } catch(e){}
    }
}

function showScreen(screenId) {
    if (screenId !== 'screen-rhythm') {
        rhythmActive = false;
        if (rhythmFrameId) cancelAnimationFrame(rhythmFrameId);
        if (rhythmLoop) { clearInterval(rhythmLoop); rhythmLoop = null; }
    }
    if (screenId !== 'screen-boss' && typeof bossAttackTimer !== 'undefined') clearBossTimers();
    if (screenId !== 'screen-gifts' && typeof giftActive !== 'undefined') {
        giftActive = false;
        if (giftFrameId) cancelAnimationFrame(giftFrameId);
    }
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });

    const target = document.getElementById(screenId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }

    const topBar = document.getElementById('top-bar');
    if (screenId === 'screen-start' || screenId === 'screen-final') {
        topBar.classList.add('hidden');
    } else {
        topBar.classList.remove('hidden');
    }

    // Сохраняем текущий экран и обновляем прогресс
    gameState.currentScreen = screenId;
    saveProgress();
    sendTrackingEvent('screen_view', { screen: screenId, score: gameState.score, completed: gameState.completedMinigames });

    updateHeaderStats();
    checkAchievements();
}

function updateHeaderStats() {
    const scoreDisplay = document.getElementById('score-display');
    const startScore = document.getElementById('start-score');
    const livesDisplay = document.getElementById('lives-display');

    if (scoreDisplay) {
        scoreDisplay.textContent = String(gameState.score).padStart(4, '0');
    }
    if (startScore) {
        startScore.textContent = String(gameState.score).padStart(4, '0');
    }
    if (livesDisplay) {
        livesDisplay.textContent = '♥'.repeat(Math.max(0, gameState.lives || 0)) || '-';
        livesDisplay.setAttribute('aria-label', `Жизни: ${gameState.lives || 0}`);
    }
}

function showModal(title, text, callback = null, secondaryCallback = null, secondaryLabel = 'ПОВТОРИТЬ ИГРУ') {
    playSound('click');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').textContent = text;
    const modal = document.getElementById('modal-overlay');
    modal.classList.remove('hidden');
    const secondary = document.getElementById('modal-secondary-btn');
    if (secondary) {
        secondary.classList.toggle('hidden', typeof secondaryCallback !== 'function');
        secondary.textContent = secondaryLabel;
        secondary.onclick = typeof secondaryCallback === 'function' ? () => {
            modal.classList.add('hidden');
            playSound('click');
            secondaryCallback();
        } : null;
    }

    const btn = document.getElementById('modal-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        playSound('click');
        if (callback) callback();
    });
}

function saveProgress() {
    localStorage.setItem('bq_state', JSON.stringify(gameState));
}

function loadProgress() {
    const saved = localStorage.getItem('bq_state');
    if (saved) {
        try {
            gameState = Object.assign(gameState, JSON.parse(saved));
        } catch (e) {
            console.error("Save load error", e);
        }
    }
}
function openInventory() {
    showScreen('screen-inventory');
    const list = document.getElementById('inventory-items-list');
    if (!list) return;
    
    list.innerHTML = '';

    // Выбираем только купленные награды
    const boughtRewards = REWARDS.filter(item => gameState.purchasedRewards.includes(item.id));

    if (boughtRewards.length === 0) {
        list.innerHTML = `<p class="text-sm color-gold margin-y-md">Твой инвентарь пуст.<br>Зарабатывай ⭐ и покупай предметы в магазине!</p>`;
        return;
    }

    boughtRewards.forEach(item => {
        const div = document.createElement('div');
        div.className = 'shop-item';
        div.innerHTML = `
            <div>
                <strong>${item.name}</strong><br>
                <small>${item.desc}</small>
            </div>
            <div>
                <span class="color-gold">✅ КУПЛЕНО</span>
            </div>
        `;
        list.appendChild(div);
    });
}
function resetProgress() {
    localStorage.removeItem('bq_state');
    gameState = {
        score: GAME_SETTINGS.startingScore,
        lives: GAME_SETTINGS.startingLives,
        unlockedLocations: ['zal', 'gifts', 'wish', 'achievements'],
        completedMinigames: [],
        purchasedRewards: [],
        foundSecrets: [],
        currentLocation: null,
        currentScreen: 'screen-start',
        wishText: '',
        eventLog: [],
        achievements: [],
        bonusCompleted: false
    };
    saveProgress();
    updateHeaderStats();
    updateMapUI();
    showScreen('screen-start');
}

/* ==========================================================================
   ЛОГИКА ЛОКАЦИЙ И КАРТЫ
   ========================================================================== */

function updateMapUI() {
    const locationStages = {
        zal: 'stars',
        kitchen: 'memory',
        room: 'differences',
        bathroom: 'finalCode',
        secret: 'boss',
        gifts: 'gifts',
        wish: 'wish',
        achievements: 'achievements'
    };

    const locs = ['zal', 'kitchen', 'room', 'bathroom', 'secret', 'gifts', 'wish', 'achievements'];
    
    locs.forEach(loc => {
        const btn = document.getElementById(`loc-${loc}`);
        if (!btn) return;

        const statusSpan = btn.querySelector('.status');

        btn.classList.remove('locked', 'unlocked', 'completed');

        const isCompleted = gameState.completedMinigames.includes(locationStages[loc]);
        const isUnlocked = gameState.unlockedLocations.includes(loc);

        if (isCompleted) {
            btn.classList.add('completed');
            if (statusSpan) statusSpan.textContent = '✅';
        } else if (isUnlocked) {
            btn.classList.add('unlocked');
            if (statusSpan) statusSpan.textContent = '🔓';
        } else {
            btn.classList.add('locked');
            if (statusSpan) statusSpan.textContent = '🔒';
        }
    });
}

function handleLocationClick(loc) {
    playSound('click');
    triggerVibrate(30);

    if (!gameState.unlockedLocations.includes(loc)) {
        showModal("ЗАПУТАННАЯ ДВЕРЬ", "Эта комната ещё заблокирована! Пройди предыдущие испытания.");
        return;
    }

    gameState.currentLocation = loc;

    if (loc === 'achievements') {
        openAchievementsScreen();
    } else if (loc === 'wish') {
        openWishScreen();
    } else if (loc === 'gifts') {
        const replayed = gameState.completedMinigames.includes('gifts');
        showModal(replayed ? '✨ НАСТРОЕНИЕ СОБРАНО' : '✨', replayed ? 'Награда уже получена, но этот уровень можно пройти ещё раз.' : 'Лови всё хорошее, что должно быть в идеальном дне рождения. Но избегай вещей, которые портят настроение.', () => showScreen('screen-map'), () => startGiftCatchGame());
    } else if (loc === 'zal') {
        if (!gameState.completedMinigames.includes('stars')) {
            showModal('🎵', 'Для начала проверим не забыла ли ты как играть секай, не сомневаюсь что ты пройдешь его спокойна.', () => startRhythmGame());
        } else {
            showModal('🎵 РИТМ ПРОЙДЕН', 'Следующий уровень: MEMORY. Код уже найден.', () => openTerminal(CLUES.mirror, CONFIG.level2Code, 'kitchen', '🧠 MEMORY ОТКРЫТ!'), () => startRhythmGame());
        }
    } else if (loc === 'kitchen') {
        if (!gameState.completedMinigames.includes('memory')) {
            showModal('🧠', 'Теперь проверим память. Тут главное - не открывать всё подряд и надеяться на чудо.', () => startMemoryGame());
        } else {
            showModal('🧠 MEMORY ПРОЙДЕНА', 'Следующий уровень: аудио-подсказка и код 7393.', () => startAudioStage(), () => startMemoryGame());
        }
    } else if (loc === 'room') {
        if (!gameState.completedMinigames.includes('differences')) {
            showModal('🔎 НАЙДИ ОТЛИЧИЯ', 'Здесь важны зоркое зрение и внимательность. Сравни фотографии и найди отличия в трёх раундах.', () => startDifferenceGame());
        } else {
            showModal('🔎 ОТЛИЧИЯ НАЙДЕНЫ', 'Следующий уровень: КАПСУЛА КОДА.', () => showScreen('screen-map'), () => startDifferenceGame());
        }
    } else if (loc === 'bathroom') {
        showModal('🔐', 'Ты уже почти дошла. Осталось последнее испытание. Все найденные подсказки были нужны именно для этого.', () => showScreen('screen-final-code'));
    // Внутри handleLocationClick(loc) в script.js:
} else if (loc === 'secret') {
    if (gameState.unlockedLocations.includes('secret')) {
        openSecretRoom(); // <--- Здесь должна быть вызвана функция с проигрыванием звука
    } else {
        openTerminal(
            "🎁 Введи секретный код для доступа!", 
            CONFIG.finalCode, 
            'secret', 
            "🔓 ФИНАЛЬНЫЙ БОЙ ОТКРЫТ!"
        );
    }
}
}

/* ==========================================================================
   ЭТАП 1: МИНИ-ИГРА "ЛОВИ ЗВЁЗДЫ"
   ========================================================================== */

let starTimer = null;
let currentStarsCaught = 0;

function startStarGame() {
    showScreen('screen-star-game');
    currentStarsCaught = 0;
    document.getElementById('star-game-score').textContent = currentStarsCaught;

    let timeLeft = GAME_SETTINGS.starGameDuration;
    document.getElementById('star-game-timer').textContent = timeLeft;

    const canvas = document.getElementById('star-canvas');
    canvas.innerHTML = '';
    spawnStar();

    if (starTimer) clearInterval(starTimer);
    starTimer = setInterval(() => {
        timeLeft--;
        document.getElementById('star-game-timer').textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(starTimer);
            canvas.innerHTML = '';

            if (currentStarsCaught >= GAME_SETTINGS.starsRequired) {
                playSound('success');
                const firstCompletion = !gameState.completedMinigames.includes('stars');
                if (firstCompletion) {
                    gameState.score += 300;
                    gameState.completedMinigames.push('stars');
                    sendTrackingEvent('mini_game_completed', { game: 'stars', score: currentStarsCaught });
                }
                saveProgress();
                showModal('LEVEL COMPLETE!', firstCompletion ? '+300 ⭐\n\nТы успешно собрала достаточно звёзд!' : 'Награда за этот уровень уже получена.', () => {
                    openTerminal(CLUES.mirror, CONFIG.level2Code, 'kitchen', '🧠 MEMORY ОТКРЫТ!');
                });
            } else {
                playSound('error');
                showModal("ПОПРОБУЙ ЕЩЁ РАЗ!", `Нужно собрать минимум ${GAME_SETTINGS.starsRequired} звёзд.`, () => {
                    showScreen('screen-map');
                });
            }
        }
    }, 1000);
}

function spawnStar() {
    const canvas = document.getElementById('star-canvas');
    canvas.innerHTML = '';

    const star = document.createElement('div');
    star.className = 'clickable-star';
    star.textContent = '⭐';

    const maxX = canvas.clientWidth - 50;
    const maxY = canvas.clientHeight - 50;

    star.style.left = Math.max(10, Math.floor(Math.random() * maxX)) + 'px';
    star.style.top = Math.max(10, Math.floor(Math.random() * maxY)) + 'px';

    star.addEventListener('pointerdown', () => {
        playSound('star');
        triggerVibrate(40);
        currentStarsCaught++;
        document.getElementById('star-game-score').textContent = currentStarsCaught;
        spawnStar();
    });

    canvas.appendChild(star);
}

/* ==========================================================================
   ЭТАП 2, 4: ВВОД КОДА В ТЕРМИНАЛЕ
   ========================================================================== */

let giftFrameId = null;
let giftActive = false;
let giftCaught = 0;
let moodLives = 3;
let giftLastTime = 0;
let giftSpawnElapsed = 0;
let giftInputBound = false;
const GOOD_MOOD = ['РАДОСТЬ', 'ОТДЫХ', 'ПОДАРОК', 'ТОРТ', 'ПУТЕШЕСТВИЕ', 'СМЕХ', 'ОБНИМАШКИ', 'СЮРПРИЗ'];
const BAD_MOOD = ['СТРЕСС', 'ДЕДЛАЙН', 'УБОРКА', 'СРОЧНЫЕ ДЕЛА', 'ПОНЕДЕЛЬНИК'];

function startGiftCatchGame() {
    showScreen('screen-gifts');
    giftActive = true; giftCaught = 0; moodLives = 3; giftLastTime = performance.now(); giftSpawnElapsed = 0;
    const field = document.getElementById('gift-field');
    const basket = document.getElementById('gift-basket');
    field.querySelectorAll('.falling-gift').forEach(node => node.remove());
    basket.style.left = '50%';
    document.getElementById('gift-game-score').textContent = '0';
    document.getElementById('gift-game-timer').textContent = moodLives;
    document.getElementById('gift-progress-bar').style.width = '0%';
    if (!giftInputBound) {
        field.addEventListener('pointermove', moveGiftBasket, { passive: true });
        field.addEventListener('pointerdown', moveGiftBasket, { passive: true });
        document.addEventListener('keydown', moveGiftBasketKeyboard);
        giftInputBound = true;
    }
    if (giftFrameId) cancelAnimationFrame(giftFrameId);
    giftFrameId = requestAnimationFrame(updateGiftCatchGame);
}

function moveGiftBasket(event) {
    if (!giftActive || !event.clientX) return;
    const field = document.getElementById('gift-field');
    const rect = field.getBoundingClientRect();
    const percent = Math.max(8, Math.min(92, ((event.clientX - rect.left) / rect.width) * 100));
    document.getElementById('gift-basket').style.left = `${percent}%`;
}

function moveGiftBasketKeyboard(event) {
    if (!giftActive || !['ArrowLeft','ArrowRight','a','d','ф','в'].includes(event.key)) return;
    event.preventDefault();
    const basket = document.getElementById('gift-basket');
    const current = parseFloat(basket.style.left) || 50;
    basket.style.left = `${Math.max(8, Math.min(92, current + (['ArrowLeft','a','ф'].includes(event.key) ? -7 : 7)))}%`;
}

function spawnFallingGift() {
    const field = document.getElementById('gift-field');
    const bad = Math.random() < 0.28;
    const item = document.createElement('button');
    const word = bad ? BAD_MOOD[Math.floor(Math.random() * BAD_MOOD.length)] : GOOD_MOOD[Math.floor(Math.random() * GOOD_MOOD.length)];
    item.type = 'button'; item.className = `falling-gift mood-card ${bad ? 'mood-bad' : 'mood-good'}`;
    item.textContent = word;
    item.dataset.x = String(8 + Math.random() * 84); item.dataset.y = '-52'; item.dataset.speed = String(105 + Math.random()*55); item.dataset.bad = bad ? '1' : '0';
    item.style.left = `${item.dataset.x}%`; item.style.top = `${item.dataset.y}px`;
    item.addEventListener('pointerdown', () => catchFallingGift(item), { once: true });
    field.appendChild(item);
}

function catchFallingGift(item) {
    if (!giftActive || !item.isConnected) return;
    if (item.dataset.bad === '1') {
        moodLives--;
        document.getElementById('gift-game-timer').textContent = moodLives;
        playSound('error'); flashScreen('rgba(255,91,120,.18)');
        document.getElementById('gift-field').classList.add('gift-hit');
        setTimeout(() => document.getElementById('gift-field').classList.remove('gift-hit'), 180);
        item.remove();
        if (moodLives <= 0) finishGiftCatchGame(false);
        return;
    }
    giftCaught++;
    document.getElementById('gift-game-score').textContent = giftCaught;
    document.getElementById('gift-progress-bar').style.width = `${(giftCaught / 12) * 100}%`;
    playSound('match'); burstFromElement(item, '✦'); floatingText('+1', item, 'combo-pop'); item.remove();
    if (giftCaught >= 12) finishGiftCatchGame(true);
}

function updateGiftCatchGame(timestamp = performance.now()) {
    if (!giftActive) return;
    const delta = Math.min(34, Math.max(0, timestamp - giftLastTime)); giftLastTime = timestamp;
    const field = document.getElementById('gift-field');
    const basket = document.getElementById('gift-basket');
    giftSpawnElapsed += delta;
    if (giftSpawnElapsed >= 430) { giftSpawnElapsed = 0; spawnFallingGift(); }
    const basketX = parseFloat(basket.style.left) || 50;
    field.querySelectorAll('.falling-gift').forEach(item => {
        const y = parseFloat(item.dataset.y) + parseFloat(item.dataset.speed) * delta / 1000;
        const x = parseFloat(item.dataset.x); item.dataset.y = String(y); item.style.top = `${y}px`;
        if (y > field.clientHeight - 86 && Math.abs(x - basketX) < 10) catchFallingGift(item);
        else if (y > field.clientHeight + 30) item.remove();
    });
    giftFrameId = requestAnimationFrame(updateGiftCatchGame);
}

function finishGiftCatchGame(won = giftCaught >= 12) {
    if (!giftActive) return;
    giftActive = false;
    if (giftFrameId) cancelAnimationFrame(giftFrameId);
    document.querySelectorAll('.falling-gift').forEach(node => node.remove());
    const firstCompletion = !gameState.completedMinigames.includes('gifts');
    if (won && firstCompletion) {
        gameState.score += 150;
        gameState.completedMinigames.push('gifts');
        sendTrackingEvent('mini_game_completed', { game: 'mood', caught: giftCaught });
        saveProgress(); updateMapUI();
        playSound('success');
        showModal('НАСТРОЕНИЕ СОБРАНО!', 'Теперь этот день официально можно считать идеальным. +150 ⭐', () => showScreen('screen-map'));
    } else if (won) {
        playSound('success');
        showModal('ЕЩЁ НЕМНОГО ПОЗИТИВА!', 'Ты уже забрала награду, но можешь сыграть ещё раз.', () => showScreen('screen-map'));
    } else {
        playSound('error');
        showModal('НАСТРОЕНИЕ ИСПОРЧЕНО', 'Ой. Плохих вещей оказалось слишком много. Попробуй ещё раз!', () => showScreen('screen-map'));
    }
}

let currentInputCode = "";
let targetCode = "";
let unlockTargetLoc = "";
let unlockMessage = "";

function openTerminal(clueText, code, unlockLoc, successMsg) {
    showScreen('screen-terminal');
    currentInputCode = "";
    targetCode = code;
    unlockTargetLoc = unlockLoc;
    unlockMessage = successMsg;

    document.getElementById('terminal-clue-text').textContent = clueText;
    updateCodeDisplay();
}

function updateCodeDisplay() {
    document.getElementById('code-display').textContent = currentInputCode.padEnd(targetCode.length || 4, '_').split('').join(' ');
}

function handleNumpadInput(val) {
    playSound(val === 'check' ? 'terminalConfirm' : 'terminalInput');
    triggerVibrate(20);

    if (val === 'back') {
        currentInputCode = currentInputCode.slice(0, -1);
    } else if (val === 'check') {
        if (currentInputCode === targetCode) {
            playSound('terminalConfirm');
            triggerVibrate([100, 50, 100]);

            if (!gameState.unlockedLocations.includes(unlockTargetLoc)) {
                gameState.unlockedLocations.push(unlockTargetLoc);
            }
            saveProgress();
            updateMapUI();

            // Внутри handleNumpadInput при успешном коде:
showModal("✅ ACCESS GRANTED", unlockMessage, () => {
    if (unlockTargetLoc === 'secret') {
        openSecretRoom(); // <--- Запустит экран и звук одновременно
    } else {
        showScreen('screen-map');
    }
});
        } else {
            playSound('error');
            triggerVibrate(200);
            showModal("❌ ACCESS DENIED", "Неверный код. Попробуй найти правильную записку!");
            currentInputCode = "";
        }
    } else if (currentInputCode.length < targetCode.length) {
        currentInputCode += val;
    }
    updateCodeDisplay();
}

function startBonusGame() {
    // Если уровень уже пройден - показываем сообщение
    if (gameState.bonusCompleted) {
        showModal("БОНУС УЖЕ ПОЛУЧЕН", "Ты уже прошла этот секретный уровень и забрала награду! Так шо псе ⭐");
        return;
    }

    // Переключаем экран на бонусный
    showScreen('screen-bonus');
    
    const box = document.getElementById('bonus-box');
    if (!box) return;

    // Очищаем старые точки
    const oldTargets = box.querySelectorAll('.diff-target');
    oldTargets.forEach(el => el.remove());

    // Устанавливаем координаты
    const targetData = { top: '70%', left: '60%' };

    const target = document.createElement('div');
    target.className = 'diff-target';
    target.style.top = targetData.top;
    target.style.left = targetData.left;

    // Клик по кружку
    target.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (!target.classList.contains('found')) {
            target.classList.add('found');
            playSound('success');
            triggerVibrate([100, 50, 100]);

            if (!gameState.bonusCompleted) gameState.score += 500;
            gameState.bonusCompleted = true; // Отмечаем как пройденный
            saveProgress();
            updateHeaderStats();

            showModal("🎉 ВЕРНО!", "Ты думала, что уже всё прошла? Конечно же нет. Я спрятал ещё одну штуку. +500 ⭐", () => {
                showScreen('screen-map');
            });
        }
    });

    // Обязательно добавляем кружок в контейнер!
    box.appendChild(target);
}
/* ==========================================================================
   ЭТАП 3: MEMORY GAME
   ========================================================================== */

const MEMORY_CARDS = [
    { id: 'photo-1', src: 'assets/images/memory/photo-1.jpg', fallback: '🎂' },
    { id: 'photo-2', src: 'assets/images/memory/photo-2.jpg', fallback: '🎁' },
    { id: 'photo-3', src: 'assets/images/memory/photo-3.jpg', fallback: '🎈' },
    { id: 'photo-4', src: 'assets/images/memory/photo-4.jpg', fallback: '🎉' },
    { id: 'photo-5', src: 'assets/images/memory/photo-5.jpg', fallback: '🍰' },
    { id: 'photo-6', src: 'assets/images/memory/photo-6.jpg', fallback: '👑' },
    { id: 'photo-7', src: 'assets/images/memory/photo-7.jpg', fallback: '✨' },
    { id: 'photo-8', src: 'assets/images/memory/photo-8.jpg', fallback: '💌' },
    { id: 'photo-9', src: 'assets/images/memory/photo-9.jpg', fallback: '🌟' }
];
let flippedCards = [];
let matchedPairs = 0;
let memoryPairCount = 8;

function startMemoryGame() {
    showScreen('screen-memory');
    const grid = document.getElementById('memory-grid');
    grid.innerHTML = '';
    flippedCards = [];
    matchedPairs = 0;

    const selectedCards = [...MEMORY_CARDS].sort(() => Math.random() - 0.5).slice(0, memoryPairCount);
    const cardsData = [...selectedCards, ...selectedCards].sort(() => Math.random() - 0.5);

    cardsData.forEach((icon, index) => {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.dataset.pair = icon.id;
        card.dataset.src = icon.src;
        card.dataset.fallback = icon.fallback;
        card.dataset.index = index;
        card.textContent = '❓';

        card.addEventListener('click', () => handleMemoryCardClick(card));
        grid.appendChild(card);
    });
}

function revealMemoryCard(card) {
    const fallback = card.dataset.fallback;
    card.innerHTML = `<img src="${card.dataset.src}" alt="Фото-воспоминание" onerror="this.remove(); this.parentNode.insertAdjacentText('afterbegin', '${fallback}')">`;
}

function handleMemoryCardClick(card) {
    if (flippedCards.length >= 2 || card.classList.contains('flipped') || card.classList.contains('matched')) return;

    playSound('click');
    card.classList.add('flipped');
    revealMemoryCard(card);
    flippedCards.push(card);

    if (flippedCards.length === 2) {
        const [c1, c2] = flippedCards;
        if (c1.dataset.pair === c2.dataset.pair) {
            playSound('star');
            c1.classList.add('matched');
            c2.classList.add('matched');
            matchedPairs++;
            flippedCards = [];

            if (matchedPairs === memoryPairCount) {
                setTimeout(() => {
                    playSound('success');
                    const firstCompletion = !gameState.completedMinigames.includes('memory');
                    if (firstCompletion) {
                        gameState.score += 500;
                        gameState.completedMinigames.push('memory');
                        sendTrackingEvent('mini_game_completed', { game: 'memory' });
                    }
                    saveProgress();
                    showModal('MEMORY COMPLETE!', firstCompletion ? 'Неплохо.\nПамять пока на месте, можно двигаться дальше. +500 ⭐' : 'Память пройдена ещё раз. Награда уже получена.', () => {
                        startAudioStage();
                    }, () => startMemoryGame());
                }, 400);
            }
        } else {
            setTimeout(() => {
                playSound('error');
                c1.classList.remove('flipped');
                c2.classList.remove('flipped');
                c1.innerHTML = '❓';
                c2.innerHTML = '❓';
                flippedCards = [];
            }, 800);
        }
    }
}

/* ==========================================================================
   ЭТАП 5: ГОЛОСОВАЯ ПОДСКАЗКА
   ========================================================================== */

function startAudioStage() {
    showScreen('screen-audio-clue');
    const fallbackText = document.getElementById('audio-fallback-text');
    if (fallbackText) {
        fallbackText.textContent = CLUES.audioFallback;
        fallbackText.classList.remove('hidden');
    }
}

function playClueAudio() {
    playSound('success');
    const fallbackText = document.getElementById('audio-fallback-text');
    if (fallbackText) {
        fallbackText.textContent = CLUES.audioFallback;
        fallbackText.classList.remove('hidden');
    }
    if (window.clueVoiceAudio) {
        window.clueVoiceAudio.pause();
        window.clueVoiceAudio.currentTime = 0;
    }

    window.clueVoiceAudio = new Audio('assets/sounds/Maks.mp3');
    window.clueVoiceAudio.volume = 1;
    window.clueVoiceAudio.play().catch(() => {
        console.warn('Не удалось воспроизвести голосовую подсказку');
    });
}

/* ============================================================================
   ЭТАП 6: НАЙДИ ОТЛИЧИЯ
   ========================================================================== */

const DIFFERENCE_ROUNDS = [
    {
        title: 'ГОСТИНАЯ',
        ratio: '16 / 9',
        beforeImage: 'assets/images/differences/round-1-before.jpg',
        afterImage: 'assets/images/differences/round-1-after.jpg',
        spots: [
            { x: 56, y: 26.5, w: 17.5, h: 44.5, label: 'Предмет в центре сцены' },
            { x: 2, y: 73, w: 16, h: 17, label: 'Предмет слева на столе' }
        ]
    },
    {
        title: 'КОТ И ЦУМУГИ',
        ratio: '4 / 3',
        beforeImage: 'assets/images/differences/round-2-before.jpg',
        afterImage: 'assets/images/differences/round-2-after.jpg',
        spots: [
            { x: 22, y: 76.3, w: 13, h: 12, label: 'Шарик снизу слева' },
            { x: 84, y: 36, w: 12, h: 25, label: 'Длинная штука справа' }
        ]
    },
    {
        title: 'ПРАЗДНИЧНЫЙ СТОЛ',
        ratio: '1280 / 590',
        beforeImage: 'assets/images/differences/round-3-before.jpg',
        afterImage: 'assets/images/differences/round-3-after.jpg',
        spots: [
            { label: 'Первый предмет', x: 43, y: 68.1, w: 5.4, h: 7.7 },
            { label: 'Второй предмет', x: 65.7, y: 77.2, w: 3.3, h: 5.5 },
            { label: 'Третий предмет', x: 59.6, y: 88.1, w: 9.8, h: 7.5 },
            { label: 'Четвёртый предмет', x: 56.6, y: 70.7, w: 6.3, h: 6.7 }
        ]
    }
];
let differenceRound = 0;
let differenceFound = 0;
let differenceLocked = false;
let differenceHintIndex = 0;

function startDifferenceGame() {
    showScreen('screen-differences');
    differenceRound = 0;
    differenceFound = 0;
    differenceLocked = false;
    differenceHintIndex = 0;
    renderDifferenceRound();
}

function renderDifferenceRound() {
    const round = DIFFERENCE_ROUNDS[differenceRound];
    differenceFound = 0;
    differenceLocked = false;
    const totalDifferences = DIFFERENCE_ROUNDS.reduce((sum, item) => sum + item.spots.length, 0);
    document.getElementById('diff-round').textContent = differenceRound + 1;
    const previousFound = DIFFERENCE_ROUNDS.slice(0, differenceRound).reduce((sum, item) => sum + item.spots.length, 0);
    document.getElementById('diff-score').textContent = previousFound;
    document.getElementById('diff-total').textContent = totalDifferences;
    document.getElementById('diff-title').textContent = round.title;
    document.getElementById('diff-feedback').textContent = `Найди ${round.spots.length} отличия на правой фотографии.`;
    const before = document.getElementById('diff-before');
    const after = document.getElementById('diff-after');
    before.style.setProperty('--diff-ratio', round.ratio);
    after.style.setProperty('--diff-ratio', round.ratio);
    before.innerHTML = `<img class="difference-image" src="${round.beforeImage}" alt="Фотография до изменений">`;
    after.innerHTML = `<img class="difference-image" src="${round.afterImage}" alt="Фотография после изменений">`;
    round.spots.forEach((spot, index) => {
        const beforeSpot = spot.before || spot;
        const afterSpot = spot.after || spot;
        const beforeHotspot = document.createElement('button');
        beforeHotspot.type = 'button';
        beforeHotspot.className = 'difference-hotspot difference-before-hotspot';
        beforeHotspot.dataset.slot = index;
        beforeHotspot.setAttribute('aria-label', `${spot.label}, верхняя фотография`);
        beforeHotspot.style.left = `${beforeSpot.x}%`;
        beforeHotspot.style.top = `${beforeSpot.y}%`;
        beforeHotspot.style.width = `${beforeSpot.w}%`;
        beforeHotspot.style.height = `${beforeSpot.h}%`;
        beforeHotspot.addEventListener('click', () => handleDifferenceClick(beforeHotspot, round));
        before.appendChild(beforeHotspot);
        const hotspot = document.createElement('button');
        hotspot.type = 'button';
        hotspot.className = 'difference-hotspot';
        hotspot.dataset.slot = index;
        hotspot.setAttribute('aria-label', spot.label);
        hotspot.style.left = `${afterSpot.x}%`;
        hotspot.style.top = `${afterSpot.y}%`;
        hotspot.style.width = `${afterSpot.w}%`;
        hotspot.style.height = `${afterSpot.h}%`;
        hotspot.addEventListener('click', () => handleDifferenceClick(hotspot, round));
        after.appendChild(hotspot);
    });
}

function handleDifferenceClick(item, round) {
    if (differenceLocked || item.classList.contains('found') || item.classList.contains('wrong')) return;
    const slot = Number(item.dataset.slot);
    if (round.spots[slot]) {
        document.querySelectorAll(`.difference-hotspot[data-slot="${slot}"]`).forEach(node => node.classList.add('found'));
        differenceFound++;
        const previousFound = DIFFERENCE_ROUNDS.slice(0, differenceRound).reduce((sum, item) => sum + item.spots.length, 0);
        const totalFound = previousFound + differenceFound;
        document.getElementById('diff-score').textContent = totalFound;
        document.getElementById('diff-feedback').textContent = '✨ Точно! Ты заметила изменение.';
        playSound('match');
        burstFromElement(item, '✦');
        if (differenceFound === round.spots.length) {
            differenceLocked = true;
            setTimeout(() => {
                differenceRound++;
                if (differenceRound < DIFFERENCE_ROUNDS.length) {
                    renderDifferenceRound();
                } else {
                    finishDifferenceGame();
                }
            }, 650);
        }
    } else {
        item.classList.add('wrong');
        document.getElementById('diff-feedback').textContent = 'Не совсем. Посмотри внимательнее.';
        playSound('error');
        setTimeout(() => item.classList.remove('wrong'), 450);
    }
}

function showDifferenceHint() {
    const round = DIFFERENCE_ROUNDS[differenceRound];
    const available = round.spots.map((_, index) => index).filter(index => !document.querySelector(`.difference-hotspot[data-slot="${index}"].found`));
    if (!available.length) {
        document.getElementById('diff-feedback').textContent = 'Все отличия в этом раунде уже найдены.';
        return;
    }
    const slot = available[differenceHintIndex % available.length];
    differenceHintIndex++;
    document.querySelectorAll(`.difference-hotspot[data-slot="${slot}"]`).forEach(node => {
        node.classList.add('hinted');
        setTimeout(() => node.classList.remove('hinted'), 2200);
    });
    const hintButton = document.getElementById('btn-diff-hint');
    hintButton.disabled = true;
    hintButton.textContent = '💡 ПОДСКАЗКА ПОКАЗАНА';
    setTimeout(() => { hintButton.disabled = false; hintButton.textContent = '💡 ПОДСКАЗАТЬ ОТЛИЧИЕ'; }, 2200);
    document.getElementById('diff-feedback').textContent = `Подсветила: ${round.spots[slot].label}.`;
}

function finishDifferenceGame() {
    const firstCompletion = !gameState.completedMinigames.includes('differences');
    if (firstCompletion) {
        gameState.score += 300;
        gameState.completedMinigames.push('differences');
        sendTrackingEvent('mini_game_completed', { game: 'differences', found: DIFFERENCE_ROUNDS.reduce((sum, item) => sum + item.spots.length, 0) });
    }
    if (!gameState.unlockedLocations.includes('bathroom')) gameState.unlockedLocations.push('bathroom');
    saveProgress();
    updateMapUI();
    playSound('success');
    const totalDifferences = DIFFERENCE_ROUNDS.reduce((sum, item) => sum + item.spots.length, 0);
    showModal('🎉 ОТЛИЧИЯ НАЙДЕНЫ!', firstCompletion ? `Зрение ещё не подвело. Следующая часть кода уже ждёт тебя. +300 ⭐` : 'Ты снова нашла все изменения. Награда уже получена.', () => showScreen('screen-map'));
}

function openWishScreen() {
    showScreen('screen-wish');
    const input = document.getElementById('wish-input');
    const saved = document.getElementById('wish-saved');
    if (input) input.value = gameState.wishText || '';
    if (saved) saved.textContent = gameState.wishText ? '✅ Пожелание сохранено на этом устройстве.' : '';
}

function saveWish() {
    const input = document.getElementById('wish-input');
    const text = (input?.value || '').trim();
    if (!text) {
        showModal('НАПИШИ ПОЖЕЛАНИЕ', 'Поле пока пустое - напиши хотя бы пару слов.');
        return;
    }
    gameState.wishText = text;
    gameState.eventLog = gameState.eventLog || [];
    gameState.eventLog.push({ type: 'wish', text, at: new Date().toISOString() });
    sendTrackingEvent('wish_saved', { wish: text });
    saveProgress();
    checkAchievements();
    const saved = document.getElementById('wish-saved');
    if (saved) saved.textContent = '✅ Готово! Пожелание сохранено.';
    playSound('success');
}

const ACHIEVEMENTS = [
    { id: 'first-step', icon: '🚀', title: 'ПЕРВЫЙ ШАГ', desc: 'Запустила праздничный квест', test: () => gameState.currentScreen !== 'screen-start' },
    { id: 'rhythm', icon: '🎵', title: 'В РИТМЕ', desc: 'Прошла ритм-игру', test: () => gameState.completedMinigames.includes('stars') },
    { id: 'memory', icon: '🧠', title: 'ФОТОПАМЯТЬ', desc: 'Собрала Memory', test: () => gameState.completedMinigames.includes('memory') },
    { id: 'differences', icon: '🔎', title: 'ОРЛИНОЕ ЗРЕНИЕ', desc: 'Нашла все отличия в праздничных сценах', test: () => gameState.completedMinigames.includes('differences') },
    { id: 'gifts', icon: '✨', title: 'СОБИРАТЕЛЬ НАСТРОЕНИЯ', desc: 'Собрала всё хорошее настроение', test: () => gameState.completedMinigames.includes('gifts') },
    { id: 'wish', icon: '📝', title: 'ЗАГАДАНО', desc: 'Написала пожелание о подарке', test: () => Boolean((gameState.wishText || '').trim()) },
    { id: 'secrets', icon: '🗝️', title: 'СЕКРЕТНЫЙ АГЕНТ', desc: 'Нашла секретные бонусы', test: () => Boolean(gameState.bonusCompleted) && (gameState.foundSecrets || []).includes('title') },
    { id: 'absolute-cinema', icon: '🎬', title: 'АБСОЛЮТ СИНЕМА', desc: 'Посмотрела пасхалку о карьере озвучкера', test: () => (gameState.foundSecrets || []).includes('career-video') },
    { id: 'boss', icon: '👾', title: 'BOSS DOWN', desc: 'Победила космического стража', test: () => gameState.completedMinigames.includes('boss') },
    { id: 'quest-master', icon: '🌟', title: 'КВЕСТ ПРОЙДЕН', desc: 'Прошла все мини-игры и финального босса', test: () => ['stars', 'memory', 'differences', 'gifts', 'boss'].every(id => gameState.completedMinigames.includes(id)) }
];

function checkAchievements() {
    gameState.achievements = gameState.achievements || [];
    const newly = [];
    ACHIEVEMENTS.forEach(item => {
        if (item.test() && !gameState.achievements.includes(item.id)) {
            gameState.achievements.push(item.id); newly.push(item);
            sendTrackingEvent('achievement_unlocked', { id: item.id, title: item.title });
        }
    });
    if (!newly.length) return;
    localStorage.setItem('bq_state', JSON.stringify(gameState));
    newly.forEach((item, index) => setTimeout(() => {
        playSound('achievement'); showAchievementToast(item);
    }, index * 900));
}

function showAchievementToast(item) {
    const toast = document.getElementById('achievement-toast');
    if (!toast) return;
    toast.innerHTML = `<span class="achievement-toast-icon">${item.icon}</span><span><b>ДОСТИЖЕНИЕ ОТКРЫТО</b><small>${item.title}</small></span>`;
    toast.classList.add('visible');
    clearTimeout(showAchievementToast.timer);
    showAchievementToast.timer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

function openAchievementsScreen() {
    showScreen('screen-achievements');
    checkAchievements();
    const grid = document.getElementById('achievements-grid');
    const unlocked = gameState.achievements || [];
    const progress = Math.round((unlocked.length / ACHIEVEMENTS.length) * 100);
    document.getElementById('achievements-progress').textContent = `${unlocked.length} / ${ACHIEVEMENTS.length} открыто · ${progress}% игры`;
    grid.innerHTML = '';
    ACHIEVEMENTS.forEach(item => {
        const isOpen = unlocked.includes(item.id);
        const card = document.createElement('article');
        card.className = `achievement-card ${isOpen ? 'unlocked' : 'locked'}`;
        card.innerHTML = `<div class="achievement-art"><span>${item.icon}</span>${isOpen ? '<i>✓</i>' : '<em>?</em>'}</div><div class="achievement-copy"><strong>${item.title}</strong><small>${item.desc}</small></div>`;
        grid.appendChild(card);
    });
}
function openCareerVideo() {
    const overlay = document.getElementById('video-secret-overlay');
    const video = document.getElementById('career-video');
    const status = document.getElementById('video-secret-status');
    if (!overlay || !video) return;
    videoSecretActive = true;
    if (backgroundMusic) backgroundMusic.pause();
    overlay.classList.remove('hidden');
    gameState.foundSecrets = gameState.foundSecrets || [];
    if (!gameState.foundSecrets.includes('career-video')) {
        gameState.foundSecrets.push('career-video');
        saveProgress();
        checkAchievements();
    }
    const embedUrl = getYouTubeEmbedUrl(YOUTUBE_VIDEO_URL);
    if (embedUrl) {
        video.src = `${embedUrl}?autoplay=1&rel=0`;
        video.classList.remove('pending');
        if (status) status.classList.add('hidden');
    } else {
        video.src = 'about:blank';
        video.classList.add('pending');
        if (status) status.classList.remove('hidden');
    }
}
function closeCareerVideo() {
    const overlay = document.getElementById('video-secret-overlay');
    const video = document.getElementById('career-video');
    if (video) video.src = 'about:blank';
    if (overlay) overlay.classList.add('hidden');
    videoSecretActive = false;
    if (soundEnabled) startBackgroundMusic(gameSettings.musicTrack, gameSettings.musicVolume);
}
function getYouTubeEmbedUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        let id = parsed.searchParams.get('v');
        if (!id && parsed.hostname.includes('youtu.be')) id = parsed.pathname.slice(1).split('/')[0];
        if (!id && parsed.pathname.includes('/embed/')) id = parsed.pathname.split('/embed/')[1].split('/')[0];
        return id ? `https://www.youtube.com/embed/${id}` : '';
    } catch (e) {
        return '';
    }
}
let bossHp = 180;
let playerHp = 100;
let playerX = 50;
let bossAttackTimer = null;
let bossAttackResolveTimer = null;
let bossPhase = 1;
let bossAttackData = null;
let spaceProjectileTimers = [];
let bossX = 50;

function startBossGame() {
    showScreen('screen-boss');
    bossHp = 180; playerHp = 100; playerX = 50; bossX = 50; bossAttackData = null;
    clearBossTimers();
    updateBossHp(); updatePlayerHp(); updatePlayerPosition(); updateBossPosition();
    setBossStatus('Совмести корабль с ядром босса и жми ОГОНЬ!');
    scheduleSpaceAttack();
}

function clearBossTimers() {
    clearTimeout(bossAttackTimer); clearTimeout(bossAttackResolveTimer);
    spaceProjectileTimers.forEach(clearTimeout); spaceProjectileTimers = [];
    const field = document.getElementById('space-field');
    if (field) field.querySelectorAll('.space-projectile, .space-effect').forEach(node => node.remove());
}

function updateBossHp() {
    const text = document.getElementById('boss-hp-text');
    const bar = document.getElementById('boss-hp-inner');
    if (text) text.textContent = bossHp;
    if (bar) bar.style.width = `${(bossHp / 180) * 100}%`;
    bossPhase = bossHp <= 55 ? 3 : bossHp <= 115 ? 2 : 1;
    const phase = document.getElementById('boss-phase');
    if (phase) phase.textContent = `ФАЗА ${bossPhase}`;
}

function updatePlayerHp() {
    const text = document.getElementById('player-hp-text');
    if (text) text.textContent = playerHp;
    const field = document.getElementById('space-field');
    if (field) field.classList.toggle('shield-low', playerHp <= 35);
}

function updatePlayerPosition() {
    const ship = document.getElementById('player-ship');
    if (ship) ship.style.left = `${playerX}%`;
}

function updateBossPosition() {
    const boss = document.getElementById('boss-ship');
    if (boss) boss.style.left = `${bossX}%`;
}

function setBossStatus(text) {
    const node = document.getElementById('boss-status');
    if (node) node.textContent = text;
}

function moveSpaceShip(direction) {
    playerX = Math.max(10, Math.min(90, playerX + direction * 10));
    updatePlayerPosition();
    playSound('click');
}

function scheduleSpaceAttack() {
    clearTimeout(bossAttackTimer);
    const delay = bossPhase === 3 ? 900 : bossPhase === 2 ? 1100 : 1350;
    bossAttackTimer = setTimeout(launchSpaceAttack, delay);
}

function launchSpaceAttack() {
    const field = document.getElementById('space-field');
    if (!field || !document.getElementById('screen-boss')?.classList.contains('active')) return;
    const kinds = bossPhase === 1 ? ['laser', 'meteor'] : bossPhase === 2 ? ['laser', 'meteor', 'wave'] : ['laser', 'meteor', 'wave', 'barrage'];
    const type = kinds[Math.floor(Math.random() * kinds.length)];
    const warning = document.getElementById('space-warning');
    if (!warning) return;
    warning.innerHTML = '';
    bossAttackData = { type, targets: [] };
    if (type === 'laser') {
        const x = 15 + Math.random() * 70; bossAttackData.targets = [x];
        warning.innerHTML = `<span class="danger-zone laser-zone" style="left:${x}%"></span>`;
        setBossStatus('⚠️ ЛАЗЕР ЗАРЯЖЕН! Уйди из красной зоны!');
    } else if (type === 'meteor') {
        const x = 10 + Math.random() * 80; bossAttackData.targets = [x];
        warning.innerHTML = `<span class="danger-zone meteor-zone" style="left:${x}%">☄️</span>`;
        setBossStatus('☄️ Босс бросает метеор! Двигайся в сторону!');
    } else if (type === 'wave') {
        bossAttackData.targets = [50];
        warning.innerHTML = '<span class="danger-zone wave-zone">〰️ УДАРНАЯ ВОЛНА 〰️</span>';
        setBossStatus('〰️ Ударная волна по центру! Уйди к краю!');
    } else {
        bossAttackData.targets = [25, 50, 75];
        warning.innerHTML = '<span class="danger-zone barrage-zone">⚡　⚡　⚡</span>';
        setBossStatus('⚡ ЗАЛП ПО ТРЁМ ЗОНАМ! Ищи безопасный промежуток!');
    }
    warning.classList.add('active');
    bossAttackResolveTimer = setTimeout(resolveSpaceAttack, 780);
}

function resolveSpaceAttack() {
    const warning = document.getElementById('space-warning');
    if (warning) { warning.classList.remove('active'); warning.innerHTML = ''; }
    if (!bossAttackData) { scheduleSpaceAttack(); return; }
    const { type, targets } = bossAttackData;
    const hit = type === 'wave' ? (playerX > 25 && playerX < 75) : targets.some(x => Math.abs(playerX - x) < (type === 'barrage' ? 12 : 16));
    if (hit) {
        const damage = type === 'laser' ? 24 : type === 'wave' ? 20 : type === 'barrage' ? 16 : 18;
        playerHp = Math.max(0, playerHp - damage); updatePlayerHp();
        setBossStatus(`💥 Попадание! Щит -${damage}. Двигайся быстрее!`);
        playSound('death'); triggerVibrate(120);
        if (playerHp <= 0) {
            clearBossTimers();
            showModal('💥 КОРАБЛЬ РАЗРУШЕН', 'Ладно, в этот раз босс оказался сильнее. Но это не считается. Пробуй ещё.', () => startBossGame());
            return;
        }
    } else {
        setBossStatus('Увернулась, теперь добей его.');
        playSound('star');
    }
    bossAttackData = null;
    bossX = 14 + Math.random() * 72;
    updateBossPosition();
    setBossStatus('Ядро переместилось. Совмести корабли и стреляй!');
    scheduleSpaceAttack();
}

function fireSpaceCannon() {
    if (bossHp <= 0 || !document.getElementById('screen-boss')?.classList.contains('active')) return;
    const field = document.getElementById('space-field');
    const shot = document.createElement('span');
    shot.className = 'space-projectile player-shot'; shot.style.left = `${playerX}%`; shot.style.bottom = '53px';
    field.appendChild(shot);
    const timer = setTimeout(() => shot.remove(), 280);
    spaceProjectileTimers.push(timer);
    if (Math.abs(playerX - bossX) > 20) {
        setBossStatus('ПРОМАХ! Сместись под ядро босса.');
        playSound('error');
        return;
    }
    const critical = Math.random() < (bossPhase === 3 ? .25 : .12);
    const damage = critical ? 18 : 10;
    bossHp = Math.max(0, bossHp - damage); updateBossHp();
    setBossStatus(`${critical ? '🔥 КРИТИЧЕСКИЙ ВЫСТРЕЛ! ' : 'Попадание! '}-${damage} HP боссу.`);
    playSound(critical ? 'match' : 'tap'); triggerVibrate(35);
    const boss = document.getElementById('boss-ship');
    if (boss) { boss.classList.remove('ship-hit'); void boss.offsetWidth; boss.classList.add('ship-hit'); }
    if (bossHp <= 0) finishBossGame();
}

function finishBossGame() {
    clearBossTimers();
    playSound('death');
    const wasBossCompleted = gameState.completedMinigames.includes('boss');
    if (!wasBossCompleted) sendTrackingEvent('boss_defeated', { score: gameState.score });
    if (!gameState.unlockedLocations.includes('secret')) gameState.unlockedLocations.push('secret');
    const firstCompletion = !gameState.completedMinigames.includes('boss');
    if (firstCompletion) {
        gameState.completedMinigames.push('boss');
        gameState.score += 1000;
    }
    saveProgress(); updateMapUI();
    showModal('🏆 BOSS DEFEATED!', firstCompletion ? 'Босс побежден, это была последняя мини-игра, ты прошла мой квест.' : 'Босс снова побеждён, но награда уже получена.', () => openSecretRoom());
}

/* ==========================================================================
   МАГАЗИН НАГРАД И ФИНАЛ
   ========================================================================== */

function openShop() {
    showScreen('screen-shop');
    document.getElementById('shop-score').textContent = gameState.score;
    const list = document.getElementById('shop-items-list');
    list.innerHTML = '';

    REWARDS.forEach(item => {
        const div = document.createElement('div');
        div.className = 'shop-item';

        const isBought = gameState.purchasedRewards.includes(item.id);

        div.innerHTML = `
            <div>
                <strong>${item.name}</strong><br>
                <small>${item.desc}</small><br>
                <span class="color-gold">⭐ ${item.cost}</span>
            </div>
            <div>
                <button class="btn btn-small ${isBought ? 'btn-danger' : 'btn-success'}" ${isBought ? 'disabled' : ''}>
                    ${isBought ? 'КУПЛЕНО' : 'КУПИТЬ'}
                </button>
            </div>
        `;

        const btn = div.querySelector('button');
        if (!isBought) {
            btn.addEventListener('click', () => buyReward(item));
        }

        list.appendChild(div);
    });
}

// Функция запуска пролетающей картинки/эмодзи
function triggerFlyAnimation() {
    // Если старый элемент остался - удаляем его
    const oldFlyer = document.querySelector('.flying-item');
    if (oldFlyer) oldFlyer.remove();

    const flyer = document.createElement('div');
    flyer.className = 'flying-item';
        flyer.innerHTML = `<img src="assets/images/lel.png" style="width:60px; height:auto;">`;

    document.body.appendChild(flyer);

    // Удаляем из DOM сразу после окончания анимации (1.8 секунды)
    setTimeout(() => {
        flyer.remove();
    }, 1800);
}

// Обновленная функция открытия секретной комнаты
function openSecretRoom() {
    showScreen('screen-secret');
    
    // Старые резкие MP3 намеренно не запускаются.

    // Картинка и праздничный звук запускаются только после отдельного финала.
    triggerVibrate([100, 50, 100, 50, 200]);
}

// Слушатель кнопки "Перейти в магазин"
function startConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const box = canvas.parentElement;
    canvas.width = box.clientWidth; canvas.height = box.clientHeight;
    const colors = ['#ffd166', '#52f6dc', '#ff5ea8', '#6f8cff'];
    const pieces = Array.from({length: 70}, () => ({
        x: Math.random() * canvas.width, y: -Math.random() * canvas.height,
        size: 4 + Math.random() * 5, speed: 1.4 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)], tilt: Math.random() * 6.28
    }));
    let frame = 0;
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(piece => {
            piece.y += piece.speed; piece.tilt += .08;
            ctx.fillStyle = piece.color;
            ctx.fillRect(piece.x + Math.sin(piece.tilt) * 4, piece.y, piece.size, piece.size * 1.7);
        });
        if (frame++ < 260) requestAnimationFrame(draw); else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    draw();
}

const toShopBtn = document.getElementById('btn-secret-to-shop');
if (toShopBtn) toShopBtn.addEventListener('click', () => {
    playSound('click');
    showScreen('screen-final');
    const secretAudio = new Audio(MUSIC_FILES.final);
    secretAudio.volume = 0.7;
    secretAudio.play().catch(() => {});
    triggerFlyAnimation();
    startConfetti();
});

function buyReward(item) {
    if (gameState.score >= item.cost) {
        playSound('purchase');
        gameState.score -= item.cost;
        gameState.purchasedRewards.push(item.id);
        sendTrackingEvent('reward_purchased', { id: item.id, name: item.name, cost: item.cost });
        saveProgress();
        updateHeaderStats();
        showModal("🎉 РАЗБЛОКИРОВАНО!", `${item.purchaseMessage}\n\nПокажи этот экран мне, чтобы забрать награду.`, () => {
            openShop();
        });
    } else {
        playSound('error');
        showModal("НЕДОСТАТОЧНО ЗВЁЗД", "Собери больше ⭐ в прошлых испытаниях!");
    }
}

/* ==========================================================================
   ПАСХАЛКИ И СЕКРЕТЫ
   ========================================================================== */

let logoTapCount = 0;

function initEasterEggs() {
    const titleBox = document.querySelector('.main-title-box');
    if (titleBox) {
        titleBox.addEventListener('click', () => {
            logoTapCount++;
            if (logoTapCount === 5) {
                logoTapCount = 0;
                playSound('success');
                gameState.foundSecrets = gameState.foundSecrets || [];
                const firstSecret = !gameState.foundSecrets.includes('title');
                if (firstSecret) gameState.score += 500;
                if (firstSecret) gameState.foundSecrets.push('title');
                saveProgress();
                updateHeaderStats();
                showModal("🤫 СЕКРЕТ НАЙДЕН!", firstSecret ? "Ты нашла пасхалку! Получено +500 ⭐" : "Эта пасхалка уже была найдена.");
            }
        });
    }
}

/* ==========================================================================
   ИНИЦИАЛИЗАЦИЯ И НАВЕШИВАНИЕ СОБЫТИЙ
   ========================================================================== */

let noGameClickCount = 0;
const NO_GAME_TEXTS = ['НЕ ХОЧУ', 'Ну давай, не ломайся', 'Ты серьёзно сейчас?', 'Я это всё вообще-то не просто так делал', 'Ладно, я понял, ты вредная', 'Всё, кнопка от тебя убегает'];
const YES_GAME_TEXTS = ['ДА, ПОГНАЛИ', 'Ну нажми уже', 'Ты всё равно нажмёшь', 'Вот и правильно', 'ВОТ И ПРАВИЛЬНО! 🎉'];

function moveNoGameButton() {
    const noBtn = document.getElementById('btn-no-game');
    if (!noBtn) return;
    noBtn.style.position = 'fixed';
    noBtn.style.zIndex = '45';
    const rect = noBtn.getBoundingClientRect();
    const margin = 14;
    const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxY = Math.max(margin, window.innerHeight - rect.height - margin);
    const x = margin + Math.random() * Math.max(0, maxX - margin);
    const y = margin + Math.random() * Math.max(0, maxY - margin);
    noBtn.style.left = `${Math.round(x)}px`;
    noBtn.style.top = `${Math.round(y)}px`;
}

function handleNoGameClick() {
    noGameClickCount++;
    const noBtn = document.getElementById('btn-no-game');
    const yesBtn = document.getElementById('btn-start-game');
    const index = Math.min(noGameClickCount, NO_GAME_TEXTS.length - 1);
    if (noBtn) {
        noBtn.textContent = NO_GAME_TEXTS[index];
        if (noGameClickCount >= 5) moveNoGameButton();
        else noBtn.style.transform = `scale(${Math.max(.72, 1 - noGameClickCount * .08)})`;
    }
    if (yesBtn) {
        yesBtn.textContent = YES_GAME_TEXTS[Math.min(noGameClickCount, YES_GAME_TEXTS.length - 1)];
        yesBtn.style.transform = `scale(${Math.min(1.35, 1 + noGameClickCount * .08)})`;
    }
    playSound('click');
    triggerVibrate(45);
}

document.addEventListener('DOMContentLoaded', () => {
    loadGameSettings();
    backgroundMusic = document.getElementById('bg-music');
    updateSettingsUI();
    sendTrackingEvent('game_loaded', { name: CONFIG.sisterName });
    loadProgress();
    updateMapUI();

    // Скрываем модальное окно при старте
    const modal = document.getElementById('modal-overlay');
    if (modal) {
        modal.classList.add('hidden');
    }
    const starIcon = document.getElementById('star-bonus-icon');
    if (starIcon) {
        starIcon.addEventListener('click', () => {
            playSound('click');
            showModal('🤫', 'Ты нашла одну из двух секреток, поздравляю (◠‿・)—☆', () => startBonusGame());
        });
    }
    const mapSecretTrigger = document.getElementById('map-secret-trigger');
    if (mapSecretTrigger) {
        mapSecretTrigger.addEventListener('click', openCareerVideo);
        mapSecretTrigger.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCareerVideo(); }
        });
    }
    const videoSecretClose = document.getElementById('video-secret-close');
    if (videoSecretClose) videoSecretClose.addEventListener('click', closeCareerVideo);
    const videoSecretOverlay = document.getElementById('video-secret-overlay');
    if (videoSecretOverlay) videoSecretOverlay.addEventListener('click', event => {
        if (event.target === videoSecretOverlay) closeCareerVideo();
    });

    // Кнопка «Назад» на бонусном экране
    const bonusBackBtn = document.getElementById('btn-bonus-back');
    if (bonusBackBtn) {
        bonusBackBtn.addEventListener('click', () => {
            playSound('click');
            showScreen('screen-map');
        });
    }
    // Кнопки Магазина и Инвентаря в шапке
const shopBtn = document.getElementById('shop-btn');
if (shopBtn) {
    shopBtn.addEventListener('click', () => {
        playSound('click');
        openShop();
    });
}
// Переход в инвентарь по клику на рюкзак
const inventoryBtn = document.getElementById('inventory-btn');
if (inventoryBtn) {
    inventoryBtn.addEventListener('click', () => {
        playSound('click');
        openInventory();
    });
}

// Кнопка возврата из инвентаря на карту
const invBackBtn = document.getElementById('btn-inventory-back');
if (invBackBtn) {
    invBackBtn.addEventListener('click', () => {
        playSound('click');
        showScreen('screen-map');
    });
}

// Обработка кликов по кнопкам ритм-игры снизу
document.querySelectorAll('.rhythm-tap-btn').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const lane = parseInt(btn.dataset.lane);
        handleRhythmTap(lane);
    });
});

// Дополнительно: нажатие прямо по дорожкам на экране
document.querySelectorAll('.rhythm-lane').forEach((lane, index) => {
    lane.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handleRhythmTap(index);
    });
});

    const nameElem = document.getElementById('start-sister-name');
    if (nameElem) nameElem.textContent = CONFIG.sisterName;

    // Загрузка сохранённого экрана
    const savedScreen = gameState.currentScreen || 'screen-start';
    showScreen(savedScreen);

    if (savedScreen === 'screen-differences') {
        startDifferenceGame();
    }

const homeBtn = document.getElementById('home-btn');
if (homeBtn) {
    homeBtn.addEventListener('click', () => {
        if (rhythmLoop) clearInterval(rhythmLoop); // Останавливаем ритм-игру при выходе
        playSound('click');
        showScreen('screen-map');
    });
}
    const startMenuBtn = document.getElementById('start-menu-btn');
    if (startMenuBtn) {
        startMenuBtn.addEventListener('click', () => {
            playSound('click');
            showScreen('screen-start');
        });
    }

    // Кнопки меню
    document.getElementById('btn-start-game').addEventListener('click', () => {
        initAudio();
        startBackgroundMusic(gameSettings.musicTrack, gameSettings.musicVolume);
        playSound('click');
        const noBtn = document.getElementById('btn-no-game');
        if (noBtn) { noBtn.style.position = ''; noBtn.style.left = ''; noBtn.style.top = ''; noBtn.style.transform = ''; }
        showScreen('screen-intro');
    });
    document.getElementById('btn-no-game').addEventListener('click', handleNoGameClick);
    document.getElementById('btn-reset-game').addEventListener('click', () => {
        if (confirm("Точно сбросить весь прогресс игры?")) {
            resetProgress();
        }
    });

    document.getElementById('btn-intro-next').addEventListener('click', () => {
        playSound('click');
        updateMapUI();
        showScreen('screen-map');
    });

    // Переключение звука
    document.getElementById('sound-toggle-btn').addEventListener('click', () => {
        initAudio();
        soundEnabled = !soundEnabled;
        if (audioContext && audioContext.state === 'suspended' && soundEnabled) audioContext.resume();
        updateBackgroundMusic();
        document.getElementById('sound-toggle-btn').textContent = soundEnabled ? '🔊' : '🔇';
        document.getElementById('sound-toggle-btn').setAttribute('aria-label', soundEnabled ? 'Выключить звук' : 'Включить звук');
    });
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => {
        playSound('click');
        updateSettingsUI();
        showScreen('screen-settings');
    });
    const settingsBack = document.getElementById('btn-settings-back');
    if (settingsBack) settingsBack.addEventListener('click', () => {
        playSound('click');
        showScreen('screen-map');
    });
    const musicVolume = document.getElementById('music-volume');
    if (musicVolume) musicVolume.addEventListener('input', event => {
        gameSettings.musicVolume = Number(event.target.value) / 100;
        const label = document.getElementById('music-volume-value');
        if (label) label.textContent = `${event.target.value}%`;
        saveGameSettings();
        if (soundEnabled && backgroundMusic) backgroundMusic.volume = gameSettings.musicVolume;
    });
    const musicTrack = document.getElementById('music-track');
    if (musicTrack) musicTrack.addEventListener('change', event => {
        gameSettings.musicTrack = event.target.value;
        saveGameSettings();
        if (soundEnabled) startBackgroundMusic(gameSettings.musicTrack, gameSettings.musicVolume);
    });
    const sfxVolume = document.getElementById('sfx-volume');
    if (sfxVolume) sfxVolume.addEventListener('input', event => {
        gameSettings.sfxVolume = Number(event.target.value) / 100;
        const label = document.getElementById('sfx-volume-value');
        if (label) label.textContent = `${event.target.value}%`;
        saveGameSettings();
    });
    const vibrationToggle = document.getElementById('vibration-toggle');
    if (vibrationToggle) vibrationToggle.addEventListener('change', event => {
        gameSettings.vibration = event.target.checked;
        saveGameSettings();
    });
    const reducedMotionToggle = document.getElementById('reduced-motion-toggle');
    if (reducedMotionToggle) reducedMotionToggle.addEventListener('change', event => {
        gameSettings.reducedMotion = event.target.checked;
        saveGameSettings();
    });
    const settingsReset = document.getElementById('btn-settings-reset');
    if (settingsReset) settingsReset.addEventListener('click', () => {
        if (confirm('Точно сбросить весь прогресс игры?')) resetProgress();
    });

    // Карта локаций
    document.getElementById('loc-zal').addEventListener('click', () => handleLocationClick('zal'));
    document.getElementById('loc-kitchen').addEventListener('click', () => handleLocationClick('kitchen'));
    document.getElementById('loc-room').addEventListener('click', () => handleLocationClick('room'));
    document.getElementById('loc-bathroom').addEventListener('click', () => handleLocationClick('bathroom'));
    document.getElementById('loc-secret').addEventListener('click', () => handleLocationClick('secret'));
    document.getElementById('loc-gifts').addEventListener('click', () => handleLocationClick('gifts'));
    document.getElementById('loc-wish').addEventListener('click', () => handleLocationClick('wish'));
    document.getElementById('btn-wish-back').addEventListener('click', () => showScreen('screen-map'));
    document.getElementById('btn-save-wish').addEventListener('click', saveWish);
    document.getElementById('loc-achievements').addEventListener('click', () => handleLocationClick('achievements'));
    document.getElementById('btn-achievements-back').addEventListener('click', () => showScreen('screen-map'));
    document.getElementById('wish-input').addEventListener('input', () => { document.getElementById('wish-saved').textContent = ''; });

    // Нампад
    document.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            handleNumpadInput(btn.dataset.val);
        });
    });

    // Аудио этап
    document.getElementById('btn-play-audio').addEventListener('click', playClueAudio);
    document.getElementById('btn-audio-done').addEventListener('click', () => {
        playSound('click');
        if (!gameState.completedMinigames.includes('audio')) {
            gameState.completedMinigames.push('audio');
        }
        saveProgress();
        openTerminal(CLUES.item, CONFIG.level3Code, 'room', '🔎 НАЙДИ ОТЛИЧИЯ ОТКРЫТЫ!');
    });

    document.getElementById('btn-diff-hint').addEventListener('click', showDifferenceHint);

    // Финальный код
    document.getElementById('btn-submit-final-code').addEventListener('click', () => {
        const val = document.getElementById('final-code-input').value.trim();
        if (val === CONFIG.finalCode) {
            playSound('success');
            if (!gameState.completedMinigames.includes('finalCode')) {
                gameState.completedMinigames.push('finalCode');
            }
            if (!gameState.unlockedLocations.includes('secret')) {
                gameState.unlockedLocations.push('secret');
            }
            saveProgress();
            updateMapUI();
            showModal("✅ КОД ВЕРЕН!", "Ну всё. Дальше отступать некуда. Перед тобой последний противник. Удаче)", () => {
                startBossGame();
            });
        } else {
            playSound('error');
            showModal("❌ ОШИБКА", "Неверный финальный код! Проверь полученные части.");
        }
    });

    // Клавиши 1-4 делают ритм-игру удобной и на компьютере, и на телефоне.
    document.addEventListener('keydown', (event) => {
        if (document.getElementById('screen-rhythm')?.classList.contains('active')) {
            const lane = ['1','2','3','4'].indexOf(event.key);
            if (lane >= 0) { event.preventDefault(); handleRhythmTap(lane); }
        }
        if (document.getElementById('screen-boss')?.classList.contains('active')) {
            if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a' || event.key.toLowerCase() === 'ф') { event.preventDefault(); moveSpaceShip(-1); }
            if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd' || event.key.toLowerCase() === 'в') { event.preventDefault(); moveSpaceShip(1); }
            if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); fireSpaceCannon(); }
        }
    });

    // Босс
    document.getElementById('btn-boss-attack').addEventListener('click', fireSpaceCannon);
    document.getElementById('btn-boss-left').addEventListener('click', () => moveSpaceShip(-1));
    document.getElementById('btn-boss-right').addEventListener('click', () => moveSpaceShip(1));
    const finalShopBtn = document.getElementById('btn-final-shop');
    if (finalShopBtn) finalShopBtn.addEventListener('click', openShop);

    // Завершение квеста
    document.getElementById('btn-finish-quest').addEventListener('click', () => {
        showScreen('screen-map');
    });

    initEasterEggs();
    updateHeaderStats();
    document.getElementById('sound-toggle-btn').textContent = soundEnabled ? '🔊' : '🔇';
    document.getElementById('sound-toggle-btn').setAttribute('aria-label', soundEnabled ? 'Выключить звук' : 'Включить звук');
});
