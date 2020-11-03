const window = require('window-or-global');
if (!window.addEventListener) {
  window.addEventListener = () => { };
}

const {
  GamepadButtonTypes,
  KeyboardKeyCodes
} = require('./gamepadButtonTypes');
const GamepadTypes = require('./gamepadTypes');
const GamepadButton = require('./gamepadButton');
const Gamepad = require('./gamepad');
const { on: setGlobalHandler, ignore: unsetGlobalHandler } = require('./globalHandlers');

const onGamepadConnected = () => {};

const {
  AXIS_NEGATIVE,
  AXIS_POSITIVE,
  BUTTON,
  KEY,
} = GamepadButtonTypes;

const gamepads = [];
// set up some default configurations - users should change these to suit their needs
const configurations = {
  [GamepadTypes.KEYBOARD]: [
    new GamepadButton('LEFT', KeyboardKeyCodes.left_arrow, KEY, -1),
    new GamepadButton('RIGHT', KeyboardKeyCodes.right_arrow, KEY, 1),
    new GamepadButton('UP', KeyboardKeyCodes.up_arrow, KEY, 1),
    new GamepadButton('DOWN', KeyboardKeyCodes.down_arrow, KEY, -1),
    new GamepadButton('A', KeyboardKeyCodes.f, KEY, 1),
    new GamepadButton('B', KeyboardKeyCodes.d, KEY, 1),
    new GamepadButton('PAUSE', KeyboardKeyCodes.enter, KEY, 1),
    // alias - the buttons in the array will also fire this button trigger
    new GamepadButton('ACCEPT', ['A', 'B'], KEY, 1),
  ],
  [GamepadTypes.JOYSTICK]: [
    new GamepadButton('LEFT', 0, AXIS_NEGATIVE, -1),
    new GamepadButton('RIGHT', 0, AXIS_POSITIVE, 1),
    new GamepadButton('UP', 1, AXIS_NEGATIVE, 1),
    new GamepadButton('DOWN', 1, AXIS_POSITIVE, -1),
    new GamepadButton('A', 0, BUTTON, 1),
    new GamepadButton('B', 1, BUTTON, 1),
    new GamepadButton('PAUSE', 9, BUTTON, 1),
    // alias - the buttons in the array will also fire this button trigger
    new GamepadButton('ACCEPT', [0, 1, 2, 3, 4, 5, 6, 7], BUTTON, 1)
  ],
  [GamepadTypes.DPAD]: [
    new GamepadButton('LEFT', 14, BUTTON, -1),
    new GamepadButton('RIGHT', 15, BUTTON, 1),
    new GamepadButton('UP', 12, BUTTON, 1),
    new GamepadButton('DOWN', 13, BUTTON, -1),
    new GamepadButton('A', 0, BUTTON, 1),
    new GamepadButton('B', 1, BUTTON, 1),
    new GamepadButton('PAUSE', 9, BUTTON, 1),
    // alias - the buttons in the array will also fire this button trigger
    new GamepadButton('ACCEPT', [0, 1, 2, 3, 4, 5, 6, 7], BUTTON, 1)
  ],
};

const getNextEmptyIndex = (array, keyboard = false) => {
    for (let i = 0; i <= array.length; i++) {
      const gp = array[i];
      const isEmpty = !gp;
      const replaceKeyboard = !keyboard && gp && gp.keyboard && gp.replaceKeyboard;
      if (isEmpty || replaceKeyboard) return [i, replaceKeyboard ? gp : null];
    }
}

const getName = i => `P${i + 1}`;

const setConfiguration = (type, config) => {
  configurations[type] = config;
};

window.addEventListener("gamepadconnected", function (e) {
  // ignore these weird 'auxilliary' gamepad devices
  if (e.gamepad.buttons.length + e.gamepad.axes.length < 4) {
    console.debug('Ignoring auxilliary connection');
    return;
  }

  console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
    e.gamepad.index, e.gamepad.id,
    e.gamepad.buttons.length, e.gamepad.axes.length);

  const [i, replacingKeyboard] = getNextEmptyIndex(gamepads);

  const gp = new Gamepad(getName(i), i, configurations);
  gp.connect(e.gamepad);
  if (replacingKeyboard) {
    gp.handlers = replacingKeyboard.handlers;
  }
  gamepads[i] = gp;
  onGamepadConnected(gp, i, e);
});

window.addEventListener("gamepaddisconnected", function (e) {
  console.debug("Gamepad disconnected from index %d: %s",
    e.gamepad.index, e.gamepad.id);
  const p = gamepads.find(p => p.id == e.gamepad.id);
  p.disconnect();
});

window.addEventListener('keydown', (event) => {
  const key = event.keyCode;
  const pList = gamepads.filter(p => p.keyboard);
  if (pList.length > 0) {
    pList.forEach(p => p.handleKey('down', key));
    event.stopPropagation();
  }
}, false);

window.addEventListener('keyup', (event) => {
  const key = event.keyCode;
  const pList = gamepads.filter(p => p.keyboard);
  if (pList.length > 0) {
    pList.forEach(p => p.handleKey('up', key));
    event.stopPropagation();
  }
}, false);

const processGamepadActivity = () => {
  const gamepadInterfaces = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads : []);
  for (let i = 0; i < gamepadInterfaces.length; i++) {
    const gpi = gamepadInterfaces[i];
    if (!gpi) continue;
    const gamepad = gamepads.find(gp => gp.index == gpi.index);
    if (!gamepad) continue;
    gamepad.handleInput(gpi);
  }
};

const addKeyboardController = ({ replaceKeyboard = true, config = {} } = {}) => {
  const [i] = getNextEmptyIndex(gamepads, true)
  const gamepad = new Gamepad(
    getName(i),
    i,
    {
      ...configurations,
      ...config,
    },
    {
      keyboard: true,
      replaceKeyboard,
    });
  gamepads[i] = gamepad;
}

const handleGamepadConnected = (handler) => {
  onGamepadConnected = handler;
}

module.exports = {
  addKeyboardController,
  gamepads,
  GamepadButton,
  GamepadButtonTypes,
  GamepadTypes,
  handleGamepadConnected,
  KeyboardKeyCodes,
  processGamepadActivity,
  setConfiguration,
  setGlobalHandler,
  unsetGlobalHandler,
};
