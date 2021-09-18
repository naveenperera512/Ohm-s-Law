// Copyright 2020, University of Colorado Boulder

/**
 * IO Type for JS's built-in Float64Array type
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 * @author Chris Klusendorf
 */

import tandemNamespace from '../tandemNamespace.js';
import IOType from './IOType.js';

const Float64ArrayIO = new IOType( 'Float64ArrayIO', {
  isValidValue: value => value instanceof Float64Array,
  toStateObject: array => {
    const result = [];
    array.forEach( float => result.push( float ) );
    return result;
  },
  fromStateObject: stateObject => new Float64Array( stateObject ),

  // Float64ArrayIO is a data type, and uses the toStateObject/fromStateObject exclusively for data type serialization.
  // Sites that use Float64ArrayIO as a reference type can use this method to update the state of an existing Float64Arary.
  applyState: ( array, stateObject ) => array.set( stateObject )
} );

tandemNamespace.register( 'Float64ArrayIO', Float64ArrayIO );
export default Float64ArrayIO;