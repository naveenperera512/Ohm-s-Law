// Copyright 2020, University of Colorado Boulder

/**
 * QUnit tests for ScreenSelector
 *
 * @author Chris Klusendorf (PhET Interactive Simulations)
 */

import selectScreens from './selectScreens.js';

// test screen constants
const a = 'a';
const b = 'b';
const c = 'c';
const hs = 'hs';

const getQueryParameterValues = queryString => {

  // TODO: Get schema from initialize-globals.js instead of duplicating here, see https://github.com/phetsims/chipper/issues/936
  return QueryStringMachine.getAllForString( {

    homeScreen: {
      type: 'boolean',
      defaultValue: true
    },

    initialScreen: {
      type: 'number',
      defaultValue: 0
    },

    screens: {
      type: 'array',
      elementSchema: {
        type: 'number'
      },
      defaultValue: null,
      isValidValue: function( value ) {
        return value === null || ( value.length === _.uniq( value ).length );
      }
    }

  }, queryString );
};

/**
 * Formats a message for each testValidScreenSelector result
 *
 * @param {string} key
 * @param {Object} expectedResult
 * @param {Object} result
 * @param {string} description
 * @returns {string}
 */
const formatMessage = ( key, expectedResult, result, description ) =>
  `expected ${key}: ${expectedResult[ key ]}, actual ${key}: ${result[ key ]} for valid selectScreens test ${description}`;

/**
 * Format the query string + all sim screens to uniquely identify the test.
 * @param {string} queryString
 * @param {Object[]} allSimScreens
 * @returns {string}
 */
const getDescription = ( queryString, allSimScreens ) => `${queryString} ${JSON.stringify( allSimScreens )}`;

QUnit.test( 'valid selectScreens', async assert => {

  /**
   * Tests a valid combination of allSimScreens and screens-related query parameters, where the expectedResult should
   * equal the result returned from ScreenSelector.select
   *
   * @param {string} queryString
   * @param {Object[]} allSimScreens
   * @param {Object} expectedResult, see selectScreens @returns for doc
   */
  const testValidScreenSelector = ( queryString, allSimScreens, expectedResult ) => {
    const queryParameterValues = getQueryParameterValues( queryString );

    const result = selectScreens(
      allSimScreens,
      queryParameterValues.homeScreen,
      QueryStringMachine.containsKeyForString( 'homeScreen', queryString ),
      queryParameterValues.initialScreen,
      QueryStringMachine.containsKeyForString( 'initialScreen', queryString ),
      queryParameterValues.screens,
      QueryStringMachine.containsKeyForString( 'screens', queryString ),
      simScreens => hs,
      queryString
    );

    const description = getDescription( queryString, allSimScreens );

    // test the four return values from selectScreens
    assert.ok( result.homeScreen === expectedResult.homeScreen,
      formatMessage( 'homeScreen', expectedResult, result, description ) );
    assert.ok( result.initialScreen === expectedResult.initialScreen,
      formatMessage( 'initialScreen', expectedResult, result, description ) );
    assert.ok( _.isEqual( result.selectedSimScreens, expectedResult.selectedSimScreens ),
      formatMessage( 'selectedSimScreens', expectedResult, result, description ) );
    assert.ok( _.isEqual( result.screens, expectedResult.screens ),
      formatMessage( 'screens', expectedResult, result, description ) );

    assert.ok( _.isEqual( result.allScreensCreated, expectedResult.allScreensCreated ),
      formatMessage( 'allScreensCreated', expectedResult, result, description ) );
  };

  // multi-screen
  testValidScreenSelector( '?screens=1', [ a, b ], {
    homeScreen: null,
    initialScreen: a,
    selectedSimScreens: [ a ],
    screens: [ a ],
    allScreensCreated: false
  } );
  testValidScreenSelector( '?screens=2', [ a, b ], {
    homeScreen: null,
    initialScreen: b,
    selectedSimScreens: [ b ],
    screens: [ b ],
    allScreensCreated: false
  } );
  testValidScreenSelector( '?screens=1,2', [ a, b ], {
    homeScreen: hs,
    initialScreen: hs,
    selectedSimScreens: [ a, b ],
    screens: [ hs, a, b ],
    allScreensCreated: true
  } );
  testValidScreenSelector( '?screens=2,1', [ a, b ], {
    homeScreen: hs,
    initialScreen: hs,
    selectedSimScreens: [ b, a ],
    screens: [ hs, b, a ],
    allScreensCreated: true
  } );
  testValidScreenSelector( '?homeScreen=false', [ a, b ], {
    homeScreen: null,
    initialScreen: a,
    selectedSimScreens: [ a, b ],
    screens: [ a, b ],
    allScreensCreated: false
  } );
  testValidScreenSelector( '?screens=2,1', [ a, b, c ], {
    homeScreen: hs,
    initialScreen: hs,
    selectedSimScreens: [ b, a ],
    screens: [ hs, b, a ],
    allScreensCreated: false
  } );
  testValidScreenSelector( '?screens=3,1', [ a, b, c ], {
    homeScreen: hs,
    initialScreen: hs,
    selectedSimScreens: [ c, a ],
    screens: [ hs, c, a ],
    allScreensCreated: false
  } );
  testValidScreenSelector( '?screens=2,3', [ a, b, c ], {
    homeScreen: hs,
    initialScreen: hs,
    selectedSimScreens: [ b, c ],
    screens: [ hs, b, c ],
    allScreensCreated: false
  } );
  testValidScreenSelector( '?initialScreen=1&homeScreen=false&screens=2,1', [ a, b ], {
    homeScreen: null,
    initialScreen: a,
    selectedSimScreens: [ b, a ],
    screens: [ b, a ],
    allScreensCreated: false
  } );
  testValidScreenSelector( '?initialScreen=0&homeScreen=true&screens=2,1', [ a, b ], {
    homeScreen: hs,
    initialScreen: hs,
    selectedSimScreens: [ b, a ],
    screens: [ hs, b, a ],
    allScreensCreated: true
  } );
  testValidScreenSelector( '?initialScreen=1&homeScreen=true&screens=2,1', [ a, b ], {
    homeScreen: hs,
    initialScreen: a,
    selectedSimScreens: [ b, a ],
    screens: [ hs, b, a ],
    allScreensCreated: true
  } );
  testValidScreenSelector( '?initialScreen=2&homeScreen=true&screens=1,2', [ a, b ], {
    homeScreen: hs,
    initialScreen: b,
    selectedSimScreens: [ a, b ],
    screens: [ hs, a, b ],
    allScreensCreated: true
  } );
  testValidScreenSelector( '?initialScreen=1&homeScreen=false&screens=1', [ a, b ], {
    homeScreen: null,
    initialScreen: a,
    selectedSimScreens: [ a ],
    screens: [ a ],
    allScreensCreated: false
  } );
  testValidScreenSelector( '?initialScreen=2&homeScreen=false&screens=2', [ a, b ], {
    homeScreen: null,
    initialScreen: b,
    selectedSimScreens: [ b ],
    screens: [ b ],
    allScreensCreated: false
  } );

  // single-screen
  // Like ph-scale-basics_en.html?screens=1
  testValidScreenSelector( '?screens=1', [ a ], {
    homeScreen: null,
    initialScreen: a,
    selectedSimScreens: [ a ],
    screens: [ a ],
    allScreensCreated: true
  } );
  testValidScreenSelector( '?initialScreen=1', [ a ], {
    homeScreen: null,
    initialScreen: a,
    selectedSimScreens: [ a ],
    screens: [ a ],
    allScreensCreated: true
  } );
  testValidScreenSelector( '?homeScreen=false', [ a ], {
    homeScreen: null,
    initialScreen: a,
    selectedSimScreens: [ a ],
    screens: [ a ],
    allScreensCreated: true
  } );
} );

