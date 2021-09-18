// Copyright 2018-2021, University of Colorado Boulder

/**
 * IO Type for JS's built-in string type.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Andrew Adare (PhET Interactive Simulations)
 */

import tandemNamespace from '../tandemNamespace.js';
import IOType from './IOType.js';
import StateSchema from './StateSchema.js';
import ValueIO from './ValueIO.js';

const StringIO = new IOType( 'StringIO', {
  supertype: ValueIO,
  valueType: 'string',
  documentation: 'IO Type for Javascript\'s string primitive type',
  stateSchema: StateSchema.asValue( 'string', { valueType: 'string' } )
} );

tandemNamespace.register( 'StringIO', StringIO );
export default StringIO;