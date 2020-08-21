const { gamepads, processGamepadActivity } = require('../index');

setInterval(() => {
  processGamepadActivity();
  console.log(gamepads[0]);
}, 33);