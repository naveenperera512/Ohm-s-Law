// Copyright 2021, University of Colorado Boulder

import tandemNamespace from '../tandemNamespace.js';
import IOType from './IOType.js';
import StateSchema from './StateSchema.js';
import ValueIO from './ValueIO.js';

const noExtraPrototype = object => Object.getPrototypeOf( object ) === Object.prototype;
/**
 * IO Type intended for usage with object literals, primarily for toStateObject/fromStateObject.
 * @author Sam Reid (PhET Interactive Simulations)
 */
const ObjectLiteralIO = new IOType( 'ObjectLiteralIO', {
  documentation: 'IO Type for object literals',
  isValidValue: noExtraPrototype,
  supertype: ValueIO,
  stateSchema: StateSchema.asValue( 'object', { valueType: Object, isValidValue: noExtraPrototype } )
} );

tandemNamespace.register( 'ObjectLiteralIO', ObjectLiteralIO );
export default ObjectLiteralIO;