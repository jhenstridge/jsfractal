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


self.addEventListener("message", (event) => {
    const data = event.data;
    for (let y = 0; y < data.height; y++) {
        const c_i = data.i_lo + (data.i_hi - data.i_lo) * y / data.height;
        for (let x = 0; x < data.width; x++) {
            const c_r = data.r_lo + (data.r_hi - data.r_lo) * x / data.width;

            let z_r = 0, z_i = 0;
            let iter;
            for (iter = 0; z_r*z_r + z_i*z_i < escape && iter < max_iter; iter++) {
                // z -> z^2 + c
                const tmp = z_r*z_r - z_i*z_i + c_r;
                z_i = 2 * z_r * z_i + c_i;
                z_r = tmp;
            }
            data.pixels[y*data.width+x] = palette[iter];
        }
    }
    self.postMessage(data, [data.pixels.buffer]);
});
