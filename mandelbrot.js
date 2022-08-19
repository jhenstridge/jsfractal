class Mandelbrot {
    constructor(canvas, n_workers) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.canvas.addEventListener("click", (event) => {
            this.click(event.clientX + document.body.scrollLeft +
                       document.documentElement.scrollLeft - canvas.offsetLeft,
                       event.clientY + document.body.scrollTop +
                       document.documentElement.scrollTop - canvas.offsetTop);
        }, false);
        window.addEventListener("resize", this.queue_resize.bind(this), false);

        this.generation = 0;
        this.block_size = 128;
        this.nextblock = null;

        this.workers = [];
        for (let i = 0; i < n_workers; i++) {
            const worker = new Worker("worker.js");
            worker.onmessage = (event) => {
                this.received_row(event.target, event.data);
            }
            worker.idle = true;
            worker.pixels = new Uint32Array(this.block_size * this.block_size);
            this.workers.push(worker);
        }
        this.i_lo = 1.5;
        this.i_hi = -1.5;
        this.r_lo = -2.5;
        this.r_hi = 1.5;

        this.resize_queued = false
    }

    draw_block(data) {
        const pdata = new Uint8ClampedArray(data.pixels.buffer);
        const imgData = new ImageData(pdata, data.width, data.height);
        this.ctx.putImageData(imgData, data.x, data.y);
    }

    received_row (worker, data) {
        if (data.generation == this.generation) {
            // Interesting data: display it.
            this.draw_block(data);
        }
        worker.pixels = data.pixels;
        this.process_row(worker);
    }

    process_row(worker) {
        const {value: data, done} = this.nextblock.next();
        if (!done) {
            data.pixels = worker.pixels;
            worker.postMessage(data, [data.pixels.buffer]);
        }
        worker.idle = done;
    }

    redraw() {
        this.generation++;

        this.nextblock = function* (generation, block_size, width, height, r_lo, r_hi, i_lo, i_hi) {
            for (let y = 0; y < height; y += block_size) {
                for (let x = 0; x < width; x += block_size) {
                    yield {
                        generation,
                        x,
                        y,
                        width: block_size,
                        height: block_size,
                        r_lo: r_lo + (r_hi - r_lo) * x / width,
                        r_hi: r_lo + (r_hi - r_lo) * (x + block_size) / width,
                        i_lo: i_lo + (i_hi - i_lo) * y / height,
                        i_hi: i_lo + (i_hi - i_lo) * (y + block_size) / height,
                        pixels: null,
                    }
                }
            }
        }(this.generation, this.block_size,
          this.canvas.width, this.canvas.height,
          this.r_lo, this.r_hi, this.i_lo, this.i_hi);

        for (let i = 0; i < this.workers.length; i++) {
            const worker = this.workers[i];
            if (worker.idle)
                this.process_row(worker);
        }
    }

    click(x, y) {
        const width = this.r_hi - this.r_lo;
        const height = this.i_hi - this.i_lo;
        const click_r = this.r_lo + width * x / this.canvas.width;
        const click_i = this.i_lo + height * y / this.canvas.height;

        this.r_lo = click_r - width/8;
        this.r_hi = click_r + width/8;
        this.i_lo = click_i - height/8;
        this.i_hi = click_i + height/8;
        this.redraw()
    }

    queue_resize() {
        if (this.resize_queued) {
            return;
        }
        if (this.canvas.clientWidth == this.canvas.width && this.canvas.clientHeight == this.canvas.height) {
            return;
        }
        this.resize_queued = true;
        requestAnimationFrame(this.resize_to_parent.bind(this));
    }

    resize_to_parent() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight
        this.canvas.width = width;
        this.canvas.height = height;

        // Adjust the horizontal scale to maintain aspect ratio
        const r_size = (this.i_lo - this.i_hi) * width / height;
        const r_mid = (this.r_hi + this.r_lo) / 2;
        this.r_lo = r_mid - r_size/2;
        this.r_hi = r_mid + r_size/2;
        this.resize_queued = false;

        this.redraw();
    }
}
