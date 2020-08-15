const { GamepadButtonTypes } = require('./gamepadButtonTypes');
const GamepadTypes = require('./gamepadTypes');
const clone = require('clone');

class Gamepad {
    constructor(name, configurations, options = {}) {
        this.name = name;

        this.connected = false;
        this.id = null;
        this.index = null;

        this.settingButton = false;
        this.ignoreInputs = false;

        this.axes = null;
        this.buttons = null;
        this.keys = [];

        this.axisThreshold = options.axisThreshold || 0.35;
        this.axisMode = options.axisMode || 0;
        this.getAxisValue = (raw) => this.axisMode
            ? Math.round(axis / this.axisThreshold) * this.axisThreshold
            : Math.abs(axis) > this.axisThreshold ? Math.abs(axis) / axis : 0;

        this.keyboard = options.keyboard;
        this.replaceKeyboard = options.replaceKeyboard;
        this.configType = this.keyboard ? GamepadTypes.KEYBOARD : null;
        this.configurations = configurations;
        this.loadConfig();

        this.handlers = {
            down: () => { },
            up: () => { }
        };
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
            this.configType = configTypes.DPAD;
        } else {
            this.configType = configTypes.JOYSTICK;
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

    getState() {
        const getSign = x => Math.abs(x) / x;
        let state = [];
        Object.values(INPUTS).forEach((value, i) => {
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

    hasActivity() {
        let value = false;
        if (this.axes && this.buttons) {
            value = this.axes.filter(a => this.getAxisValue(a)).length > 0;
            value = value || this.buttons.filter(b => b).length > 0;
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
        return this.config.filter(b => !_.isArray(b.id));
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
            const btn = _.find(this.config, b => {
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

        const matches = _.filter(this.config, (c) => {
            let match = c.id == keyCode;
            if (_.isArray(c.id)) {
                const keyCodes = _.pluck(this.config.filter(x => c.id.includes(x.name)), 'id');
                match = keyCodes.includes(keyCode);
            }
            return c.type == GamepadButtonTypes.KEY
                && match;
        });
        matches.forEach(m => {
            const handler = this.handlers[event];
            const value = event == 'up' ? 0 : m.multiplier;
            handler(m.name, value);
        });
    }

    handleInput(gp) {
        if (this.ignoreInputs) return;

        if (this.settingButton) {
            const btn = _.find(this.config, b => {
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
            const buttons = _.filter(this.config, c => {
                return c.type == GamepadButtonTypes.BUTTON
                    && (c.id == index || (_.isArray(c.id) && c.id.indexOf(index) > -1));
            });
            if (((this.textInput && buttons.find(b => [INPUTS.UP, INPUTS.DOWN, INPUTS.LEFT, INPUTS.RIGHT].includes(b.name))) || this.buttons[index] != button.pressed) && buttons.length > 0) {
                let value = button.value;
                this.buttons[index] = button.pressed;
                buttons.forEach(b => {
                    const event = value ? 'down' : 'up';
                    value = Math.abs(value) * (b.multiplier)
                    const handler = this.handlers[event];
                    handler(b.name, value);
                });
            }
        });
        
        gp.axes.forEach((axis, index) => {
            const buttons = _.filter(this.config, c => {
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
                        const handler = this.handlers[event];
                        handler(b.name, sendValue);
                    }
                });
            }
        });
    }
}

module.exports = Gamepad;