class GamepadButton {
    /**
     * 
     * @param {string} name the name of the button/event that will fire when this button is activated
     * @param {number} buttonId the keycode or axis/button index to base this button on
     * @param {GamepadButtonTypes} type the type of button (keyboard key, gamepad button, gamepad axis+, gamepad axis-)
     * @param {number} multiplier the value to present to the event handler for this button (+/-)
     */
    constructor(name, buttonId, type, multiplier = 1) {
        this.name = name;
        this.id = buttonId;
        this.type = type;
        this.multiplier = multiplier;
        this.selected = false;
        this.textInput = false;
    }
}

module.exports = GamepadButton;