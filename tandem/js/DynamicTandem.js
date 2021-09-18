// Copyright 2019-2020, University of Colorado Boulder

/**
 * A tandem for a dynamic element that stores the name of the archetype that defines its dynamic element's schema.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Chris Klusendorf (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import Tandem from './Tandem.js';
import tandemNamespace from './tandemNamespace.js';

// constants
const DYNAMIC_ARCHETYPE_NAME = 'archetype';

class DynamicTandem extends Tandem {

  /**
   * @param {Tandem} parentTandem
   * @param {string} name
   * @param {Object} [options]
   */
  constructor( parentTandem, name, options ) {
    assert && assert( parentTandem, 'DynamicTandem must have a parentTandem' );
    super( parentTandem, name, options );
  }

  /**
   * Returns the regular expression which can be used to test each term. The term must consist only of alpha-numeric
   * characters or underscores.
   * @returns {RegExp}
   * @protected
   * @override
   */
  getTermRegex() {
    return /^[a-zA-Z0-9_]+$/;
  }

  /**
   * See Tandem.getArchetypalPhetioID, in this case, look up the corresponding archetype.
   * A dynamic phetioID contains text like .................'sim.screen1.particles.particles_7.visibleProperty'
   * This method looks up the corresponding archetype like..'sim.screen1.particles.archetype.visibleProperty'
   * @returns {string}
   * @public
   * @override
   */
  getArchetypalPhetioID() {
    assert && assert( this.parentTandem, 'Group elements must be in a Group' );
    return window.phetio.PhetioIDUtils.append( this.parentTandem.getArchetypalPhetioID(), DYNAMIC_ARCHETYPE_NAME );
  }
}

// @public {string}
DynamicTandem.DYNAMIC_ARCHETYPE_NAME = DYNAMIC_ARCHETYPE_NAME;

tandemNamespace.register( 'DynamicTandem', DynamicTandem );
export default DynamicTandem;