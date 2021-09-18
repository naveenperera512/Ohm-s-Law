// Copyright 2013-2020, University of Colorado Boulder

/**
 * Function for doing a linear mapping between two domains ('a' and 'b').
 * <p>
 * Example usage:
 * <code>
 * var f = new dot.LinearFunction( 0, 100, 0, 200 );
 * f( 50 ); // 100
 * f.inverse( 100 ); // 50
 * </code>
 *
 * @author Chris Malley (PixelZoom, Inc.)
 */

import Utils from './Utils.js';
import dot from './dot.js';

/**
 * @param {number} a1
 * @param {number} a2
 * @param {number} b1
 * @param {number} b2
 * @param {boolean} [clamp=false] - clamp the result to the provided ranges, false by default
 * @constructor
 */
function LinearFunction( a1, a2, b1, b2, clamp ) {

  clamp = _.isUndefined( clamp ) ? false : clamp;

  /**
   * Linearly interpolate two points and evaluate the line equation for a third point.
   * f( a1 ) = b1, f( a2 ) = b2, f( a3 ) = <linear mapped value>
   * Optionally clamp the result to the range [b1,b2].
   *
   * @private
   *
   * @param {number} a1
   * @param {number} a2
   * @param {number} b1
   * @param {number} b2
   * @param {number} a3
   * @param {boolean} clamp
   * @returns {number}
   */
  const map = ( a1, a2, b1, b2, a3, clamp ) => {
    let b3 = Utils.linear( a1, a2, b1, b2, a3 );
    if ( clamp ) {
      const max = Math.max( b1, b2 );
      const min = Math.min( b1, b2 );
      b3 = Utils.clamp( b3, min, max );
    }
    return b3;
  };

  /**
   * Maps from a to b.
   * @public
   *
   * @param {number} a3
   * @returns {number}
   */
  const evaluate = a3 => {
    return map( a1, a2, b1, b2, a3, clamp );
  };


  /**
   * Maps from b to a
   * @public
   *
   * @param {number} b3
   * @returns {number}
   */
  evaluate.inverse = b3 => {
    return map( b1, b2, a1, a2, b3, clamp );
  };

  return evaluate; // return the evaluation function, so we use sites look like: f(a) f.inverse(b)
}

dot.register( 'LinearFunction', LinearFunction );

export default LinearFunction;