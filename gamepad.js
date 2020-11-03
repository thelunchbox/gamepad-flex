const clone = require('clone');
const { GamepadButtonTypes } = require('./gamepadButtonTypes');
const GamepadTypes = require('./gamepadTypes');
const { getHandler: getGlobalHandler } = require('./globalHandlers');

class Gamepad {
    constructor(name, position, configurations = null, options = {}) {
        this.name = name;

        this.connected = false;
        this.id = null;
        this.index = null;
        this.position = position;

        this.settingButton = false;
        this.ignoreInputs = false;

        this.axes = null;
        this.buttons = null;
        this.keys = [];

        this.connectedAt = new Date();

        this.axisThreshold = options.axisThreshold || 0.35;
        this.axisMode = options.axisMode || 0;
        this.getAxisValue = (value) => this.axisMode
            ? Math.round(value / this.axisThreshold) * this.axisThreshold
            : Math.abs(value) > this.axisThreshold ? Math.abs(value) / value : 0;

        this.keyboard = options.keyboard;
        this.replaceKeyboard = options.replaceKeyboard;
        this.configType = this.keyboard ? GamepadTypes.KEYBOARD : null;
        this.configurations = configurations;
        this.loadConfig();

        this.handlers = {};
    }

    connect(gp) {
        this.keyboard = false;

        this.connected = true;
        this.id = gp.id;
        this.index = gp.index;

        this.axes = new Array(gp.axes.length);
        this.buttons = new Array(gp.buttons.length);

        this.configuring = false;

        if (gp.axes.length == 0) {
            this.configType = GamepadTypes.DPAD;
        } else {
            this.configType = GamepadTypes.JOYSTICK;
        }
        this.loadConfig();

        gp.buttons.forEach((button, index) => {
            this.buttons[index] = button.pressed;
        });
        gp.axes.forEach((axis, index) => {
            const axisRoundedValue = this.getAxisValue(axis);
            this.axes[index] = axisRoundedValue;
        });
    }

    disconnect() {
        this.connected = false;
        this.id = null;
        this.index = null;
        this.axes = null;
        this.buttons = null;
        this.waiting = true;
    }

    getState(inputs) {
        const getSign = x => Math.abs(x) / x;
        let state = [];
        Object.values(inputs).forEach((value, i) => {
            const btn = this.config.find(c => c.name == value);
            let pressed = false;
            switch (btn.type) {
                case GamepadButtonTypes.AXIS_NEGATIVE:
                    pressed = getSign(this.axes[btn.id]) == -1;
                    break;
                case GamepadButtonTypes.AXIS_POSITIVE:
                    pressed = getSign(this.axes[btn.id]) == 1;
                    break;
                case GamepadButtonTypes.BUTTON:
                    pressed = this.buttons[btn.id];
                    break;
                case GamepadButtonTypes.KEY:
                    pressed = this.keys[btn.id];
                    break;
            }
            state[i] = pressed ? btn.multiplier : 0;
        });
        return state;
    }

    getKeyValue(name) {
        return this.config.find(c => c.name == name).value;
    }

    hasActivity({ buttonsOnly = false } = {}) {
        let value = false;
        if (!buttonsOnly && this.axes) {
          value = this.axes.some(a => this.getAxisValue(a));
        }
        if (this.buttons) {
            value = value || this.buttons.some(b => b);
        }
        if (this.keyboard && this.keys) {
          value = value || this.keys.some(k => k);
        }
        return value;
    }

    connectFrom(gp) {
        this.keyboard = false;
        this.connected = true;
        this.id = gp.id;
        this.index = gp.index;
        this.axes = gp.axes;
        this.buttons = gp.buttons;
        this.configType = gp.configType;

        this.loadConfig();
    }

    getConfigurableButtons() {
        if (!this.config) return null;
        return this.config.filter(b => !b.id.length);
    }

    startButtonConfigure(button) {
        button.selected = true;
        this.settingButton = true;
        this.tempIgnoreInputs();
    }

    tempIgnoreInputs(time = 200) {
        this.ignoreInputs = true;
        window.setTimeout(() => {
            this.ignoreInputs = false;
        }, time);
    }

    loadConfig() {
        this.config = null;
        let storedConfig = window.localStorage.getItem(this.name + '-config');
        if (storedConfig) {
            storedConfig = JSON.parse(storedConfig);
            this.config = storedConfig[this.configType] || null;
        }
        // if we didn't load a config, load the default config.
        if (!this.config) {
            this.config = clone(this.configurations[this.configType]);
        }
    }

