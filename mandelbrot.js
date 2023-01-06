"use strict";

function transform_coords(x, y, width, height, r_mid, i_mid, scale) {
    const avg = (width + height) / 2;
    const r_span = width / avg * scale;
    const i_span = -height / avg * scale;
    const r = r_mid + (x / width - 0.5) * r_span;
    const i = i_mid + (y / height - 0.5) * i_span;
    return {r, i};
}

class Mandelbrot {
    constructor(fractal) {
        this.container = fractal;
        this.canvas = fractal.querySelector("canvas");
        this.toolbar = new Toolbar(fractal.querySelector(".toolbar"));

        this.toolbar.setVisible("restore", false);
        this.toolbar.onclick = (id) => this.select_tool(id);
        this.select_tool("zoom-in");
        this.container.addEventListener("fullscreenchange", (event) => {
            this.fullscreen_changed();
        });

        this.ctx = this.canvas.getContext("2d");
        this.canvas.addEventListener("pointerdown", (event) => this.pointerdown(event));
        this.canvas.addEventListener("pointermove", (event) => this.pointermove(event));
        this.canvas.addEventListener("pointerup", (event) => this.pointerup(event));
        this.canvas.addEventListener("pointerout", (event) => this.pointerout(event));
        this.canvas.addEventListener("click", (event) => this.click(event));
        window.addEventListener("resize", (event) => this.queue_resize());

        this.in_drag = false;
        this.drag_pos = {x: 0, y: 0};
        this.last_pos = {x: 0, y: 0};

        this.generation = 0;
        this.block_size = 128;
        this.nextblock = null;

        this.workers = [];
        const n_workers = navigator.hardwareConcurrency || 4;
        for (let i = 0; i < n_workers; i++) {
            const worker = new Worker("worker.js");
            worker.addEventListener("message", (event) => {
                this.received_row(event.target, event.data);
            });
            worker.idle = true;
            worker.pixels = new Uint32Array(this.block_size * this.block_size);
            this.workers.push(worker);
        }
        this.i_mid = 0.0;
        this.r_mid = -0.5;
        this.scale = 3.5;

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
        if (this.nextblock == null) {
            worker.idle = true;
            return;
        }
        const {value: data, done} = this.nextblock.next();
        if (!done) {
            data.pixels = worker.pixels;
            worker.postMessage(data, [data.pixels.buffer]);
        }
        worker.idle = done;
    }

    stop_draw() {
        this.generation++;
        this.nextblock = null;
    }

    redraw() {
        this.generation++;

        this.nextblock = function* (generation, block_size, width, height, r_mid, i_mid, scale) {
            for (let y = 0; y < height; y += block_size) {
                for (let x = 0; x < width; x += block_size) {
                    const {r: r_lo, i: i_lo} = transform_coords(x, y, width, height, r_mid, i_mid, scale);
                    const {r: r_hi, i: i_hi} = transform_coords(x + block_size, y + block_size, width, height, r_mid, i_mid, scale);
                    yield {
                        generation,
                        x,
                        y,
                        width: block_size,
                        height: block_size,
                        r_lo,
                        r_hi,
                        i_lo,
                        i_hi,
                        pixels: null,
                    }
                }
            }
        }(this.generation, this.block_size,
          this.canvas.width, this.canvas.height,
          this.r_mid, this.i_mid, this.scale);

        for (let i = 0; i < this.workers.length; i++) {
            const worker = this.workers[i];
            if (worker.idle)
                this.process_row(worker);
        }
    }

    select_tool(id) {
        switch (id) {
        case "move":
            this.active_tool = id;
            this.toolbar.setActive(id);
            this.canvas.style.cursor = "grab";
            break;
        case "zoom-in":
            this.active_tool = id;
            this.toolbar.setActive(id);
            this.canvas.style.cursor = "zoom-in";
            break;
        case "zoom-out":
            this.active_tool = id;
            this.toolbar.setActive(id);
            this.canvas.style.cursor = "zoom-out";
            break;
        case "reload":
            this.i_mid = 0.0;
            this.r_mid = -0.5;
            this.scale = 3.5;
            // resize_to_parent will adjust viewport to maintain
            // correct aspect ratio.
            this.resize_to_parent();
            break;
        case "fullscreen":
            this.container.requestFullscreen();
            break;
        case "restore":
            document.exitFullscreen();
            break;
        }
    }

