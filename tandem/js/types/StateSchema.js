// Copyright 2021, University of Colorado Boulder

/**
 * Class responsible for storing information about the schema of PhET-iO state. See IOType stateSchema option for usage
 * and more information.
 *
 * There are two types of StateSchema, the first serves a "value", when the state of an IOType is just a value. The second
 * is a "composite", where the state of an IOType is made from sub-components, each of which have an IOType. Check
 * which type of StateSchema your instance is with StateSchema.isComposite().
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import validate from '../../../axon/js/validate.js';
import ValidatorDef from '../../../axon/js/ValidatorDef.js';
import assertMutuallyExclusiveOptions from '../../../phet-core/js/assertMutuallyExclusiveOptions.js';
import merge from '../../../phet-core/js/merge.js';
import tandemNamespace from '../tandemNamespace.js';
import IOType from './IOType.js';

class StateSchema {

  /**
   * @param {Object} [options]
   */
  constructor( options ) {

    // Either create with compositeSchema, or specify a that this state is just a value
    assert && assertMutuallyExclusiveOptions( options, [ 'compositeSchema' ], [ 'displayString', 'validator' ] );

    options = merge( {
      displayString: '',
      validator: null,

      // {Object.<string,IOType>} - an object literal of keys that correspond to an IOType
      compositeSchema: null
    }, options );

    // @public (read-only)
    this.displayString = options.displayString;
    this.validator = options.validator;

    // @public (read-only) - "composite" state schemas are treated differently that value state schemas
    this.compositeSchema = options.compositeSchema;

    assert && this.validateStateSchema( this.compositeSchema );
  }


  /**
   * Make sure that a composite state schema is of the correct form. Each value in the object should be an IOType
   * Only useful if assert is called.
   * @private
   */
  validateStateSchema( stateSchema ) {
    if ( assert && this.isComposite() ) {

      for ( const stateSchemaKey in stateSchema ) {
        if ( stateSchema.hasOwnProperty( stateSchemaKey ) ) {

          const stateSchemaValue = stateSchema[ stateSchemaKey ];

          if ( stateSchemaKey === '_private' ) {
            this.validateStateSchema( stateSchemaValue );
          }
          else {
            assert && assert( stateSchemaValue instanceof IOType, `${stateSchemaValue} expected to be an IOType` );
          }
        }
      }
    }
  }

  /**
   * @public
   * @param {PhetioObject} coreObject
   * @param {Object} stateObject
   */
  defaultApplyState( coreObject, stateObject ) {

    const applyStateForLevel = ( schema, stateObjectLevel ) => {
      assert && assert( this.isComposite(), 'defaultApplyState from stateSchema only applies to composite stateSchemas' );
      for ( const stateKey in schema ) {
        if ( schema.hasOwnProperty( stateKey ) ) {
          if ( stateKey === '_private' ) {
            applyStateForLevel( schema._private, stateObjectLevel._private );
          }
          else {

            // The IOType for the key in the composite.
            const schemaIOType = schema[ stateKey ];
            assert && assert( stateObjectLevel.hasOwnProperty( stateKey ), `stateObject does not have expected schema key: ${stateKey}` );

            // Using fromStateObject to deserialize sub-component
            if ( schemaIOType.defaultDeserializationMethod === IOType.DeserializationMethod.FROM_STATE_OBJECT ) {
              coreObject[ stateKey ] = schema[ stateKey ].fromStateObject( stateObjectLevel[ stateKey ] );
            }
            else {
              assert && assert( schemaIOType.defaultDeserializationMethod === IOType.DeserializationMethod.APPLY_STATE, 'unexpected deserialization method' );

              // Using applyState to deserialize sub-component
              schema[ stateKey ].applyState( coreObject[ stateKey ], stateObjectLevel[ stateKey ] );
            }
          }
        }
      }
    };
    applyStateForLevel( this.compositeSchema, stateObject );
  }

  /**
   * @public
   * @param {PhetioObject} coreObject
   * @returns {Object}
   */
  defaultToStateObject( coreObject ) {
    assert && assert( this.isComposite(), 'defaultToStateObject from stateSchema only applies to composite stateSchemas' );

    const toStateObjectForSchemaLevel = schema => {

      const stateObject = {};
      for ( const stateKey in schema ) {
        if ( schema.hasOwnProperty( stateKey ) ) {
          if ( stateKey === '_private' ) {
            stateObject._private = toStateObjectForSchemaLevel( schema._private );
          }
          else {
            assert && assert( coreObject.hasOwnProperty( stateKey ),
              `cannot get state because coreObject does not have expected schema key: ${stateKey}` );
            stateObject[ stateKey ] = schema[ stateKey ].toStateObject( coreObject[ stateKey ] );
          }
        }
      }
      return stateObject;
    };
    return toStateObjectForSchemaLevel( this.compositeSchema );
  }

  /**
   * True if the StateSchema is a composite schema.
   * @public
   * @returns {boolean}
   */
  isComposite() {
    return !!this.compositeSchema;
  }


  /**
   * Check if a given stateObject is as valid as can be determined by this StateSchema. Will return null if valid, but
   * needs more checking up and down the hierarchy.
   *
   * @public
   * @param {Object} stateObject - the stateObject to validate against
   * @param {boolean} toAssert - whether or not to assert when invalid
   * @param {string[]} publicSchemaKeys - to be populated with any public keys this StateSchema is responsible for
   * @param {string[]} privateSchemaKeys - to be populated with any private keys this StateSchema is responsible for
   * @returns {boolean|null} boolean if validity can be checked, null if valid, but next in the hierarchy is needed
   */
  checkStateObjectValid( stateObject, toAssert, publicSchemaKeys, privateSchemaKeys ) {
    if ( this.isComposite() ) {
      const schema = this.compositeSchema;

      let valid = null;
      const checkLevel = ( schemaLevel, objectLevel, keyList, exclude ) => {
        Object.keys( schemaLevel ).filter( k => k !== exclude ).forEach( key => {

          const validKey = objectLevel.hasOwnProperty( key );
          if ( !validKey ) {
            valid = false;
          }
          assert && toAssert && assert( validKey, `${key} in state schema but not in the state object` );
          schemaLevel[ key ].validateStateObject( objectLevel[ key ] );
          keyList.push( key );
        } );
      };

      checkLevel( schema, stateObject, publicSchemaKeys, '_private' );
      schema._private && checkLevel( schema._private, stateObject._private, privateSchemaKeys, null );
      return valid;
    }
    else {
      if ( toAssert ) {
        validate( stateObject, this.validator );
      }
      return ValidatorDef.isValueValid( stateObject, this.validator );
    }
  }

  /**
   * Get a list of all IOTypes associated with this StateSchema
   * @public
   * @returns {IOType[]}
   */
  getRelatedTypes() {
    const relatedTypes = [];

    // to support IOTypes from public and private state
    const getRelatedStateTypeForLevel = stateSchema => {
      Object.keys( stateSchema ).forEach( stateSchemaKey => {

        // Support keywords in state like "private"
        stateSchema[ stateSchemaKey ] instanceof IOType && relatedTypes.push( stateSchema[ stateSchemaKey ] );
      } );
    };

    if ( this.compositeSchema ) {
      getRelatedStateTypeForLevel( this.compositeSchema );
      this.compositeSchema._private && getRelatedStateTypeForLevel( this.compositeSchema._private );
    }
    return relatedTypes;
  }


  /**
   * Returns a unique identified for this stateSchema, or an object of the stateSchemas for each sub-component in the composite
   * @public (phet-io internal)
   * @returns {string|Object.<string,string|Object>}
   */
  getStateSchemaAPI() {
    if ( this.isComposite() ) {
      const stateSchemaAPI = _.mapValues( this.compositeSchema, value => value.typeName );
      if ( this.compositeSchema._private ) {
        stateSchemaAPI._private = _.mapValues( this.compositeSchema._private, value => value.typeName );
      }
      return stateSchemaAPI;
    }
    else {
      return this.displayString;
    }
  }


  /**
   * Factory function for StateSchema instances that represent a single value of state. This is opposed to a composite
   * schema of sub-components.
   * @param displayString
   * @param validator
   * @public
   * @returns {StateSchema}
   */
  static asValue( displayString, validator ) {
    return new StateSchema( {
      validator: validator,
      displayString: displayString
    } );
  }
}

tandemNamespace.register( 'StateSchema', StateSchema );
export default StateSchema;