var Mandelbrot = function (canvas, n_workers) {
    var self = this; // for use in closures where 'this' is rebound
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.row_data = this.ctx.createImageData(canvas.width, 1);
    this.canvas.addEventListener("click", function(event) {
            self.click(event.clientX - canvas.offsetLeft,
                       event.clientY - canvas.offsetTop);
        }, false);

    this.workers = [];
    for (var i = 0; i < n_workers; i++) {
        var worker = new Worker("worker.js");
        worker.addEventListener("message", function(event) {
                self.received_row(event)
            }, false);
        worker.idle = true;
        this.workers.push(worker);
    }
    this.i_max = 1.5;
    this.i_min = -1.5;
    this.r_min = -2.0;
    this.r_max = 2.0;
    this.generation = 0;
    this.nextrow = 0;
}

Mandelbrot.prototype = {
    draw_row: function(data) {
        var values = data.values;
        var pdata = this.row_data.data;
        for (var i = 0; i < this.row_data.width; i++) {
            var pixel;
            pdata[4*i+3] = 255;
            if (values[i] < 0) {
                pdata[4*i] = pdata[4*i+1] = pdata[4*i+2] = 0;
            } else {
                pdata[4*i] = (-7*values[i]) & 255;
                pdata[4*i+1] = (-5*values[i]) & 255;
                pdata[4*i+2] = (-11*values[i]) & 255;
            }
        }
        this.ctx.putImageData(this.row_data, 0, data.row);
    },

    received_row: function (event) {
        var worker = event.target;
        var data = event.data;
        if (data.generation == this.generation) {
            // Interesting data: display it.
            this.draw_row(data);
        }
        this.process_row(worker);
    },

    process_row: function(worker) {
        var row = this.nextrow++;
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
                i: this.i_max + (this.i_min - this.i_max) * row / this.canvas.height
           })
        }
    },

    start: function() {
        this.generation++;
        this.nextrow = 0;
        for (var i = 0; i < this.workers.length; i++) {
            var worker = this.workers[i];
            if (worker.idle)
                this.process_row(worker);
        }
    },

    click: function(x, y) {
        var width = this.r_max - this.r_min;
        var height = this.i_min - this.i_max;
        click_r = this.r_min + width * x / this.canvas.width;
        click_i = this.i_max + height * y / this.canvas.height;

        this.r_min = click_r - width/4;
        this.r_max = click_r + width/4;
        this.i_max = click_i - height/4;
        this.i_min = click_i + height/4;
        this.start()
    },
}
