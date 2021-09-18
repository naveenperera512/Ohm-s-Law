// Copyright 2020-2021, University of Colorado Boulder

/**
 * Parametric IO Type that adds support for serializing an element as multiple types, as a composite. Serialization occurs
 * via a first-come-first-serialize basis, where the first parameterType will be the
 *
 * Sample usage:
 *
 * window.numberOrStringProperty = new Property( 'I am currently a string', {
      tandem: Tandem.GENERAL_MODEL.createTandem( 'numberOrStringProperty' ),
      phetioType: Property.PropertyIO( OrIO( [ StringIO, NumberIO ] ) )
    } );
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import ValidatorDef from '../../../axon/js/ValidatorDef.js';
import tandemNamespace from '../tandemNamespace.js';
import IOType from './IOType.js';
import StateSchema from './StateSchema.js';

// {Map.<parameterType:IOType, IOType>} - Cache each parameterized IOType so that it is only created once
const cache = new Map();

/**
 * Parametric type constructor function, do not use `new`
 * @param {Array.<IOType>} parameterTypes - a list of IO Type to combine into a single composite
 * @returns {IOType} - the IO Type that supports null
 */
const OrIO = parameterTypes => {
  assert && assert( Array.isArray( parameterTypes ), 'OrIO needs to be an array' );
  assert && assert( parameterTypes.length > 0, 'OrIO needs parameterTypes' );
  const typeNames = parameterTypes.map( parameterType => parameterType.typeName );
  const key = typeNames.join( ',' );

  if ( !cache.has( key ) ) {
    cache.set( key, new IOType( `OrIO<${typeNames.join( ', ' )}>`, {
      documentation: 'An IOType adding support for a composite type that can be any of its parameters.',
      parameterTypes: parameterTypes,
      isValidValue: instance => {
        for ( let i = 0; i < parameterTypes.length; i++ ) {
          const parameterType = parameterTypes[ i ];
          if ( ValidatorDef.isValueValid( instance, parameterType.validator ) ) {
            return true;
          }
        }
        return false;
      },

      toStateObject: instance => {
        for ( let i = 0; i < parameterTypes.length; i++ ) {
          const parameterType = parameterTypes[ i ];
          if ( ValidatorDef.isValueValid( instance, parameterType.validator ) ) {
            return {
              index: i,
              state: parameterType.toStateObject( instance )
            };
          }
        }
        throw new Error( 'somehow the instance was not valid, we should not get here. Why was isValidValue not used before this step?' );
      },

      fromStateObject: stateObject => {
        assert && assert( stateObject.hasOwnProperty( 'index' ), 'index required for deserialization' );
        assert && assert( stateObject.hasOwnProperty( 'state' ), 'state required for deserialization' );
        return parameterTypes[ stateObject.index ].fromStateObject( stateObject.state );
      },
      stateSchema: StateSchema.asValue( `${typeNames.join( '|' )}` )
    } ) );
  }

  return cache.get( key );
};

tandemNamespace.register( 'OrIO', OrIO );
export default OrIO;