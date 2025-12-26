(() => {
  // =========================
  // Canvas / Resize
  // =========================
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  const DPR = () => Math.max(1, Math.min(2.25, window.devicePixelRatio || 1));
  let dpr = DPR();

  function resize() {
    dpr = DPR();
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
  }
  addEventListener("resize", resize);
  resize();

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  // =========================
  // Musica (toggle com botao)
  // =========================
  const musicBtn = document.getElementById("musicBtn");

  const bgMusic = new Audio("musica.ogg"); // arquivo na mesma pasta
  bgMusic.loop = true;
  bgMusic.volume = 0.55;
  bgMusic.preload = "auto";

  let musicOn = true; // comeca ligado
  function updateMusicUI() {
    if (!musicBtn) return;

    musicBtn.classList.toggle("on", musicOn);
    musicBtn.setAttribute("aria-label", `Musica: ${musicOn ? "ligada" : "desligada"}`);
    musicBtn.title = musicOn
      ? "Musica: ligada (clique para desligar)"
      : "Musica: desligada (clique para ligar)";
  }

  async function setMusic(on) {
    musicOn = on;
    updateMusicUI();
    if (musicOn) {
      try {
        await bgMusic.play(); // navegadores exigem interacao do usuario
      } catch (err) {
        console.log("Autoplay bloqueado. Clique no icone de musica para tocar.");
      }
    } else {
      bgMusic.pause();
    }
  }

  musicBtn?.addEventListener("click", () => setMusic(!musicOn));

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) bgMusic.pause();
    else if (musicOn) bgMusic.play().catch(() => {});
  });

  updateMusicUI();

  // =========================
  // Input (mouse)
  // =========================
  let state = "menu"; // menu | playing | win | lose
  let last = performance.now();

  const mouse = { x: 0, y: 0, down: false };
  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width) / dpr;
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height) / dpr;
  });
  canvas.addEventListener("mousedown", () => (mouse.down = true));
  addEventListener("mouseup", () => (mouse.down = false));

  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "enter" || k === " ") {
      if (state === "menu") startGame();
      else if (state === "win" || state === "lose") startGame();
    }
    if (k === "r") startGame();
  });

  canvas.addEventListener("click", () => {
    if (state === "menu") startGame();
    else if (state === "win" || state === "lose") startGame();
  });

  // =========================
  // Entities / Progress
  // =========================
  const santa = {
    x: 400, y: 300,
    vx: 0, vy: 0,
    r: 20,
    hp: 5,
    inv: 0,
    speed: 520,
    maxSpeed: 260,
    weapon: 1,   // 1 ou 3
    shootCd: 0
  };

  const enemies = [];
  const bullets = [];
  const orbs = [];
  const snow = [];
  const fireworks = { bursts: [], sparks: [] };

  let orbCount = 0;
  const ORB_TRIPLE = 3;
  const ORB_PORTAL = 15;

  const portal = { active: false, x: 0, y: 0, r: 44 };

  let enemySpawnTimer = 0;
  let loseMsg = "";

  // =========================
  // Helpers
  // =========================
  function resetSnow() {
    snow.length = 0;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    for (let i = 0; i < 170; i++) {
      snow.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vy: rand(30, 140),
        r: rand(1, 2.6),
        a: rand(0.25, 0.95)
      });
    }
  }

  function resetWorld() {
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    santa.x = W * 0.45;
    santa.y = H * 0.55;
    santa.vx = santa.vy = 0;
    santa.hp = 5;
    santa.inv = 0;
    santa.weapon = 1;
    santa.shootCd = 0;

    enemies.length = 0;
    bullets.length = 0;
    orbs.length = 0;

    orbCount = 0;
    portal.active = false;
    portal.x = W * 0.85;
    portal.y = H * 0.5;

    fireworks.bursts.length = 0;
    fireworks.sparks.length = 0;

    enemySpawnTimer = 0.8;
    resetSnow();

    // orbs iniciais
    for (let i = 0; i < 7; i++) spawnOrb();
  }

  function startGame() {
    resetWorld();
    state = "playing";
    // se musica ja estiver ligada, tenta tocar (ainda pode depender de interacao)
    if (musicOn) bgMusic.play().catch(() => {});
  }

  function lose(msg) {
    state = "lose";
    loseMsg = msg || "Voce perdeu!";
  }

  function win() {
    state = "win";
    for (let i = 0; i < 3; i++) spawnFireworkBurst();
  }

  function spawnEnemy() {
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    if (side === 0) { x = -30; y = rand(0, H); }
    if (side === 1) { x = W + 30; y = rand(0, H); }
    if (side === 2) { x = rand(0, W); y = -30; }
    if (side === 3) { x = rand(0, W); y = H + 30; }

    enemies.push({
      x, y,
      r: rand(12, 18),
      speed: rand(70, 125),
      hp: 2,
      wobble: rand(0, Math.PI * 2)
    });
  }

  function spawnOrb(x = rand(40, canvas.width / dpr - 40), y = rand(100, canvas.height / dpr - 40)) {
    orbs.push({ x, y, r: 10, t: rand(0, Math.PI * 2), taken: false });
  }

  // =========================
  // Shooting
  // =========================
  function shoot() {
    if (santa.shootCd > 0) return;

    const dx = mouse.x - santa.x;
    const dy = mouse.y - santa.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;

    const baseSpeed = 560;

    const makeBullet = (angOffset) => {
      const ang = Math.atan2(uy, ux) + angOffset;
      bullets.push({
        x: santa.x,
        y: santa.y,
        vx: Math.cos(ang) * baseSpeed,
        vy: Math.sin(ang) * baseSpeed,
        r: 4.6,
        life: 0.9
      });
    };

    if (santa.weapon === 1) {
      makeBullet(0);
      santa.shootCd = 0.14;
    } else {
      makeBullet(0);
      makeBullet(0.18);
      makeBullet(-0.18);
      santa.shootCd = 0.22;
    }
  }

  // =========================
  // Fireworks
  // =========================
  function spawnFireworkBurst() {
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    const x = rand(W * 0.18, W * 0.82);
    const y = rand(H * 0.12, H * 0.45);

    fireworks.bursts.push({ x, y, life: 0.25 });

    const n = 95;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(90, 340);
      fireworks.sparks.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.9, 1.8),
        max: 1,
        size: rand(1.5, 3.6),
        tone: Math.random() < 0.5 ? "cyan" : "violet"
      });
    }
  }

  // =========================
  // Update
  // =========================
  function update(dt) {
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    // neve
    for (const s of snow) {
      s.y += s.vy * dt;
      if (s.y > H + 6) { s.y = -6; s.x = Math.random() * W; }
    }

    // fogos
    for (let i = fireworks.bursts.length - 1; i >= 0; i--) {
      fireworks.bursts[i].life -= dt;
      if (fireworks.bursts[i].life <= 0) fireworks.bursts.splice(i, 1);
    }
    for (let i = fireworks.sparks.length - 1; i >= 0; i--) {
      const sp = fireworks.sparks[i];
      sp.life -= dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vy += 90 * dt;
      sp.vx *= Math.pow(0.986, dt * 60);
      sp.vy *= Math.pow(0.986, dt * 60);
      if (sp.life <= 0) fireworks.sparks.splice(i, 1);
    }

    if (state === "win") {
      if (Math.random() < 0.12) spawnFireworkBurst();
      return;
    }
    if (state !== "playing") return;

    if (santa.inv > 0) santa.inv -= dt;
    if (santa.shootCd > 0) santa.shootCd -= dt;

    // seguir mouse (movimento suave)
    const dx = mouse.x - santa.x;
    const dy = mouse.y - santa.y;
    const d = Math.hypot(dx, dy);

    if (d > 6) {
      const ux = dx / d;
      const uy = dy / d;
      santa.vx += ux * santa.speed * dt;
      santa.vy += uy * santa.speed * dt;
    }

    const spd = Math.hypot(santa.vx, santa.vy);
    if (spd > santa.maxSpeed) {
      santa.vx = (santa.vx / spd) * santa.maxSpeed;
      santa.vy = (santa.vy / spd) * santa.maxSpeed;
    }

    santa.vx *= Math.pow(0.90, dt * 60);
    santa.vy *= Math.pow(0.90, dt * 60);

    santa.x += santa.vx * dt;
    santa.y += santa.vy * dt;

    santa.x = clamp(santa.x, santa.r + 10, W - santa.r - 10);
    santa.y = clamp(santa.y, santa.r + 10, H - santa.r - 10);

    // atirar segurando clique
    if (mouse.down) shoot();

    // spawn inimigos (mais dificil conforme orbs)
    enemySpawnTimer -= dt;
    const spawnRate = clamp(1.15 - orbCount * 0.03, 0.30, 1.15);
    if (enemySpawnTimer <= 0) {
      spawnEnemy();
      if (orbCount >= 8 && Math.random() < 0.35) spawnEnemy();
      enemySpawnTimer = spawnRate;
    }

    // orbs flutuando
    for (const o of orbs) o.t += dt * 2;

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -20 || b.y < -20 || b.x > W + 20 || b.y > H + 20) {
        bullets.splice(i, 1);
      }
    }

    // enemies + colisao com bullets
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];

      e.wobble += dt * 3.2;
      const wob = Math.sin(e.wobble) * 0.18;

      const ex = santa.x - e.x;
      const ey = santa.y - e.y;
      const ed = Math.hypot(ex, ey) || 1;
      const ux = ex / ed;
      const uy = ey / ed;

      e.x += (ux * e.speed + (-uy * wob * 30)) * dt;
      e.y += (uy * e.speed + ( ux * wob * 30)) * dt;

      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (dist(b.x, b.y, e.x, e.y) < e.r + b.r) {
          e.hp -= 1;
          bullets.splice(j, 1);

          if (e.hp <= 0) {
            if (Math.random() < 0.65) spawnOrb(e.x, e.y);
            enemies.splice(i, 1);
          }
          break;
        }
      }

      // inimigo encosta no santa
      if (dist(e.x, e.y, santa.x, santa.y) < e.r + santa.r) {
        if (santa.inv <= 0) {
          santa.hp -= 1;
          santa.inv = 1.0;

          santa.vx += (-ux) * 220;
          santa.vy += (-uy) * 220;

          if (santa.hp <= 0) {
            lose("Os virus dominaram. O Santa nao conseguiu entregar o presente.");
            return;
          }
        }
      }
    }

    // coletar orbs
    for (const o of orbs) {
      if (o.taken) continue;
      if (dist(o.x, o.y, santa.x, santa.y) < santa.r + o.r + 6) {
        o.taken = true;
        orbCount++;

        if (orbCount === ORB_TRIPLE) santa.weapon = 3;
        if (orbCount >= ORB_PORTAL) portal.active = true;
      }
    }
    for (let i = orbs.length - 1; i >= 0; i--) if (orbs[i].taken) orbs.splice(i, 1);

    // mantem orbs no mapa
    if (orbs.length < 7 && Math.random() < 0.35) spawnOrb();

    // vitoria
    if (portal.active && dist(santa.x, santa.y, portal.x, portal.y) < portal.r + santa.r) {
      win();
    }
  }

  // =========================
  // Draw
  // =========================
  function drawBackground() {
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#101b3f");
    g.addColorStop(1, "#070a14");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const rg = ctx.createRadialGradient(W * 0.5, H * 0.25, 40, W * 0.5, H * 0.25, Math.max(W, H) * 0.6);
    rg.addColorStop(0, "rgba(120,170,255,0.14)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);

    for (const s of snow) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawOrbs() {
    for (const o of orbs) {
      const pulse = 1 + Math.sin(o.t) * 0.12;

      ctx.save();
      ctx.shadowColor = "rgba(0,255,220,0.95)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "rgba(0,255,220,0.95)";
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(o.x - 4, o.y - 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBullets() {
    ctx.fillStyle = "#fff";
    for (const b of bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEnemies() {
    for (const e of enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);

      ctx.shadowColor = "rgba(255,60,80,0.85)";
      ctx.shadowBlur = 16;

      ctx.fillStyle = "rgba(255,60,80,0.95)";
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,60,80,0.85)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + e.wobble * 0.3;
        const x1 = Math.cos(a) * (e.r - 2);
        const y1 = Math.sin(a) * (e.r - 2);
        const x2 = Math.cos(a) * (e.r + 10);
        const y2 = Math.sin(a) * (e.r + 10);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(-5, -4, 2.3, 0, Math.PI * 2);
      ctx.arc( 5, -4, 2.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // roundRect polyfill
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

  function drawSanta() {
    if (santa.inv > 0 && Math.floor(santa.inv * 20) % 2 === 0) return;

    ctx.save();
    ctx.translate(santa.x, santa.y);

    // sombra
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, santa.r + 16, 26, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // saco
    ctx.save();
    ctx.rotate(-0.35);
    ctx.fillStyle = "#caa56a";
    ctx.beginPath();
    ctx.ellipse(-18, 6, 16, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(-22, 10, 10, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // corpo
    ctx.fillStyle = "#d63b3b";
    ctx.beginPath();
    ctx.roundRect(-18, -10, 36, 34, 10);
    ctx.fill();

    // faixa branca
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(-16, 2, 32, 8, 6);
    ctx.fill();

    // cinto
    ctx.fillStyle = "#1b1b1b";
    ctx.beginPath();
    ctx.roundRect(-17, 14, 34, 8, 6);
    ctx.fill();

    // fivela
    ctx.strokeStyle = "#ffd24d";
    ctx.lineWidth = 3;
    ctx.strokeRect(-5, 14, 10, 8);

    // botas
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.roundRect(-18, 22, 16, 10, 5);
    ctx.roundRect(2, 22, 16, 10, 5);
    ctx.fill();

    // cabeca
    ctx.fillStyle = "#ffdfc8";
    ctx.beginPath();
    ctx.arc(0, -20, 12, 0, Math.PI * 2);
    ctx.fill();

    // barba
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(0, -16, 12, 0, Math.PI);
    ctx.closePath();
    ctx.fill();

    // olhos
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(-4, -22, 1.8, 0, Math.PI * 2);
    ctx.arc( 4, -22, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // nariz
    ctx.fillStyle = "#ffb5a5";
    ctx.beginPath();
    ctx.arc(0, -19, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // chapeu
    ctx.fillStyle = "#d63b3b";
    ctx.beginPath();
    ctx.moveTo(-12, -26);
    ctx.lineTo(10, -34);
    ctx.lineTo(8, -12);
    ctx.closePath();
    ctx.fill();

    // faixa chapeu
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(-13, -30, 26, 6, 5);
    ctx.fill();

    // pompom
    ctx.save();
    ctx.translate(12, -34);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // aura quando arma tripla
    if (santa.weapon === 3) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.shadowColor = "rgba(0,255,220,0.85)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "rgba(0,255,220,0.32)";
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawPortal() {
    if (!portal.active) return;

    const t = performance.now() * 0.003;
    const pulse = 1 + Math.sin(t) * 0.10;

    ctx.save();
    ctx.translate(portal.x, portal.y);

    ctx.globalAlpha = 0.9;
    ctx.shadowColor = "rgba(0,255,210,0.95)";
    ctx.shadowBlur = 30;

    ctx.fillStyle = "rgba(0,255,210,0.18)";
    ctx.beginPath();
    ctx.arc(0, 0, portal.r * 1.4 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,255,210,0.85)";
    ctx.beginPath();
    ctx.arc(0, 0, portal.r * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(120,170,255,0.22)";
    ctx.beginPath();
    ctx.arc(0, 0, portal.r * 0.7 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.font = "900 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("PORTAL", 0, portal.r + 22);
    ctx.textAlign = "left";

    ctx.restore();
  }

  function drawHUD() {
    const W = canvas.width / dpr;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(12, 12, Math.min(740, W - 24), 74);

    ctx.fillStyle = "#fff";
    ctx.font = "800 16px system-ui";
    ctx.fillText(`Vida: ${santa.hp}`, 22, 38);
    ctx.fillText(`Bolinhas: ${orbCount}/${ORB_PORTAL}`, 150, 38);

    const weaponTxt = santa.weapon === 1 ? "TIRO NORMAL" : "TIRO TRIPLO";
    ctx.fillText(`Arma: ${weaponTxt}`, 360, 38);

    ctx.font = "700 14px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText("Mouse move o Santa | Segure clique para atirar | Enter/R reinicia", 22, 62);

    let obj = "";
    if (!portal.active) {
      obj = orbCount < ORB_TRIPLE
        ? `Objetivo: pegue ${ORB_TRIPLE} bolinhas para liberar TIRO TRIPLO.`
        : `Objetivo: pegue ${ORB_PORTAL} bolinhas para abrir o PORTAL.`;
    } else {
      obj = "PORTAL ABERTO! Entre no portal para entregar o presente para Manuele!";
    }

    ctx.fillStyle = "rgba(0,0,0,0.40)";
    ctx.fillRect(12, 92, Math.min(900, W - 24), 34);
    ctx.fillStyle = "#fff";
    ctx.font = "800 14px system-ui";
    ctx.fillText(obj, 22, 114);
  }

  function drawMenu() {
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.save();
    ctx.shadowColor = "rgba(80,160,255,0.95)";
    ctx.shadowBlur = 26;
    ctx.fillStyle = "#fff";
    ctx.font = "900 46px system-ui";
    ctx.fillText("SANTA vs VIRUS", W/2, H*0.38);
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "800 18px system-ui";
    ctx.fillText("Colete bolinhas, derrote os virus e abra o portal da Manuele!", W/2, H*0.38 + 42);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "700 16px system-ui";
    ctx.fillText("Clique / ENTER para comecar", W/2, H*0.38 + 88);

    ctx.textAlign = "left";
  }

  function drawLose() {
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    ctx.fillStyle = "rgba(0,0,0,0.60)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.save();
    ctx.shadowColor = "rgba(255,80,80,0.95)";
    ctx.shadowBlur = 26;
    ctx.fillStyle = "#fff";
    ctx.font = "900 52px system-ui";
    ctx.fillText("GAME OVER", W/2, H*0.42);
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "800 16px system-ui";
    ctx.fillText(loseMsg || "Voce perdeu!", W/2, H*0.42 + 42);
    ctx.fillText("Clique / ENTER para tentar de novo", W/2, H*0.42 + 98);

    ctx.textAlign = "left";
  }

  function drawFireworks() {
    for (const b of fireworks.bursts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, b.life / 0.25);
      const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 85);
      rg.addColorStop(0, "rgba(255,255,255,0.9)");
      rg.addColorStop(0.4, "rgba(0,200,255,0.35)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 85, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const sp of fireworks.sparks) {
      const a = clamp(sp.life / sp.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = sp.tone === "cyan" ? "rgba(0,255,210,0.95)" : "rgba(170,120,255,0.95)";
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWin() {
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    drawFireworks();

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.save();
    ctx.shadowColor = "rgba(80,160,255,0.95)";
    ctx.shadowBlur = 32;
    ctx.fillStyle = "#fff";
    ctx.font = "900 40px system-ui";
    ctx.fillText("FELIZ NATAL", W/2, H*0.40);
    ctx.fillText("E UM PROSPERO ANO NOVO", W/2, H*0.40 + 46);
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "800 16px system-ui";
    ctx.fillText("Presente entregue para a Manuele!", W/2, H*0.40 + 96);
    ctx.fillText("Clique / ENTER para jogar de novo", W/2, H*0.40 + 150);

    ctx.textAlign = "left";
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    if (mouse.x === 0 && mouse.y === 0) { mouse.x = W / 2; mouse.y = H / 2; }

    drawBackground();
    drawPortal();
    drawOrbs();
    drawBullets();
    drawEnemies();
    drawSanta();
    drawHUD();

    if (state === "menu") drawMenu();
    if (state === "lose") drawLose();
    if (state === "win") drawWin();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (state === "win" && Math.random() < 0.12) spawnFireworkBurst();

    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // =========================
  // Init
  // =========================
  resetWorld();
  requestAnimationFrame(loop);

})();