    fullscreen_changed() {
        this.toolbar.setVisible("fullscreen", !document.fullscreenElement);
        this.toolbar.setVisible("restore", !!document.fullscreenElement);
    }

    pointerdown(event) {
        if (this.active_tool != "move") return;
        if (event.button != 0) return;

        this.stop_draw();
        const rect = event.currentTarget.getBoundingClientRect();
        this.drag_pos.x = this.last_pos.x = event.clientX - rect.left;
        this.drag_pos.y = this.last_pos.y = event.clientY - rect.top;
        this.in_drag = true;
        this.canvas.style.cursor = "grabbing";
    }

    pointermove(event) {
        if (this.active_tool != "move") return;
        if (!this.in_drag) return;

        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left, y = event.clientY - rect.top;

        const dx = x - this.last_pos.x;
        const dy = y - this.last_pos.y;
        this.ctx.save();
        this.ctx.globalCompositeOperation = "copy";
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(this.canvas, dx, dy);
        this.ctx.restore();

        this.last_pos.x = x;
        this.last_pos.y = y;
    }

    pointerup(event) {
        if (this.active_tool != "move") return;

        if (this.in_drag) {
            this.canvas.style.cursor = "grab";
            const rect = event.currentTarget.getBoundingClientRect();
            const x = event.clientX - rect.left, y = event.clientY - rect.top;
            const scale = this.scale / ((this.canvas.width + this.canvas.height) / 2);

            const delta_r = (x - this.drag_pos.x) * scale;
            const delta_i = -(y - this.drag_pos.y) * scale;

            this.r_mid -= delta_r;
            this.i_mid -= delta_i;
            this.redraw();
        }
        this.in_drag = false;
    }

    pointerout(event) {
        this.pointerup(event);
    }

    click(event) {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left, y = event.clientY - rect.top;

        const {r: click_r, i: click_i} = transform_coords(x, y, this.canvas.width, this.canvas.height, this.r_mid, this.i_mid, this.scale)

        switch (this.active_tool) {
        case "zoom-in":
            this.r_mid = click_r;
            this.i_mid = click_i;
            this.scale /= 4;
            this.redraw();
            break;
        case "zoom-out":
            this.r_mid = click_r;
            this.i_mid = click_i;
            this.scale *= 4;
            this.redraw();
            break;
        }
    }

    queue_resize() {
        if (this.resize_queued) {
            return;
        }
        if (this.canvas.clientWidth == this.canvas.width && this.canvas.clientHeight == this.canvas.height) {
            return;
        }
        this.resize_queued = true;
        requestAnimationFrame(() => this.resize_to_parent());
    }

    resize_to_parent() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight
        this.canvas.width = width;
        this.canvas.height = height;

        this.resize_queued = false;
        this.redraw();
    }
}

class Toolbar {
    constructor(toolbar) {
        this.toolbar = toolbar;
        this.onclick = null;
        this.buttons = {}
        for (const anchor of this.toolbar.getElementsByTagName("a")) {
            this.buttons[anchor.id] = anchor;
            anchor.addEventListener("click", (event) => {
                if (this.onclick != null) {
                    this.onclick(event.currentTarget.id);
                }
                event.preventDefault();
            });
        }
    }

    setActive(id) {
        for (const button in this.buttons) {
            if (button == id) {
                this.buttons[button].classList.add("active");
            } else {
                this.buttons[button].classList.remove("active");
            }
        }
    }

    setVisible(id, visible) {
        const button = this.buttons[id];
        button.style.display = visible ? "block" : "none";
    }
}

window.addEventListener("load", (event) => {
    const mandelbrot = new Mandelbrot(document.getElementById("fractal"));
    // This will resize the canvas and kick off the initial redraw.
    mandelbrot.queue_resize();
});
