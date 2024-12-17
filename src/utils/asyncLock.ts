export default class AsyncLock {
  private locked = false;
  private queue: (() => void)[] = [];

  async acquire() {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.locked = true;
  }

  release() {
    this.locked = false;
    const next = this.queue.shift();
    if (next) next();
  }
}
