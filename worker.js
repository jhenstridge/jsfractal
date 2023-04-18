"use strict";

const max_iter = 1024;
const escape = 100;

const palette = new Uint32Array((() => {
    const p = new Uint8ClampedArray((max_iter + 1) * 4);
    function wrap(x) {
        x = ((x + 256) & 0x1ff) - 256;
        if (x < 0) x = -x;
        return x;
    }
    for (let i = 0; i <= max_iter; i++) {
        p[4*i] = wrap(7*i);
        p[4*i+1] = wrap(5*i);
        p[4*i+2] = wrap(11*i);
        p[4*i+3] = 255;
    }
    p[4*max_iter] = 0;
    p[4*max_iter+1] = 0;
    p[4*max_iter+2] = 0;
    p[4*max_iter+3] = 255;
    return p.buffer;
})());

const algorithms = {
    mandelbrot: (z_r, z_i, c_r, c_i) => {
        let iter;
        for (iter = 0; z_r*z_r + z_i*z_i < escape && iter < max_iter; iter++) {
            // z -> z^2 + c
            const tmp = z_r*z_r - z_i*z_i + c_r;
            z_i = 2 * z_r * z_i + c_i;
            z_r = tmp;
        }
        return iter;
    },

    mandel3: (z_r, z_i, c_r, c_i) => {
        let iter;
        for (iter = 0; z_r*z_r + z_i*z_i < escape && iter < max_iter; iter++) {
            // z -> z^3 + c
            const r2 = z_r*z_r, i2 = z_i*z_i;
            z_r = z_r * (r2 - 3*i2) + c_r;
            z_i = z_i * (3*r2 - i2) + c_i;
        }
        return iter;
    },

    mandel4: (z_r, z_i, c_r, c_i) => {
        let iter;
        for (iter = 0; z_r*z_r + z_i*z_i < escape && iter < max_iter; iter++) {
            // z -> z^4 + c
            const r2 = z_r*z_r, i2 = z_i*z_i, ri=z_r*z_i;
            z_r = r2*r2 + i2*i2 - 6*r2*i2 + c_r;
            z_i = 4*ri*(r2 - i2) + c_i;
        }
        return iter;
    },
};

self.addEventListener("message", (event) => {
    const data = event.data;
    const algorithm = algorithms[data.algorithm];
    const julia = data.julia;
    const c_r = data.c_r, c_i = data.c_i;
    for (let y = 0; y < data.height; y++) {
        const z_i = data.i_lo + (data.i_hi - data.i_lo) * y / data.height;
        for (let x = 0; x < data.width; x++) {
            const z_r = data.r_lo + (data.r_hi - data.r_lo) * x / data.width;
            const iter = (julia ? algorithm(z_r, z_i, c_r, c_i)
                                : algorithm(0.0, 0.0, z_r, z_i));
            data.pixels[y*data.width+x] = palette[iter];
        }
    }
    self.postMessage(data, [data.pixels.buffer]);
});
