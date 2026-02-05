export class HUD {
  constructor() {
    this.carsLeftEl = document.getElementById('cars-left');
    this.speedEl = document.getElementById('speed');
    this.timerEl = document.getElementById('timer');
    this.phaseEl = document.getElementById('phase');
    this.dayEl = document.getElementById('day');
    this.startScreenEl = document.getElementById('start-screen');
    this.messageEl = document.getElementById('message');
    this.flashEl = document.getElementById('flash');
    this.versionEl = document.getElementById('version');
  }

  setStatus({ carsLabel, phase, day, speedKmh, dayTimeLeft }) {
    this.carsLeftEl.textContent = carsLabel;
    this.speedEl.textContent = `SPEED: ${Math.round(Math.max(0, speedKmh))}`;
    this.timerEl.textContent = `TIME: ${this.formatTime(dayTimeLeft)}`;
    this.phaseEl.textContent = `PHASE: ${phase}`;
    this.dayEl.textContent = `DAY ${day}`;
  }

  formatTime(seconds) {
    const safe = Math.max(0, Math.floor(seconds));
    const min = String(Math.floor(safe / 60)).padStart(2, '0');
    const sec = String(safe % 60).padStart(2, '0');
    return `${min}:${sec}`;
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

  setVersion(version) {
    if (!this.versionEl) return;
    this.versionEl.textContent = version;
  }
}
