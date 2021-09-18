// Copyright 2014-2021, University of Colorado Boulder

/**
 * Model for a toggle button that sticks when pushed down and pops up when pushed a second time. Unlike other general
 * sun models, 'sticky' implies a specific type of user-interface component, a button that is either popped up or
 * pressed down.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author John Blanco (PhET Interactive Simulations)
 */

import Emitter from '../../../axon/js/Emitter.js';
import Property from '../../../axon/js/Property.js';
import merge from '../../../phet-core/js/merge.js';
import EventType from '../../../tandem/js/EventType.js';
import Tandem from '../../../tandem/js/Tandem.js';
import sun from '../sun.js';
import ButtonModel from './ButtonModel.js';

class StickyToggleButtonModel extends ButtonModel {

  /**
   * @param {Object} valueUp value when the toggle is in the 'up' position
   * @param {Object} valueDown value when the toggle is in the 'down' position
   * @param {Property} valueProperty axon Property that can be either valueUp or valueDown.
   *   Would have preferred to call this `property` but it would clash with the Property function name.
   * @param {Object} [options]
   */
  constructor( valueUp, valueDown, valueProperty, options ) {

    options = merge( {
      tandem: Tandem.REQUIRED
    }, options );

    super( options );

    // @private
    this.valueUp = valueUp;
    this.valueDown = valueDown;
    this.valueProperty = valueProperty;
    this.toggledEmitter = new Emitter( {
      tandem: options.tandem.createTandem( 'toggledEmitter' ),
      phetioDocumentation: 'Emits when the button is toggled',
      phetioEventType: EventType.USER
    } );

    const toggleListener = () => {
      assert && assert( this.valueProperty.value === this.valueUp || this.valueProperty.value === this.valueDown,
        `unrecognized value: ${this.valueProperty.value}` );

      this.valueProperty.value = this.valueProperty.value === this.valueUp ? this.valueDown : this.valueUp;
    };
    this.toggledEmitter.addListener( toggleListener );

    // When the user releases the toggle button, it should only fire an event if it is not during the same action in
    // which they pressed the button.  Track the state to see if they have already pushed the button.
    //
    // Note: Does this need to be reset when the simulation does "reset all"?  I (Sam Reid) can't find any negative
    // consequences in the user interface of not resetting it, but maybe I missed something. Or maybe it would be safe
    // to reset it anyway.
    this.pressedWhileDownProperty = new Property( false ); // @private

    // If the button is up and the user presses it, show it pressed and toggle the state right away.  When the button is
    // released, pop up the button (unless it was part of the same action that pressed the button down in the first
    // place).
    const downListener = down => {
      const overOrFocused = this.overProperty.get() || this.focusedProperty.get();
      if ( this.enabledProperty.get() && overOrFocused && !this.interrupted ) {
        if ( down && valueProperty.value === valueUp ) {
          this.toggle();
          this.pressedWhileDownProperty.set( false );
        }
        if ( !down && valueProperty.value === valueDown ) {
          if ( this.pressedWhileDownProperty.get() ) {
            this.toggle();
          }
          else {
            this.pressedWhileDownProperty.set( true );
          }
        }
      }

      // Handle the case where the pointer moved out then up over a toggle button, so it will respond to the next press
      if ( !down && !overOrFocused ) {
        this.pressedWhileDownProperty.set( true );
      }
    };

    this.downProperty.link( downListener );

    // if the valueProperty is set externally to user interaction, update the buttonModel
    // downProperty so the model stays in sync
    const valuePropertyListener = value => {
      this.downProperty.set( value === valueDown );
    };
    valueProperty.link( valuePropertyListener );

    // make the button ready to toggle when enabled
    const enabledPropertyOnListener = enabled => {
      if ( enabled ) {
        this.pressedWhileDownProperty.set( true );
      }
    };
    this.enabledProperty.link( enabledPropertyOnListener );

    // @private - dispose items specific to this instance
    this.disposeToggleButtonModel = () => {
      this.downProperty.unlink( downListener );
      this.enabledProperty.unlink( enabledPropertyOnListener );
      valueProperty.unlink( valuePropertyListener );
      this.toggledEmitter.removeListener( toggleListener );
    };
  }

  /**
   * @public
   * @override
   */
  dispose() {
    this.disposeToggleButtonModel();
    super.dispose();
  }

  // @public
  toggle() {
    this.toggledEmitter.emit();
    this.produceSoundEmitter.emit();
  }
}

sun.register( 'StickyToggleButtonModel', StickyToggleButtonModel );
export default StickyToggleButtonModel;