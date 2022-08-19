class Mandelbrot {
    constructor(canvas, n_workers) {
        const self = this; // for use in closures where 'this' is rebound
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.row_data = this.ctx.createImageData(canvas.width, 1);
        this.canvas.addEventListener("click", function(event) {
            self.click(event.clientX + document.body.scrollLeft +
                       document.documentElement.scrollLeft - canvas.offsetLeft,
                       event.clientY + document.body.scrollTop +
                       document.documentElement.scrollTop - canvas.offsetTop);
        }, false);
        window.addEventListener("resize", this.queue_resize.bind(this), false);

        this.workers = [];
        for (let i = 0; i < n_workers; i++) {
            const worker = new Worker("worker.js");
            worker.onmessage = function(event) {
                self.received_row(event.target, event.data)
            }
            worker.idle = true;
            this.workers.push(worker);
        }
        this.i_max = 1.5;
        this.i_min = -1.5;
        this.r_min = -2.5;
        this.r_max = 1.5;
        this.max_iter = 1024;
        this.escape = 100;

        this.generation = 0;
        this.nextrow = 0;
        this.resize_queued = false

        this.make_palette();
    }

    make_palette() {
        const palette = new Uint8ClampedArray((this.max_iter + 1) * 4);
        // wrap values to a saw tooth pattern.
        function wrap(x) {
            x = ((x + 256) & 0x1ff) - 256;
            if (x < 0) x = -x;
            return x;
        }
        for (let i = 0; i <= this.max_iter; i++) {
            palette[4*i] = wrap(7*i);
            palette[4*i+1] = wrap(5*i);
            palette[4*i+2] = wrap(11*i);
            palette[4*i+3] = 255;
        }
        palette[4*this.max_iter] = 0;
        palette[4*this.max_iter+1] = 0;
        palette[4*this.max_iter+2] = 0;
        palette[4*this.max_iter+3] = 255;
        this.palette = new Uint32Array(palette.buffer);
    }

    draw_row(data) {
        const values = data.values;
        const pdata = new Uint32Array(this.row_data.data.buffer);
        for (let i = 0; i < this.row_data.width; i++) {
            var pixel;
            if (values[i] < 0) {
                pdata[i] = this.palette[this.max_iter];
            } else {
                pdata[i] = this.palette[values[i]];
            }
        }
        this.ctx.putImageData(this.row_data, 0, data.row);
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
                width: this.row_data.width,
                generation: this.generation,
                r_min: this.r_min,
                r_max: this.r_max,
                i: this.i_max + (this.i_min - this.i_max) * row / this.canvas.height,
                max_iter: this.max_iter,
                escape: this.escape,
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

        // Reallocate the image data object used to draw rows.
        this.row_data = this.ctx.createImageData(width, 1);

        this.redraw();
    }
}
