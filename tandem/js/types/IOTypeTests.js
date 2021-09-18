// Copyright 2021, University of Colorado Boulder

/**
 * Unit tests for IOType
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import merge from '../../../phet-core/js/merge.js';
import PhetioObject from '../PhetioObject.js';
import Tandem from '../Tandem.js';
import IOType from './IOType.js';
import NumberIO from './NumberIO.js';
import StateSchema from './StateSchema.js';

QUnit.module( 'IOType' );

QUnit.test( 'always true', assert => {
  assert.ok( true, 'initial test' );
} );

if ( Tandem.PHET_IO_ENABLED ) {
  QUnit.test( 'fromCoreType', assert => {

    window.assert && assert.throws( () => {
      return new IOType();
    }, 'need args in config' );

    class XHolder extends PhetioObject {
      constructor( x ) {
        super( {
          phetioType: XHolderIO,

          tandem: Tandem.ROOT_TEST.createTandem( 'xHolder' )
        } );
        this.x = x;
      }

      /**
       * @public
       */
      static get STATE_SCHEMA() {
        return {
          x: NumberIO
        };
      }
    }

    const XHolderIO = IOType.fromCoreType( 'XHolderIO', XHolder );

    const xHolder = new XHolder( 4 );
    const stateObject = XHolderIO.toStateObject( xHolder );
    assert.ok( stateObject, 'should be defined' );
    assert.ok( stateObject.x === 4, 'should be right number from stateSchema' );
    XHolderIO.applyState( xHolder, { x: 7 } );
    assert.ok( xHolder.x === 7, 'applyState should be right number' );

    xHolder.dispose();

    ///////////////////////////////////////////////////////////////

    class ParticularParticle extends PhetioObject {
      constructor( options ) {
        options = merge( {
          phetioType: ParticularParticleIO

        }, options );
        super( options );
      }

      /**
       * @public
       */
      static get STATE_SCHEMA() {
        return StateSchema.asValue( 'particularParticle', { isValidValue: value => value === 'particularParticle' } );
      }
    }

    window.assert && assert.throws( () => {
      return IOType.fromCoreType( 'ParticularParticleIO', ParticularParticle );
    }, 'no toStateObject on value StateSchema\'ed IOType.' );

    ParticularParticle.prototype.toStateObject = () => 'particularParticle';

    const ParticularParticleIO = IOType.fromCoreType( 'ParticularParticleIO', ParticularParticle );
    const particularParticle = new ParticularParticle( {
      tandem: Tandem.ROOT_TEST.createTandem( 'particularParticle1' )
    } );

    assert.ok( ParticularParticleIO.toStateObject( particularParticle ) === 'particularParticle', 'serialization should work for value stateSchema' );
    particularParticle.dispose();

  } );

  QUnit.test( 'fromCoreType with Class hierarchy', assert => {

    class Parent extends PhetioObject {
      constructor( parentNumber, options ) {
        options = merge( {

          phetioType: ParentIO,

          tandem: Tandem.ROOT_TEST.createTandem( 'parent' )

        }, options );
        super( options );
        this.parentNumber = parentNumber;
      }

      /**
       * @public
       */
      static get STATE_SCHEMA() {
        return {
          parentNumber: NumberIO
        };
      }
    }

    class Child extends Parent {
      constructor( childNumber ) {
        super( 10, {
          phetioType: ChildIO,

          tandem: Tandem.ROOT_TEST.createTandem( 'child' )
        } );

        this.childNumber = childNumber;
      }

      /**
       * @public
       */
      static get STATE_SCHEMA() {
        return {
          childNumber: NumberIO
        };
      }
    }

    const ParentIO = IOType.fromCoreType( 'ParentIO', Parent );
    const ChildIO = IOType.fromCoreType( 'ChildIO', Child );

    const child = new Child( 4 );
    const parentStateObject = ParentIO.toStateObject( child );
    assert.ok( parentStateObject.parentNumber === 10, 'simple case, treated as parent' );

    const childStateObject = ChildIO.toStateObject( child );
    assert.ok( childStateObject.childNumber === 4, 'simple case, treated as child' );

    // This does not work. Instead, you have to manually create a toStateObject in ChildIO that calls up to the parent.
    // assert.ok( childStateObject.parentNumber === 10, 'oh boy' );

    child.dispose();
  } );
}
