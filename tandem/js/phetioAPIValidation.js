// Copyright 2019-2021, University of Colorado Boulder

/**
 * This singleton is responsible for ensuring that the PhET-iO API is correct through the lifetime of the simulation.
 * The PhET-iO API is defined through multiple preloaded files. The "elements baseline" API holds an exact match of
 * what PhetioObject instances/metadata the sim should create on startup, where the "elements overrides" file is a
 * sparse list that can overwrite metadata without changing the code. See `grunt generate-phet-io-api` for
 * more information. The complete list of checks was decided on in https://github.com/phetsims/phet-io/issues/1453
 * (and later trimmed down) and is as follows:
 *
 * 1. After startup, only dynamic instances prescribed by the baseline API can be registered.
 * 2. Any static, registered PhetioObject can never be deregistered.
 * 3. Any schema entries in the overrides file must exist in the baseline API
 * 4. Any schema entries in the overrides file must be different from its baseline counterpart
 * 5. Dynamic element metadata should match the archetype in the API.
 *
 * Terminology:
 * schema: specified through preloads. The full schema is the baseline plus the overrides, but those parts can be
 *         referred to separately.
 * registered: the process of instrumenting a PhetioObject and it "becoming" a PhET-iO Element on the wrapper side.
 * static PhetioObject: A registered PhetioObject that exists for the lifetime of the sim. It should not be removed
 *                      (even intermittently) and must be created during startup so that it is immediately interoperable.
 * dynamic PhetioObject: A registered PhetioObject that can be created and/or destroyed at any point. Only dynamic
 *                       PhetioObjects can be created after startup.
 *
 * See https://github.com/phetsims/phet-io/issues/1443#issuecomment-484306552 for an explanation of how to maintain the
 * PhET-iO API for a simulation.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 * @author Chris Klusendorf (PhET Interactive Simulations)
 */

import DynamicTandem from './DynamicTandem.js';
import Tandem from './Tandem.js';
import tandemNamespace from './tandemNamespace.js';

// constants
// The API-tracked and validated metadata keys
const KEYS_TO_CHECK = [
  'phetioDynamicElement',
  'phetioEventType',
  'phetioIsArchetype',
  'phetioPlayback',
  'phetioReadOnly',
  'phetioState',
  'phetioTypeName'
];

class PhetioAPIValidation {

  constructor() {

    /**
     * {Object[]} - Each object holds a single "API mismatch" with the following keys:
     *                phetioID: {string}
     *                stack: {string} - for a stack trace
     *                ruleInViolation: {string} - one of the numbered list in the header doc.
     *                [message]: {string} - specific problem
     *
     * Feel free to add any other JSONifyable keys to this to make the error more clear! All mismatches are printed
     * at once for clarity, see PhetioEngine.
     * @private
     */
    this.apiMismatches = [];

    // @private - keep track of when the sim has started.
    this.simHasStarted = false;

    // @public {boolean} - settable by qunitStart.js. Validation is only enabled when all screens are present.
    this.enabled = assert && Tandem.VALIDATION;

    // @private {Object.<typeName:string, IOType>} - this must be all phet-io types so that the
    // following would fail: add a phetioType, then remove it, then add a different one under the same typeName.
    // A Note about memory: Every IOType that is loaded as a module is already loaded on the namespace. Therefore
    // this map doesn't add any memory by storing these. The exception to this is parametric IOTypes. It should be
    // double checked that anything being passed into a parametric type is memory safe. As of this writing, only IOTypes
    // are passed to parametric IOTypes, so this pattern remains memory leak free. Furthermore, this list is only
    // populated when `this.enabled`.
    this.everyPhetioType = {};
  }

  /**
   * Callback when the simulation is ready to go, and all static PhetioObjects have been created.
   * @param {PhetioEngine} phetioEngine
   * @public
   */
  onSimStarted( phetioEngine ) {
    this.simHasStarted = true;
    if ( this.enabled && phet.joist.sim.allScreensCreated ) {
      this.validateOverridesFile();
    }
  }

  /**
   * Checks if a removed phetioObject is part of a Group
   * @param {PhetioObject} phetioObject
   * @public
   */
  onPhetioObjectRemoved( phetioObject ) {
    if ( !this.enabled ) {
      return;
    }

    const phetioID = phetioObject.tandem.phetioID;

    // if it isn't dynamic, then it shouldn't be removed during the lifetime of the sim.
    if ( !phetioObject.phetioDynamicElement ) {
      this.assertAPIError( {
        phetioID: phetioID,
        ruleInViolation: '2. Any static, registered PhetioObject can never be deregistered.'
      } );
    }
  }