    saveConfig() {
        if (!this.config) return;

        this.config.forEach(b => {
            b.selected = false;
        });

        let storedConfig = window.localStorage.getItem(this.name + '-config');
        if (storedConfig) {
            storedConfig = JSON.parse(storedConfig);
        } else {
            storedConfig = {};
        }

        storedConfig[this.configType] = this.config;
        window.localStorage.setItem(this.name + '-config', JSON.stringify(storedConfig));
    }

    on(event, handler) {
        this.handlers[event] = handler;
    }

    ignore(event) {
        delete this.handlers[event];
    }

    handleKey(event, keyCode) {
        if (this.ignoreInputs) return;

        if (this.settingButton && event == 'down') {
            const btn = this.config.find(b => {
                return b.selected;
            });
            btn.id = keyCode;
            btn.type = GamepadButtonTypes.KEY;
            this.settingButton = false;
            btn.selected = false;
            this.tempIgnoreInputs();
            return;
        }

        this.keys[keyCode] = event == 'down';

        const matches = this.config.filter((c) => {
            let match = c.id == keyCode;
            if (c.id.length) {
                const keyCodes = this.config.filter(x => c.id.includes(x.name)).map(c => c.id);
                match = keyCodes.includes(keyCode);
            }
            return c.type == GamepadButtonTypes.KEY
                && match;
        });
        matches.forEach(m => {
            const handler = this.handlers[event] || getGlobalHandler(event);
            const value = event == 'up' ? 0 : m.multiplier;
            handler && handler(m.name, value, { index: this.position, name: this.name });
        });
    }

    handleInput(gp) {
        if (this.ignoreInputs) return;

        if (this.settingButton) {
            const btn = this.config.find(b => {
                return b.selected;
            });

            gp.buttons.forEach((button, index) => {
                if (this.settingButton && button.pressed) {
                    btn.id = index;
                    btn.type = GamepadButtonTypes.BUTTON;
                    this.settingButton = false;
                    btn.selected = false;
                    this.tempIgnoreInputs();
                }
            });
            gp.axes.forEach((axis, index) => {
                if (index > 2) return; // no controller should have more than 3 axes...
                const axisRoundedValue = this.getAxisValue(axis);
                if (this.settingButton && axisRoundedValue != 0) {
                    btn.id = index;
                    btn.type = axisRoundedValue > 0 ? GamepadButtonTypes.AXIS_POSITIVE : GamepadButtonTypes.AXIS_NEGATIVE;
                    this.settingButton = false;
                    btn.selected = false;
                    this.tempIgnoreInputs();
                }
            });
            return;
        }

        gp.buttons.forEach((button, index) => {
            const buttons = this.config.filter(c => {
                return c.type == GamepadButtonTypes.BUTTON
                    && (c.id == index || (c.id.length && c.id.indexOf(index) > -1));
            });
            if (((this.textInput && buttons.find(b => [INPUTS.UP, INPUTS.DOWN, INPUTS.LEFT, INPUTS.RIGHT].includes(b.name))) || this.buttons[index] != button.pressed) && buttons.length > 0) {
                let value = button.value;
                this.buttons[index] = button.pressed;
                buttons.forEach(b => {
                    const event = value ? 'down' : 'up';
                    value = Math.abs(value) * (b.multiplier)
                    const handler = this.handlers[event] || getGlobalHandler(event);
                    handler && handler(b.name, value, { index: this.position, name: this.name });
                });
            }
        });
        
        gp.axes.forEach((axis, index) => {
            const buttons = this.config.filter(c => {
                return (c.type == GamepadButtonTypes.AXIS_NEGATIVE
                    || c.type == GamepadButtonTypes.AXIS_POSITIVE)
                    && c.id == index;
            });
            const axisRoundedValue = this.getAxisValue(axis);
            if ((this.textInput || this.axes[index] != axisRoundedValue) && buttons.length > 0) {
                const value = axisRoundedValue;
                this.axes[index] = axisRoundedValue;
                buttons.forEach(b => {
                    if (value == 0 || (value < 0 && b.type == GamepadButtonTypes.AXIS_NEGATIVE) || (value > 0 && b.type == GamepadButtonTypes.AXIS_POSITIVE)) {
                        const event = value ? 'down' : 'up';
                        const sendValue = Math.abs(value) * (b.multiplier)
                        const handler = this.handlers[event] || getGlobalHandler(event);
                        handler && handler(m.name, sendValue, { index: this.position, name: this.name });
                    }
                });
            }
        });
    }
}

module.exports = Gamepad;