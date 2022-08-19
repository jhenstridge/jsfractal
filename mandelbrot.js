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

        this.workers = [];
        for (let i = 0; i < n_workers; i++) {
            const worker = new Worker("worker.js");
            worker.onmessage = (event) => {
                this.received_row(event.target, event.data);
            }
            worker.idle = true;
            this.workers.push(worker);
        }
        this.i_max = 1.5;
        this.i_min = -1.5;
        this.r_min = -2.5;
        this.r_max = 1.5;

        this.generation = 0;
        this.nextrow = 0;
        this.resize_queued = false
    }

    draw_row(data) {
        const pdata = new Uint8ClampedArray(data.values.buffer);
        const imgData = new ImageData(pdata, data.values.length);
        this.ctx.putImageData(imgData, 0, data.row);
    }

    received_row (worker, data) {
        if (data.generation == this.generation) {
            // Interesting data: display it.
            this.draw_row(data);
        }
        this.process_row(worker);
    }

    process_row(worker) {
        const row = this.nextrow++;
        if (row >= this.canvas.height) {
            worker.idle = true;
        } else {
            worker.idle = false;
            worker.postMessage({
                row: row,
                width: this.canvas.width,
                generation: this.generation,
                r_min: this.r_min,
                r_max: this.r_max,
                i: this.i_max + (this.i_min - this.i_max) * row / this.canvas.height,
           })
        }
    }

    redraw() {
        this.generation++;
        this.nextrow = 0;
        for (let i = 0; i < this.workers.length; i++) {
            const worker = this.workers[i];
            if (worker.idle)
                this.process_row(worker);
        }
    }

    click(x, y) {
        const width = this.r_max - this.r_min;
        const height = this.i_min - this.i_max;
        const click_r = this.r_min + width * x / this.canvas.width;
        const click_i = this.i_max + height * y / this.canvas.height;

        this.r_min = click_r - width/8;
        this.r_max = click_r + width/8;
        this.i_max = click_i - height/8;
        this.i_min = click_i + height/8;
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
        const r_size = (this.i_max - this.i_min) * width / height;
        const r_mid = (this.r_max + this.r_min) / 2;
        this.r_min = r_mid - r_size/2;
        this.r_max = r_mid + r_size/2;
        this.resize_queued = false;

        this.redraw();
    }
}