  /**
   * Should be called from phetioEngine when a PhetioObject is added to the PhET-iO
   * @param {PhetioObject} phetioObject
   * @public
   */
  onPhetioObjectAdded( phetioObject ) {
    if ( !this.enabled ) {
      return;
    }

    const newPhetioType = phetioObject.phetioType;
    const oldPhetioType = this.everyPhetioType[ newPhetioType.typeName ];

    if ( !oldPhetioType ) { // This may not be necessary, but may be helpful so that we don't overwrite if rule 10 is in violation
      this.everyPhetioType[ newPhetioType.typeName ] = newPhetioType;
    }

    if ( this.simHasStarted ) {

      // Here we need to kick this validation to the next frame to support construction in any order. Parent first, or
      // child first. Use namespace to avoid because timer is a PhetioObject.
      phet.axon.animationFrameTimer.runOnNextTick( () => {

        // The only instances that it's OK to create after startup are "dynamic instances" which are marked as such.
        if ( !phetioObject.phetioDynamicElement ) {
          this.assertAPIError( {
            phetioID: phetioObject.tandem.phetioID,
            ruleInViolation: '1. After startup, only dynamic instances prescribed by the baseline file can be registered.'
          } );
        }
        else {

          // Compare the dynamic element to the archetype if creating them this runtime.
          if ( phet.preloads.phetio.createArchetypes ) {
            const archetypeID = phetioObject.tandem.getArchetypalPhetioID();
            const archetypeMetadata = phet.phetio.phetioEngine.getPhetioObject( archetypeID ).getMetadata();

            // Compare to the simulation-defined archetype
            checkDynamicInstanceAgainstArchetype( this, phetioObject, archetypeMetadata, 'simulation archetype' );
          }
        }
      } );
    }
  }

  /**
   * @private
   */
  validateOverridesFile() {

    // import phetioEngine causes a cycle and cannot be used, hence we must use the namespace
    const entireBaseline = phet.phetio.phetioEngine.getPhetioElementsBaseline();

    for ( const phetioID in window.phet.preloads.phetio.phetioElementsOverrides ) {
      const isArchetype = phetioID.indexOf( DynamicTandem.DYNAMIC_ARCHETYPE_NAME ) >= 0;
      if ( !phet.preloads.phetio.createArchetypes && !entireBaseline.hasOwnProperty( phetioID ) ) {
        assert && assert( isArchetype, `phetioID missing from the baseline that was not an archetype: ${phetioID}` );
      }
      else {
        if ( !entireBaseline.hasOwnProperty( phetioID ) ) {
          this.assertAPIError( {
            phetioID: phetioID,
            ruleInViolation: '3. Any schema entries in the overrides file must exist in the baseline file.',
            message: 'phetioID expected in the baseline file but does not exist'
          } );
        }
        else {

          const override = window.phet.preloads.phetio.phetioElementsOverrides[ phetioID ];
          const baseline = entireBaseline[ phetioID ];

          if ( Object.keys( override ).length === 0 ) {
            this.assertAPIError( {
              phetioID: phetioID,
              ruleInViolation: '4. Any schema entries in the overrides file must be different from its baseline counterpart.',
              message: 'no metadata keys found for this override.'
            } );
          }

          for ( const metadataKey in override ) {
            if ( !baseline.hasOwnProperty( metadataKey ) ) {
              this.assertAPIError( {
                phetioID: phetioID,
                ruleInViolation: '8. Any schema entries in the overrides file must be different from its baseline counterpart.',
                message: `phetioID metadata key not found in the baseline: ${metadataKey}`
              } );
            }

            if ( override[ metadataKey ] === baseline[ metadataKey ] ) {
              this.assertAPIError( {
                phetioID: phetioID,
                ruleInViolation: '8. Any schema entries in the overrides file must be different from its baseline counterpart.',
                message: 'phetioID metadata override value is the same as the corresponding metadata value in the baseline.'
              } );
            }
          }
        }
      }
    }
  }

  /**
   * Assert out the failed API validation rule.
   * @param {Object} apiErrorObject - see doc for this.apiMismatches
   * @private
   */
  assertAPIError( apiErrorObject ) {

    const mismatchMessage = apiErrorObject.phetioID ? `${apiErrorObject.phetioID}:  ${apiErrorObject.ruleInViolation}` :
                            `${apiErrorObject.ruleInViolation}`;

    console.log( 'error data:', apiErrorObject );
    assert && assert( false, `PhET-iO API error:\n${mismatchMessage}` );
  }
}

/**
 * Compare a dynamic phetioObject's metadata to the expected metadata
 * @param {phetioAPIValidation} phetioAPIValidation
 * @param {PhetioObject} phetioObject
 * @param {Object} archetypeMetadata - from an archetype of the dynamic element
 * @param {string} source - where the archetype came from, for debugging
 */
const checkDynamicInstanceAgainstArchetype = ( phetioAPIValidation, phetioObject, archetypeMetadata, source ) => {
  const actualMetadata = phetioObject.getMetadata();
  KEYS_TO_CHECK.forEach( key => {

    // These attributes are different for archetype vs actual
    if ( key !== 'phetioDynamicElement' && key !== 'phetioArchetypePhetioID' && key !== 'phetioIsArchetype' ) {

      if ( archetypeMetadata[ key ] !== actualMetadata[ key ] ) {
        phetioAPIValidation.assertAPIError( {
          phetioID: phetioObject.tandem.phetioID,
          ruleInViolation: '5. Dynamic element metadata should match the archetype in the API.',
          source: source,
          message: `mismatched metadata: ${key}`
        } );
      }
    }
  } );
};

const phetioAPIValidation = new PhetioAPIValidation();
tandemNamespace.register( 'phetioAPIValidation', phetioAPIValidation );
export default phetioAPIValidation;