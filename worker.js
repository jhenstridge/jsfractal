self.onmessage = function (event) {
    const data = event.data;
    const c_i = data.i;
    const max_iter = data.max_iter;
    const escape = data.escape * data.escape;
    data.values = new Int32Array(data.width);
    for (let i = 0; i < data.width; i++) {
        const c_r = data.r_min + (data.r_max - data.r_min) * i / data.width;
        let z_r = 0, z_i = 0;
        let iter;
        for (iter = 0; z_r*z_r + z_i*z_i < escape && iter < max_iter; iter++) {
            // z -> z^2 + c
            const tmp = z_r*z_r - z_i*z_i + c_r;
            z_i = 2 * z_r * z_i + c_i;
            z_r = tmp;
        }
        if (iter == max_iter) {
            iter = -1;
        }
        data.values[i] = iter
    }
    self.postMessage(data, [data.values.buffer]);
}
