'use strict';

/**
 * Debounce function delays invoking the function until after wait milliseconds have
a	 passed since the last time the debounced function was invoked.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The number of milliseconds to delay.
 * @param {Object} [options] - Options object with a leading and trailing boolean.
 * @returns {Function} - A new debounced function.
 */
function debounce(func, wait, options = {}) {
    let timeout;
    let result;
    let previous;
    const ctx = this;

    const later = (args) => {
        const now = Date.now();
        timeout = null;

        if (options.leading && !previous) {
            result = func.apply(ctx, args);
        }
        previous = !options.leading;
    };

    return function(...args) {
        const callNow = options.leading && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later.bind(this, args), wait);
        if (callNow) {
            result = func.apply(ctx, args);
        }
        return result;
    };
}

/**
 * Throttle function creates a throttled function that can only be called at most once in the 
 * specified time frame.
 * @param {Function} func - The function to throttle.
 * @param {number} limit - The number of milliseconds to throttle.
 * @returns {Function} - A new throttled function.
 */
function throttle(func, limit) {
    let lastFunc;
    let lastRan;

    return function(...args) {
        if (!lastRan) {
            func.apply(this, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(this, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

module.exports = { debounce, throttle };
