// Copyright 2018-2021, University of Colorado Boulder

/**
 * IO Type for JS's built-in boolean type.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Andrew Adare (PhET Interactive Simulations)
 */

import tandemNamespace from '../tandemNamespace.js';
import IOType from './IOType.js';
import StateSchema from './StateSchema.js';
import ValueIO from './ValueIO.js';

const BooleanIO = new IOType( 'BooleanIO', {
  supertype: ValueIO,
  valueType: 'boolean',
  documentation: 'IO Type for Javascript\'s boolean primitive type',
  stateSchema: StateSchema.asValue( 'boolean', { valueType: 'boolean' } )
} );

tandemNamespace.register( 'BooleanIO', BooleanIO );
export default BooleanIO;