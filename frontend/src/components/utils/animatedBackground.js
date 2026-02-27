class Particle {
  constructor(x, y, radius, color, velocity, canvasWidth, canvasHeight) {
    this.x = x;
    this.y = y;
    this.originX = x;
    this.originY = y;
    this.radius = radius;
    this.color = color;
    this.velocity = velocity;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  draw(context) {
    context.beginPath();
    context.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
    context.fillStyle = this.color;
    context.fill();
  }

  update(mouse) {
    const dxMouse = this.x - mouse.x;
    const dyMouse = this.y - mouse.y;
    const distanceMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
    const maxDistance = mouse.radius;


    if (distanceMouse < maxDistance) {
      const forceDirectionX = dxMouse / distanceMouse;
      const forceDirectionY = dyMouse / distanceMouse;

      const force = (maxDistance - distanceMouse) / maxDistance;
      const pushSpeed = 3;
      
      this.x += forceDirectionX * force * pushSpeed;
      this.y += forceDirectionY * force * pushSpeed;
    } else {
      if (this.x !== this.originX) {
        const dxOrigin = this.x - this.originX;
        this.x -= dxOrigin / 20; 
      }
      if (this.y !== this.originY) {
        const dyOrigin = this.y - this.originY;
        this.y -= dyOrigin / 20;
      }
    }

    this.x += this.velocity.x;
    this.y += this.velocity.y;

    if (this.x - this.radius < 0 || this.x + this.radius > this.canvasWidth) {
      this.velocity.x *= -1; 
    }
    if (this.y - this.radius < 0 || this.y + this.radius > this.canvasHeight) {
      this.velocity.y *= -1; 
    }
  }
}

export class AnimatedBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.particles = [];
    this.mouse = {
      x: undefined,
      y: undefined,
      radius: 150, 
    };
    this.animationFrameId = null;

    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas.bind(this));
    window.addEventListener('mousemove', this.updateMousePosition.bind(this));
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.createParticles();
  }

  createParticles() {
    this.particles = [];
    const numberOfParticles = (this.canvas.width * this.canvas.height) / 9000;
    
    for (let i = 0; i < numberOfParticles; i++) {
      const size = Math.random() * 2 + 0.5; 
      const x = Math.random() * this.canvas.width;
      const y = Math.random() * this.canvas.height;
      const velocity = {
        x: (Math.random() - 0.5) * 0.2,
        y: (Math.random() - 0.5) * 0.2,
      };
      const color = `rgba(163, 161, 185, ${Math.random() * 0.5 + 0.2})`;
      
      this.particles.push(new Particle(x, y, size, color, velocity, this.canvas.width, this.canvas.height));
    }
  }

  updateMousePosition(event) {
    this.mouse.x = event.x;
    this.mouse.y = event.y;
  }

  animate() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach(p => {
      p.update(this.mouse);
      p.draw(this.context);
    });

    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
  }

  start() {
    if (!this.animationFrameId) {
      this.animate();
    }
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener('resize', this.resizeCanvas);
    window.removeEventListener('mousemove', this.updateMousePosition);
  }
}