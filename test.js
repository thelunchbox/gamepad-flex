const gf = require('./index');
const gfWrapper = require('./test-helper');

const errors = [];
let tests = 0;

const test = (message, test) => {
    tests++;
    console.log(`${tests}) ${message}`);
    try {
        test();
        console.log('PASSED')
    } catch (ex) {
        console.warn('FAILED');
        errors.push({
            message:`${tests}) ${message}`,
            stack: ex.stack,
        });
    }
    console.log('-----');
};

test('gamepad-flex gamepads should be synced across require statements', () => {
    gf.gamepads.push(0, 1, 2);
    if (gfWrapper.gamepads.length < 3) {
        throw new Error('expected 3 gamepads');
    }
});

errors.forEach(e => {
    console.error(e.message, '\n', e.stack);
});

console.log(`Test completed, ${tests - errors.length}/${tests} test${tests != 1 ? 's' : ''} passed.`);