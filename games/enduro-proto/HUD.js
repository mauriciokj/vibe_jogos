export class HUD {
  constructor() {
    this.carsLeftEl = document.getElementById('cars-left');
    this.phaseEl = document.getElementById('phase');
    this.dayEl = document.getElementById('day');
    this.startScreenEl = document.getElementById('start-screen');
    this.messageEl = document.getElementById('message');
    this.flashEl = document.getElementById('flash');
  }

  setStatus({ carsLeft, phase, day }) {
    this.carsLeftEl.textContent = `CARS LEFT: ${Math.max(0, carsLeft)}`;
    this.phaseEl.textContent = `PHASE: ${phase}`;
    this.dayEl.textContent = `DAY ${day}`;
  }

  showStart(onStart) {
    const trigger = () => {
      this.startScreenEl.classList.add('hidden');
      document.removeEventListener('keydown', onKey);
      this.startScreenEl.removeEventListener('click', trigger);
      onStart();
    };

    const onKey = (event) => {
      if (event.code === 'Enter' || event.code === 'Space') trigger();
    };

    this.startScreenEl.classList.remove('hidden');
    document.addEventListener('keydown', onKey);
    this.startScreenEl.addEventListener('click', trigger);
  }

  message(text, durationMs = 1200) {
    this.messageEl.textContent = text;
    this.messageEl.classList.remove('hidden');

    if (durationMs > 0) {
      window.setTimeout(() => this.hideMessage(), durationMs);
    }
  }

  hideMessage() {
    this.messageEl.classList.add('hidden');
  }

  flash(duration = 120) {
    this.flashEl.classList.add('active');
    window.setTimeout(() => this.flashEl.classList.remove('active'), duration);
  }

  overtakePulse() {
    this.carsLeftEl.classList.add('pulse');
    window.setTimeout(() => this.carsLeftEl.classList.remove('pulse'), 150);
  }
}
