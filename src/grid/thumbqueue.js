// Viewport-prioritized thumbnail scheduler.
//
// Cells enqueue a request when they become visible and `cancel()` it when they
// scroll out of view. Pending requests are served newest-first (LIFO), so when
// the user scrolls fast, work that was queued for now-offscreen cells is dropped
// before it ever hits the backend, and generation follows the viewport.
import { getThumbnail } from "../ipc";
export class ThumbScheduler {
    constructor(concurrency = 6) {
        this.concurrency = concurrency;
        this.jobs = new Map(); // key -> latest job
        this.stack = []; // request order; newest at the end
        this.active = 0;
    }
    request(key, path, max, cb) {
        this.jobs.set(key, { path, max, cb });
        this.stack.push(key);
        this.pump();
    }
    cancel(key) {
        // Lazy removal: drop the job now; its stale stack entry is skipped at pump time.
        this.jobs.delete(key);
    }
    pump() {
        while (this.active < this.concurrency) {
            let key;
            // Pop newest entries, skipping any that were cancelled.
            while ((key = this.stack.pop()) !== undefined && !this.jobs.has(key)) {
                /* skip stale */
            }
            if (key === undefined)
                return;
            const job = this.jobs.get(key);
            this.jobs.delete(key);
            this.active++;
            getThumbnail(job.path, job.max)
                .then(job.cb)
                .catch(() => { })
                .finally(() => {
                this.active--;
                this.pump();
            });
        }
    }
}