QUnit.test( 'invalid selectScreens', async assert => {

  assert.ok( true, 'At least one assert must run, even if not running with ?ea' );

  /**
   * Tests an invalid combination of allSimScreens and screens-related query parameters, where selectScreens should
   * throw an error
   *
   * @param {string} queryString
   * @param {Object[]} allSimScreens
   */
  const testInvalidScreenSelector = ( queryString, allSimScreens ) => {
    const queryParameterValues = getQueryParameterValues( queryString );
    const description = getDescription( queryString, allSimScreens );

    window.assert && assert.throws( () => {
      selectScreens(
        allSimScreens,
        queryParameterValues.homeScreen,
        QueryStringMachine.containsKeyForString( 'homeScreen', queryString ),
        queryParameterValues.initialScreen,
        QueryStringMachine.containsKeyForString( 'initialScreen', queryString ),
        queryParameterValues.screens,
        QueryStringMachine.containsKeyForString( 'screens', queryString ),
        simScreens => hs,
        queryString
      );
    }, `expected error for invalid selectScreens test ${description}` );
  };

  // multi-screen
  testInvalidScreenSelector( '?screens=0', [ a, b ] );
  testInvalidScreenSelector( '?screens=3', [ a, b ] );
  testInvalidScreenSelector( '?screens=', [ a, b ] );
  testInvalidScreenSelector( '?initialScreen=0&homeScreen=true&screens=1', [ a, b ] );
  testInvalidScreenSelector( '?initialScreen=0&homeScreen=false&screens=0', [ a, b ] );
  testInvalidScreenSelector( '?initialScreen=0&homeScreen=false&screens=2,1', [ a, b ] );
  testInvalidScreenSelector( '?initialScreen=0&homeScreen=false&screens=1', [ a, b ] );
  testInvalidScreenSelector( '?initialScreen=2&homeScreen=false&screens=1', [ a, b ] );

  // Like ph-scale_en.html?screens=1,4
  testInvalidScreenSelector( '?screens=1,4', [ a, b, c ] );

  // single-screen
  testInvalidScreenSelector( '?initialScreen=0', [ a ] );
  testInvalidScreenSelector( '?initialScreen=2', [ a ] );
  testInvalidScreenSelector( '?homeScreen=true', [ a ] );
  testInvalidScreenSelector( '?screens=0', [ a ] );
  testInvalidScreenSelector( '?screens=2', [ a ] );

  testInvalidScreenSelector( '?screens=2', [ a ] );

  // These contain errors, display warning dialog, and revert to default.
  // like ph-scale-basics_en.html?screens=2,1
  testInvalidScreenSelector( '?screens=2,1', [ a ] );
} );