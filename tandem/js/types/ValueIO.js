// Copyright 2021, University of Colorado Boulder

import tandemNamespace from '../tandemNamespace.js';
import IOType from './IOType.js';
import StateSchema from './StateSchema.js';

/**
 * IO Type that uses value semantics for toStateObject/fromStateObject
 * @author Sam Reid (PhET Interactive Simulations)
 */
const ValueIO = new IOType( 'ValueIO', {
  isValidValue: _.stubTrue,
  supertype: IOType.ObjectIO,
  toStateObject: coreObject => coreObject,
  fromStateObject: stateObject => stateObject,
  stateSchema: StateSchema.asValue( '*', { isValidValue: _.stubTrue } )
} );

tandemNamespace.register( 'ValueIO', ValueIO );
export default ValueIO;