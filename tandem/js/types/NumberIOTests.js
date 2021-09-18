// Copyright 2021, University of Colorado Boulder

/**
 * Unit tests for NumberIO
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import NumberIO from './NumberIO.js';

QUnit.module( 'NumberIO' );

QUnit.test( 'serialization', assert => {

  assert.ok( NumberIO.toStateObject( 5 ) === 5, 'simple case' );

  assert.ok( NumberIO.toStateObject( Number.POSITIVE_INFINITY ) === 'POSITIVE_INFINITY', 'serialization positive infinity' );
  assert.ok( NumberIO.toStateObject( Number.NEGATIVE_INFINITY ) === 'NEGATIVE_INFINITY', 'serialization negative infinity' );

  assert.ok( NumberIO.fromStateObject( NumberIO.toStateObject( Number.POSITIVE_INFINITY ) ) === Number.POSITIVE_INFINITY, 'deserialization positive infinity' );
  assert.ok( NumberIO.fromStateObject( NumberIO.toStateObject( Number.NEGATIVE_INFINITY ) ) === Number.NEGATIVE_INFINITY, 'deserialization negative infinity' );

  window.assert && assert.throws( () => {
    NumberIO.toStateObject( 4 * 'oh hello' );
  } );
  window.assert && assert.throws( () => {
    NumberIO.toStateObject( 'oh hello' );
  } );
} );
