// Two distinct presses in the same direction; holding a key never counts twice.
export class DoubleTap {
  private side=0;
  private at=-Infinity;
  press(side: number, now: number) {
    const triggered=side===this.side && now-this.at<=280 && now>=this.at;
    this.side=triggered?0:side;this.at=triggered?-Infinity:now;return triggered;
  }
  reset() { this.side=0;this.at=-Infinity; }
}
