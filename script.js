const $ = id => document.getElementById(id);

const LOGIN_EMAIL = "pandak";
const LOGIN_PASSWORD = "sitaw";
const LOGIN_STORAGE_KEY = "nightfall_logged_in";
const TOTAL_PUMPKINS = 11;
const WORLD_WIDTH = 2920;

// Fixed game size. CSS scales the canvas to fit any screen.
const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 440;
let renderScale = 1;

const loginScreen = $("loginCard");
const loadingScreen = $("loadingScreen");
const difficultyScreen = $("difficultyScreen");
const characterScreen = $("characterScreen");
const gameScreen = $("gameScreen");
const endingScreen = $("endingScreen");

const loginForm = $("loginForm");
const usernameInput = $("username");
const passwordInput = $("password");
const togglePassword = $("togglePassword");
const loginButton = $("loginButton");
const message = $("message");

const loadingPercent = $("loadingPercent");
const progressFill = $("progressFill");
const loadingDescription = $("loadingDescription");
const loadingStatus = $("loadingStatus");

const canvas = $("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

const pumpkinCount = $("pumpkinCount");
const livesCount = $("livesCount");
const currentDifficulty = $("currentDifficulty");
const gameMessage = $("gameMessage");

const restartButton = $("restartButton");
const playAgainButton = $("playAgainButton");
const endingPlayAgainButton = $("endingPlayAgainButton");

const leftButton = $("leftButton");
const rightButton = $("rightButton");
const jumpButton = $("jumpButton");

const difficultyButtons = document.querySelectorAll("[data-difficulty]");
const characterButtons = document.querySelectorAll("[data-character]");

const confirmCharacterButton = $("confirmCharacterButton");
const backToDifficultyButton = $("backToDifficultyButton");
const characterHint = $("characterHint");
const rotateScreen = $("rotateScreen");

const hunterSprite = new Image();

// The sprite is optional. If the asset is not available, the game keeps using
// the built-in fallback drawing so the page remains functional on every device.
hunterSprite.onerror = () => {
  hunterSprite.src = "";
};

const hunterAnimation = {
  frameWidth: 40,
  frameHeight: 55,
  drawWidth: 48,
  drawHeight: 58,
  frameRate: 9,
  animations: {
    idle: { frames: [{ x: 0, y: 0 }] },
    walk: {
      frames: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 80, y: 0 }
      ]
    },
    jump: { frames: [{ x: 0, y: 0 }] },
    shoot: { frames: [{ x: 0, y: 0 }] },
    hurt: { frames: [{ x: 0, y: 0 }] },
    die: { frames: [{ x: 0, y: 0 }] }
  }
};

const logoutButton = document.createElement("button");
logoutButton.type = "button";
logoutButton.id = "nightfallLogoutButton";
logoutButton.textContent = "↪ LOG OUT";

Object.assign(logoutButton.style, {
  position: "fixed",
  top: "8px",
  right: "8px",
  zIndex: "99999",
  display: "none",
  padding: "8px 12px",
  border: "1px solid rgba(255,255,255,.25)",
  borderRadius: "10px",
  background: "#6d244c",
  color: "#fff",
  fontFamily: "Arial,sans-serif",
  fontSize: "12px",
  fontWeight: "800",
  cursor: "pointer"
});

document.body.appendChild(logoutButton);

const difficultySettings = {
  easy: {
    name: "EASY",
    lives: 5,
    playerSpeed: 4.5,
    jumpPower: 12.5,
    ghostSpeed: 0.8
  },
  normal: {
    name: "NORMAL",
    lives: 3,
    playerSpeed: 4.1,
    jumpPower: 11.8,
    ghostSpeed: 1
  },
  hard: {
    name: "HARD",
    lives: 2,
    playerSpeed: 4.2,
    jumpPower: 12.1,
    ghostSpeed: 1.45
  }
};

const characterSettings = {
  hunter: {
    name: "HUNTER",
    emoji: "🏹",
    color: "#e87927",
    outfit: "#352048"
  },
  witch: {
    name: "WITCH",
    emoji: "🧙‍♀️",
    color: "#b86bff",
    outfit: "#44245f"
  },
  vampire: {
    name: "VAMPIRE",
    emoji: "🧛",
    color: "#ff4e78",
    outfit: "#581b35"
  }
};

let difficulty = difficultySettings.normal;
let selectedDifficulty = "normal";
let selectedCharacter = null;

let player = null;
let platforms = [];
let pumpkins = [];
let ghosts = [];
let exitPortal = null;

let cameraX = 0;
let score = 0;
let lives = 3;

let gameRunning = false;
let gameWon = false;
let gameOver = false;

let animationFrame = null;
let endingAnimationFrame = null;
let loadingTimer = null;
let loadingRunId = 0;
let lastTime = 0;

let keys = {};
let touchLeft = false;
let touchRight = false;
let touchJump = false;
let jumpQueued = false;

let resizeFrame = null;

