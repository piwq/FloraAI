export class AnimatedBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.animationFrameId = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.initParticles();
  }

  initParticles() {
    this.particles = [];
    // Количество частиц зависит от размера экрана
    const numParticles = Math.floor((this.canvas.width * this.canvas.height) / 12000);
    for (let i = 0; i < numParticles; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        radius: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.3, // Медленное движение (пыльца)
        vy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.5 + 0.1,
      });
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Мягкий градиент (от темно-синего/зеленого к черному)
    const gradient = this.ctx.createRadialGradient(
      this.canvas.width / 2, this.canvas.height / 2, 0,
      this.canvas.width / 2, this.canvas.height / 2, this.canvas.width
    );
    gradient.addColorStop(0, '#0f172a'); // Центр (surface-2)
    gradient.addColorStop(1, '#020617'); // Края (очень темный)

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Рисуем зеленые частицы
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      // Отскок от краев экрана
      if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      // Цвет accent-ai: #22c55e с прозрачностью
      this.ctx.fillStyle = `rgba(34, 197, 94, ${p.alpha})`;
      this.ctx.fill();
    });

    this.animationFrameId = requestAnimationFrame(() => this.draw());
  }

  start() {
    this.initParticles();
    this.draw();
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}