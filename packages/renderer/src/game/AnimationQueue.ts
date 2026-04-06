type AnimationTask = () => Promise<void>;

export class AnimationQueue {
  private queue: AnimationTask[] = [];
  private running = false;

  enqueue(task: AnimationTask): void {
    this.queue.push(task);
    if (!this.running) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
      }
    }

    this.running = false;
  }

  get isPlaying(): boolean {
    return this.running;
  }
}