function configureCanvas() {
  if (!canvas || !ctx) return;

  // The game always runs at VIEW_WIDTH x VIEW_HEIGHT. We only raise the
  // internal resolution on high-DPI screens so it stays sharp. CSS handles
  // fitting the canvas into the available space.
  renderScale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

  const w = Math.round(VIEW_WIDTH * renderScale);
  const h = Math.round(VIEW_HEIGHT * renderScale);

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  drawGame();
}

function resizeGame() {
  if (resizeFrame !== null) {
    cancelAnimationFrame(resizeFrame);
  }

  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null;

    if (!canvas || !ctx) return;

    if (player && platforms.length) {
      drawGame();
    }

    updateRotateScreen();
  });
}

function hasSavedLogin() {
  try {
    return localStorage.getItem(LOGIN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveLogin() {
  try {
    localStorage.setItem(LOGIN_STORAGE_KEY, "true");
  } catch (error) {
    console.error("Could not save login status:", error);
  }

  updateLogoutButton();
}

function updateLogoutButton() {
  logoutButton.style.display = hasSavedLogin() ? "block" : "none";
}

function showScreen(screen) {
  if (!screen) return;

  screen.hidden = false;
  screen.classList.add("active");
  screen.setAttribute("aria-hidden", "false");

  if (screen === gameScreen) {
    configureCanvas();
    resizeGame();
  }

  updateRotateScreen();
}

function hideScreen(screen) {
  if (!screen) return;

  screen.classList.remove("active");
  screen.hidden = true;
  screen.setAttribute("aria-hidden", "true");

  updateRotateScreen();
}

function clearInputs() {
  keys = {};
  touchLeft = false;
  touchRight = false;
  touchJump = false;
  jumpQueued = false;
}

function stopLoading() {
  loadingRunId++;

  if (loadingTimer !== null) {
    clearTimeout(loadingTimer);
    loadingTimer = null;
  }
}

function stopGame() {
  gameRunning = false;

  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  clearInputs();
}

function stopEndingAnimation() {
  if (endingAnimationFrame !== null) {
    cancelAnimationFrame(endingAnimationFrame);
    endingAnimationFrame = null;
  }
}

function showMessage(text, type = "error") {
  if (!message) return;

  message.textContent = text;
  message.className = `message ${type}`;
}

function setProgress(value, description, status) {
  if (loadingPercent) loadingPercent.textContent = `${value}%`;
  if (progressFill) progressFill.style.width = `${value}%`;
  if (loadingDescription) loadingDescription.textContent = description;
  if (loadingStatus) loadingStatus.textContent = status;
}

function resetLoginButton() {
  if (!loginButton) return;

  loginButton.disabled = false;
  loginButton.innerHTML = "<span>LOG IN</span><span>☠</span>";
}

if (togglePassword && passwordInput) {
  togglePassword.addEventListener("click", () => {
    const showing = passwordInput.type === "password";

    passwordInput.type = showing ? "text" : "password";
    togglePassword.textContent = showing ? "Hide" : "👁";
    togglePassword.setAttribute(
      "aria-label",
      showing ? "Hide password" : "Show password"
    );
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", event => {
    event.preventDefault();

    if (!usernameInput || !passwordInput || !loginButton) return;
    if (loginButton.disabled) return;

    if (
      usernameInput.value.trim() !== LOGIN_EMAIL ||
      passwordInput.value !== LOGIN_PASSWORD
    ) {
      showMessage("Incorrect username or password. Try again.");
      passwordInput.value = "";
      passwordInput.focus();
      return;
    }

    stopGame();
    stopLoading();
    stopEndingAnimation();

    loginButton.disabled = true;
    loginButton.textContent = "ENTERING...";

    showMessage("Welcome to Nightfall...", "success");
    saveLogin();

    hideScreen(loginScreen);
    hideScreen(difficultyScreen);
    hideScreen(characterScreen);
    hideScreen(gameScreen);
    hideScreen(endingScreen);

    setProgress(0, "Preparing your adventure...", "Starting");
    showScreen(loadingScreen);
    runLoadingSequence();
  });
}

function runLoadingSequence() {
  stopLoading();

  const runId = loadingRunId;

  const steps = [
    [8, "Waking the spirits...", "Summoning the shadows"],
    [24, "Entering the haunted forest...", "Loading the forest"],
    [43, "Preparing your adventure...", "Preparing the pumpkins"],
    [61, "The ghosts are gathering...", "Awakening the ghosts"],
    [79, "Opening the portal...", "Almost ready"],
    [100, "Welcome to Nightfall!", "Adventure ready"]
  ];

  let index = 0;

  function nextStep() {
    if (
      runId !== loadingRunId ||
      !loadingScreen ||
      loadingScreen.hidden
    ) {
      return;
    }

    if (index >= steps.length) {
      loadingTimer = setTimeout(() => {
        if (runId !== loadingRunId) return;

        loadingTimer = null;
        hideScreen(loadingScreen);
        resetLoginButton();
        showDifficultySelection();
      }, 450);

      return;
    }

    const step = steps[index++];
    setProgress(step[0], step[1], step[2]);
    loadingTimer = setTimeout(nextStep, 500);
  }

  loadingTimer = setTimeout(nextStep, 250);
}

function updateDifficultyButtons() {
  difficultyButtons.forEach(button => {
    const selected = button.dataset.difficulty === selectedDifficulty;

    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function showDifficultySelection() {
  stopGame();
  stopEndingAnimation();

  hideScreen(loginScreen);
  hideScreen(loadingScreen);
  hideScreen(characterScreen);
  hideScreen(gameScreen);
  hideScreen(endingScreen);

  if (!difficultyScreen) {
    showCharacterSelection();
    return;
  }

  showScreen(difficultyScreen);
  updateDifficultyButtons();
}

difficultyButtons.forEach(button => {
  button.addEventListener("click", () => {
    const selected = button.dataset.difficulty;

    if (!difficultySettings[selected]) return;

    selectedDifficulty = selected;
    updateDifficultyButtons();
    showCharacterSelection();
  });
});

function updateCharacterButtons() {
  characterButtons.forEach(button => {
    const selected = button.dataset.character === selectedCharacter;

    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  if (confirmCharacterButton) {
    confirmCharacterButton.disabled = !selectedCharacter;
  }
}

function showCharacterSelection() {
  stopGame();

  hideScreen(difficultyScreen);
  hideScreen(gameScreen);
  hideScreen(endingScreen);

  if (!characterScreen) {
    startGame(selectedDifficulty, selectedCharacter || "hunter");
    return;
  }

  showScreen(characterScreen);
  updateCharacterButtons();

  if (characterHint) {
    characterHint.textContent = selectedCharacter
      ? `${characterSettings[selectedCharacter].name} selected. Confirm to begin.`
      : "Choose a character to continue.";
  }
}

characterButtons.forEach(button => {
  button.addEventListener("click", () => {
    const selected = button.dataset.character;

    if (!characterSettings[selected]) return;

    selectedCharacter = selected;
    updateCharacterButtons();

    if (characterHint) {
      characterHint.textContent =
        `${characterSettings[selected].name} selected. Ready to enter the forest?`;
    }
  });
});

if (confirmCharacterButton) {
  confirmCharacterButton.addEventListener("click", () => {
    if (!selectedCharacter || !characterSettings[selectedCharacter]) {
      if (characterHint) {
        characterHint.textContent = "Please select a character first.";
      }

      return;
    }

    startGame(selectedDifficulty, selectedCharacter);
  });
}

if (backToDifficultyButton) {
  backToDifficultyButton.addEventListener("click", () => {
    hideScreen(characterScreen);
    showScreen(difficultyScreen);
    updateDifficultyButtons();
  });
}

function startGame(chosenDifficulty = "normal", chosenCharacter = "hunter") {
  if (!difficultySettings[chosenDifficulty]) {
    chosenDifficulty = "normal";
  }

  if (!characterSettings[chosenCharacter]) {
    chosenCharacter = "hunter";
  }

  stopGame();
  stopEndingAnimation();
  stopLoading();
  clearInputs();

  selectedDifficulty = chosenDifficulty;
  selectedCharacter = chosenCharacter;
  difficulty = difficultySettings[selectedDifficulty];

  gameOver = false;
  gameWon = false;

  hideScreen(loginScreen);
  hideScreen(loadingScreen);
  hideScreen(difficultyScreen);
  hideScreen(characterScreen);
  hideScreen(endingScreen);

  showScreen(gameScreen);
  configureCanvas();

  if (currentDifficulty) {
    currentDifficulty.textContent = difficulty.name;
  }

  updateCharacterHUD();

  if (gameMessage) {
    gameMessage.hidden = true;
    gameMessage.classList.remove("show", "win", "lose");
  }

  resetGame();

  if (!ctx || !canvas) {
    showGameResult(
      false,
      "GAME ERROR",
      "The game canvas could not be found. Check that your HTML contains gameCanvas."
    );
    return;
  }

  gameRunning = true;
  lastTime = 0;
  drawGame();
  animationFrame = requestAnimationFrame(gameLoop);
}

function updateCharacterHUD() {
  if (!gameScreen) return;

  let badge = $("currentCharacter");

  if (!badge) {
    badge = document.createElement("div");
    badge.id = "currentCharacter";
    badge.className = "stat character-stat";

    const stats = gameScreen.querySelector(".game-stats");

    if (stats) {
      stats.insertBefore(badge, restartButton || null);
    }
  }

  const character = characterSettings[selectedCharacter];

  if (!character) return;

  badge.textContent = `${character.emoji} ${character.name}`;
  badge.style.borderColor = character.color;
}

function resetGame() {
  score = 0;
  lives = difficulty.lives;
  cameraX = 0;
  gameOver = false;
  gameWon = false;

  player = {
    x: 65,
    y: 270,
    width: 30,
    height: 42,
    vx: 0,
    vy: 0,
    grounded: false,
    facing: 1,
    invincible: 0,
    animation: "idle",
    animationTime: 0,
    animationFrame: 0,
    hurtTime: 0,
    deathTime: 0
  };

  platforms = [
    { x: 0, y: 360, w: 450, h: 80 },
    { x: 500, y: 325, w: 160, h: 30 },
    { x: 700, y: 285, w: 150, h: 30 },
    { x: 900, y: 335, w: 180, h: 30 },
    { x: 1130, y: 290, w: 170, h: 30 },
    { x: 1350, y: 250, w: 160, h: 30 },
    { x: 1570, y: 320, w: 190, h: 30 },
    { x: 1820, y: 275, w: 180, h: 30 },
    { x: 2050, y: 330, w: 180, h: 30 },
    { x: 2290, y: 285, w: 170, h: 30 },
    { x: 2520, y: 340, w: 400, h: 80 }
  ];

  pumpkins = [
    { x: 210, y: 320, collected: false },
    { x: 550, y: 280, collected: false },
    { x: 750, y: 240, collected: false },
    { x: 970, y: 290, collected: false },
    { x: 1190, y: 245, collected: false },
    { x: 1400, y: 205, collected: false },
    { x: 1640, y: 275, collected: false },
    { x: 1880, y: 230, collected: false },
    { x: 2120, y: 285, collected: false },
    { x: 2350, y: 240, collected: false },
    { x: 2650, y: 295, collected: false }
  ];

  ghosts = [
    { x: 370, y: 320, min: 300, max: 430, dir: 1 },
    { x: 790, y: 245, min: 710, max: 820, dir: -1 },
    { x: 1000, y: 295, min: 930, max: 1050, dir: 1 },
    { x: 1450, y: 210, min: 1370, max: 1480, dir: -1 },
    { x: 1690, y: 280, min: 1600, max: 1720, dir: 1 },
    { x: 2160, y: 290, min: 2080, max: 2200, dir: -1 },
    { x: 2600, y: 290, min: 2550, max: 2780, dir: 1 }
  ];

  exitPortal = {
    x: 2770,
    y: 260,
    width: 48,
    height: 80
  };

  clearInputs();
  updateHUD();
}

function updateHUD() {
  if (pumpkinCount) {
    pumpkinCount.textContent = `${score} / ${TOTAL_PUMPKINS}`;
  }

  if (livesCount) {
    livesCount.textContent = lives;
  }
}

function gameLoop(timestamp) {
  if (!gameRunning || !ctx || !canvas) {
    animationFrame = null;
    return;
  }

  const delta = lastTime
    ? Math.min((timestamp - lastTime) / 16.67, 2)
    : 1;

  lastTime = timestamp;

  updateGame(delta);

  if (gameRunning) {
    drawGame();
    animationFrame = requestAnimationFrame(gameLoop);
  } else {
    animationFrame = null;
  }
}

function updateGame(delta) {
  if (!player || !gameRunning || gameOver) return;

  const left = Boolean(keys.ArrowLeft || keys.KeyA || touchLeft);
  const right = Boolean(keys.ArrowRight || keys.KeyD || touchRight);

  const jumping = Boolean(
    keys.Space ||
    keys.ArrowUp ||
    keys.KeyW ||
    jumpQueued ||
    touchJump
  );

  player.vx = 0;

  if (left && !right) {
    player.vx = -difficulty.playerSpeed;
    player.facing = -1;
  } else if (right && !left) {
    player.vx = difficulty.playerSpeed;
    player.facing = 1;
  }

  if (jumping && player.grounded) {
    player.vy = -difficulty.jumpPower;
    player.grounded = false;
  }

  jumpQueued = false;

  player.x += player.vx * delta;
  player.x = Math.max(0, Math.min(player.x, WORLD_WIDTH - player.width));

  const previousY = player.y;

  player.vy += 0.55 * delta;
  player.y += player.vy * delta;
  player.grounded = false;

  for (const platform of platforms) {
    const wasAbove = previousY + player.height <= platform.y + 5;
    const crossing = player.y + player.height >= platform.y;

    const overlaps =
      player.x + player.width > platform.x &&
      player.x < platform.x + platform.w;

    if (overlaps && wasAbove && crossing && player.vy >= 0) {
      player.y = platform.y - player.height;
      player.vy = 0;
      player.grounded = true;
    }
  }

  if (player.invincible > 0) {
    player.invincible = Math.max(0, player.invincible - delta);
  }

  if (player.hurtTime > 0) {
    player.hurtTime = Math.max(0, player.hurtTime - delta);
  }

  updateHunterAnimation(delta);

  for (const pumpkin of pumpkins) {
    if (pumpkin.collected) continue;

    const dx = player.x + player.width / 2 - pumpkin.x;
    const dy = player.y + player.height / 2 - pumpkin.y;

    if (Math.abs(dx) < 27 && Math.abs(dy) < 34) {
      pumpkin.collected = true;
      score++;
      updateHUD();
    }
  }

  for (const ghost of ghosts) {
    ghost.x += ghost.dir * difficulty.ghostSpeed * delta;

    if (ghost.x < ghost.min || ghost.x > ghost.max) {
      ghost.dir *= -1;
      ghost.x = Math.max(ghost.min, Math.min(ghost.x, ghost.max));
    }

    const touching =
      player.x < ghost.x + 30 &&
      player.x + player.width > ghost.x &&
      player.y < ghost.y + 34 &&
      player.y + player.height > ghost.y;

    if (touching && player.invincible <= 0) {
      lives--;
      player.invincible = 80;
      player.hurtTime = 14;
      player.vy = -5;
      player.vx = 0;

      clearInputs();
      updateHUD();

      if (lives <= 0) {
        player.animation = "die";
        endGame(false);
        return;
      }
    }
  }

  if (player.y > VIEW_HEIGHT + 120) {
    lives--;
    updateHUD();

    if (lives <= 0) {
      player.animation = "die";
      endGame(false);
      return;
    }

    player.x = Math.max(40, cameraX + 40);
    player.y = 220;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    player.invincible = 90;
    player.hurtTime = 14;

    clearInputs();
  }

  if (
    player.x + player.width > exitPortal.x &&
    player.x < exitPortal.x + exitPortal.width &&
    player.y + player.height > exitPortal.y
  ) {
    endGame(true);
    return;
  }

  cameraX = Math.max(
    0,
    Math.min(
      player.x - VIEW_WIDTH * 0.35,
      WORLD_WIDTH - VIEW_WIDTH
    )
  );
}

function updateHunterAnimation(delta) {
  if (!player) return;

  let nextAnimation;

  if (player.hurtTime > 0) {
    nextAnimation = "hurt";
  } else if (!player.grounded) {
    nextAnimation = "jump";
  } else if (Math.abs(player.vx) > 0.1) {
    nextAnimation = "walk";
  } else {
    nextAnimation = "idle";
  }

  if (player.animation !== nextAnimation) {
    player.animation = nextAnimation;
    player.animationTime = 0;
    player.animationFrame = 0;
  } else {
    player.animationTime += delta;

    const animation = hunterAnimation.animations[player.animation];
    const frames = animation ? animation.frames : [];

    if (frames.length > 1) {
      const frameDuration = 60 / hunterAnimation.frameRate;

      if (player.animationTime >= frameDuration) {
        player.animationTime = 0;
        player.animationFrame =
          (player.animationFrame + 1) % frames.length;
      }
    }
  }
}

function drawGame() {
  if (!ctx || !canvas || !player) return;

  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  sky.addColorStop(0, "#100d2b");
  sky.addColorStop(1, "#37204e");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  drawStars();
  drawBackgroundHills();

  ctx.save();
  ctx.translate(-cameraX, 0);

  platforms.forEach(drawPlatform);

  pumpkins.forEach(pumpkin => {
    if (!pumpkin.collected) {
      drawPumpkin(pumpkin.x, pumpkin.y);
    }
  });

  ghosts.forEach(ghost => {
    drawGhost(ghost.x, ghost.y, ghost.dir);
  });

  drawPortal();
  drawPlayer();

  ctx.restore();

  ctx.fillStyle = "rgba(8,5,22,.75)";
  ctx.fillRect(12, 12, 210, 34);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 13px Arial";
  ctx.fillText("FIND THE EXIT PORTAL", 24, 34);
}

function drawStars() {
  for (let i = 0; i < 45; i++) {
    const x = (i * 83 + 21) % VIEW_WIDTH;
    const y = (i * 47 + 13) % 180;

    ctx.fillStyle = i % 3 === 0 ? "#ffd875" : "#fff";
    ctx.globalAlpha = 0.35 + (i % 5) * 0.12;
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.globalAlpha = 1;
}

function drawBackgroundHills() {
  ctx.fillStyle = "#201438";
  ctx.beginPath();
  ctx.moveTo(0, 280);

  for (let x = 0; x <= VIEW_WIDTH + 80; x += 80) {
    ctx.lineTo(x, 230 + Math.sin(x * 0.02) * 30);
  }

  ctx.lineTo(VIEW_WIDTH, VIEW_HEIGHT);
  ctx.lineTo(0, VIEW_HEIGHT);
  ctx.fill();

  ctx.fillStyle = "#171029";
  ctx.beginPath();
  ctx.moveTo(0, 320);

  for (let x = 0; x <= VIEW_WIDTH + 80; x += 80) {
    ctx.lineTo(x, 285 + Math.cos(x * 0.018) * 22);
  }

  ctx.lineTo(VIEW_WIDTH, VIEW_HEIGHT);
  ctx.lineTo(0, VIEW_HEIGHT);
  ctx.fill();
}

function drawPlatform(platform) {
  ctx.fillStyle = "#39234b";
  ctx.fillRect(platform.x, platform.y, platform.w, platform.h);

  ctx.fillStyle = "#a05bdb";
  ctx.fillRect(platform.x, platform.y, platform.w, 6);

  ctx.fillStyle = "rgba(0,0,0,.2)";

  for (
    let x = platform.x + 8;
    x < platform.x + platform.w;
    x += 28
  ) {
    ctx.fillRect(x, platform.y + 15, 14, 3);
  }
}

function drawPumpkin(x, y) {
  ctx.fillStyle = "#ff8b24";
  ctx.beginPath();
  ctx.ellipse(x, y, 13, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#d85c12";
  ctx.fillRect(x - 3, y - 10, 6, 20);

  ctx.fillStyle = "#5cb94b";
  ctx.fillRect(x - 3, y - 17, 6, 7);

  ctx.fillStyle = "#fff1a3";

  ctx.beginPath();
  ctx.moveTo(x - 7, y - 3);
  ctx.lineTo(x - 2, y + 2);
  ctx.lineTo(x - 7, y + 3);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 7, y - 3);
  ctx.lineTo(x + 2, y + 2);
  ctx.lineTo(x + 7, y + 3);
  ctx.fill();
}

function drawGhost(x, y, direction) {
  ctx.fillStyle = "rgba(210,228,255,.92)";
  ctx.beginPath();
  ctx.arc(x + 15, y + 12, 15, Math.PI, 0);
  ctx.lineTo(x + 30, y + 30);
  ctx.lineTo(x + 23, y + 25);
  ctx.lineTo(x + 16, y + 31);
  ctx.lineTo(x + 8, y + 25);
  ctx.lineTo(x, y + 30);
  ctx.lineTo(x, y + 12);
  ctx.fill();

  ctx.fillStyle = "#1a1230";
  ctx.beginPath();
  ctx.arc(x + 10 + direction, y + 12, 3, 0, Math.PI * 2);
  ctx.arc(x + 21 + direction, y + 12, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawHunter() {
  if (
    !player ||
    !hunterSprite.complete ||
    hunterSprite.naturalWidth === 0
  ) {
    return false;
  }

  const animation =
    hunterAnimation.animations[player.animation] ||
    hunterAnimation.animations.idle;

  const frames = animation.frames;
  const frame = frames[
    Math.min(player.animationFrame, frames.length - 1)
  ];

  const drawWidth = hunterAnimation.drawWidth;
  const drawHeight = hunterAnimation.drawHeight;
  const drawX = player.x - (drawWidth - player.width) / 2;
  const drawY = player.y - (drawHeight - player.height);

  ctx.save();

  if (player.facing === -1) {
    ctx.translate(drawX + drawWidth, drawY);
    ctx.scale(-1, 1);

    ctx.drawImage(
      hunterSprite,
      frame.x,
      frame.y,
      hunterAnimation.frameWidth,
      hunterAnimation.frameHeight,
      0,
      0,
      drawWidth,
      drawHeight
    );
  } else {
    ctx.drawImage(
      hunterSprite,
      frame.x,
      frame.y,
      hunterAnimation.frameWidth,
      hunterAnimation.frameHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );
  }

  ctx.restore();
  return true;
}

function drawPlayer() {
  if (!player) return;

  if (
    player.invincible > 0 &&
    Math.floor(player.invincible / 5) % 2 === 0
  ) {
    return;
  }

  if (selectedCharacter === "hunter" && drawHunter()) {
    return;
  }

  const character =
    characterSettings[selectedCharacter] || characterSettings.hunter;

  const x = player.x;
  const y = player.y;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 8;

  ctx.fillStyle = "#f5c79a";
  ctx.fillRect(x + 6, y + 4, 19, 17);

  ctx.fillStyle = "#2b1638";
  ctx.fillRect(x + 3, y, 25, 7);
  ctx.fillRect(x + 1, y + 5, 7, 8);

  ctx.fillStyle = "#fff";
  ctx.fillRect(
    x + (player.facing === 1 ? 17 : 7),
    y + 10,
    5,
    5
  );

  ctx.fillStyle = character.outfit;
  ctx.fillRect(x + 5, y + 21, 21, 13);

  ctx.fillStyle = character.color;
  ctx.fillRect(x + 5, y + 22, 21, 6);

  ctx.fillStyle = "#17111f";
  ctx.fillRect(x + 6, y + 34, 7, 8);
  ctx.fillRect(x + 19, y + 34, 7, 8);

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, 27, 40);

  if (selectedCharacter === "vampire") {
    ctx.fillStyle = "#d7345b";
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 20);
    ctx.lineTo(x + 15, y + 42);
    ctx.lineTo(x + 27, y + 20);
    ctx.fill();
  }

  if (selectedCharacter === "witch") {
    ctx.fillStyle = "#2b1638";
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 5);
    ctx.lineTo(x + 15, y - 14);
    ctx.lineTo(x + 28, y + 5);
    ctx.fill();

    ctx.fillStyle = "#d9a6ff";
    ctx.fillRect(x + 7, y + 2, 16, 3);
  }

  ctx.restore();
}

function drawPortal() {
  if (!exitPortal) return;

  const pulse = Math.sin(performance.now() / 180) * 3;

  ctx.fillStyle = "rgba(174,77,255,.2)";
  ctx.beginPath();
  ctx.ellipse(
    exitPortal.x + 24,
    exitPortal.y + 42,
    32 + pulse,
    47 + pulse,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.strokeStyle = "#dba1ff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(
    exitPortal.x + 24,
    exitPortal.y + 38,
    20 + pulse * 0.3,
    36 + pulse,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText("EXIT", exitPortal.x + 24, exitPortal.y - 10);
  ctx.textAlign = "left";
}

function showGameResult(won, titleText, descriptionText) {
  stopGame();
  clearInputs();

  gameOver = !won;
  gameWon = won;

  if (gameMessage) {
    gameMessage.hidden = false;
    gameMessage.classList.remove("show", "win", "lose");
    gameMessage.classList.add("show", won ? "win" : "lose");
  }

  const title = $("resultTitle");
  const description = $("resultDescription");
  const icon = $("resultIcon");
  const eyebrow = $("resultEyebrow");
  const finalScore = $("finalScore");

  if (title) title.textContent = titleText;
  if (description) description.textContent = descriptionText;
  if (icon) icon.textContent = won ? "🎃" : "👻";
  if (eyebrow) eyebrow.textContent = won ? "QUEST COMPLETE" : "GAME OVER";

  if (finalScore) {
    finalScore.textContent =
      `Pumpkins collected: ${score} / ${TOTAL_PUMPKINS}`;
  }
}

function endGame(won) {
  if (!gameRunning || gameOver) return;

  gameRunning = false;
  gameOver = true;
  gameWon = won;

  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  clearInputs();

  if (won) {
    showEndingScreen();
  } else {
    showGameResult(
      false,
      "GAME OVER",
      "The ghosts caught you! Choose a character and try again."
    );
  }
}

function showEndingScreen() {
  stopGame();

  hideScreen(gameScreen);
  hideScreen(difficultyScreen);
  hideScreen(characterScreen);
  showScreen(endingScreen);

  const endingPhoto = $("endingPhoto");

  if (endingPhoto) {
    endingPhoto.onerror = () => endingPhoto.classList.add("photo-missing");
    endingPhoto.onload = () => endingPhoto.classList.remove("photo-missing");
  }

  const endingScore = $("endingScore");

  if (endingScore) {
    endingScore.textContent =
      `${score} / ${TOTAL_PUMPKINS} pumpkins collected`;
  }

  startEndingAnimation();
}

function startEndingAnimation() {
  const endingCanvas = $("endingCanvas");

  stopEndingAnimation();

  if (!endingCanvas || !endingScreen) return;

  const endingCtx = endingCanvas.getContext("2d");
  if (!endingCtx) return;

  const particles = Array.from({ length: 65 }, () => ({
    x: Math.random() * endingCanvas.width,
    y: Math.random() * endingCanvas.height,
    size: Math.random() * 5 + 2,
    speed: Math.random() * 1.8 + 0.4,
    color: ["#ff8b24", "#b86bff", "#fff1a3", "#ff4e78"][
      Math.floor(Math.random() * 4)
    ]
  }));

  function animate() {
    if (endingScreen.hidden) {
      endingAnimationFrame = null;
      return;
    }

    endingCtx.clearRect(
      0,
      0,
      endingCanvas.width,
      endingCanvas.height
    );

    for (const particle of particles) {
      particle.y += particle.speed;
      particle.x += Math.sin(particle.y / 18) * 0.6;

      if (particle.y > endingCanvas.height) {
        particle.y = -10;
        particle.x = Math.random() * endingCanvas.width;
      }

      endingCtx.fillStyle = particle.color;
      endingCtx.globalAlpha = 0.8;
      endingCtx.beginPath();
      endingCtx.arc(
        particle.x,
        particle.y,
        particle.size,
        0,
        Math.PI * 2
      );
      endingCtx.fill();
    }

    endingCtx.globalAlpha = 1;
    endingAnimationFrame = requestAnimationFrame(animate);
  }

  animate();
}

function replayAtDifficultySelection() {
  stopGame();
  stopEndingAnimation();
  stopLoading();
  clearInputs();

  gameOver = false;
  gameWon = false;

  if (gameMessage) {
    gameMessage.hidden = true;
    gameMessage.classList.remove("show", "win", "lose");
  }

  showDifficultySelection();
}

if (restartButton) {
  restartButton.addEventListener("click", replayAtDifficultySelection);
}

if (playAgainButton) {
  playAgainButton.addEventListener("click", replayAtDifficultySelection);
}

if (endingPlayAgainButton) {
  endingPlayAgainButton.addEventListener(
    "click",
    replayAtDifficultySelection
  );
}

function bindHoldButton(button, setter) {
  if (!button) return;

  button.addEventListener("pointerdown", event => {
    if (!gameRunning || gameOver) return;

    event.preventDefault();
    setter(true);

    if (button.setPointerCapture) {
      try {
        button.setPointerCapture(event.pointerId);
      } catch {}
    }
  });

  const release = () => setter(false);

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
  button.addEventListener("contextmenu", event => event.preventDefault());
}

bindHoldButton(leftButton, value => {
  touchLeft = value;
});

bindHoldButton(rightButton, value => {
  touchRight = value;
});

bindHoldButton(jumpButton, value => {
  touchJump = value;

  if (value) {
    jumpQueued = true;
  }
});

document.addEventListener("keydown", event => {
  if (!gameRunning || gameOver) return;

  if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)
  ) {
    event.preventDefault();
  }

  keys[event.code] = true;

  if (
    ["Space", "ArrowUp", "KeyW"].includes(event.code) &&
    !event.repeat
  ) {
    jumpQueued = true;
  }
});

document.addEventListener("keyup", event => {
  keys[event.code] = false;
});

window.addEventListener("blur", clearInputs);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearInputs();
  }
});

function updateRotateScreen() {
  if (!rotateScreen || !gameScreen) return;

  const mobile = window.matchMedia("(max-width: 768px)").matches;
  const portrait = window.matchMedia("(orientation: portrait)").matches;
  const shouldShow = mobile && portrait && !gameScreen.hidden;

  rotateScreen.hidden = !shouldShow;
  rotateScreen.setAttribute("aria-hidden", String(!shouldShow));
}

function handleViewportChange() {
  resizeGame();
}

window.addEventListener("resize", handleViewportChange);
window.addEventListener("orientationchange", handleViewportChange);

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", handleViewportChange);
}

if (screen.orientation && screen.orientation.addEventListener) {
  screen.orientation.addEventListener("change", handleViewportChange);
}

const rotateObserver = new MutationObserver(updateRotateScreen);

if (gameScreen) {
  rotateObserver.observe(gameScreen, {
    attributes: true,
    attributeFilter: ["hidden", "class"]
  });
}

function resetToLogin() {
  stopGame();
  stopLoading();
  stopEndingAnimation();
  clearInputs();

  gameOver = false;
  gameWon = false;
  score = 0;
  lives = difficultySettings.normal.lives;
  cameraX = 0;
  lastTime = 0;

  selectedDifficulty = "normal";
  selectedCharacter = null;
  difficulty = difficultySettings.normal;

  if (loginForm) loginForm.reset();
  if (passwordInput) passwordInput.type = "password";

  if (togglePassword) {
    togglePassword.textContent = "👁";
    togglePassword.setAttribute("aria-label", "Show password");
  }

  resetLoginButton();

  if (message) {
    message.textContent = "";
    message.className = "message";
  }

  if (gameMessage) {
    gameMessage.hidden = true;
    gameMessage.classList.remove("show", "win", "lose");
  }

  [
    loadingScreen,
    difficultyScreen,
    characterScreen,
    gameScreen,
    endingScreen
  ].forEach(screen => {
    if (!screen) return;

    screen.hidden = true;
    screen.classList.remove("active");
    screen.setAttribute("aria-hidden", "true");
  });

  if (loginScreen) {
    loginScreen.hidden = false;
    loginScreen.classList.add("active");
    loginScreen.setAttribute("aria-hidden", "false");
  }

  updateDifficultyButtons();
  updateCharacterButtons();
  updateRotateScreen();
  updateLogoutButton();
}

logoutButton.addEventListener("click", () => {
  if (!window.confirm("Are you sure you want to log out of Nightfall?")) {
    return;
  }

  try {
    localStorage.removeItem(LOGIN_STORAGE_KEY);
  } catch (error) {
    console.error("Could not clear login status:", error);
  }

  resetToLogin();
});

function restoreSavedLogin() {
  stopGame();
  stopLoading();
  stopEndingAnimation();
  clearInputs();

  if (!hasSavedLogin()) {
    resetToLogin();
    return;
  }

  if (loginScreen) {
    loginScreen.hidden = true;
    loginScreen.classList.remove("active");
    loginScreen.setAttribute("aria-hidden", "true");
  }

  [
    loadingScreen,
    characterScreen,
    gameScreen,
    endingScreen
  ].forEach(screen => {
    if (!screen) return;

    screen.hidden = true;
    screen.classList.remove("active");
    screen.setAttribute("aria-hidden", "true");
  });

  selectedDifficulty = "normal";
  selectedCharacter = null;
  difficulty = difficultySettings.normal;
  score = 0;
  lives = difficultySettings.normal.lives;
  cameraX = 0;
  gameOver = false;
  gameWon = false;

  if (gameMessage) {
    gameMessage.hidden = true;
    gameMessage.classList.remove("show", "win", "lose");
  }

  resetLoginButton();
  hideScreen(loadingScreen);
  showScreen(difficultyScreen);
  updateDifficultyButtons();
  updateCharacterButtons();
  updateRotateScreen();
  updateLogoutButton();
}

function initializeNightfall() {
  configureCanvas();
  restoreSavedLogin();
  updateRotateScreen();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeNightfall, {
    once: true
  });
} else {
  initializeNightfall();
}

window.addEventListener("pageshow", event => {
  if (event.persisted) {
    initializeNightfall();
  }
});