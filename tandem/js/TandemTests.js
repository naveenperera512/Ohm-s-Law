// Copyright 2020-2021, University of Colorado Boulder

/**
 * Unit tests for PhetioObject
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import NumberProperty from '../../axon/js/NumberProperty.js';
import Tandem from './Tandem.js';

QUnit.module( 'Tandem' );

QUnit.test( 'Tandem validation on ROOT', assert => {

  let p = new NumberProperty( 0, {
    tandem: Tandem.ROOT_TEST.createTandem( 'aProperty' )
  } );
  assert.ok( p.isPhetioInstrumented(), 'should be instrumented' );

  p = new NumberProperty( 0, {
    tandem: Tandem.ROOT_TEST.createTandem( 'bProperty' )
  } );
  assert.ok( p.isPhetioInstrumented(), 'should be instrumented' );

  p = new NumberProperty( 0, {
    tandem: Tandem.ROOT_TEST.createTandem( 'cProperty' )
  } );
  assert.ok( p.isPhetioInstrumented(), 'should be instrumented' );

  // Only specific tandems allowed on root when validating tandems
  window.assert && Tandem.VALIDATION && assert.throws( () => {
    p = new NumberProperty( 0, {
      tandem: Tandem.ROOT.createTandem( 'aProperty' ) // Should fail because aProperty is not allowed on ROOT Tandem
    } );
  } );
} );